import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight } from "lucide-react";

const TOTAL_SECTIONS = 8;

const SECTION_TITLES = [
  "Client Information",
  "Intake & Consent",
  "Medical Safety Screen",
  "Sound & Body History",
  "Āyurvedic Dosha Screen",
  "Gurdjieff Centers Screen",
  "Session Intentions",
  "Comfort & Engagement",
];

function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            value === opt.value
              ? "border-primary bg-primary/10"
              : "border-white/10 hover:border-white/20"
          }`}
          data-testid={`radio-${name}-${opt.value}`}
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
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
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

export default function Questionnaire() {
  const [section, setSection] = useState(1);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [form, setForm] = useState<Record<string, any>>({
    clientName: "",
    clientEmail: "",
    sessionDate: new Date().toISOString().slice(0, 10),
    practitionerName: "",
    consentGiven: 0,
    birthDate: "",
    birthTime: "",
    birthPlace: "",
    understandsLimits: 0,
    hasPacemaker: 0,
    hasEpilepsy: 0,
    recentSurgery: 0,
    soundSensitivity: 0,
    acuteCrisis: 0,
    pregnancyStatus: "no",
    implantedDevice: 0,
    priorExperience: "none",
    bodyContact: "comfortable",
    tinnitus: 0,
    doshaBody: "",
    doshaMind: "",
    doshaSleep: "",
    doshaAppetite: "",
    doshaEnergy: "",
    doshaEmotions: "",
    centerDecisions: "",
    centerStress: "",
    centerLearning: "",
    centerTrust: "",
    centerNeglected: "",
    centerSelf: "",
    intentionText: "",
    stressAreas: "",
    vocalization: "no",
    chakraFamiliarity: "new",
    comfortNotes: "",
  });

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const mutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/questionnaires", data);
      return res.json();
    },
    onSuccess: (result) => {
      navigate(`/questionnaire/result/${result.id}`);
    },
    onError: () => {
      toast({ title: "Submission error", description: "Please check your answers and try again.", variant: "destructive" });
    },
  });

  const canProceed = () => {
    if (section === 1) return form.clientName.trim().length > 0;
    if (section === 2) return Boolean(form.consentGiven) && Boolean(form.understandsLimits);
    return true;
  };

  const handleSubmit = () => {
    mutation.mutate(form);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <PageHeader
          title="In-Person Form"
          description="Complete together with your client. The system generates a session profile, flags any contraindications, and recommends a protocol."
        />
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Section {section} of {TOTAL_SECTIONS}: {SECTION_TITLES[section - 1]}</span>
          <span>{Math.round((section / TOTAL_SECTIONS) * 100)}%</span>
        </div>
        <Progress value={(section / TOTAL_SECTIONS) * 100} className="h-1.5" />
      </div>

      {/* Section tabs strip */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {SECTION_TITLES.map((title, i) => (
          <button
            key={i}
            onClick={() => setSection(i + 1)}
            className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full transition-colors ${
              section === i + 1
                ? "bg-primary text-white"
                : "bg-white/5 text-muted-foreground hover:bg-white/10"
            }`}
            data-testid={`section-tab-${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="bg-card border border-white/10 rounded-xl p-6 space-y-6">
        <h2 className="font-semibold text-white">{section}. {SECTION_TITLES[section - 1]}</h2>

        {/* ── Section 1: Client Info ── */}
        {section === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Client full name *</Label>
              <Input
                value={form.clientName}
                onChange={(e) => set("clientName", e.target.value)}
                placeholder="Full name"
                className="bg-background border-white/20"
                data-testid="input-clientName"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Email address (optional)</Label>
              <Input
                type="email"
                value={form.clientEmail}
                onChange={(e) => set("clientEmail", e.target.value)}
                placeholder="email@example.com"
                className="bg-background border-white/20"
                data-testid="input-clientEmail"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Session date</Label>
                <Input
                  type="date"
                  value={form.sessionDate}
                  onChange={(e) => set("sessionDate", e.target.value)}
                  className="bg-background border-white/20"
                  data-testid="input-sessionDate"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Practitioner name</Label>
                <Input
                  value={form.practitionerName}
                  onChange={(e) => set("practitionerName", e.target.value)}
                  placeholder="Practitioner"
                  className="bg-background border-white/20"
                  data-testid="input-practitionerName"
                />
              </div>
            </div>

            {/* Gene Keys Radiance — optional */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <div>
                <Label className="text-muted-foreground">Date of birth <span className="text-white/30 font-normal">(optional — unlocks Gene Keys Radiance synthesis)</span></Label>
                <Input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => set("birthDate", e.target.value)}
                  className="bg-background border-white/20 mt-2"
                  data-testid="input-birthDate"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Time of birth <span className="text-white/30 font-normal">(optional — improves accuracy)</span></Label>
                  <Input
                    type="time"
                    value={form.birthTime}
                    onChange={(e) => set("birthTime", e.target.value)}
                    className="bg-background border-white/20"
                    data-testid="input-birthTime"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Place of birth <span className="text-white/30 font-normal">(optional)</span></Label>
                  <Input
                    value={form.birthPlace}
                    onChange={(e) => set("birthPlace", e.target.value)}
                    placeholder="City, Country"
                    className="bg-background border-white/20"
                    data-testid="input-birthPlace"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Section 2: Intake & Consent ── */}
        {section === 2 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Sound healing using tuning forks, singing bowls, and bells is a complementary wellness
              practice. It is not a substitute for medical diagnosis or treatment. The practitioner makes
              no medical claims.
            </p>
            <div className="space-y-3">
              <CheckRow
                label="I understand that this session is a wellness and relaxation practice, not medical treatment."
                checked={form.understandsLimits}
                onChange={(v) => set("understandsLimits", v)}
              />
              <CheckRow
                label="I give consent to receive sound healing in this session and understand I may stop at any time."
                checked={form.consentGiven}
                onChange={(v) => set("consentGiven", v)}
              />
            </div>
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
              <p className="text-xs text-amber-200">
                Both boxes must be checked to proceed. A signed physical copy is recommended for in-person sessions.
              </p>
            </div>
          </div>
        )}

        {/* ── Section 3: Medical Safety ── */}
        {section === 3 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Please answer honestly. These questions identify conditions that require modified technique
              or practitioner judgement. Any "yes" will not cancel your session — it will adjust how we work.
            </p>
            <div className="space-y-3">
              <CheckRow label="I have a pacemaker or implanted cardiac device" checked={form.hasPacemaker} onChange={(v) => set("hasPacemaker", v)} />
              <CheckRow label="I have epilepsy or a seizure disorder" checked={form.hasEpilepsy} onChange={(v) => set("hasEpilepsy", v)} />
              <CheckRow label="I have had surgery, fracture, or significant procedure in the past 6 months" checked={form.recentSurgery} onChange={(v) => set("recentSurgery", v)} />
              <CheckRow label="I have an active implanted electronic device (cochlear implant, neurostimulator, etc.)" checked={form.implantedDevice} onChange={(v) => set("implantedDevice", v)} />
              <CheckRow label="I am currently in acute emotional crisis, severe trauma, or psychotic episode" checked={form.acuteCrisis} onChange={(v) => set("acuteCrisis", v)} />
              <CheckRow label="I have significant tinnitus or sound hypersensitivity" checked={form.soundSensitivity} onChange={(v) => set("soundSensitivity", v)} />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Pregnancy status</Label>
              <Select value={form.pregnancyStatus} onValueChange={(v) => set("pregnancyStatus", v)}>
                <SelectTrigger className="bg-background border-white/20" data-testid="select-pregnancy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">Not pregnant</SelectItem>
                  <SelectItem value="first-trimester">Pregnant — first trimester</SelectItem>
                  <SelectItem value="yes">Pregnant — second/third trimester</SelectItem>
                  <SelectItem value="postpartum">Postpartum (within 6 weeks)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ── Section 4: Sound & Body History ── */}
        {section === 4 && (
          <div className="space-y-5">
            <div className="space-y-3">
              <Label className="text-muted-foreground">Prior experience with sound healing</Label>
              <RadioGroup
                name="priorExperience"
                value={form.priorExperience}
                onChange={(v) => set("priorExperience", v)}
                options={[
                  { value: "none", label: "None — this is my first session" },
                  { value: "some", label: "Some — a few sessions with bowls or forks" },
                  { value: "regular", label: "Regular — I have sound healing as an ongoing practice" },
                  { value: "practitioner", label: "Trained practitioner — I work with instruments myself" },
                ]}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-muted-foreground">Comfort with body contact from instruments</Label>
              <RadioGroup
                name="bodyContact"
                value={form.bodyContact}
                onChange={(v) => set("bodyContact", v)}
                options={[
                  { value: "comfortable", label: "Comfortable — place instruments directly on my body" },
                  { value: "limited", label: "Limited — close to body but not touching" },
                  { value: "field-only", label: "Field only — work in the biofield, no body contact" },
                ]}
              />
            </div>
          </div>
        )}

        {/* ── Section 5: How are you today? ── */}
        {section === 5 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Select the option that most closely matches your current state — not your general nature, just right now.
            </p>
            {[
              {
                key: "doshaBody",
                question: "How does your body feel today?",
                options: [
                  { value: "balanced", label: "Grounded, comfortable, and present" },
                  { value: "vata-like", label: "Light, restless, cold, or scattered" },
                  { value: "pitta-like", label: "Warm, tense, sharp, or intense" },
                  { value: "kapha-like", label: "Heavy, slow, cool, or sluggish" },
                ],
              },
              {
                key: "doshaMind",
                question: "How is your mind right now?",
                options: [
                  { value: "balanced", label: "Clear, settled, and at ease" },
                  { value: "vata-like", label: "Racing, anxious, or jumping between thoughts" },
                  { value: "pitta-like", label: "Focused but pressured, critical, or irritated" },
                  { value: "kapha-like", label: "Foggy, slow, withdrawn, or flat" },
                ],
              },
              {
                key: "doshaSleep",
                question: "How has your sleep been lately?",
                options: [
                  { value: "balanced", label: "Restful, consistent, and restorative" },
                  { value: "vata-like", label: "Light, interrupted, or not enough" },
                  { value: "pitta-like", label: "Vivid dreams, waking hot, or short and intense" },
                  { value: "kapha-like", label: "Heavy, long, or hard to wake from" },
                ],
              },
              {
                key: "doshaAppetite",
                question: "How is your appetite and digestion today?",
                options: [
                  { value: "balanced", label: "Regular hunger, digesting comfortably" },
                  { value: "vata-like", label: "Irregular or forgetting to eat, gassy or bloated" },
                  { value: "pitta-like", label: "Strong or sharp hunger, acid or heat in digestion" },
                  { value: "kapha-like", label: "Low appetite, slow or heavy after eating" },
                ],
              },
              {
                key: "doshaEnergy",
                question: "How is your energy today?",
                options: [
                  { value: "balanced", label: "Steady, sustained, and well-paced" },
                  { value: "vata-like", label: "Erratic — bursts of energy then crashes" },
                  { value: "pitta-like", label: "Driven but depleted — pushing hard" },
                  { value: "kapha-like", label: "Low and hard to mobilise" },
                ],
              },
              {
                key: "doshaEmotions",
                question: "How are you feeling emotionally right now?",
                options: [
                  { value: "balanced", label: "Open, equanimous, and connected" },
                  { value: "vata-like", label: "Anxious, scattered, or emotionally ungrounded" },
                  { value: "pitta-like", label: "Irritable, critical, or carrying frustration" },
                  { value: "kapha-like", label: "Withdrawn, heavy, or emotionally flat" },
                ],
              },
            ].map(({ key, question, options }) => (
              <div key={key} className="space-y-2">
                <Label className="text-white text-sm">{question}</Label>
                <RadioGroup name={key} value={form[key]} onChange={(v) => set(key, v)} options={options} />
              </div>
            ))}
          </div>
        )}

        {/* ── Section 6: Where you hold things ── */}
        {section === 6 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Three short questions about how you process experience. Select what feels truest right now.
            </p>
            {[
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
                question: "Where do you feel stress most in your body?",
                options: [
                  { value: "intellectual", label: "Head, eyes, or jaw — mental tension" },
                  { value: "emotional", label: "Chest or throat — emotional tightness" },
                  { value: "physical", label: "Shoulders, belly, or legs — physical holding" },
                ],
              },
              {
                key: "centerNeglected",
                question: "Which part of yourself feels most neglected right now?",
                options: [
                  { value: "intellectual", label: "Mind — I don't give myself time to reflect" },
                  { value: "emotional", label: "Heart — I suppress or avoid feelings" },
                  { value: "physical", label: "Body — I live mostly in my head" },
                ],
              },
            ].map(({ key, question, options }) => (
              <div key={key} className="space-y-2">
                <Label className="text-white text-sm">{question}</Label>
                <RadioGroup name={key} value={form[key]} onChange={(v) => set(key, v)} options={options} />
              </div>
            ))}
          </div>
        )}

        {/* ── Section 7: Intentions ── */}
        {section === 7 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-muted-foreground">
                What brings you to this session? What would you like to release, integrate, or open?
              </Label>
              <Textarea
                value={form.intentionText}
                onChange={(e) => set("intentionText", e.target.value)}
                placeholder="Share as much or as little as you like…"
                className="bg-background border-white/20 min-h-[100px]"
                data-testid="textarea-intentionText"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">
                Are there any areas of the body, emotions, or life circumstances you want particular attention on?
              </Label>
              <Textarea
                value={form.stressAreas}
                onChange={(e) => set("stressAreas", e.target.value)}
                placeholder="Optional…"
                className="bg-background border-white/20 min-h-[80px]"
                data-testid="textarea-stressAreas"
              />
            </div>
          </div>
        )}

        {/* ── Section 8: Comfort & Engagement ── */}
        {section === 8 && (
          <div className="space-y-5">
            <div className="space-y-3">
              <Label className="text-muted-foreground">Are you open to vocal toning or mantra during the session?</Label>
              <RadioGroup
                name="vocalization"
                value={form.vocalization}
                onChange={(v) => set("vocalization", v)}
                options={[
                  { value: "no", label: "No — I prefer to receive in silence" },
                  { value: "maybe", label: "Maybe — gently guide me if it feels appropriate" },
                  { value: "yes", label: "Yes — I'm open to toning and bija mantras" },
                ]}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-muted-foreground">Familiarity with chakra and energy body concepts</Label>
              <RadioGroup
                name="chakraFamiliarity"
                value={form.chakraFamiliarity}
                onChange={(v) => set("chakraFamiliarity", v)}
                options={[
                  { value: "new", label: "New — please keep explanations simple" },
                  { value: "some", label: "Some familiarity — a basic framework is fine" },
                  { value: "experienced", label: "Experienced — I work with these systems regularly" },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Any additional notes for the practitioner?</Label>
              <Textarea
                value={form.comfortNotes}
                onChange={(e) => set("comfortNotes", e.target.value)}
                placeholder="Sensitivities, preferences, boundaries…"
                className="bg-background border-white/20 min-h-[80px]"
                data-testid="textarea-comfortNotes"
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => setSection((s) => s - 1)}
          disabled={section === 1}
          className="border-white/20 text-muted-foreground"
          data-testid="button-prev"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        {section < TOTAL_SECTIONS ? (
          <Button
            onClick={() => setSection((s) => s + 1)}
            disabled={!canProceed()}
            data-testid="button-next"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="bg-primary hover:bg-primary/90"
            data-testid="button-submit"
          >
            {mutation.isPending ? "Processing…" : "Generate Session Profile"}
          </Button>
        )}
      </div>
    </div>
  );
}
