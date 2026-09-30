import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type LeadMachineVideoProps = {
  prospectId: string;
  businessName: string;
  industry?: string;
  location?: string;
  googleRating?: number | string | null;
  reviewCount?: number | string | null;
  website?: string | null;
  currentCta?: string | null;
  currentEnquiryFlow?: string | null;
  websiteEnquiryForm?: string | null;
  onlineBooking?: string | null;
  quoteRequest?: string | null;
  whatsAppCta?: string | null;
  digitalPresenceGap?: string | null;
  observedEnquiryFriction?: string | null;
  potentialLeakageRisk?: string | null;
  leadMachineConcept?: string | null;
  conversionEvent?: string | null;
  followUpSequence?: string | null;
  prospectTier?: string | null;
  demoUrl?: string | null;
};

const C = {
  bg: "#07110d",
  panel: "#0d1914",
  panel2: "#10221a",
  text: "#f4f7f5",
  muted: "#a8b5ae",
  line: "#243b31",
  green: "#54d89a",
  green2: "#22b574",
  gold: "#e4bd6a",
  red: "#f77f7f",
};

function clean(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  if (/^(pending|n\/a|unknown|unverified|not available|null|none observed)/i.test(text)) {
    return fallback;
  }
  return text.replace(/\s+/g, " ");
}

function truncate(value: unknown, max = 118, fallback = "") {
  const text = clean(value, fallback);
  if (!text) return "";
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sectionOpacity(frame: number, start: number, end: number) {
  return interpolate(frame, [start, start + 18, end - 18, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function Section({
  children,
  start,
  end,
}: {
  children: React.ReactNode;
  start: number;
  end: number;
}) {
  const frame = useCurrentFrame();
  const opacity = sectionOpacity(frame, start, end);
  const y = interpolate(frame, [start, start + 24], [48, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity, transform: `translateY(${y}px)` }}>
      {children}
    </AbsoluteFill>
  );
}

function Chip({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: "green" | "gold" | "neutral" | "red";
}) {
  const border = tone === "green" ? "rgba(84,216,154,.32)" : tone === "gold" ? "rgba(228,189,106,.34)" : tone === "red" ? "rgba(247,127,127,.34)" : "rgba(255,255,255,.12)";
  const background = tone === "green" ? "rgba(34,181,116,.11)" : tone === "gold" ? "rgba(228,189,106,.10)" : tone === "red" ? "rgba(247,127,127,.09)" : "rgba(255,255,255,.055)";
  const color = tone === "green" ? C.green : tone === "gold" ? C.gold : tone === "red" ? C.red : C.muted;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: `1px solid ${border}`,
        background,
        color,
        padding: "12px 18px",
        borderRadius: 999,
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </span>
  );
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(145deg, rgba(20,40,31,.96), rgba(8,19,14,.98))",
        border: `1px solid ${C.line}`,
        borderRadius: 34,
        boxShadow: "0 28px 70px rgba(0,0,0,.26)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  accent = C.green,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: C.muted, fontSize: 21, fontWeight: 600 }}>{label}</div>
      <div style={{ color: accent, fontSize: 40, lineHeight: 1.05, fontWeight: 800, marginTop: 8 }}>
        {value}
      </div>
    </div>
  );
}

function LeadMachineBadge() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          border: `2px solid ${C.green}`,
          display: "grid",
          placeItems: "center",
          color: C.green,
          fontSize: 20,
          fontWeight: 900,
        }}
      >
        ✓
      </div>
      <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-0.02em" }}>
        Lead<span style={{ color: C.green }}>Machine</span>
      </div>
    </div>
  );
}

function ProgressRail({ frame }: { frame: number }) {
  const progress = interpolate(frame, [0, 900], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 52,
        right: 52,
        bottom: 35,
        height: 5,
        borderRadius: 99,
        background: "rgba(255,255,255,.08)",
      }}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          height: "100%",
          borderRadius: 99,
          background: `linear-gradient(90deg, ${C.green2}, ${C.gold})`,
        }}
      />
    </div>
  );
}

