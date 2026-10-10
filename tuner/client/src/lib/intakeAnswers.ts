// Turns a stored intake (remote or in-person form) into the questions and
// answers as the client saw them, grouped by section. Used by the client's
// result page (to show every answer) and by Nexus (as page context), so the
// practitioner and Nexus read exactly the same thing.

type Rec = Record<string, any>;

export interface AnswerItem {
  question: string;
  answer: string;
  /** A "yes" on a safety question, worth drawing the eye to. */
  flagged?: boolean;
}
export interface AnswerSection {
  title: string;
  items: AnswerItem[];
}

const DOSHA_OPTIONS: Record<string, Record<string, string>> = {
  doshaBody: {
    "vata-like": "Light, restless, cold or scattered",
    "pitta-like": "Warm, tense, sharp or intense",
    "kapha-like": "Heavy, slow, cool or sluggish",
    balanced: "Comfortable, steady, at ease",
  },
  doshaMind: {
    "vata-like": "Racing, anxious or jumping between thoughts",
    "pitta-like": "Focused but pressured, critical or irritated",
    "kapha-like": "Foggy, slow, withdrawn or flat",
    balanced: "Clear and calm",
  },
  doshaSleep: {
    "vata-like": "Light, interrupted or not enough",
    "pitta-like": "Vivid dreams, waking hot, or short and intense",
    "kapha-like": "Heavy, long or hard to wake from",
    balanced: "Restful and regular",
  },
  doshaAppetite: {
    "vata-like": "Irregular or forgetting to eat, gassy or bloated",
    "pitta-like": "Strong or sharp hunger, acid or heat in digestion",
    "kapha-like": "Low appetite, slow or heavy after eating",
    balanced: "Regular hunger, digesting comfortably",
  },
  doshaEnergy: {
    "vata-like": "Erratic: bursts of energy then crashes",
    "pitta-like": "Driven but depleted: pushing hard",
    "kapha-like": "Low and hard to mobilise",
    balanced: "Steady through the day",
  },
  doshaEmotions: {
    "vata-like": "Anxious, scattered or emotionally ungrounded",
    "pitta-like": "Irritable, critical or carrying frustration",
    "kapha-like": "Withdrawn, heavy or emotionally flat",
    balanced: "Open, equanimous and connected",
  },
};

const DOSHA_QUESTIONS: [string, string][] = [
  ["doshaBody", "How does your body feel right now?"],
  ["doshaMind", "How is your mind right now?"],
  ["doshaSleep", "How has your sleep been lately?"],
  ["doshaAppetite", "How is your appetite and digestion today?"],
  ["doshaEnergy", "How is your energy today?"],
  ["doshaEmotions", "How are you feeling emotionally right now?"],
];

const CENTER_QUESTIONS: [string, string, Record<string, string>][] = [
  ["centerDecisions", "How do you usually make decisions?", {
    intellectual: "Think it through: analysis and logic",
    emotional: "Feel into it: what resonates or feels right",
    physical: "Act first: instinct and movement",
  }],
  ["centerStress", "Where do you usually feel stress in your body?", {
    intellectual: "Head, eyes or jaw: mental tension",
    emotional: "Chest or throat: emotional tightness",
    physical: "Shoulders, belly or legs: physical holding",
  }],
  ["centerNeglected", "Which part of yourself feels most neglected lately?", {
    intellectual: "Mind: no time to reflect",
    emotional: "Heart: suppressing or avoiding feelings",
    physical: "Body: living mostly in the head",
  }],
];

const SAFETY: [string, string][] = [
  ["hasPacemaker", "Pacemaker or implanted cardiac device"],
  ["implantedDevice", "Other implanted electronic device (cochlear implant, neurostimulator, etc.)"],
  ["hasEpilepsy", "Epilepsy or a seizure disorder"],
  ["recentSurgery", "Surgery or significant injury in the past 6 months"],
  ["soundSensitivity", "Significant tinnitus or sound sensitivity"],
  ["acuteCrisis", "Acute emotional crisis or severe mental distress"],
];

const PREGNANCY: Record<string, string> = {
  no: "Not pregnant / doesn't apply",
  "first-trimester": "Pregnant, first trimester",
  yes: "Pregnant, second or third trimester",
  postpartum: "Postpartum (within 6 weeks)",
};

