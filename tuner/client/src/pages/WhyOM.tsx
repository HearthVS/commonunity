import { useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import ChladniCanvas from "@/components/ChladniCanvas";
import { formatHz } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { setNexusContext } from "../components/NexusPanel";

const OM_HZ = 136.10;

export default function WhyOM() {
  useEffect(() => {
    setNexusContext("Why OM — 136.10 Hz\nThe Earth Year frequency, Cousto derivation, co-chanting practice with two heart forks at the sternum, and the ceremonial container.");
    return () => setNexusContext("Frequency toolkit — OM Tuner");
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-10">
      {/* Hero */}
      <PageHeader
        title="Why OM at 136.10 Hz?"
        description="The OM ceremony at 136.10 Hz is the ceremonial container of every CommonUnity sound healing session. Understanding its origins — cosmological, physiological, and musical — deepens both the practitioner's intention and the client's receptivity."
        actions={<span className="text-sm font-mono bg-teal-500/20 text-teal-300 px-3 py-1 rounded-full">{formatHz(OM_HZ)}</span>}
      />

      {/* Chladni pattern */}
      <div className="bg-card border border-teal-500/30 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Chladni Pattern at 136.10 Hz</p>
          <span className="text-xs font-mono text-teal-300">{formatHz(OM_HZ)} · Earth Year</span>
        </div>
        <div className="flex items-center justify-center p-8">
          <ChladniCanvas frequency={OM_HZ} size={260} color="#00CED1" />
        </div>
        <div className="px-5 pb-5">
          <p className="text-xs text-muted-foreground italic text-center">
            The Chladni figure at 136.10 Hz. Sand placed on a vibrating plate driven at this frequency
            would organise into this nodal pattern — a visible geometry of the Earth's annual song.
          </p>
        </div>
      </div>

      {/* The Cousto calculation */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">The Cousto Calculation</h2>
        <div className="bg-card border border-white/10 rounded-xl p-5 space-y-3">
          <p className="text-sm text-white leading-relaxed">
            Hans Cousto (1988) proposed that any cyclic phenomenon in nature can be octave-transposed into
            the audible range. The Earth's orbital period — one year (365.25 days) — translates as follows:
          </p>
          <div className="bg-background rounded-lg p-4 space-y-2 font-mono text-xs">
            <p className="text-muted-foreground">Earth Year = 365.25 days × 86,400 s/day = 31,557,600 s</p>
            <p className="text-muted-foreground">Fundamental = 1 / 31,557,600 ≈ 3.168×10⁻⁸ Hz</p>
            <p className="text-muted-foreground">Octave-transpose: × 2³² (32 octaves) = 136.10 Hz</p>
            <p className="text-teal-300 font-semibold mt-2">→ 136.10 Hz ≈ C# · Earth Year · OM</p>
          </div>
          <p className="text-sm text-muted-foreground">
            This is not a mystical correspondence — it is a mathematical consequence of octave equivalence
            applied to the planet's orbital period. Cousto called this frequency the "OM tone" because
            ancient Indian cosmology associates OM with the frequency of the cosmos itself.
          </p>
        </div>
      </section>

      {/* Physiological resonance */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Physiological Resonance</h2>
        <div className="bg-card border border-white/10 rounded-xl p-5 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            136.10 Hz falls in the range associated with calming, sedative, and integrative effects in
            clinical sound research. Proposed mechanisms include:
          </p>
          <ul className="space-y-3">
            {[
              {
                title: "Vagal tone support",
                body: "The heart's autonomic rhythm is influenced by low-frequency acoustic input. 136 Hz is within the range that may stimulate the vagus nerve via bone conduction when applied to the sternum.",
              },
              {
                title: "Heart coherence",
                body: "HeartMath research identifies 0.1 Hz (6 breaths/minute) as optimal HRV coherence. 136.10 Hz is 1361 × 0.1 Hz — a higher harmonic of the heart coherence resonance, though this correspondence remains speculative.",
              },
              {
                title: "Nitric oxide release",
                body: "Studies on humming and resonant breathing show increased nitric oxide production at specific vibration frequencies. 136 Hz in the chest cavity may support NO release, which is vasodilatory and anti-inflammatory.",
              },
            ].map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground italic border-t border-white/5 pt-3">
            These mechanisms are proposed, not clinically proven. Present to clients as explanatory models, not medical claims.
          </p>
        </div>
      </section>

      {/* Vedic context */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Vedic Context</h2>
        <div className="bg-card border border-white/10 rounded-xl p-5 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            In Vedic philosophy, OM (Aum) is the primordial sound — Nāda Brahman — from which all creation emerges.
            The Māṇḍūkya Upaniṣad (c. 7th century BCE) describes OM's four states corresponding to waking
            (A), dreaming (U), deep sleep (M), and the transcendent silence beyond (the fourth, turīya).
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            136.10 Hz bridges this ancient cosmological concept with measurable planetary cycles. Whether you
            hold the frequency as a devotional object (OM as sound of the cosmos) or a physical fact
            (Earth's orbital frequency in the audible range), the subjective experience — deep calm, coherence,
            and a quality of homecoming — is consistently reported across traditions.
          </p>
        </div>
      </section>

      {/* The ceremony */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">The Ceremony</h2>
        <div className="bg-teal-900/20 border border-teal-500/30 rounded-xl p-5 space-y-4">
          <p className="text-sm text-teal-100 leading-relaxed">
            The CommonUnity OM opener/closer uses two heart forks (TF-PW-HEART, practitioner + TF-OM-136W,
            client) simultaneously at the sternum. This creates:
          </p>
          <ul className="space-y-2">
            {[
              "Acoustic entrainment — both fields at identical frequency, minimising dissonance",
              "Co-chanting container — practitioner and client both sounding OM simultaneously",
              "Sternum placement — bone conduction into the thoracic cavity, surrounding the heart",
              "Ceremonial boundary — a clear energetic opening and closing signal for both parties",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-teal-200">
                <span className="text-teal-400 mt-0.5">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-teal-200 italic">
            "OM is not a symbol we use. It is the frequency we enter together."
          </p>
        </div>
      </section>

      {/* CTA */}
      <div className="flex gap-3">
        <Link href="/inventory/TF-PW-HEART">
          <Button variant="outline" className="border-white/20 text-muted-foreground">
            View TF-PW-HEART
          </Button>
        </Link>
        <Link href="/protocols">
          <Button className="bg-primary hover:bg-primary/90">
            Browse Protocols
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
