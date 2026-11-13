import enum


class FileType(str, enum.Enum):
    runbook_pdf = "runbook_pdf"
    crash_log = "crash_log"
    postmortem = "postmortem"


class IngestionStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    indexed = "indexed"
    failed = "failed"


class IncidentStatus(str, enum.Enum):
    investigating = "investigating"
    awaiting_approval = "awaiting_approval"
    resolved = "resolved"
    rejected = "rejected"


class AgentName(str, enum.Enum):
    router = "router"
    log_agent = "log_agent"
    git_agent = "git_agent"
    runbook_agent = "runbook_agent"
    security_agent = "security_agent"
    synthesizer = "synthesizer"
    verifier = "verifier"