const BODY_CONTACT: Record<string, string> = {
  comfortable: "Comfortable: instruments can be placed directly on the body",
  limited: "Gentle: close to the body but not touching",
  "field-only": "Field only: no body contact",
};
const VOCALIZATION: Record<string, string> = {
  no: "No: prefers to receive in silence",
  maybe: "Maybe: guide them if it feels appropriate",
  yes: "Yes: open to toning or humming",
};
const CHAKRA_FAMILIARITY: Record<string, string> = {
  new: "New to it: keep explanations simple",
  some: "Some familiarity: a basic framework is fine",
  experienced: "Experienced: works with these systems regularly",
};
const PRIOR_EXPERIENCE: Record<string, string> = {
  none: "None: this is their first session",
  some: "Some: a few sessions with bowls or forks",
  regular: "Regular: an ongoing practice",
  practitioner: "Trained practitioner: works with instruments themselves",
};

const yesNo = (v: unknown) => (v === 1 || v === true || v === "1" ? "Yes" : "No");
const has = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";
const pick = (map: Record<string, string>, v: unknown) => (has(v) ? map[String(v)] ?? String(v) : "");

export function intakeAnswerSections(r: Rec): AnswerSection[] {
  const sections: AnswerSection[] = [];
  const push = (title: string, items: AnswerItem[]) => {
    const shown = items.filter((i) => has(i.answer));
    if (shown.length) sections.push({ title, items: shown });
  };

  push("About the client", [
    { question: "Name", answer: r.clientName ?? "" },
    { question: "Email", answer: r.clientEmail ?? "" },
    { question: "Phone", answer: r.clientPhone ?? "" },
    { question: "Session date", answer: r.sessionDate ?? "" },
    { question: "Practitioner", answer: r.practitionerName ?? "" },
    { question: "Prior experience", answer: pick(PRIOR_EXPERIENCE, r.priorExperience) },
  ]);

  push("Consent", [
    { question: "Gave consent to the session", answer: has(r.consentGiven) ? yesNo(r.consentGiven) : "" },
  ]);

  // Every safety question is shown, "No" included, so nothing is ambiguous.
  push("Health and safety", [
    ...SAFETY.map(([key, q]) => ({ question: q, answer: yesNo(r[key]), flagged: yesNo(r[key]) === "Yes" })),
    {
      question: "Pregnancy",
      answer: pick(PREGNANCY, r.pregnancyStatus || "no"),
      flagged: has(r.pregnancyStatus) && r.pregnancyStatus !== "no",
    },
    { question: "Other medical notes", answer: r.otherMedical ?? "" },
    { question: "Medication affecting the senses", answer: r.sensoryMeds ?? "" },
  ]);

  // Both forms ask these four; appetite and emotions only appear when the
  // in-person form answered them.
  const ASKED_BY_BOTH = new Set(["doshaBody", "doshaMind", "doshaSleep", "doshaEnergy"]);
  push("How they are today", DOSHA_QUESTIONS
    .filter(([key]) => ASKED_BY_BOTH.has(key) || has(r[key]))
    .map(([key, q]) => ({
      question: q,
      answer: has(r[key]) ? pick(DOSHA_OPTIONS[key], r[key]) : "Not answered",
    })));

  push("How they tend to be", CENTER_QUESTIONS.map(([key, q, map]) => ({
    question: q,
    answer: has(r[key]) ? pick(map, r[key]) : "Not answered",
  })));

  push("Intention", [
    { question: "What brings you to this session? What would you like to release, integrate or open?", answer: r.intentionText ?? "" },
    { question: "Areas of body, emotions or life needing particular attention", answer: r.attentionAreas ?? "" },
    { question: "What they would like to receive", answer: r.receiveText ?? "" },
  ]);

  push("Preferences", [
    { question: "Instruments touching the body", answer: pick(BODY_CONTACT, r.bodyContact) },
    { question: "Toning or humming during the session", answer: pick(VOCALIZATION, r.vocalization) },
    { question: "Familiarity with chakras and energy body work", answer: pick(CHAKRA_FAMILIARITY, r.chakraFamiliarity) },
    { question: "Sensory notes", answer: r.sensoryNotes ?? "" },
    { question: "Anything else the practitioner should know", answer: r.otherNotes ?? "" },
  ]);

  return sections;
}

/** The same answers as plain text, for Nexus. */
export function intakeAnswersText(r: Rec): string {
  return intakeAnswerSections(r)
    .map((s) => `${s.title}:\n` + s.items.map((i) => `- ${i.question}: ${i.answer}`).join("\n"))
    .join("\n\n");
}
