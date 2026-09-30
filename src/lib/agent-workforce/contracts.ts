
export type EvidenceLabel = "SOURCE-BACKED" | "CUSTOMER-CONFIRMED" | "PROPOSAL" | "ASSUMPTION";

export type RuntimeKind = "openmuse" | "openbot" | "demo";

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

export type SalesWorkerResult = {
  runId: string;
  mode: "live-runtime-check" | "public-research";
  completedAt: string;
  target: {
    businessName: string;
    websiteUrl: string;
    location?: string;
    category?: string;
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
};
