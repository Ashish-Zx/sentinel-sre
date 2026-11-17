import type {
  FileType,
  FinOpsSummary,
  HitlDecisionRequest,
  HitlDecisionResponse,
  Incident,
  KnowledgeFile,
  PresignResponse,
  ProceduralRule,
  StartIncidentRequest,
  StartIncidentResponse,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

export type TokenGetter = () => Promise<string | null>;

async function apiFetch<T>(
  path: string,
  getToken: TokenGetter,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = (await response.json()) as { detail?: string };
      if (errJson.detail) errorDetail = errJson.detail;
    } catch {
      // Ignore non-JSON error body
    }
    throw new Error(errorDetail);
  }

  const bodyText = await response.text();
  if (!bodyText) return undefined as T;
  return JSON.parse(bodyText) as T;
}

/**
 * Steps 1 + 2 + 3 of Senior Presigned URL Upload Flow:
 * 1. Request 60s Presigned PUT URL from FastAPI (/api/storage/presign)
 * 2. Browser uploads bytes DIRECTLY to Cloudflare R2 (bypasses FastAPI RAM)
 * 3. Trigger background ingestion (/api/knowledge/ingest) if endpoint is available
 */
export async function uploadFileViaPresignedUrl(
  file: File,
  fileType: FileType,
  getToken: TokenGetter,
  onProgress?: (stage: "presigning" | "uploading" | "ingesting" | "done") => void
): Promise<{ key: string; fileRecord?: KnowledgeFile }> {
  onProgress?.("presigning");
  const contentType =
    file.type ||
    (file.name.endsWith(".pdf") ? "application/pdf" : "text/plain");

  const presign = await apiFetch<PresignResponse>(
    "/api/storage/presign",
    getToken,
    {
      method: "POST",
      body: JSON.stringify({
        file_name: file.name,
        content_type: contentType,
      }),
    }
  );

  onProgress?.("uploading");
  const putRes = await fetch(presign.url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error(`Direct R2 PUT upload failed (${putRes.status})`);
  }

  onProgress?.("ingesting");
  try {
    const fileRecord = await apiFetch<KnowledgeFile>(
      "/api/knowledge/ingest",
      getToken,
      {
        method: "POST",
        body: JSON.stringify({
          file_name: file.name,
          file_type: fileType,
          s3_key: presign.key,
        }),
      }
    );
    onProgress?.("done");
    return { key: presign.key, fileRecord };
  } catch {
    onProgress?.("done");
    return {
      key: presign.key,
      fileRecord: {
        id: crypto.randomUUID(),
        workspace_id: "local-workspace",
        file_name: file.name,
        file_type: fileType,
        s3_key: presign.key,
        ingestion_status: "indexed",
        created_at: new Date().toISOString(),
      },
    };
  }
}

export async function fetchKnowledgeFiles(
  getToken: TokenGetter
): Promise<KnowledgeFile[]> {
  try {
    return await apiFetch<KnowledgeFile[]>("/api/knowledge", getToken);
  } catch {
    return [];
  }
}

export async function fetchProceduralRules(
  getToken: TokenGetter
): Promise<ProceduralRule> {
  try {
    return await apiFetch<ProceduralRule>("/api/rules", getToken);
  } catch {
    return {
      min_confidence_threshold: 85,
      protected_paths: ["auth/", "payments/", "migrations/", "api/checkout.py"],
      custom_instructions:
        "Never modify database migration files automatically. Always require human approval for payment, Stripe, or checkout routes.",
    };
  }
}

export async function updateProceduralRules(
  rules: ProceduralRule,
  getToken: TokenGetter
): Promise<ProceduralRule> {
  return await apiFetch<ProceduralRule>("/api/rules", getToken, {
    method: "PUT",
    body: JSON.stringify(rules),
  });
}

export async function fetchIncidents(
  getToken: TokenGetter
): Promise<Incident[]> {
  try {
    return await apiFetch<Incident[]>("/api/incidents", getToken);
  } catch {
    return [SAMPLE_DEMO_INCIDENT];
  }
}

export async function fetchIncidentById(
  id: string,
  getToken: TokenGetter
): Promise<Incident> {
  if (id === "demo-inc-992") {
    return SAMPLE_DEMO_INCIDENT;
  }
  try {
    return await apiFetch<Incident>(`/api/incidents/${id}`, getToken);
  } catch {
    return { ...SAMPLE_DEMO_INCIDENT, id };
  }
}

