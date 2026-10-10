import { useEffect, useState } from "react";
import { Layers, ChevronDown, ChevronUp, Link2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { parseArr } from "@/lib/utils";
import type { Kosha, Instrument } from "@shared/schema";
import { setNexusContext } from "../components/NexusPanel";
import { Link } from "wouter";

const LAYER_LABELS: Record<number, { roman: string; bg: string }> = {
  1: { roman: "I",   bg: "rgba(204,0,0,0.12)" },
  2: { roman: "II",  bg: "rgba(255,140,0,0.12)" },
  3: { roman: "III", bg: "rgba(255,215,0,0.12)" },
  4: { roman: "IV",  bg: "rgba(34,139,34,0.12)" },
  5: { roman: "V",   bg: "rgba(30,144,255,0.12)" },
  6: { roman: "VI",  bg: "rgba(75,0,130,0.12)" },
  7: { roman: "VII", bg: "rgba(148,0,211,0.12)" },
};

function InstrumentBadge({ id, instruments }: { id: string; instruments: Instrument[] }) {
  const inst = instruments.find((i) => i.id === id);
  return (
    <Link href={`/inventory/${id}`}>
      <span
        className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-mono cursor-pointer hover:bg-primary/35 transition-colors"
        title={inst ? `${inst.name} — ${inst.frequency} Hz` : id}
        data-testid={`badge-instrument-${id}`}
      >
        {id}
      </span>
    </Link>
  );
}

export default function KoshasAtlas() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
      "Koshas Atlas — 7 Subtle Body Layers\nThe five classical koshas (Taittiriya Upanishad) extended to a 7-layer model incorporating Theosophical, Brennan, and Gene Keys frameworks. Indicates which instruments are most relevant to each layer and the application modality."
    );
    return () => setNexusContext("Frequency toolkit — OM Tuner");
  }, []);

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-3">
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        icon={<Layers size={20} />}
        title="Koshas Atlas"
        description="The Taittiriya Upanishad describes five koshas (sheaths) enclosing pure consciousness. This atlas extends the classical model to seven layers by incorporating the Theosophical tradition (Annie Besant / C.W. Leadbeater), Barbara Brennan's Hands of Light auric anatomy, and the Seven Seals of Gene Key 22. Each layer is mapped to an instrument set from your inventory with a specific application modality."
      />

      {/* Lineage note */}
      <div className="bg-card border border-white/10 rounded-xl p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-white">Multiple lineages:</span>{" "}
          Layers 1–5 are canonical Sanskrit koshas (Taittiriya Upanishad, ~800 BCE).
          Layers 6–7 are extended using Theosophical and Gene Keys frameworks.
          Where naming differs between systems, both names are shown.
          Instrument assignments are a CommonUnity synthesis — not claimed by any single tradition.
        </p>
      </div>

      {/* Layer cards — stacked ascending order */}
      <div className="space-y-3">
        {koshas.map((kosha) => {
          const primaryIds = parseArr(kosha.primaryInstruments as unknown as string);
          const secondaryIds = parseArr(kosha.secondaryInstruments as unknown as string ?? "[]");
          const isOpen = expanded[kosha.id] ?? false;
          const label = LAYER_LABELS[kosha.layerNumber] ?? { roman: String(kosha.layerNumber), bg: "rgba(43,201,184,0.12)" };

          return (
            <div
              key={kosha.id}
              className="bg-card border rounded-xl overflow-hidden transition-all"
              style={{ borderColor: kosha.colorHex ?? "#2BC9B8" }}
              data-testid={`card-kosha-${kosha.id}`}
            >
              {/* Top accent bar */}
              <div className="h-1" style={{ background: kosha.colorHex ?? "#2BC9B8" }} />

              {/* Collapsed header — always visible */}
              <button
                className="w-full text-left p-5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
                onClick={() => toggle(kosha.id)}
                data-testid={`toggle-kosha-${kosha.id}`}
                aria-expanded={isOpen}
              >
                {/* Layer number badge */}
                <div
                  className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                  style={{ background: label.bg, color: kosha.colorHex ?? "#2BC9B8", border: `1px solid ${kosha.colorHex ?? "#2BC9B8"}40` }}
                >
                  {label.roman}
                </div>

                {/* Names */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="font-bold text-white text-sm">{kosha.sanskritName}</h3>
                    <span className="text-xs text-muted-foreground">{kosha.englishName}</span>
                    {kosha.isExtendedKosha && (
                      <span className="text-xs px-1.5 py-0.5 rounded border border-white/20 text-muted-foreground">
                        Extended
                      </span>
                    )}
                  </div>
                  {/* Primary instruments preview */}
                  {!isOpen && primaryIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {primaryIds.slice(0, 3).map((id) => (
                        <span key={id} className="text-xs font-mono text-primary/70">{id}</span>
                      ))}
                      {primaryIds.length > 3 && <span className="text-xs text-muted-foreground">+{primaryIds.length - 3}</span>}
                    </div>
                  )}
                </div>

                {/* Biofield distance */}
                {kosha.biofieldPosition && (
                  <span className="hidden sm:block text-xs text-muted-foreground shrink-0 bg-white/5 px-2 py-1 rounded">
                    {kosha.biofieldPosition}
                  </span>
                )}

                {/* Expand chevron */}
                <div className="shrink-0 text-muted-foreground">
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {/* Expanded body */}
              {isOpen && (
                <div className="px-5 pb-5 space-y-4 border-t border-white/5">
                  {/* Cross-system names */}
                  <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {kosha.theosophicalName && (
                      <div className="bg-white/[0.03] rounded-lg p-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Theosophical</p>
                        <p className="text-xs text-white/80">{kosha.theosophicalName}</p>
                      </div>
                    )}
                    {kosha.brennanLevel && (
                      <div className="bg-white/[0.03] rounded-lg p-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Brennan Level</p>
                        <p className="text-xs text-white/80">{kosha.brennanLevel}</p>
                      </div>
                    )}
                    {kosha.geneKeySeal && (
                      <div className="bg-white/[0.03] rounded-lg p-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Gene Key Seal</p>
                        <p className="text-xs text-white/80">{kosha.geneKeySeal}</p>
                        {(kosha.geneKeyShadow || kosha.geneKeyGift) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Shadow: {kosha.geneKeyShadow} → Gift: {kosha.geneKeyGift}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Domain */}
                  {kosha.domain && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Domain</p>
                      <p className="text-sm text-white/80 leading-relaxed">{kosha.domain}</p>
                    </div>
                  )}

                  {/* Vibrational quality */}
                  {kosha.vibrationalQuality && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Vibrational Quality</p>
                      <p className="text-sm text-muted-foreground leading-relaxed italic">{kosha.vibrationalQuality}</p>
                    </div>
                  )}

                  {/* Biofield + frequency */}
                  <div className="flex flex-wrap gap-3">
                    {kosha.biofieldPosition && (
                      <div className="bg-white/[0.03] rounded-lg px-3 py-2 text-xs">
                        <span className="text-muted-foreground">Field position: </span>
                        <span className="text-white">{kosha.biofieldPosition}</span>
                      </div>
                    )}
                    {kosha.frequencyRange && (
                      <div className="bg-white/[0.03] rounded-lg px-3 py-2 text-xs">
                        <span className="text-muted-foreground">Frequency range: </span>
                        <span className="text-white">{kosha.frequencyRange}</span>
                      </div>
                    )}
                    {kosha.chakraId && (
                      <div className="bg-white/[0.03] rounded-lg px-3 py-2 text-xs">
                        <span className="text-muted-foreground">Primary chakra: </span>
                        <span className="text-white">{kosha.chakraId.replace("CH-", "").toLowerCase().replace("-", " ")}</span>
                      </div>
                    )}
                  </div>

                  {/* Sound healing interaction */}
                  {kosha.soundHealingInteraction && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Sound Healing Interaction</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{kosha.soundHealingInteraction}</p>
                    </div>
                  )}

                  {/* Instruments */}
                  <div className="pt-3 border-t border-white/5 space-y-3">
                    {primaryIds.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Primary Instruments</p>
                        <div className="flex flex-wrap gap-2">
                          {primaryIds.map((id) => (
                            <InstrumentBadge key={id} id={id} instruments={instruments} />
                          ))}
                        </div>
                      </div>
                    )}
                    {secondaryIds.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Secondary Instruments</p>
                        <div className="flex flex-wrap gap-2">
                          {secondaryIds.map((id) => (
                            <InstrumentBadge key={id} id={id} instruments={instruments} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Application mode */}
                  {kosha.applicationMode && (
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                      <p className="text-xs font-medium text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Link2 size={12} style={{ color: kosha.colorHex ?? "#2BC9B8" }} />
                        Application Mode
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{kosha.applicationMode}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="bg-card border border-white/10 rounded-xl p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Instrument assignments are working hypotheses derived from frequency research and traditional system correspondences.
          All body-contact work should be preceded by consent and contraindication screening.
          Off-body and field-only modalities are always available as alternatives.
        </p>
      </div>
    </div>
  );
}
