import { useEffect, useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { OmTunerLogo } from "@/components/OmTunerMark";

const DRAFT_KEY = "tuner-intake-draft";

const SECTION_TITLES = [
  "About you",
  "Consent",
  "Health & safety",
  "How are you today?",
  "How you tend to be",
  "Your intention",
  "Preferences",
];
const TOTAL_SECTIONS = SECTION_TITLES.length;

const HEALTH_ITEMS: { key: string; label: string }[] = [
  { key: "hasPacemaker", label: "I have a pacemaker or implanted cardiac device" },
  { key: "implantedDevice", label: "I have another implanted electronic device (cochlear implant, neurostimulator, etc.)" },
  { key: "hasEpilepsy", label: "I have epilepsy or a seizure disorder" },
  { key: "recentSurgery", label: "I've had surgery or a significant injury in the past 6 months" },
  { key: "soundSensitivity", label: "I have significant tinnitus or am very sensitive to sound" },
  { key: "acuteCrisis", label: "I am currently in acute emotional crisis or severe mental distress" },
];

type Question = { key: string; question: string; options: { value: string; label: string }[] };

// Dosha questions (scored server-side); "balanced" is a real answer.
const TODAY_QUESTIONS: Question[] = [
  {
    key: "doshaBody",
    question: "How does your body feel right now?",
    options: [
      { value: "vata-like", label: "Light, restless, cold, or scattered" },
      { value: "pitta-like", label: "Warm, tense, sharp, or intense" },
      { value: "kapha-like", label: "Heavy, slow, cool, or sluggish" },
      { value: "balanced", label: "Comfortable, steady, at ease" },
    ],
  },
  {
    key: "doshaMind",
    question: "How is your mind right now?",
    options: [
      { value: "vata-like", label: "Racing, anxious, or jumping between thoughts" },
      { value: "pitta-like", label: "Focused but pressured, critical, or irritated" },
      { value: "kapha-like", label: "Foggy, slow, withdrawn, or flat" },
      { value: "balanced", label: "Clear and calm" },
    ],
  },
  {
    key: "doshaSleep",
    question: "How have you slept over the last few nights?",
    options: [
      { value: "vata-like", label: "Light, interrupted, or not enough" },
      { value: "pitta-like", label: "Vivid dreams, waking hot, or short and intense" },
      { value: "kapha-like", label: "Heavy, long, or hard to wake from" },
      { value: "balanced", label: "Restful and regular" },
    ],
  },
  {
    key: "doshaEnergy",
    question: "How is your energy today?",
    options: [
      { value: "vata-like", label: "Erratic — bursts of energy then crashes" },
      { value: "pitta-like", label: "Driven but depleted — pushing hard" },
      { value: "kapha-like", label: "Low and hard to mobilise" },
      { value: "balanced", label: "Steady through the day" },
    ],
  },
];

// Center questions (scored server-side).
const TENDENCY_QUESTIONS: Question[] = [
  {
    key: "centerDecisions",
    question: "How do you usually make decisions?",
    options: [
      { value: "intellectual", label: "Think it through — analysis and logic" },
      { value: "emotional", label: "Feel into it — what resonates or feels right" },
      { value: "physical", label: "Act first — instinct and movement" },
    ],
  },
  {
    key: "centerStress",
    question: "Where do you usually feel stress in your body?",
    options: [
      { value: "intellectual", label: "Head, eyes, or jaw — mental tension" },
      { value: "emotional", label: "Chest or throat — emotional tightness" },
      { value: "physical", label: "Shoulders, belly, or legs — physical holding" },
    ],
  },
  {
    key: "centerNeglected",
    question: "Which part of yourself feels most neglected lately?",
    options: [
      { value: "intellectual", label: "Mind — I don't give myself time to reflect" },
      { value: "emotional", label: "Heart — I suppress or avoid feelings" },
      { value: "physical", label: "Body — I live mostly in my head" },
    ],
  },
];

const INITIAL_FORM: Record<string, any> = {
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  sessionDate: "",
  website: "", // honeypot — stays empty for real people
  consentGiven: 0,
  understandsLimits: 0,
  hasPacemaker: 0,
  implantedDevice: 0,
  hasEpilepsy: 0,
  recentSurgery: 0,
  soundSensitivity: 0,
  acuteCrisis: 0,
  noneApply: 0,
  pregnancyStatus: "no",
  bodyContact: "comfortable",
  doshaBody: "",
  doshaMind: "",
  doshaSleep: "",
  doshaEnergy: "",
  centerDecisions: "",
  centerStress: "",
  centerNeglected: "",
  intentionText: "",
  attentionAreas: "",
  vocalization: "no",
  chakraFamiliarity: "new",
  otherNotes: "",
  _source: "intake",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function loadDraft(): { form: Record<string, any>; section: number } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    return { form: { ...INITIAL_FORM, ...draft.form, website: "" }, section: Number(draft.section) || 1 };
  } catch {
    return null;
  }
}

