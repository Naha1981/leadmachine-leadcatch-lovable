import { getIndustryExperience } from "@/lib/industry-experiences";

export type QualificationQuestion = {
  id: string;
  question: string;
  required?: boolean;
};

export type VerticalPack = {
  id: string;
  label: string;
  aliases: string[];
  services: string[];
  questions: QualificationQuestion[];
  urgentKeywords: string[];
  fitKeywords: string[];
};

export const VERTICAL_PACKS: Record<string, VerticalPack> = {
  plumber: {
    id: "plumber",
    label: "Plumber",
    aliases: ["plumber", "plumbing"],
    services: ["Emergency plumbing", "Leak detection and repairs", "Blocked drains", "Geyser repairs", "Bathroom and kitchen plumbing"],
    questions: [
      { id: "service", question: "What plumbing problem do you need help with?" },
      { id: "location", question: "Which suburb are you in?" },
      { id: "urgency", question: "How urgent is it — now, today, or later?" },
      { id: "property", question: "Is this a home, rental, office or other property?", required: false },
    ],
    urgentKeywords: ["burst", "flood", "flooding", "overflow", "no water", "emergency", "urgent", "leaking now"],
    fitKeywords: ["plumb", "leak", "geyser", "drain", "pipe", "toilet", "tap"],
  },
  electrician: {
    id: "electrician",
    label: "Electrician",
    aliases: ["electrician", "electrical"],
    services: ["Electrical fault finding", "Installations and repairs", "DB board repairs and upgrades", "Certificates of compliance", "Solar and inverter electrical work"],
    questions: [
      { id: "fault", question: "What electrical issue or job do you need help with?" },
      { id: "location", question: "Which suburb are you in?" },
      { id: "urgency", question: "Is there immediate danger, a power outage, or can it wait?" },
      { id: "property", question: "Is this residential, rental, office or commercial?", required: false },
    ],
    urgentKeywords: ["sparking", "smoke", "fire", "power out", "short circuit", "danger", "emergency", "urgent"],
    fitKeywords: ["electric", "power", "db board", "coc", "solar", "inverter", "wiring", "plug", "lights"],
  },
  "mobile-mechanic": {
    id: "mobile-mechanic",
    label: "Mobile Mechanic",
    aliases: ["mobile mechanic", "mechanic", "auto repair", "automotive"],
    services: ["Vehicle diagnostics", "Breakdown assistance", "Battery and starting faults", "Brake and service repairs", "Pre-purchase inspections"],
    questions: [
      { id: "vehicle", question: "What vehicle make, model and year is it?" },
      { id: "location", question: "Where is the vehicle right now?" },
      { id: "problem", question: "What problem is the vehicle having?" },
      { id: "drivable", question: "Can the vehicle still drive?", required: false },
    ],
    urgentKeywords: ["breakdown", "stranded", "won't start", "wont start", "doesn't start", "doesnt start", "immobile", "accident", "emergency", "urgent"],
    fitKeywords: ["car", "bakkie", "vehicle", "mechanic", "battery", "brake", "engine", "service", "diagnostic"],
  },
  cleaner: {
    id: "cleaner",
    label: "Cleaner",
    aliases: ["cleaner", "cleaning"],
    services: ["Home cleaning", "Office cleaning", "Deep cleaning", "Move-in and move-out cleaning", "Post-construction cleaning"],
    questions: [
      { id: "service", question: "What type of cleaning do you need?" },
      { id: "location", question: "Which suburb or area is the property in?" },
      { id: "timing", question: "When do you need the cleaning done?" },
      { id: "frequency", question: "Is this a once-off or recurring service?", required: false },
    ],
    urgentKeywords: ["today", "tomorrow", "same day", "urgent", "move out", "move-out", "move in", "move-in", "inspection"],
    fitKeywords: ["clean", "house", "home", "office", "deep clean", "moving", "post-construction"],
  },
};

export function getVerticalPack(industry: string | null | undefined): VerticalPack | null {
  const value = (industry ?? "").trim().toLowerCase();
  const existing = Object.values(VERTICAL_PACKS).find((pack) => pack.aliases.includes(value));
  if (existing) return existing;

  const experience = getIndustryExperience(industry);
  if (!experience) return null;

  return {
    id: experience.id,
    label: experience.label,
    aliases: experience.aliases,
    services: experience.services,
    questions: experience.qualificationQuestions.map((question, index) => ({
      id: `industry-${experience.id}-${index + 1}`,
      question,
    })),
    urgentKeywords: experience.urgentKeywords,
    fitKeywords: experience.fitKeywords,
  };
}

export function fallbackLeadScore(opts: {
  industry?: string | null;
  message: string;
  phone?: string | null;
  service?: string | null;
}) {
  const pack = getVerticalPack(opts.industry);
  const text = [opts.message, opts.service].filter(Boolean).join(" ").toLowerCase();
  let score = 3;
  if (pack && pack.fitKeywords.some((k) => text.includes(k))) score += 2;
  if (pack && pack.urgentKeywords.some((k) => text.includes(k))) score += 3;
  if ((opts.phone ?? "").replace(/\D/g, "").length >= 9) score += 1;
  if (text.length >= 35) score += 1;
  score = Math.min(10, Math.max(1, score));
  const temperature = score >= 8 ? "hot" : score >= 5 ? "warm" : "cold";
  return {
    score,
    temperature,
    summary: pack
      ? `${pack.label} enquiry detected. ${temperature === "hot" ? "Urgency and service fit suggest fast follow-up." : "Follow up to confirm the missing qualification details."}`
      : `Inbound enquiry scored ${score}/10. Confirm the service, location and timing.`,
    followUp: pack ? pack.questions.slice(0, 3).map((q) => q.question) : ["Confirm the service needed", "Confirm suburb/location", "Confirm timing or urgency"],
  } as const;
}
