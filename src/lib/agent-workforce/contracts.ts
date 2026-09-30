export type EvidenceLabel = "SOURCE-BACKED" | "CUSTOMER-CONFIRMED" | "PROPOSAL" | "ASSUMPTION";

export type RuntimeKind = "openmuse" | "openbot";

export type RuntimeStatus = {
  kind: RuntimeKind;
  configured: boolean;
  reachable: boolean;
  capabilities: string[];
  message: string;
};

export type EvidenceItem = {
  id: string;
  label: EvidenceLabel;
  title: string;
  detail: string;
  sourceUrl: string;
  observedAt: string;
};

export type WorkerFinding = {
  id: string;
  severity: "info" | "watch" | "opportunity";
  title: string;
  detail: string;
  evidenceIds: string[];
};

export type SalesExecutionReceipt = {
  id: string;
  step: string;
  provider: string;
  status: "started" | "completed" | "failed" | "skipped" | "outcome_unknown";
  externalId?: string | null;
  outputSummary?: Record<string, unknown>;
  createdAt: string;
};

export type SalesWorkerResult = {
  runId: string;
  mode: "live-runtime-check" | "public-research";
  completedAt: string;
  target: {
    businessName: string;
    websiteUrl: string;
    location?: string;
    category?: string;
    contactName?: string;
    prospectPhone?: string;
  };
  runtimes: RuntimeStatus[];
  evidence: EvidenceItem[];
  findings: WorkerFinding[];
  recommendedActions: Array<{
    title: string;
    detail: string;
    approvalRequired: boolean;
  }>;
  approvalRequired: boolean;
  approvalActionId?: string;
  approvalId?: string;
};

export type SalesExecutionStatus = {
  action: {
    id: string;
    status: string;
    result: Record<string, unknown>;
    error?: string | null;
    createdAt: string;
    completedAt?: string | null;
  };
  approval: {
    id: string;
    status: string;
    requested_at?: string;
    resolved_at?: string | null;
    resolved_by?: string | null;
    note?: string | null;
  } | null;
  receipts: SalesExecutionReceipt[];
};
