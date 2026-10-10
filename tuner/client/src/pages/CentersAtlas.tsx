import { useEffect } from "react";
import { Eye } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { parseArr } from "@/lib/utils";
import type { Center } from "@shared/schema";
import { setNexusContext } from "../components/NexusPanel";

const CATEGORY_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  "physical": { border: "#f97316", bg: "#f9731618", text: "#f97316" },
  "emotional": { border: "#ec4899", bg: "#ec489918", text: "#ec4899" },
  "intellectual": { border: "#A98BF0", bg: "#A98BF018", text: "#A98BF0" },
  "instinctive": { border: "#f59e0b", bg: "#f59e0b18", text: "#f59e0b" },
  "sex": { border: "#ef4444", bg: "#ef444418", text: "#ef4444" },
};

function getCenterColors(category: string) {
  return CATEGORY_COLORS[category?.toLowerCase()] ?? { border: "#2BC9B8", bg: "#2BC9B818", text: "#2BC9B8" };
}

export default function CentersAtlas() {
  const { data: centers = [], isLoading } = useQuery<Center[]>({
    queryKey: ["/api/centers"],
    queryFn: () => apiRequest("GET", "/api/centers").then((r) => r.json()),
  });

  useEffect(() => {
    setNexusContext("Centers Atlas (Gurdjieff)\nMoving, emotional, and intellectual centers — how center dominance shapes a client's session needs and instrument choices.");
    return () => setNexusContext("Sound healing practitioner tool — OM Tuner");
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <PageHeader
          icon={<Eye size={20}/>}
          title="Centers Atlas"
          description="The Gurdjieff–Ouspensky Fourth Way tradition describes the human being as a multi-centered organism. Each center operates at a distinct speed and quality of energy. Sound healing can address specific centers to support balance and encourage presence."
        />
      </div>

      {/* Lineage note */}
      <div className="bg-card border border-white/10 rounded-xl p-4">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-white">Lineage attribution:</span> The centers model is drawn from
          G.I. Gurdjieff's teachings as recorded by P.D. Ouspensky in <em>In Search of the Miraculous</em> (1949).
          The sound healing application layer is a CommonUnity synthesis — not a direct Fourth Way teaching.
        </p>
      </div>

      {/* Center Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {centers.map((center) => {
          const instruments = parseArr(center.suggestedForks as unknown as string);
          const characteristics = parseArr(center.characteristics as unknown as string);
          const behaviors = parseArr(center.dominantBehaviors as unknown as string);
          const colors = getCenterColors(center.category);

          return (
            <div
              key={center.id}
              className="bg-card border rounded-xl overflow-hidden"
              style={{ borderColor: colors.border }}
              data-testid={`card-center-${center.id}`}
            >
              <div className="h-1.5" style={{ background: colors.border }} />
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white">{center.name}</h3>
                    {center.category && (
                      <span className="text-xs font-medium capitalize" style={{ color: colors.text }}>
                        {center.category} Center
                      </span>
                    )}
                  </div>
                  {center.manNumber && (
                    <span className="text-xs text-muted-foreground shrink-0 bg-white/5 px-2 py-1 rounded">
                      Man #{center.manNumber}
                    </span>
                  )}
                </div>

                {/* Description */}
                {center.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{center.description}</p>
                )}

                {/* Characteristics */}
                {characteristics.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Characteristics</p>
                    <div className="flex flex-wrap gap-1.5">
                      {characteristics.map((c) => (
                        <span key={c} className="text-xs px-2 py-0.5 rounded-full border capitalize"
                          style={{ borderColor: colors.border, color: colors.text, background: colors.bg }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dominant behaviors */}
                {behaviors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Dominant Behaviors</p>
                    <ul className="space-y-1">
                      {behaviors.slice(0, 3).map((b) => (
                        <li key={b} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span style={{ color: colors.text }} className="mt-0.5">·</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Instruments */}
                {instruments.length > 0 && (
                  <div className="pt-3 border-t border-white/5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Suggested Forks</p>
                    <div className="flex flex-wrap gap-1.5">
                      {instruments.map((id) => (
                        <span key={id} className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-mono">
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Practitioner notes */}
                {center.practitionerNotes && (
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-xs text-muted-foreground italic">{center.practitionerNotes}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-white/10 rounded-xl p-4">
        <p className="text-xs text-muted-foreground">
          Working with the centers is observational — the practitioner notices which center appears dominant
          or depleted in the session and adjusts instrument selection accordingly. No diagnostic claims are made.
        </p>
      </div>
    </div>
  );
}