function RadioGroup({
  name, legend, options, value, onChange, muted,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  muted?: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className={`text-sm mb-2 ${muted ? "text-muted-foreground" : "text-white"}`}>{legend}</legend>
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            value === opt.value
              ? "border-primary bg-primary/10"
              : "border-white/10 hover:border-white/20"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="mt-0.5 accent-primary"
          />
          <span className="text-sm text-white">{opt.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function CheckRow({
  label, checked, onChange,
}: {
  label: string;
  checked: number | boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked ? 1 : 0)}
        className="mt-0.5 accent-primary"
      />
      <span className="text-sm text-white">{label}</span>
    </label>
  );
}

function Field({
  label, children,
}: {
  label: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-muted-foreground">{label}</Label>
      {children(id)}
    </div>
  );
}

export default function Intake() {
  const [draft] = useState(loadDraft);
  const [section, setSection] = useState(draft?.section ?? 1);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, any>>(draft?.form ?? INITIAL_FORM);

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  // Keep a draft so a refresh or a closed tab doesn't lose the answers.
  useEffect(() => {
    if (submitted) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form: { ...form, website: "" }, section }));
    } catch { /* storage unavailable — the form still works */ }
  }, [form, section, submitted]);

  // Each step starts at the top of the page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [section, submitted]);

  const mutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { noneApply, ...payload } = data;
      const res = await apiRequest("POST", "/api/questionnaires", payload);
      return res.json();
    },
    onSuccess: () => {
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setSubmitted(true);
    },
    onError: (err: Error) => {
      const tooMany = err.message.startsWith("429");
      toast({
        title: tooMany ? "Too many attempts" : "Something went wrong",
        description: tooMany
          ? "Please wait a little while and try again."
          : "Your answers are saved on this device. Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const anyHealthItem = HEALTH_ITEMS.some(({ key }) => Boolean(form[key]));
  const email = form.clientEmail.trim();
  const phone = form.clientPhone.trim();
  const emailInvalid = email.length > 0 && !EMAIL_RE.test(email);

  const blocker = (): string | null => {
    if (section === 1) {
      if (!form.clientName.trim()) return "Please add your name.";
      if (!email && !phone) return "Please add an email address or phone number so your practitioner can reach you.";
      if (emailInvalid) return "That email address doesn't look right.";
    }
    if (section === 2 && !(form.consentGiven && form.understandsLimits)) {
      return "Both boxes must be checked to continue.";
    }
    if (section === 3 && !anyHealthItem && !form.noneApply) {
      return "Tick anything that applies, or \"None of these apply to me\".";
    }
    if (section === 4 && TODAY_QUESTIONS.some(({ key }) => !form[key])) {
      return "Please choose an answer for each question.";
    }
    if (section === 5 && TENDENCY_QUESTIONS.some(({ key }) => !form[key])) {
      return "Please choose an answer for each question.";
    }
    return null;
  };
  const blocked = blocker();

  const setHealth = (key: string, v: number) =>
    setForm((f) => ({ ...f, [key]: v, ...(v ? { noneApply: 0 } : {}) }));
  const setNoneApply = (v: number) =>
    setForm((f) => ({
      ...f,
      noneApply: v,
      ...(v ? Object.fromEntries(HEALTH_ITEMS.map(({ key }) => [key, 0])) : {}),
    }));

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Thank you, {form.clientName.trim().split(" ")[0]}.</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your responses have been received. Your practitioner will review your profile
              and prepare a personalised session for you.
            </p>
          </div>
          <div className="bg-card border border-white/10 rounded-xl p-4">
            <p className="text-xs text-muted-foreground">
              Nothing more to do — you can close this page. See you at your session.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <OmTunerLogo size={30} />
          </div>
          <h1 className="text-xl font-bold text-white">Pre-session intake</h1>
          <p className="text-sm text-muted-foreground">
            Takes about 5 minutes. Your answers help your practitioner personalise your session.
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{SECTION_TITLES[section - 1]}</span>
            <span>Step {section} of {TOTAL_SECTIONS}</span>
          </div>
          <Progress
            value={(section / TOTAL_SECTIONS) * 100}
            className="h-1.5"
            aria-label={`Step ${section} of ${TOTAL_SECTIONS}`}
          />
        </div>

        {/* Section content */}
        <div className="bg-card border border-white/10 rounded-xl p-6 space-y-6">
          <h2 className="font-semibold text-white">{SECTION_TITLES[section - 1]}</h2>

          {/* ── Section 1: About you ── */}
          {section === 1 && (
            <div className="space-y-4">
              <Field label="Your name *">
                {(id) => (
                  <Input
                    id={id}
                    autoComplete="name"
                    value={form.clientName}
                    onChange={(e) => set("clientName", e.target.value)}
                    placeholder="First and last name"
                    className="bg-background border-white/20"
                  />
                )}
              </Field>
              <p className="text-xs text-muted-foreground">
                Please give an email address or a phone number (or both) so your practitioner can reach you.
              </p>
              <Field label="Email address">
                {(id) => (
                  <Input
                    id={id}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={form.clientEmail}
                    onChange={(e) => set("clientEmail", e.target.value)}
                    placeholder="email@example.com"
                    aria-invalid={emailInvalid}
                    className="bg-background border-white/20"
                  />
                )}
              </Field>
              <Field label="Phone number">
                {(id) => (
                  <Input
                    id={id}
                    type="tel"
                    autoComplete="tel"
                    value={form.clientPhone}
                    onChange={(e) => set("clientPhone", e.target.value)}
                    placeholder="+1 555 123 4567"
                    className="bg-background border-white/20"
                  />
                )}
              </Field>
              <Field label="Session date (if already booked)">
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={form.sessionDate}
                    onChange={(e) => set("sessionDate", e.target.value)}
                    className="bg-background border-white/20"
                  />
                )}
              </Field>
              {/* Honeypot: hidden from people and screen readers */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                <label>
                  Website
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          {/* ── Section 2: Consent ── */}
          {section === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sound healing using tuning forks, singing bowls, and bells is a complementary wellness
                practice. It is not a substitute for medical diagnosis or treatment.
              </p>
              <div className="space-y-3">
                <CheckRow
                  label="I understand this is a wellness practice, not medical treatment."
                  checked={form.understandsLimits}
                  onChange={(v) => set("understandsLimits", v)}
                />
                <CheckRow
                  label="I give my consent to receive sound healing and understand I can stop at any time."
                  checked={form.consentGiven}
                  onChange={(v) => set("consentGiven", v)}
                />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-white">Your privacy.</span> Your answers go only to your practitioner.
                  They are stored in your practitioner's Tuner account behind a login and are used to prepare
                  your session. You can ask your practitioner to delete them at any time.
                </p>
              </div>
            </div>
          )}

          {/* ── Section 3: Health & safety ── */}
          {section === 3 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Please answer honestly. Any "yes" won't cancel your session — it helps your practitioner
                work safely with you.
              </p>
              <fieldset className="space-y-3">
                <legend className="sr-only">Health conditions</legend>
                {HEALTH_ITEMS.map(({ key, label }) => (
                  <CheckRow key={key} label={label} checked={form[key]} onChange={(v) => setHealth(key, v)} />
                ))}
                <div className="border-t border-white/10 pt-3">
                  <CheckRow label="None of these apply to me" checked={form.noneApply} onChange={setNoneApply} />
                </div>
              </fieldset>
              {Boolean(form.acuteCrisis) && (
                <div role="status" className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-3">
                  <p className="text-xs text-sky-100 leading-relaxed">
                    Thank you for telling us. Your practitioner will get in touch before your session to
                    check in with you. If you feel you might harm yourself or are in immediate danger,
                    please call your local emergency number now.
                  </p>
                </div>
              )}
              <RadioGroup
                name="pregnancyStatus"
                legend="Pregnancy"
                muted
                value={form.pregnancyStatus}
                onChange={(v) => set("pregnancyStatus", v)}
                options={[
                  { value: "no", label: "Not pregnant / doesn't apply" },
                  { value: "first-trimester", label: "Pregnant — first trimester" },
                  { value: "yes", label: "Pregnant — second or third trimester" },
                  { value: "postpartum", label: "Postpartum (within 6 weeks)" },
                ]}
              />
            </div>
          )}

          {/* ── Section 4: Today ── */}
          {section === 4 && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Choose the option that feels most true right now — not in general, just today.
              </p>
              {TODAY_QUESTIONS.map(({ key, question, options }) => (
                <RadioGroup key={key} name={key} legend={question} value={form[key]} onChange={(v) => set(key, v)} options={options} />
              ))}
            </div>
          )}

          {/* ── Section 5: How you tend to be ── */}
          {section === 5 && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                These are about how you usually are. Go with your first instinct.
              </p>
              {TENDENCY_QUESTIONS.map(({ key, question, options }) => (
                <RadioGroup key={key} name={key} legend={question} value={form[key]} onChange={(v) => set(key, v)} options={options} />
              ))}
            </div>
          )}

          {/* ── Section 6: Intention ── */}
          {section === 6 && (
            <div className="space-y-5">
              <Field label="What brings you to this session? What would you like to release, integrate, or open?">
                {(id) => (
                  <Textarea
                    id={id}
                    value={form.intentionText}
                    onChange={(e) => set("intentionText", e.target.value)}
                    placeholder="Share as much or as little as you like…"
                    className="bg-background border-white/20 min-h-[100px]"
                  />
                )}
              </Field>
              <Field label="Are there areas of your body, emotions, or life you'd like particular attention on? (optional)">
                {(id) => (
                  <Textarea
                    id={id}
                    value={form.attentionAreas}
                    onChange={(e) => set("attentionAreas", e.target.value)}
                    placeholder="Optional…"
                    className="bg-background border-white/20 min-h-[80px]"
                  />
                )}
              </Field>
            </div>
          )}

          {/* ── Section 7: Preferences ── */}
          {section === 7 && (
            <div className="space-y-5">
              <RadioGroup
                name="bodyContact"
                legend="How comfortable are you with instruments touching your body?"
                muted
                value={form.bodyContact}
                onChange={(v) => set("bodyContact", v)}
                options={[
                  { value: "comfortable", label: "Comfortable — instruments can be placed directly on me" },
                  { value: "limited", label: "Gentle — close to the body but not touching" },
                  { value: "field-only", label: "Field only — please work around me without contact" },
                ]}
              />
              <RadioGroup
                name="vocalization"
                legend="Are you open to gently toning or humming during the session?"
                muted
                value={form.vocalization}
                onChange={(v) => set("vocalization", v)}
                options={[
                  { value: "no", label: "No — I prefer to receive in silence" },
                  { value: "maybe", label: "Maybe — guide me if it feels appropriate" },
                  { value: "yes", label: "Yes — I'm open to it" },
                ]}
              />
              <RadioGroup
                name="chakraFamiliarity"
                legend="How familiar are you with chakras and energy body work?"
                muted
                value={form.chakraFamiliarity}
                onChange={(v) => set("chakraFamiliarity", v)}
                options={[
                  { value: "new", label: "New to it — keep explanations simple" },
                  { value: "some", label: "Some familiarity — a basic framework is fine" },
                  { value: "experienced", label: "Experienced — I work with these systems regularly" },
                ]}
              />
              <Field label="Anything else your practitioner should know?">
                {(id) => (
                  <Textarea
                    id={id}
                    value={form.otherNotes}
                    onChange={(e) => set("otherNotes", e.target.value)}
                    placeholder="Sensitivities, preferences, boundaries…"
                    className="bg-background border-white/20 min-h-[80px]"
                  />
                )}
              </Field>
            </div>
          )}

          {blocked && (
            <p className="text-xs text-amber-200" aria-live="polite">{blocked}</p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={() => setSection((s) => s - 1)}
            disabled={section === 1}
            className="border-white/20 text-muted-foreground"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          {section < TOTAL_SECTIONS ? (
            <Button onClick={() => setSection((s) => s + 1)} disabled={Boolean(blocked)}>
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => mutation.mutate(form)}
              disabled={mutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {mutation.isPending ? "Sending…" : "Submit"}
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground opacity-50">
          OM Tuner · Pre-session intake
        </p>
      </div>
    </div>
  );
}
