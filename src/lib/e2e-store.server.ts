export type E2ELead = {
  id: string;
  name: string;
  phone: string;
  service: string;
  ai_score: number;
  ai_temperature: "hot" | "warm" | "cold";
  ai_summary: string;
  status: "new" | "contacted";
  source: string;
  created_at: string;
};

type E2EAlert = {
  leadId: string;
  status: "alerted";
  whatsapp: boolean;
  sms: boolean;
  waitingMinutes: number;
};

let state = {
  seeded: false,
  sitePublished: false,
  latestLead: null as E2ELead | null,
  leakageLeadId: "e2e-leakage-lead",
  leakageAlert: null as E2EAlert | null,
  autoReplySent: false,
};

const e2eBusiness = {
  tenantId: "00000000-0000-0000-0000-00000000e2e1",
  slug: "e2e-leadmachine",
  businessName: "E2E Test Plumbing",
  industry: "Plumber",
  services: "Emergency plumbing\nLeak detection and repairs\nBlocked drains\nGeyser repairs",
};

export function resetE2EState() {
  state = {
    seeded: true,
    sitePublished: true,
    latestLead: {
      id: state.leakageLeadId,
      name: "Leakage Test Lead",
      phone: "27825550999",
      service: "Emergency plumbing",
      ai_score: 10,
      ai_temperature: "hot",
      ai_summary: "Urgent emergency plumbing enquiry.",
      status: "new",
      source: "e2e",
      created_at: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
    },
    leakageLeadId: "e2e-leakage-lead",
    leakageAlert: null,
    autoReplySent: false,
  };
}

export function getE2EBusiness() {
  return e2eBusiness;
}

export function recordQuoteLead(input: {
  name: string;
  phone: string;
  score: number;
  temperature: "hot" | "warm" | "cold";
  summary: string;
}) {
  state.latestLead = {
    id: "e2e-quote-lead",
    name: input.name,
    phone: input.phone.replace(/\D/g, ""),
    service: "Emergency plumbing",
    ai_score: input.score,
    ai_temperature: input.temperature,
    ai_summary: input.summary,
    status: "new",
    source: "website",
    created_at: new Date().toISOString(),
  };
}

export function recordWhatsAppLead(input: {
  phone: string;
  score: number;
  temperature: "hot" | "warm" | "cold";
  summary: string;
}) {
  state.latestLead = {
    id: "e2e-whatsapp-lead",
    name: "WhatsApp Test Customer",
    phone: input.phone.replace(/\D/g, ""),
    service: "Emergency plumbing",
    ai_score: input.score,
    ai_temperature: input.temperature,
    ai_summary: input.summary,
    status: "contacted",
    source: "whatsapp",
    created_at: new Date().toISOString(),
  };
  state.autoReplySent = true;
}

export function alertLeakage() {
  const waitingMinutes = 16;
  state.leakageAlert = {
    leadId: state.leakageLeadId,
    status: "alerted",
    whatsapp: true,
    sms: false,
    waitingMinutes,
  };
  return {
    leadId: state.leakageLeadId,
    status: "alerted",
    whatsapp: true,
    sms: false,
  };
}

export function getE2EState() {
  return {
    ok: true,
    site: { slug: e2eBusiness.slug, published: state.sitePublished, tenant_id: e2eBusiness.tenantId },
    lead: state.latestLead,
    alert: state.leakageAlert,
    autoReplySent: state.autoReplySent,
    e2e: true,
  };
}

export function isE2EEnabled() {
  return process.env["E2E_MODE"] === "true";
}
