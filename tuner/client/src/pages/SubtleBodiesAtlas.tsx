import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { parseArr } from "@/lib/utils";
import type { Kosha, Instrument } from "@shared/schema";
import { setNexusContext } from "../components/NexusPanel";
import { Link } from "wouter";

// Each layer maps to one rendered "body" in the nested visual
// Outer layers are wider (lower opacity) — inner layers narrower (higher opacity)
const LAYER_VISUAL: Record<number, { opacity: number; paddingClass: string }> = {
  7: { opacity: 0.15, paddingClass: "px-0" },
  6: { opacity: 0.22, paddingClass: "px-3" },
  5: { opacity: 0.32, paddingClass: "px-6" },
  4: { opacity: 0.42, paddingClass: "px-9" },
  3: { opacity: 0.55, paddingClass: "px-12" },
  2: { opacity: 0.70, paddingClass: "px-16" },
  1: { opacity: 1.0,  paddingClass: "px-20" },
};

function InstrumentBadge({ id, instruments }: { id: string; instruments: Instrument[] }) {
  const inst = instruments.find((i) => i.id === id);
  return (
    <Link href={`/inventory/${id}`}>
      <span
        className="text-xs px-2 py-0.5 rounded bg-[var(--primary)]/20 text-[var(--primary)] font-mono cursor-pointer hover:bg-[var(--primary)]/35 transition-colors"
        title={inst ? `${inst.name} — ${inst.frequency} Hz` : id}
        data-testid={`badge-sb-instrument-${id}`}
      >
        {id}
      </span>
    </Link>
  );
}

