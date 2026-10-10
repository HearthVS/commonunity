import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { setNexusContext } from "../components/NexusPanel";

const SECTIONS = [
  {
    id: "overview",
    title: "Overview",
    icon: "⚗",
    content: (
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p>
          OM Tuner is a practitioner-grade session planning tool. It is not a standalone healing
          device — it is a reference, protocol library, and session tracking system designed to support
          experienced sound healing practitioners.
        </p>
        <p>
          This guide covers the five core competencies expected of a practitioner using this system:
          instrument knowledge, client intake, protocol execution, contraindication management, and
          session documentation.
        </p>
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4">
          <p className="text-amber-200">
            <span className="font-semibold">Scope reminder:</span> Every protocol in this library includes
            off-body and surrogate alternatives. Default to field work (hovering 5–30 cm above the body)
            unless the client has explicitly consented to body contact and no contraindications exist.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "instruments",
    title: "Instruments",
    icon: "𝄞",
    content: (
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p>
          The inventory contains 25 instruments across three types: weighted tuning forks (fork), singing bowls
          (bowl), and bells (bell). Each instrument has a primary frequency, chakra assignment, elemental
          association, and dosha tags.
        </p>
        <div className="space-y-3">
          {[
            {
              title: "Weighted tuning forks (fork)",
              body: "Weighted forks are designed for body contact. The stem end is activated by striking and placed directly on bony prominences (skull, sternum, wrists, spine). Unweighted forks are held in the field. Always clean stems between clients.",
            },
            {
              title: "Singing bowls (bowl)",
              body: "Bowls produce sustained harmonic overtones. Strike with a mallet, then circle the rim for continuous tone. Placement: on flat surfaces beside or below the client. Crystal bowls are not for body placement.",
            },
            {
              title: "Bells (bell)",
              body: "Bells are used for punctuation — opening, closing, transitions between protocol phases. A clear bell tone at the start of a session signals to the nervous system that sacred space has opened.",
            },
          ].map((item) => (
            <div key={item.title} className="bg-card border border-white/10 rounded-lg p-4">
              <p className="font-medium text-white mb-1.5">{item.title}</p>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "intake",
    title: "Client Intake",
    icon: "📋",
    content: (
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p>
          The 8-section pre-session questionnaire generates a personalised session profile including:
          contraindication flags, dominant dosha, dominant Gurdjieff center, suggested chakra focus,
          recommended comfort tier, and protocol recommendation.
        </p>
        <div className="space-y-3">
          <div className="bg-red-900/20 border border-red-500/40 rounded-xl p-4">
            <p className="text-red-200 font-medium mb-2">Absolute contraindications — work off-body only or defer to physician:</p>
            <ul className="space-y-1 text-red-300">
              {[
                "Active pacemaker or implanted cardiac device",
                "Active epilepsy with uncontrolled seizures",
                "Acute psychotic episode",
                "Open wounds at placement sites",
              ].map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="mt-0.5">·</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4">
            <p className="text-amber-200 font-medium mb-2">Relative contraindications — modify technique:</p>
            <ul className="space-y-1 text-amber-300">
              {[
                "Pregnancy (first trimester) — avoid lower abdomen/sacrum",
                "Recent surgery or fracture — avoid placement over healing sites",
                "Tinnitus / sound sensitivity — reduce volume and session duration",
                "Acute trauma — grounding protocols only; no deep emotional work",
              ].map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="mt-0.5">·</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "protocols",
    title: "Protocol Execution",
    icon: "🔁",
    content: (
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p>
          Every session uses the same ceremonial structure regardless of the middle protocol chosen:
        </p>
        <div className="space-y-3">
          {[
            {
              phase: "1. OM Opener (3–5 min)",
              desc: "Strike TF-PW-HEART and TF-OM-136W simultaneously. Hold at the sternum (or 5 cm above). Invite the client to tone OM with you for three breaths. Set the session intention in the silence that follows.",
              color: "teal",
            },
            {
              phase: "2. Core Protocol",
              desc: "Follow the selected protocol's phase sequence. Each phase specifies instrument, placement, technique, and duration. Adapt based on the client's comfort tier and any contraindication flags from the intake.",
              color: "indigo",
            },
            {
              phase: "3. Integration (2–3 min)",
              desc: "After the main work, allow 2–3 minutes of complete silence. No instruments, no guidance. The nervous system integrates in stillness.",
              color: "purple",
            },
            {
              phase: "4. OM Closer (3–5 min)",
              desc: "Return to TF-PW-HEART + TF-OM-136W at the sternum. Three slow OM tones. Complete silence after the final fade. Gentle verbal re-entry: 'Take your time. When you're ready, begin to return.'",
              color: "teal",
            },
          ].map((item) => (
            <div key={item.phase} className={`bg-${item.color}-900/20 border border-${item.color}-500/30 rounded-xl p-4`}>
              <p className={`font-medium text-${item.color}-200 mb-1.5`}>{item.phase}</p>
              <p className={`text-${item.color}-300/80`}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "multi-lineage",
    title: "Multi-Lineage Practice",
    icon: "∞",
    content: (
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p>
          OM Tuner honours multiple healing lineages rather than privileging any single system.
          Where frequency assignments differ, all systems are shown with attribution.
        </p>
        <div className="grid grid-cols-1 gap-3">
          {[
            {
              system: "Cousto / Planetware",
              principle: "Planetary octave transposition. Frequencies derived from orbital periods of celestial bodies. The foundational physics layer.",
            },
            {
              system: "Solfeggio",
              principle: "Ancient liturgical scale rediscovered by Joseph Puleo. Claimed resonance with cellular processes. Attribution required: claims are contested.",
            },
            {
              system: "Western Tonal",
              principle: "12-tone equal temperament (A=432 Hz or A=440 Hz variants). Otto forks, BioSonic forks. Familiar to musicians.",
            },
            {
              system: "Āyurveda",
              principle: "Dosha-based frequency selection. Vāta: grounding low frequencies. Pitta: cooling mid frequencies. Kapha: stimulating higher frequencies.",
            },
            {
              system: "Chakra system",
              principle: "Seven energy centres with traditional colour, element, and bija mantra assignments. Multiple frequency mapping traditions exist — show all.",
            },
            {
              system: "Gurdjieff Centers",
              principle: "Physical, Emotional, Intellectual intelligence centers. Guides which type of experience the session should emphasise.",
            },
          ].map((item) => (
            <div key={item.system} className="bg-card border border-white/10 rounded-xl p-4">
              <p className="font-medium text-white mb-1">{item.system}</p>
              <p className="text-xs">{item.principle}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "documentation",
    title: "Session Documentation",
    icon: "📝",
    content: (
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p>
          The Session Log stores the complete practice record. Recommended fields to complete after every session:
        </p>
        <ul className="space-y-2">
          {[
            "Client name and session date",
            "Protocol used and comfort tier delivered",
            "Instruments actually used (may differ from protocol)",
            "Chakras focused during the session",
            "In-session notes: client responses, deviations from protocol",
            "Post-session notes: client feedback, follow-up recommendations",
            "Overall session rating (1–5) — for your practice development",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-primary">{i + 1}</span>
              </div>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="bg-card border border-white/10 rounded-xl p-4">
          <p className="text-white font-medium mb-1.5">Gap analysis</p>
          <p>
            After three or more sessions with the same client, the Session Log dashboard shows average
            duration, average rating, and session frequency. Use this to identify practice gaps — clients
            who would benefit from more frequent sessions, or protocols that consistently yield low ratings.
          </p>
        </div>
      </div>
    ),
  },
];

export default function PractitionerGuide() {
  const [active, setActive] = useState("overview");
  const activeSection = SECTIONS.find((s) => s.id === active)!;

  useEffect(() => {
    setNexusContext("Practitioner Guide\nSession design, client preparation, contraindication protocols, and ethical guidelines for sound healing practice.");
    return () => setNexusContext("Sound healing practitioner tool — OM Tuner");
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-white">Practitioner Guide</h1>
        <p className="text-sm text-muted-foreground">
          Reference documentation for OM Tuner v1. Covers instrument types, intake protocol,
          session execution, multi-lineage practice, and documentation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Nav */}
        <div className="md:col-span-1">
          <nav className="space-y-1 sticky top-6">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                  active === s.id
                    ? "bg-primary/20 text-white"
                    : "text-muted-foreground hover:bg-white/5"
                }`}
                data-testid={`guide-section-${s.id}`}
              >
                <span className="text-base">{s.icon}</span>
                <span>{s.title}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="md:col-span-3">
          <div className="bg-card border border-white/10 rounded-xl p-6 space-y-4">
            <h2 className="font-bold text-white">{activeSection.title}</h2>
            {activeSection.content}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="bg-card border border-white/10 rounded-xl p-5 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Links</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/inventory">
            <Button variant="outline" size="sm" className="border-white/20 text-muted-foreground">Instrument Inventory</Button>
          </Link>
          <Link href="/questionnaire">
            <Button variant="outline" size="sm" className="border-white/20 text-muted-foreground">Pre-Session Questionnaire</Button>
          </Link>
          <Link href="/protocols">
            <Button variant="outline" size="sm" className="border-white/20 text-muted-foreground">Protocol Library</Button>
          </Link>
          <Link href="/why-om">
            <Button variant="outline" size="sm" className="border-white/20 text-muted-foreground">Why OM at 136.10 Hz?</Button>
          </Link>
          <Link href="/sources">
            <Button variant="outline" size="sm" className="border-white/20 text-muted-foreground">Source Library</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
