type E2EDemandSignal = {
  id: string;
  title: string;
  body: string;
  service: string;
  suburb: string;
  urgency: string;
  intent_score: number;
  source_name: string;
  source_url: string;
  status: "new" | "alerted";
  alerted_at: string | null;
};

const fixture: E2EDemandSignal = {
  id: "demand-e2e-001",
  title: "Looking for a reliable plumber in Sandton",
  body: "My geyser burst and I need someone tonight. Any recommendations?",
  service: "Plumbing",
  suburb: "Sandton",
  urgency: "Tonight",
  intent_score: 10,
  source_name: "Community enquiry",
  source_url: "https://example.com/community/plumber-sandton",
  status: "new",
  alerted_at: null,
};

export function resetE2EDemandSignal() {
  fixture.status = "new";
  fixture.alerted_at = null;
}

export function getE2EDemandSignal() {
  return { ...fixture };
}

export function processE2EDemandRadar() {
  fixture.status = "alerted";
  fixture.alerted_at = new Date().toISOString();
  return { discovered: 1, alerted: 1, signal: { ...fixture } };
}