export default function SubtleBodiesAtlas() {
  const { data: koshas = [], isLoading } = useQuery<Kosha[]>({
    queryKey: ["/api/koshas"],
    queryFn: () => apiRequest("GET", "/api/koshas").then((r) => r.json()),
  });

  const { data: instruments = [] } = useQuery<Instrument[]>({
    queryKey: ["/api/instruments"],
    queryFn: () => apiRequest("GET", "/api/instruments").then((r) => r.json()),
  });

  useEffect(() => {
    setNexusContext(
      "Subtle Bodies Atlas — 7 Seals of Gene Key 22\nThe seven subtle bodies mapped through Barbara Brennan's auric anatomy, the Theosophical tradition, and the seven evolutionary Seals of Gene Key 22 (Grace). Each body is linked to its primary instruments and recommended application distance."
    );
    return () => setNexusContext("Sound healing practitioner tool — OM Tuner");
  }, []);

  // Sort outer → inner for the nested visual (7 down to 1)
  const reversedKoshas = [...koshas].reverse();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="space-y-3">
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <PageHeader
        icon={<Sparkles size={20} />}
        title="Subtle Bodies Atlas"
        description="The seven subtle bodies viewed through three complementary lenses: the Theosophical tradition (Besant & Leadbeater), Barbara Brennan's clinical auric anatomy (Hands of Light), and the Seven Seals of Gene Key 22 — the integrating Gene Key of Grace. The nested diagram below shows how each body wraps around the next, innermost to outermost."
      />

      {/* Lineage note */}
      <div className="bg-[var(--card)] border border-white/10 rounded-xl p-4">
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          <span className="font-semibold text-white">Lineage sources:</span>{" "}
          Theosophical names from Annie Besant &amp; C.W. Leadbeater (1900–1925).
          Brennan levels from <em>Hands of Light</em> (1987) and <em>Light Emerging</em> (1993).
          Gene Keys seals from Richard Rudd, <em>The Gene Keys</em> (2009, updated 2013).
          Instrument mappings are a CommonUnity synthesis.
        </p>
      </div>

      {/* Nested visual diagram */}
      <div className="bg-[var(--card)] border border-white/10 rounded-xl p-6 overflow-hidden">
        <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-5 text-center">
          Nested Body Map — outer to inner
        </p>
        <div className="relative flex flex-col items-center gap-0.5">
          {reversedKoshas.map((kosha) => {
            const vis = LAYER_VISUAL[kosha.layerNumber] ?? { opacity: 0.5, paddingClass: "px-8" };
            return (
              <div
                key={kosha.id}
                className={`w-full rounded-lg py-2 flex items-center justify-between gap-2 ${vis.paddingClass} transition-all`}
                style={{
                  background: `${kosha.colorHex ?? "#6366f1"}${Math.round(vis.opacity * 30).toString(16).padStart(2,"0")}`,
                  border: `1px solid ${kosha.colorHex ?? "#6366f1"}${Math.round(vis.opacity * 80).toString(16).padStart(2,"0")}`,
                }}
                data-testid={`layer-visual-${kosha.layerNumber}`}
              >
                <span className="text-xs font-bold" style={{ color: kosha.colorHex ?? "#6366f1" }}>
                  {kosha.layerNumber}
                </span>
                <span className="text-xs text-white/70 text-center flex-1 truncate px-2">
                  {kosha.theosophicalName
                    ? kosha.theosophicalName.split("—")[0].trim()
                    : kosha.englishName}
                </span>
                <span className="text-xs text-[var(--muted)] shrink-0 hidden sm:block">
                  {kosha.biofieldPosition ?? ""}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted)] text-center mt-4">
          Physical body at center ↓ — Ketheric / Monadic body at outer edge ↑
        </p>
      </div>

      {/* Detail cards — outer-to-inner matches the "peeling back" approach in session */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Seven Bodies — Detailed Reference</h2>

        {/* Iterate in forward order (1→7) for reference clarity */}
        {koshas.map((kosha) => {
          const primaryIds = parseArr(kosha.primaryInstruments as unknown as string);
          const secondaryIds = parseArr(kosha.secondaryInstruments as unknown as string ?? "[]");

          return (
            <div
              key={kosha.id}
              className="bg-[var(--card)] border rounded-xl overflow-hidden"
              style={{ borderColor: `${kosha.colorHex ?? "#6366f1"}60` }}
              data-testid={`card-subtlebody-${kosha.id}`}
            >
              <div className="h-1" style={{ background: kosha.colorHex ?? "#6366f1" }} />
              <div className="p-5 space-y-4">
                {/* Header row */}
                <div className="flex items-start gap-4">
                  <div
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: `${kosha.colorHex ?? "#6366f1"}25`, color: kosha.colorHex ?? "#6366f1", border: `1px solid ${kosha.colorHex ?? "#6366f1"}50` }}
                  >
                    {kosha.layerNumber}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <h3 className="font-bold text-white text-sm">{kosha.englishName}</h3>
                      {kosha.isExtendedKosha && (
                        <span className="text-xs px-1.5 py-0.5 rounded border border-white/20 text-[var(--muted)]">Extended</span>
                      )}
                    </div>
                    {kosha.geneKeySeal && (
                      <p className="text-xs mt-0.5" style={{ color: kosha.colorHex ?? "#6366f1" }}>
                        {kosha.geneKeySeal}
                        {kosha.geneKeySiddhi && ` — ${kosha.geneKeySiddhi}`}
                      </p>
                    )}
                  </div>
                  {kosha.biofieldPosition && (
                    <span className="shrink-0 text-xs text-[var(--muted)] bg-white/5 px-2 py-1 rounded">
                      {kosha.biofieldPosition}
                    </span>
                  )}
                </div>

                {/* Three-lens names */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {kosha.theosophicalName && (
                    <div className="bg-white/[0.03] rounded-lg p-3">
                      <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1">Theosophical</p>
                      <p className="text-xs text-white/80">{kosha.theosophicalName}</p>
                    </div>
                  )}
                  {kosha.brennanLevel && (
                    <div className="bg-white/[0.03] rounded-lg p-3">
                      <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1">Brennan — <em>Hands of Light</em></p>
                      <p className="text-xs text-white/80">{kosha.brennanLevel}</p>
                    </div>
                  )}
                </div>

                {/* Vibrational quality */}
                {kosha.vibrationalQuality && (
                  <p className="text-sm text-[var(--muted)] leading-relaxed italic border-l-2 pl-3"
                    style={{ borderColor: `${kosha.colorHex ?? "#6366f1"}60` }}>
                    {kosha.vibrationalQuality}
                  </p>
                )}

                {/* Gene Key shadow / gift */}
                {(kosha.geneKeyShadow || kosha.geneKeyGift) && (
                  <div className="flex gap-4 text-xs">
                    {kosha.geneKeyShadow && (
                      <span className="text-red-400/70">Shadow: {kosha.geneKeyShadow}</span>
                    )}
                    {kosha.geneKeyGift && (
                      <span className="text-emerald-400/70">Gift: {kosha.geneKeyGift}</span>
                    )}
                  </div>
                )}

                {/* Sound healing */}
                {kosha.soundHealingInteraction && (
                  <div>
                    <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5">Sound Healing</p>
                    <p className="text-sm text-[var(--muted)] leading-relaxed">{kosha.soundHealingInteraction}</p>
                  </div>
                )}

                {/* Instruments */}
                {primaryIds.length > 0 && (
                  <div className="pt-3 border-t border-white/5 space-y-2">
                    <div>
                      <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Primary</p>
                      <div className="flex flex-wrap gap-2">
                        {primaryIds.map((id) => (
                          <InstrumentBadge key={id} id={id} instruments={instruments} />
                        ))}
                      </div>
                    </div>
                    {secondaryIds.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Secondary</p>
                        <div className="flex flex-wrap gap-2">
                          {secondaryIds.map((id) => (
                            <InstrumentBadge key={id} id={id} instruments={instruments} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Application mode */}
                {kosha.applicationMode && (
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                    <p className="text-xs font-medium text-white uppercase tracking-wider mb-2">Application</p>
                    <p className="text-sm text-[var(--muted)] leading-relaxed">{kosha.applicationMode}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="bg-[var(--card)] border border-white/10 rounded-xl p-4">
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Gene Keys Seal assignments are sourced from Richard Rudd's commentary on the 22nd Gene Key and the Seven Seals framework.
          Sound healing assignments are a CommonUnity synthesis drawing on Biofield Tuning, Cousto planetary frequencies, and Solfeggio research.
          Off-body and surrogate modalities are always available as alternatives to direct body contact.
        </p>
      </div>
    </div>
  );
}
