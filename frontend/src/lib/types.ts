export type FileType = "runbook_pdf" | "crash_log" | "postmortem";

export type IngestionStatus = "pending" | "processing" | "indexed" | "failed";

export type IncidentStatus =
  | "investigating"
  | "awaiting_approval"
  | "resolved"
  | "rejected";

export type AgentName =
  | "router"
  | "log_agent"
  | "git_agent"
  | "runbook_agent"
  | "security_agent"
  | "synthesizer"
  | "verifier";

export interface PresignRequest {
  file_name: string;
  content_type: string;
}

export interface PresignResponse {
  url: string;
  key: string;
  expires_in: number;
}

export interface KnowledgeFile {
  id: string;
  workspace_id: string;
  file_name: string;
  file_type: FileType;
  s3_key: string;
  ingestion_status: IngestionStatus;
  created_at: string;
}

export interface ProceduralRule {
  id?: string;
  workspace_id?: string;
  min_confidence_threshold: number;
  protected_paths: string[];
  custom_instructions: string | null;
}

export interface LlmTrace {
  id: string;
  incident_id: string | null;
  agent_name: AgentName;
  model_used: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  latency_ms: number;
  created_at: string;
}

export interface Incident {
  id: string;
  workspace_id: string;
  title: string;
  github_repo_url?: string | null;
  deployed_commit_sha?: string | null;
  raw_error_trace?: string | null;
  raw_error_log_s3_key: string | null;
  error_summary: string | null;
  status: IncidentStatus;
  root_cause_report: string | null;
  proposed_patch_diff: string | null;
  target_file_path: string | null;
  confidence_score: number | null;
  verifier_critique: string | null;
  escalation_reason?: string | null;
  human_feedback: string | null;
  github_pr_url: string | null;
  created_at: string;
  traces?: LlmTrace[];
  total_cost_usd?: number;
  total_latency_ms?: number;
}

export interface StartIncidentRequest {
  title: string;
  github_repo_url: string;
  deployed_commit_sha?: string;
  raw_error_trace?: string;
  raw_error_log_s3_key?: string;
  is_demo?: boolean;
}

export interface StartIncidentResponse {
  incident_id: string;
  status: IncidentStatus;
}

export interface HitlDecisionRequest {
  approved: boolean;
  feedback?: string;
}

export interface HitlDecisionResponse {
  status: IncidentStatus;
  github_pr_url?: string | null;
}

export interface AgentStepState {
  agent_name: AgentName;
  label: string;
  description: string;
  tier: "fast" | "reasoning";
  status: "pending" | "running" | "completed" | "failed";
  model_used?: string;
  latency_ms?: number;
  cost_usd?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  summary?: string;
}

export interface SseAgentEvent {
  type:
    | "agent_started"
    | "agent_completed"
    | "verifier_result"
    | "hitl_paused"
    | "incident_resolved"
    | "state_snapshot"
    | "error";
  agent_name?: AgentName;
  model_used?: string;
  latency_ms?: number;
  cost_usd?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  summary?: string;
  confidence_score?: number;
  verifier_critique?: string;
  escalation_reason?: string;
  root_cause_report?: string;
  proposed_patch_diff?: string;
  target_file_path?: string;
  status?: IncidentStatus;
  github_pr_url?: string;
  message?: string;
}

export interface FinOpsSummary {
  total_incidents: number;
  resolved_incidents: number;
  awaiting_approval_incidents: number;
  actual_cost_usd: number;
  baseline_frontier_cost_usd: number;
  saved_usd: number;
  savings_percentage: number;
  avg_latency_ms: number;
  verifier_catch_count: number;
  by_agent: {
    agent_name: AgentName;
    calls: number;
    actual_cost_usd: number;
    baseline_cost_usd: number;
    avg_latency_ms: number;
    primary_model: string;
  }[];
  recent_incidents: {
    incident_id: string;
    title: string;
    actual_cost_usd: number;
    baseline_cost_usd: number;
    latency_ms: number;
    confidence_score: number | null;
    status: IncidentStatus;
  }[];
}
