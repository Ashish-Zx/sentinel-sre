"use client";

import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL, fetchIncidentById, type TokenGetter } from "./api";
import type { AgentStepState, Incident, SseAgentEvent } from "./types";

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
                  // Mark the verifier step done — the backend emits verifier_result
                  // (not agent_completed) for this step.
                  setSteps((prev) =>
                    prev.map((s) =>
                      s.agent_name === "verifier"
                        ? {
                            ...s,
                            status: "completed",
                            model_used: data.model_used,
                          }
                        : s
                    )
                  );
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
  };
}
