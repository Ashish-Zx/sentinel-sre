"use client";

import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL, fetchIncidentById, type TokenGetter } from "./api";
import type { AgentName, AgentStepState, Incident, SseAgentEvent } from "./types";

const INITIAL_STEPS: AgentStepState[] = [
  {
    agent_name: "router",
    label: "1. Triage & Cost-Aware Router",
    description:
      "Extracts stack trace signature, loads Procedural Memory rules, and fans out 4 parallel specialists via LangGraph Send().",
    tier: "fast",
    status: "pending",
  },
  {
    agent_name: "log_agent",
    label: "2A. Log & StackTrace Specialist",
    description: "Reads crash log from Cloudflare R2 / stack trace, filters noise, isolates offending payload.",
    tier: "fast",
    status: "pending",
  },
  {
    agent_name: "git_agent",
    label: "2B. Git & Codebase Specialist (GitHub MCP)",
    description: "Calls GitHub MCP get_file_contents & list_commits to find recent regressions.",
    tier: "fast",
    status: "pending",
  },
  {
    agent_name: "runbook_agent",
    label: "2C. Runbook & Episodic Memory Specialist",
    description: "Queries pgvector Semantic Memory chunks + past_incidents SQL history.",
    tier: "fast",
    status: "pending",
  },
  {
    agent_name: "security_agent",
    label: "2D. Security & Blast-Radius Specialist",
    description: "Audits target file path against protected_paths (/auth, /payments, migrations).",
    tier: "fast",
    status: "pending",
  },
  {
    agent_name: "synthesizer",
    label: "3. Incident Commander Synthesizer",
    description: "Aggregates all 4 specialist reports, writes cited Root Cause Analysis, and drafts Unified Git Diff.",
    tier: "reasoning",
    status: "pending",
  },
  {
    agent_name: "verifier",
    label: "4. L4 Fresh-Context Verifier Shield",
    description: "Audits raw error + raw file + proposed diff in an isolated zero-history prompt context + Python AST check.",
    tier: "reasoning",
    status: "pending",
  },
];

