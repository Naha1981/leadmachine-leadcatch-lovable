export type ZeroUIActionClass = "automatic" | "approval_required" | "forbidden";

export type ZeroUIAction =
  | "classify_lead"
  | "score_lead"
  | "search_leads"
  | "get_lead_metrics"
  | "get_business_settings"
  | "search_conversation"
  | "send_whatsapp_message"
  | "schedule_followup"
  | "notify_owner"
  | "change_settings"
  | "delete_data"
  | "discount";

const POLICY: Record<ZeroUIAction, ZeroUIActionClass> = {
  classify_lead: "automatic",
  score_lead: "automatic",
  search_leads: "automatic",
  get_lead_metrics: "automatic",
  get_business_settings: "automatic",
  search_conversation: "automatic",
  send_whatsapp_message: "automatic",
  schedule_followup: "automatic",
  notify_owner: "automatic",
  change_settings: "approval_required",
  delete_data: "forbidden",
  discount: "approval_required",
};

export function getActionClass(action: ZeroUIAction): ZeroUIActionClass {
  return POLICY[action];
}

export function assertActionAllowed(action: ZeroUIAction, opts: { requireApproval?: boolean; approved?: boolean } = {}) {
  const actionClass = getActionClass(action);
  if (actionClass === "forbidden") throw new Error(\`Zero UI policy forbids action: \${action}\`);
  if (actionClass === "approval_required" && !(opts.approved || opts.requireApproval === true)) {
    throw new Error(\`Zero UI approval required for action: \${action}\`);
  }
  return actionClass;
}