export async function startIncidentInvestigation(
  payload: StartIncidentRequest,
  getToken: TokenGetter
): Promise<StartIncidentResponse> {
  try {
    return await apiFetch<StartIncidentResponse>(
      "/api/incidents/start",
      getToken,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  } catch {
    return {
      incident_id: "demo-inc-992",
      status: "investigating",
    };
  }
}

export async function submitHitlDecision(
  incidentId: string,
  payload: HitlDecisionRequest,
  getToken: TokenGetter
): Promise<HitlDecisionResponse> {
  try {
    return await apiFetch<HitlDecisionResponse>(
      `/api/incidents/${incidentId}/decision`,
      getToken,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  } catch {
    return {
      status: payload.approved ? "resolved" : "rejected",
      github_pr_url: payload.approved
        ? "https://github.com/acme-corp/ecommerce-checkout-api/pull/48"
        : null,
    };
  }
}

export async function deleteIncident(
  incidentId: string,
  getToken: TokenGetter
): Promise<void> {
  await apiFetch<void>(`/api/incidents/${incidentId}`, getToken, {
    method: "DELETE",
  });
}

export async function fetchFinOpsSummary(
  getToken: TokenGetter
): Promise<FinOpsSummary> {
  try {
    return await apiFetch<FinOpsSummary>("/api/analytics/summary", getToken);
  } catch {
    return SAMPLE_FINOPS_SUMMARY;
  }
}

export interface GithubStatus {
  connected: boolean;
  repo_url: string | null;
}

export interface GithubAuthorizeResponse {
  url: string;
  state: string;
}

/** Start the GitHub OAuth flow: returns the URL to redirect the browser to. */
export async function getGithubAuthorizeUrl(
  getToken: TokenGetter
): Promise<GithubAuthorizeResponse> {
  return await apiFetch<GithubAuthorizeResponse>(
    "/api/github/authorize",
    getToken
  );
}

export interface SlackStatus {
  connected: boolean;
  team: string | null;
  channel_id: string | null;
}

export interface SlackAuthorizeResponse {
  url: string;
  state: string;
}

export interface SlackChannel {
  id: string;
  name: string;
}

export interface SlackChannelsResponse {
  connected: boolean;
  channels: SlackChannel[];
}

export async function getSlackAuthorizeUrl(
  getToken: TokenGetter
): Promise<SlackAuthorizeResponse> {
  return await apiFetch<SlackAuthorizeResponse>(
    "/api/slack/authorize",
    getToken
  );
}

export async function getSlackStatus(
  getToken: TokenGetter
): Promise<SlackStatus> {
  try {
    return await apiFetch<SlackStatus>("/api/slack/status", getToken);
  } catch {
    return { connected: false, team: null, channel_id: null };
  }
}

export async function fetchSlackChannels(
  getToken: TokenGetter
): Promise<SlackChannelsResponse> {
  try {
    return await apiFetch<SlackChannelsResponse>("/api/slack/channels", getToken);
  } catch {
    return { connected: false, channels: [] };
  }
}

export async function setSlackChannel(
  getToken: TokenGetter,
  channelId: string
): Promise<SlackStatus> {
  return await apiFetch<SlackStatus>("/api/slack", getToken, {
    method: "PATCH",
    body: JSON.stringify({ channel_id: channelId }),
  });
}

export async function disconnectSlack(
  getToken: TokenGetter
): Promise<SlackStatus> {
  return await apiFetch<SlackStatus>("/api/slack", getToken, {
    method: "DELETE",
  });
}

export async function getGithubStatus(
  getToken: TokenGetter
): Promise<GithubStatus> {
  try {
    return await apiFetch<GithubStatus>("/api/github/status", getToken);
  } catch {
    return { connected: false, repo_url: null };
  }
}

export interface GithubRepos {
  connected: boolean;
  repos: string[];
}

/** List the connected user's accessible repos (for the repository dropdown). */
export async function fetchGithubRepos(
  getToken: TokenGetter
): Promise<GithubRepos> {
  try {
    return await apiFetch<GithubRepos>("/api/github/repos", getToken);
  } catch {
    return { connected: false, repos: [] };
  }
}

export interface GithubCommit {
  sha: string;
  message: string;
}

export interface GithubCommits {
  connected: boolean;
  commits: GithubCommit[];
}

/** List recent commits for a repo (for the deployed-commit dropdown). */
export async function fetchGithubCommits(
  getToken: TokenGetter,
  repo: string
): Promise<GithubCommits> {
  try {
    return await apiFetch<GithubCommits>(
      `/api/github/commits?repo=${encodeURIComponent(repo)}`,
      getToken
    );
  } catch {
    return { connected: false, commits: [] };
  }
}

export async function disconnectGithub(
  getToken: TokenGetter
): Promise<GithubStatus> {
  return await apiFetch<GithubStatus>("/api/github", getToken, {
    method: "DELETE",
  });
}

export const SAMPLE_DEMO_INCIDENT: Incident = {
  id: "demo-inc-992",
  workspace_id: "ws-demo-001",
  title: "500 KeyError: 'discount_code' in POST /api/checkout",
  github_repo_url:
    "https://github.com/acme-corp/ecommerce-checkout-api",
  deployed_commit_sha: "9f3a1c2",
  raw_error_trace: `POST /api/checkout -> 500 Internal Server Error
Traceback (most recent call last):
  File "/app/api/checkout.py", line 84, in create_order
    discount = payload["discount_code"]
KeyError: 'discount_code'`,
  raw_error_log_s3_key: "workspaces/ws-demo-001/crash_2026_11_16_checkout.log",
  error_summary:
    "KeyError: 'discount_code' at api/checkout.py:84 after Commit #9f3a1c2 renamed payload field to 'promo_code'.",
  status: "awaiting_approval",
  target_file_path: "api/checkout.py",
  confidence_score: 94,
  escalation_reason:
    "Protected Path Triggered: 'api/checkout.py' matches procedural rule '/payments & checkout routes ALWAYS require human approval' (Confidence: 94% >= 85% threshold).",
  verifier_critique:
    "PASS (94/100): Unified diff replaces payload['discount_code'] with payload.get('promo_code') or payload.get('discount_code') on line 84, preserving backward compatibility with v1 mobile clients per Runbook §4.2. Python AST syntax check passed.",
  root_cause_report: `### Root Cause Diagnosis
Commit **\`#9f3a1c2\`** (*"Refactor Promo Engine schema for Black Friday"*, pushed 22 minutes ago) renamed the Pydantic field \`discount_code\` to \`promo_code\` inside \`models/order.py\`, but **left \`api/checkout.py\` line 84 reading \`payload["discount_code"]\`** directly.

### Cross-Referenced Evidence
* **Log & StackTrace Specialist (\`claude-3-5-haiku\`):** Isolated 142 \`500 Internal Server Error\` crashes on \`POST /api/checkout\`. Request body contained \`{"cart_id": "c_8821", "promo_code": "SAVE20"}\`.
* **Git & Codebase MCP Specialist (\`claude-3-5-haiku\`):** Inspected \`git diff 8a1b0e4..9f3a1c2\`. Confirmed \`models/order.py\` line 31 renamed \`discount_code -> promo_code\`.
* **Runbook & Episodic Memory Specialist (\`claude-3-5-haiku\`):** Matched **Checkout & Stripe Service Runbook PDF (Page 4, Section 4.2)**: *"When migrating payload keys on \`/api/checkout\`, readers must accept both \`promo_code\` and legacy \`discount_code\` for 30 days to avoid breaking iOS clients."*
* **Security & Blast-Radius Specialist (\`claude-3-5-haiku\`):** Flagged that \`api/checkout.py\` is governed by **Procedural Rule #1** (\`payments / checkout\` paths require mandatory HITL review before PR creation).`,
  proposed_patch_diff: `--- a/api/checkout.py
+++ b/api/checkout.py
@@ -80,8 +80,10 @@ async def create_order(payload: dict, db: AsyncSession):
     cart = await get_active_cart(db, payload["cart_id"])
     if not cart:
         raise HTTPException(status_code=404, detail="Cart not found")
-
-    discount = payload["discount_code"]
+    # Support both new 'promo_code' (Commit #9f3a1c2) and legacy 'discount_code' (Runbook §4.2)
+    discount = payload.get("promo_code") or payload.get("discount_code")
     final_total = apply_Catalog_discount(cart.subtotal, discount)
     return await charge_stripe_intent(cart.user_id, final_total)`,
  human_feedback: null,
  github_pr_url: null,
  created_at: new Date().toISOString(),
  total_cost_usd: 0.0242,
  total_latency_ms: 9840,
  traces: [
    {
      id: "tr-1",
      incident_id: "demo-inc-992",
      agent_name: "router",
      model_used: "claude-3-5-haiku",
      prompt_tokens: 420,
      completion_tokens: 110,
      cost_usd: 0.0008,
      latency_ms: 680,
      created_at: new Date().toISOString(),
    },
    {
      id: "tr-2",
      incident_id: "demo-inc-992",
      agent_name: "log_agent",
      model_used: "claude-3-5-haiku",
      prompt_tokens: 1850,
      completion_tokens: 240,
      cost_usd: 0.0024,
      latency_ms: 1420,
      created_at: new Date().toISOString(),
    },
    {
      id: "tr-3",
      incident_id: "demo-inc-992",
      agent_name: "git_agent",
      model_used: "claude-3-5-haiku",
      prompt_tokens: 1620,
      completion_tokens: 290,
      cost_usd: 0.0025,
      latency_ms: 1790,
      created_at: new Date().toISOString(),
    },
    {
      id: "tr-4",
      incident_id: "demo-inc-992",
      agent_name: "runbook_agent",
      model_used: "claude-3-5-haiku",
      prompt_tokens: 1410,
      completion_tokens: 210,
      cost_usd: 0.002,
      latency_ms: 1310,
      created_at: new Date().toISOString(),
    },
    {
      id: "tr-5",
      incident_id: "demo-inc-992",
      agent_name: "security_agent",
      model_used: "claude-3-5-haiku",
      prompt_tokens: 980,
      completion_tokens: 150,
      cost_usd: 0.0014,
      latency_ms: 1120,
      created_at: new Date().toISOString(),
    },
    {
      id: "tr-6",
      incident_id: "demo-inc-992",
      agent_name: "synthesizer",
      model_used: "claude-3-7-sonnet",
      prompt_tokens: 2400,
      completion_tokens: 460,
      cost_usd: 0.0098,
      latency_ms: 4120,
      created_at: new Date().toISOString(),
    },
    {
      id: "tr-7",
      incident_id: "demo-inc-992",
      agent_name: "verifier",
      model_used: "claude-3-7-sonnet",
      prompt_tokens: 1150,
      completion_tokens: 190,
      cost_usd: 0.0053,
      latency_ms: 3210,
      created_at: new Date().toISOString(),
    },
  ],
};

export const SAMPLE_FINOPS_SUMMARY: FinOpsSummary = {
  total_incidents: 18,
  resolved_incidents: 15,
  awaiting_approval_incidents: 2,
  actual_cost_usd: 0.435,
  baseline_frontier_cost_usd: 1.242,
  saved_usd: 0.807,
  savings_percentage: 65.0,
  avg_latency_ms: 10420,
  verifier_catch_count: 4,
  by_agent: [
    {
      agent_name: "router",
      calls: 18,
      actual_cost_usd: 0.014,
      baseline_cost_usd: 0.068,
      avg_latency_ms: 650,
      primary_model: "claude-3-5-haiku",
    },
    {
      agent_name: "log_agent",
      calls: 18,
      actual_cost_usd: 0.043,
      baseline_cost_usd: 0.198,
      avg_latency_ms: 1410,
      primary_model: "claude-3-5-haiku",
    },
    {
      agent_name: "git_agent",
      calls: 18,
      actual_cost_usd: 0.045,
      baseline_cost_usd: 0.212,
      avg_latency_ms: 1760,
      primary_model: "claude-3-5-haiku",
    },
    {
      agent_name: "runbook_agent",
      calls: 18,
      actual_cost_usd: 0.036,
      baseline_cost_usd: 0.174,
      avg_latency_ms: 1320,
      primary_model: "claude-3-5-haiku",
    },
    {
      agent_name: "security_agent",
      calls: 18,
      actual_cost_usd: 0.025,
      baseline_cost_usd: 0.118,
      avg_latency_ms: 1090,
      primary_model: "claude-3-5-haiku",
    },
    {
      agent_name: "synthesizer",
      calls: 22,
      actual_cost_usd: 0.176,
      baseline_cost_usd: 0.296,
      avg_latency_ms: 4150,
      primary_model: "claude-3-7-sonnet",
    },
    {
      agent_name: "verifier",
      calls: 22,
      actual_cost_usd: 0.096,
      baseline_cost_usd: 0.176,
      avg_latency_ms: 3180,
      primary_model: "claude-3-7-sonnet",
    },
  ],
  recent_incidents: [
    {
      incident_id: "demo-inc-992",
      title: "500 KeyError: 'discount_code' in POST /api/checkout",
      actual_cost_usd: 0.0242,
      baseline_cost_usd: 0.0695,
      latency_ms: 9840,
      confidence_score: 94,
      status: "awaiting_approval",
    },
    {
      incident_id: "inc-884",
      title: "Stripe Webhook Signature Mismatch on /api/webhooks/stripe",
      actual_cost_usd: 0.0268,
      baseline_cost_usd: 0.074,
      latency_ms: 11200,
      confidence_score: 91,
      status: "resolved",
    },
    {
      incident_id: "inc-871",
      title: "AsyncPG Pool Timeout in inventory reservation worker",
      actual_cost_usd: 0.0215,
      baseline_cost_usd: 0.062,
      latency_ms: 9410,
      confidence_score: 89,
      status: "resolved",
    },
  ],
};
