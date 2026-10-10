import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Brain, ChevronRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { parseArr, CHAKRA_COLORS, formatHz, cn } from "@/lib/utils";
import type { Chakra } from "@shared/schema";
import { setNexusContext } from "../components/NexusPanel";

export default function ChakraAtlas() {
  const { data: chakras = [], isLoading } = useQuery<Chakra[]>({
    queryKey: ["/api/chakras"],
  });

  useEffect(() => {
    setNexusContext("Chakra Atlas\nOverview of all 7 chakras plus extended centers — frequencies, bija mantras, mudras, forks, and placement guides.");
    return () => setNexusContext("Sound healing practitioner tool — OM Tuner");
  }, []);

  const sorted = [...chakras].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        icon={<Brain size={20}/>}
        title="Chakra Atlas"
        description="Seven chakras with full sensory, frequency, practice, and instrument layering data. Multi-system frequencies displayed with attribution."
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({length:7}).map((_,i) => <Skeleton key={i} className="h-24 rounded-xl"/>)}
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(ch => <ChakraRow key={ch.id} chakra={ch}/>)}
        </div>
      )}
    </div>
  );
}

function ChakraRow({ chakra: c }: { chakra: Chakra }) {
  const color = CHAKRA_COLORS[c.id] || "#6366f1";
  const themes = parseArr(c.themes).slice(0, 4);
  const forks = parseArr(c.recommendedForks);

  return (
    <Link href={`/chakras/${c.id}`} data-testid={`card-chakra-${c.id}`}>
      <div
        className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/30 transition-all group flex gap-4 items-start"
        style={{ boxShadow: `0 0 20px ${color}28, 0 1px 0 hsl(var(--border))` }}
      >
        {/* Color swatch */}
        <div
          className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
          style={{ background: `${color}30`, border: `2px solid ${color}60` }}
        >
          <span style={{ color }}>{c.sortOrder}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            <span className="font-bold text-sm">{c.sanskrit}</span>
            <span className="text-muted-foreground text-xs mt-0.5">— {c.sanskritMeaning}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
            {c.element && <span>{c.element}</span>}
            {c.locationPhysical && <><span>·</span><span>{c.locationPhysical}</span></>}
            {c.frequencyCousto && <><span>·</span><span style={{color}} className="font-semibold frequency-display">{formatHz(c.frequencyCousto)} Cousto</span></>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {themes.map(t => (
              <span key={t} className="tag-pill" style={{background: `${color}15`, color, borderColor: `${color}30`}}>{t}</span>
            ))}
            {forks.slice(0,2).map(f => (
              <span key={f} className="tag-pill opacity-70">{f}</span>
            ))}
          </div>
        </div>

        <ChevronRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex-shrink-0"/>
      </div>
    </Link>
  );
}
