import { getE2EBusiness, isE2EEnabled } from "./e2e-store.server";

let ownerState = {
  commandCount: 0,
  lastReply: "",
  lastIntent: "",
};

export function resetE2EOwnerState() {
  ownerState = { commandCount: 0, lastReply: "", lastIntent: "" };
}

export function getE2EOwnerState() {
  return { ...ownerState };
}

export function handleE2EOwnerCommand(text: string) {
  if (!isE2EEnabled()) throw new Error("E2E mode disabled");
  const normalized = text.toLowerCase();
  let intent = "help";
  let reply = "Try: Any new leads? / Show me today's hot leads. / Follow up with everyone who hasn't replied.";
  if (normalized.includes("new lead")) {
    intent = "new_leads_summary";
    reply = "3 new leads today. 1 hot, 1 warm, 1 cold. Sarah is the hot lead.";
  } else if (normalized.includes("hot lead")) {
    intent = "hot_leads";
    reply = "🔥 Sarah · Roof inspection · Sandton · 9/10 Hot";
  } else if (normalized.includes("follow up")) {
    intent = "follow_up_unreplied";
    reply = "✅ I found 2 eligible leads and scheduled their follow-ups.";
  }
  ownerState.commandCount += 1;
  ownerState.lastIntent = intent;
  ownerState.lastReply = reply;
  return { intent, reply, business: getE2EBusiness() };
}