export const LeadMachineVideo: React.FC<LeadMachineVideoProps> = (rawProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const props = {
    prospectId: clean(rawProps.prospectId, "NL-PROSPECT"),
    businessName: clean(rawProps.businessName, "Your business"),
    industry: clean(rawProps.industry, "Service business"),
    location: clean(rawProps.location, "Johannesburg"),
    googleRating: asNumber(rawProps.googleRating),
    reviewCount: asNumber(rawProps.reviewCount),
    website: clean(rawProps.website),
    currentCta: clean(rawProps.currentCta),
    currentEnquiryFlow: clean(rawProps.currentEnquiryFlow),
    websiteEnquiryForm: clean(rawProps.websiteEnquiryForm),
    onlineBooking: clean(rawProps.onlineBooking),
    quoteRequest: clean(rawProps.quoteRequest),
    whatsAppCta: clean(rawProps.whatsAppCta),
    digitalPresenceGap: clean(rawProps.digitalPresenceGap),
    observedEnquiryFriction: clean(rawProps.observedEnquiryFriction),
    potentialLeakageRisk: clean(rawProps.potentialLeakageRisk),
    leadMachineConcept: clean(rawProps.leadMachineConcept),
    conversionEvent: clean(rawProps.conversionEvent),
    followUpSequence: clean(rawProps.followUpSequence),
    prospectTier: clean(rawProps.prospectTier, "Prospect"),
    demoUrl: clean(rawProps.demoUrl),
  };

  const rating = props.googleRating ? props.googleRating.toFixed(1) : "—";
  const reviews = props.reviewCount ? props.reviewCount.toLocaleString("en-ZA") : "—";
  const friction = truncate(
    props.observedEnquiryFriction ||
      props.digitalPresenceGap ||
      props.currentEnquiryFlow,
    145,
    "The public enquiry path is visible, but the hand-off and follow-up logic are not.",
  );
  const leakage = truncate(
    props.potentialLeakageRisk,
    145,
    "The research signal points to an opportunity to qualify, prioritise and follow up more systematically.",
  );
  const concept = truncate(
    props.leadMachineConcept,
    145,
    "Add an intelligence layer that captures, scores, diagnoses, follows up and attributes enquiries.",
  );
  const cta = truncate(
    props.currentCta ||
      props.whatsAppCta ||
      props.quoteRequest ||
      props.onlineBooking ||
      "Website enquiry path",
    88,
    "Website enquiry path",
  );
  const demo = props.demoUrl || "demo.leadmachine.co.za";
  const demoShort = demo.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const heroScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });

  const signalBar = interpolate(frame, [365, 500], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        color: C.text,
        fontFamily: "Inter, Geist, ui-sans-serif, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Ambient background */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 80% 14%, rgba(34,181,116,.16), transparent 28%), radial-gradient(circle at 10% 88%, rgba(228,189,106,.10), transparent 26%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 120,
          right: -120,
          width: 460,
          height: 460,
          borderRadius: "50%",
          border: "1px solid rgba(84,216,154,.14)",
          boxShadow: "0 0 150px rgba(84,216,154,.05)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: -180,
          width: 520,
          height: 520,
          borderRadius: "50%",
          border: "1px solid rgba(228,189,106,.10)",
        }}
      />

      <div style={{ position: "absolute", inset: 52, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <LeadMachineBadge />
          <div style={{ color: C.muted, fontSize: 21, fontWeight: 700 }}>{props.prospectId}</div>
        </div>

        <Sequence from={0} durationInFrames={120}>
          <Section start={0} end={120}>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 200,
                transform: `scale(${0.92 + heroScale * 0.08})`,
                transformOrigin: "center left",
              }}
            >
              <Chip tone="green">{props.industry} · {props.location}</Chip>
              <div style={{ marginTop: 34, maxWidth: 920 }}>
                <div style={{ fontSize: 72, lineHeight: 1.02, fontWeight: 900, letterSpacing: "-0.055em" }}>
                  A quick look at{" "}
                  <span style={{ color: C.green }}>{props.businessName}</span>
                </div>
                <div style={{ marginTop: 28, fontSize: 34, lineHeight: 1.3, color: C.muted, maxWidth: 820 }}>
                  We mapped the public enquiry journey and where revenue can leak before a person ever becomes a customer.
                </div>
              </div>
            </div>
          </Section>
        </Sequence>

        <Sequence from={120} durationInFrames={210}>
          <Section start={120} end={330}>
            <div style={{ position: "absolute", top: 190, left: 0, right: 0 }}>
              <div style={{ fontSize: 21, color: C.muted, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".16em" }}>
                Public signals
              </div>
              <div style={{ marginTop: 18, fontSize: 46, fontWeight: 850, letterSpacing: "-.035em" }}>
                The front door is clear. The hand-off is where the work starts.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 34 }}>
                <Card style={{ padding: 30 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Metric label="Google rating" value={rating} accent={C.gold} />
                    <Metric label="Reviews" value={reviews} />
                  </div>
                  <div style={{ marginTop: 28, height: 1, background: C.line }} />
                  <div style={{ marginTop: 24, color: C.muted, fontSize: 23, lineHeight: 1.42 }}>
                    Strong public proof creates more enquiries. That makes response quality matter more.
                  </div>
                </Card>

                <Card style={{ padding: 30 }}>
                  <div style={{ color: C.muted, fontSize: 21, fontWeight: 700 }}>Current enquiry route</div>
                  <div style={{ marginTop: 14, fontSize: 31, lineHeight: 1.26, fontWeight: 800 }}>
                    {cta}
                  </div>
                  <div style={{ marginTop: 26, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {props.whatsAppCta ? <Chip tone="green">WhatsApp signal</Chip> : null}
                    {props.websiteEnquiryForm ? <Chip tone="neutral">Website form</Chip> : null}
                    {props.onlineBooking ? <Chip tone="gold">Online booking</Chip> : null}
                    {props.quoteRequest ? <Chip tone="green">Quote request</Chip> : null}
                  </div>
                </Card>
              </div>
            </div>
          </Section>
        </Sequence>

        <Sequence from={330} durationInFrames={210}>
          <Section start={330} end={540}>
            <div style={{ position: "absolute", top: 190, left: 0, right: 0 }}>
              <div style={{ fontSize: 21, color: C.gold, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".16em" }}>
                Research signal
              </div>
              <div style={{ marginTop: 18, fontSize: 46, fontWeight: 850, letterSpacing: "-.035em" }}>
                Where an enquiry can disappear
              </div>

              <Card style={{ marginTop: 30, padding: 34 }}>
                <div style={{ fontSize: 24, color: C.muted, fontWeight: 700 }}>Observed friction</div>
                <div style={{ marginTop: 14, fontSize: 33, lineHeight: 1.3, fontWeight: 800 }}>
                  {friction}
                </div>

                <div style={{ marginTop: 30, height: 18, background: "rgba(255,255,255,.07)", borderRadius: 99, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.max(18, signalBar * 100)}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${C.green}, ${C.gold})`,
                      borderRadius: 99,
                    }}
                  />
                </div>

                <div style={{ marginTop: 32, fontSize: 24, color: C.muted, fontWeight: 700 }}>Leakage hypothesis</div>
                <div style={{ marginTop: 12, fontSize: 28, lineHeight: 1.36, color: C.text }}>
                  {leakage}
                </div>
              </Card>

              <div style={{ marginTop: 18, fontSize: 19, color: C.muted }}>
                Research evidence is directional — not a claim about revenue already lost.
              </div>
            </div>
          </Section>
        </Sequence>

        <Sequence from={540} durationInFrames={180}>
          <Section start={540} end={720}>
            <div style={{ position: "absolute", top: 190, left: 0, right: 0 }}>
              <div style={{ fontSize: 21, color: C.green, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".16em" }}>
                Lead Machine
              </div>
              <div style={{ marginTop: 18, fontSize: 48, fontWeight: 900, letterSpacing: "-.04em" }}>
                Add the intelligence layer — not another job.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 34 }}>
                {[
                  ["01", "Capture", "Bring every enquiry into one evidence trail."],
                  ["02", "Score", "Prioritise intent, urgency and value."],
                  ["03", "Follow up", "Keep opportunities moving until a human takes over."],
                ].map(([number, title, body]) => (
                  <Card key={number} style={{ padding: 26, minHeight: 250 }}>
                    <div style={{ color: C.green, fontSize: 19, fontWeight: 900 }}>{number}</div>
                    <div style={{ marginTop: 26, fontSize: 31, fontWeight: 850 }}>{title}</div>
                    <div style={{ marginTop: 12, color: C.muted, fontSize: 22, lineHeight: 1.36 }}>{body}</div>
                  </Card>
                ))}
              </div>

              <div style={{ marginTop: 22, color: C.text, fontSize: 27, lineHeight: 1.35 }}>
                {concept}
              </div>
            </div>
          </Section>
        </Sequence>

        <Sequence from={720} durationInFrames={180}>
          <Section start={720} end={900}>
            <div
              style={{
                position: "absolute",
                top: 235,
                left: 0,
                right: 0,
                textAlign: "center",
              }}
            >
              <Chip tone="gold">Built for {props.businessName}</Chip>
              <div style={{ marginTop: 30, fontSize: 72, lineHeight: 1.02, fontWeight: 900, letterSpacing: "-.055em" }}>
                See the <span style={{ color: C.green }}>full Lead Recovery Report.</span>
              </div>
              <div style={{ margin: "28px auto 0", maxWidth: 860, fontSize: 30, lineHeight: 1.35, color: C.muted }}>
                We can show the workflow against the same evidence we used for this video.
              </div>

              <div
                style={{
                  margin: "42px auto 0",
                  padding: "25px 32px",
                  width: "fit-content",
                  borderRadius: 22,
                  border: `1px solid rgba(84,216,154,.35)`,
                  background: "rgba(34,181,116,.10)",
                  fontSize: 28,
                  fontWeight: 850,
                  color: C.green,
                }}
              >
                {demoShort}
              </div>

              <div style={{ marginTop: 50, display: "flex", justifyContent: "center", gap: 20, alignItems: "center" }}>
                <div style={{ color: C.muted, fontSize: 22 }}>NahaLabs</div>
                <div style={{ width: 6, height: 6, borderRadius: 99, background: C.gold }} />
                <div style={{ color: C.muted, fontSize: 22 }}>Intelligent systems that return decisions, probabilities and evidence.</div>
              </div>
            </div>
          </Section>
        </Sequence>

        <ProgressRail frame={frame} />
      </div>
    </AbsoluteFill>
  );
};
