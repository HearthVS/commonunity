import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { parseArr, parseObj, CHAKRA_COLORS, formatHz } from "@/lib/utils";
import type { Chakra } from "@shared/schema";
import ChladniCanvas from "../components/ChladniCanvas";
import { setNexusContext } from "../components/NexusPanel";

export default function ChakraDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: chakra, isLoading } = useQuery<Chakra>({
    queryKey: ["/api/chakras", id],
    queryFn: async () => {
      const res = await fetch(`/api/chakras/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  useEffect(() => {
    if (chakra) {
      const themes = parseArr(chakra.themes).slice(0, 3).join(", ");
      setNexusContext(
        `Viewing chakra: ${chakra.sanskrit} (${chakra.id})\n` +
        `Element: ${chakra.element || "—"} | Bija: ${chakra.bijaMantraShort || "—"}\n` +
        (chakra.frequencyCousto ? `Cousto: ${chakra.frequencyCousto} Hz` : "") +
        (chakra.frequencySolfeggio ? ` | Solfeggio: ${chakra.frequencySolfeggio} Hz` : "") +
        (themes ? `\nThemes: ${themes}` : "")
      );
    }
    return () => setNexusContext("Sound healing practitioner tool — OM Tuner");
  }, [chakra]);

  if (isLoading) return <div className="p-6"><Skeleton className="h-96"/></div>;
  if (!chakra) return <div className="p-6 text-muted-foreground">Chakra not found.</div>;

  const color = CHAKRA_COLORS[chakra.id] || "#2BC9B8";
  const themes = parseArr(chakra.themes);
  const imbalance = parseObj(chakra.imbalanceSigns);
  const asanas = parseArr(chakra.asanas);
  const physicalCorrelates = parseArr(chakra.physicalCorrelates);
  const forks = parseArr(chakra.recommendedForks);
  const layering = parseArr(chakra.layeringPattern);
  const placement = parseObj(chakra.placementGuide);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/chakras" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft size={14}/> Chakra Atlas
      </Link>

      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}25`, border: `2px solid ${color}50` }}
        >
          <span className="text-xl font-bold" style={{color}}>{chakra.sortOrder}</span>
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{chakra.sanskrit}</h1>
            <span className="text-muted-foreground text-sm">{chakra.sanskritMeaning}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {chakra.element && <span><strong>Element:</strong> {chakra.element}</span>}
            {chakra.fingerCorrespondence && <span>· <strong>Finger:</strong> {chakra.fingerCorrespondence}</span>}
            {chakra.locationPhysical && <span>· {chakra.locationPhysical}</span>}
          </div>
          {chakra.affirmationEnglish && (
            <p className="text-sm italic text-foreground/70 mt-2 border-l-2 pl-3" style={{borderColor: color}}>
              "{chakra.affirmationEnglish}"
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="space-y-4">
          {/* Chladni */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Resonance Pattern</div>
            <ChladniCanvas frequency={chakra.frequencyCousto || 136.1} color={color} size={200}/>
            {chakra.frequencyCousto && (
              <p className="text-xs text-muted-foreground text-center mt-2">{formatHz(chakra.frequencyCousto)} Cousto</p>
            )}
          </div>

          {/* Mantra */}
          {chakra.bijaMantraShort && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Bīja Mantra</div>
              <div className="text-3xl font-bold text-center mb-2" style={{color}}>{chakra.bijaMantraShort}</div>
              {chakra.bijaMantraLong && <div className="text-sm text-muted-foreground text-center">{chakra.bijaMantraLong}</div>}
              {chakra.vowelSound && <div className="text-xs text-muted-foreground text-center mt-1">Vowel: {chakra.vowelSound}</div>}
            </div>
          )}

          {/* Color */}
          {chakra.colorHex && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Color</div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full" style={{background: chakra.colorHex}}/>
                <div>
                  <div className="text-sm font-medium">{chakra.colorTraditional}</div>
                  {chakra.colorCoustoWavelength && <div className="text-xs text-muted-foreground">{chakra.colorCoustoWavelength}</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="lg:col-span-2 space-y-4">
          {/* Themes */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Themes</div>
            <div className="flex flex-wrap gap-1.5">
              {themes.map(t => <span key={t} className="tag-pill" style={{background:`${color}15`, color, borderColor:`${color}30`}}>{t}</span>)}
            </div>
          </div>

          {/* Multi-system frequencies */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Frequencies — Multi-system (all attributed)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {chakra.frequencyCousto && <FreqBadge label="Cousto" freq={chakra.frequencyCousto} color={color} note="The Cosmic Octave"/>}
              {chakra.frequencySolfeggio && <FreqBadge label="Solfeggio" freq={chakra.frequencySolfeggio} color="#f59e0b"/>}
              {chakra.frequencyWestern && <div className="bg-secondary/50 rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Western Tonal</div>
                <div className="text-sm font-semibold">{chakra.frequencyWestern}</div>
              </div>}
              {chakra.frequencyBowl && <FreqBadge label="Bowl" freq={chakra.frequencyBowl} color="#10b981"/>}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              Frequency assignments vary across systems. All displayed with original attribution. See Sources page.
            </p>
          </div>

          {/* Recommended instruments */}
          {forks.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recommended Instruments</div>
              <div className="flex flex-wrap gap-2">
                {forks.map(f => (
                  <Link key={f} href={`/inventory/${f}`}>
                    <span className="tag-pill cursor-pointer hover:border-primary/40 hover:text-foreground transition-colors">{f}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Layering pattern */}
          {layering.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Layering Pattern</div>
              <ol className="space-y-1.5">
                {layering.map((l, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-muted-foreground flex-shrink-0 font-mono text-xs mt-0.5">{i+1}.</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Imbalance signs */}
          {(imbalance.excess || imbalance.deficiency) && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Imbalance Signs</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-orange-400 font-medium mb-1">Excess</div>
                  <p className="text-muted-foreground text-xs">{imbalance.excess}</p>
                </div>
                <div>
                  <div className="text-xs text-blue-400 font-medium mb-1">Deficiency</div>
                  <p className="text-muted-foreground text-xs">{imbalance.deficiency}</p>
                </div>
              </div>
            </div>
          )}

          {/* Yogic context */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {asanas.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Āsanas</div>
                <ul className="space-y-1">
                  {asanas.map(a => <li key={a} className="text-sm text-muted-foreground">• {a}</li>)}
                </ul>
              </div>
            )}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Practice Layer</div>
              <div className="space-y-1.5 text-xs">
                {chakra.pranayamaPrimary && <div><strong>Prāṇāyāma:</strong> {chakra.pranayamaPrimary}</div>}
                {chakra.mudra && <div><strong>Mudrā:</strong> {chakra.mudra}</div>}
                {chakra.bandha && <div><strong>Bandha:</strong> {chakra.bandha}</div>}
                {chakra.devata && <div><strong>Devatā:</strong> {chakra.devata}</div>}
              </div>
            </div>
          </div>

          {/* Placement guide */}
          {Object.keys(placement).length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Placement Guide</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(placement).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-muted-foreground capitalize font-medium">{k}: </span>
                    <span>{v as string}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Physical correlates */}
          {physicalCorrelates.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Physical Correlates</div>
              <div className="flex flex-wrap gap-1.5">
                {physicalCorrelates.map(p => <span key={p} className="tag-pill">{p}</span>)}
              </div>
            </div>
          )}

          {/* Practitioner observations */}
          {chakra.practitionerObservations && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Practitioner Observations</div>
              <p className="text-sm text-muted-foreground italic leading-relaxed">{chakra.practitionerObservations}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FreqBadge({ label, freq, color, note }: { label: string; freq: number; color: string; note?: string }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm font-semibold frequency-display" style={{color}}>{formatHz(freq)}</div>
      {note && <div className="text-[10px] text-muted-foreground">{note}</div>}
    </div>
  );
}