export function useIncidentWarRoom(incidentId: string, getToken: TokenGetter) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [steps, setSteps] = useState<AgentStepState[]>(INITIAL_STEPS);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const hydrateStepsFromIncident = useCallback((inc: Incident) => {
    if (!inc.traces || inc.traces.length === 0) return;
    setSteps((prev) =>
      prev.map((step) => {
        const trace = inc.traces?.find((t) => t.agent_name === step.agent_name);
        if (!trace) return step;
        return {
          ...step,
          status: "completed",
          model_used: trace.model_used,
          latency_ms: trace.latency_ms,
          cost_usd: trace.cost_usd,
          prompt_tokens: trace.prompt_tokens,
          completion_tokens: trace.completion_tokens,
        };
      })
    );
  }, []);

  const runInteractiveDemoStream = useCallback(async () => {
    setIsStreaming(true);
    setStreamError(null);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending" })));

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const demoData = await fetchIncidentById("demo-inc-992", getToken);

    setIncident({
      ...demoData,
      status: "investigating",
      root_cause_report: null,
      proposed_patch_diff: null,
      confidence_score: null,
    });

    // Step 1: Router
    setSteps((prev) =>
      prev.map((s) => (s.agent_name === "router" ? { ...s, status: "running" } : s))
    );
    await sleep(650);
    setSteps((prev) =>
      prev.map((s) =>
        s.agent_name === "router"
          ? {
              ...s,
              status: "completed",
              model_used: "claude-3-5-haiku",
              latency_ms: 680,
              cost_usd: 0.0008,
              summary: "Extracted KeyError: 'discount_code' at api/checkout.py:84.",
            }
          : s
      )
    );

    // Step 2: 4 parallel specialists
    const parallelAgents: AgentName[] = ["log_agent", "git_agent", "runbook_agent", "security_agent"];
    setSteps((prev) =>
      prev.map((s) => (parallelAgents.includes(s.agent_name) ? { ...s, status: "running" } : s))
    );
    await sleep(900);

    setSteps((prev) =>
      prev.map((s) =>
        s.agent_name === "security_agent"
          ? {
              ...s,
              status: "completed",
              model_used: "claude-3-5-haiku",
              latency_ms: 1120,
              cost_usd: 0.0014,
              summary: "Flagged api/checkout.py under protected rule. Mandatory HITL gate armed.",
            }
          : s.agent_name === "runbook_agent"
            ? {
                ...s,
                status: "completed",
                model_used: "claude-3-5-haiku",
                latency_ms: 1310,
                cost_usd: 0.002,
                summary: "Matched Checkout Runbook PDF §4.2 (pgvector 0.91 similarity).",
              }
            : s
      )
    );
    await sleep(600);
    setSteps((prev) =>
      prev.map((s) =>
        s.agent_name === "log_agent"
          ? {
              ...s,
              status: "completed",
              model_used: "claude-3-5-haiku",
              latency_ms: 1420,
              cost_usd: 0.0024,
              summary: "Isolated 142 HTTP 500 crashes. Payload sends 'promo_code' while line 84 reads 'discount_code'.",
            }
          : s.agent_name === "git_agent"
            ? {
                ...s,
                status: "completed",
                model_used: "claude-3-5-haiku",
                latency_ms: 1790,
                cost_usd: 0.0025,
                summary: "GitHub MCP found Commit #9f3a1c2 renamed 'discount_code' -> 'promo_code'.",
              }
            : s
      )
    );

    // Step 3: Synthesizer
    setSteps((prev) =>
      prev.map((s) => (s.agent_name === "synthesizer" ? { ...s, status: "running" } : s))
    );
    await sleep(1200);
    setSteps((prev) =>
      prev.map((s) =>
        s.agent_name === "synthesizer"
          ? {
              ...s,
              status: "completed",
              model_used: "claude-3-7-sonnet",
              latency_ms: 4120,
              cost_usd: 0.0098,
              summary: "Synthesized Root Cause Report + backward-compatible Unified Git Diff.",
            }
          : s
      )
    );

    // Step 4: Verifier
    setSteps((prev) =>
      prev.map((s) => (s.agent_name === "verifier" ? { ...s, status: "running" } : s))
    );
    await sleep(1000);
    setSteps((prev) =>
      prev.map((s) =>
        s.agent_name === "verifier"
          ? {
              ...s,
              status: "completed",
              model_used: "claude-3-7-sonnet",
              latency_ms: 3210,
              cost_usd: 0.0053,
              summary: "Verified in isolated fresh context: AST valid, resolves KeyError (Confidence: 94%).",
            }
          : s
      )
    );

    setIncident(demoData);
    setIsStreaming(false);
  }, [getToken]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    async function init() {
      const initial = await fetchIncidentById(incidentId, getToken);
      if (!isMounted) return;
      setIncident(initial);
      hydrateStepsFromIncident(initial);

      if (incidentId === "demo-inc-992") {
        return;
      }

      if (initial.status === "investigating") {
        setIsStreaming(true);
        const token = await getToken();
        try {
          await fetchEventSource(
            `${API_BASE_URL}/api/incidents/${incidentId}/stream`,
            {
              method: "GET",
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                Accept: "text/event-stream",
              },
              signal: controller.signal,
              onmessage(ev) {
                if (!ev.data) return;
                const data = JSON.parse(ev.data) as SseAgentEvent;
                if (data.type === "agent_started" && data.agent_name) {
                  setSteps((prev) =>
                    prev.map((s) =>
                      s.agent_name === data.agent_name ? { ...s, status: "running" } : s
                    )
                  );
                } else if (data.type === "agent_completed" && data.agent_name) {
                  setSteps((prev) =>
                    prev.map((s) =>
                      s.agent_name === data.agent_name
                        ? {
                            ...s,
                            status: "completed",
                            model_used: data.model_used,
                            latency_ms: data.latency_ms,
                            cost_usd: data.cost_usd,
                            summary: data.summary,
                          }
                        : s
                    )
                  );
                } else if (data.type === "hitl_paused" || data.type === "incident_resolved") {
                  void fetchIncidentById(incidentId, getToken).then((updated) => {
                    if (isMounted) setIncident(updated);
                  });
                  setIsStreaming(false);
                } else if (data.type === "verifier_result") {
                  setIncident((prev) =>
                    prev
                      ? {
                          ...prev,
                          confidence_score: data.confidence_score ?? prev.confidence_score,
                          verifier_critique: data.verifier_critique ?? prev.verifier_critique,
                        }
                      : prev
                  );
                }
              },
              onerror(err) {
                setStreamError(err instanceof Error ? err.message : "SSE stream disconnected");
                setIsStreaming(false);
                throw err;
              },
            }
          );
        } catch {
          setIsStreaming(false);
        }
      }
    }

    void init();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [incidentId, getToken, hydrateStepsFromIncident]);

  return {
    incident,
    setIncident,
    steps,
    isStreaming,
    streamError,
    replayDemoInvestigation: runInteractiveDemoStream,
  };
}
