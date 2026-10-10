import { useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { parseArr, CHAKRA_COLORS } from "@/lib/utils";
import { Clock, Users, ChevronRight } from "lucide-react";
import type { ProtocolTemplate } from "@shared/schema";
import { setNexusContext } from "../components/NexusPanel";

const CATEGORY_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  grounding: { border: "#CC0000", bg: "#CC000018", text: "#f87171" },
  "emotional-release": { border: "#ec4899", bg: "#ec489918", text: "#f9a8d4" },
  "deep-relaxation": { border: "#A98BF0", bg: "#A98BF018", text: "#C9B6F7" },
  vata: { border: "#a78bfa", bg: "#a78bfa18", text: "#c4b5fd" },
  pitta: { border: "#f97316", bg: "#f9731618", text: "#fdba74" },
  kapha: { border: "#34d399", bg: "#34d39918", text: "#6ee7b7" },
  "heart-coherence": { border: "#228B22", bg: "#228B2218", text: "#86efac" },
  "throat-expression": { border: "#1E90FF", bg: "#1E90FF18", text: "#93c5fd" },
  intuition: { border: "#4B0082", bg: "#4B008218", text: "#c4b5fd" },
  "full-spectrum": { border: "#9400D3", bg: "#9400D318", text: "#e879f9" },
  "om-ceremony": { border: "#00CED1", bg: "#00CED118", text: "#67e8f9" },
  sleep: { border: "#1e3a8a", bg: "#1e3a8a18", text: "#93c5fd" },
};

export default function Protocols() {
  const { data: protocols = [], isLoading } = useQuery<ProtocolTemplate[]>({
    queryKey: ["/api/protocols"],
    queryFn: () => apiRequest("GET", "/api/protocols").then((r) => r.json()),
  });

  useEffect(() => {
    setNexusContext("Protocol Library\nAll session protocols — grounding, clearing, heart-centering, chakra-specific, dosha-specific, and the OM ceremonial container.");
    return () => setNexusContext("Sound healing practitioner tool — OM Tuner");
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <PageHeader
          title="Protocol Library"
          description="12 practitioner-grade session templates. Every protocol includes the Universal OM Opener (136.10 Hz) and Closer ceremony. Comfort tiers adapt each session for client readiness."
        />
      </div>

      {/* OM Ceremony banner */}
      <div className="bg-teal-900/20 border border-teal-500/30 rounded-xl p-4 flex items-start gap-3">
        <div className="text-2xl">𝄞</div>
        <div>
          <p className="text-sm font-semibold text-teal-200">Universal OM Ceremony</p>
          <p className="text-xs text-teal-300/80 mt-0.5">
            Every session opens and closes with co-chanting at 136.10 Hz — two heart forks at the sternum.
            This is the signature ceremonial container of CommonUnity sound healing.
          </p>
        </div>
      </div>

      {/* Protocol grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {protocols.map((proto) => {
          const instruments = parseArr(proto.goalTags as unknown as string);
          const chakraIds = parseArr(proto.chakraFocus as unknown as string);
          const category = (parseArr(proto.doshaTags as unknown as string)[0]) ?? "grounding";
          const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.grounding;

          return (
            <Link key={proto.id} href={`/protocols/${proto.id}`}>
              <div
                className="bg-card border rounded-xl overflow-hidden cursor-pointer hover:border-white/30 transition-colors group"
                style={{ borderColor: colors.border }}
                data-testid={`card-protocol-${proto.id}`}
              >
                <div className="h-1.5" style={{ background: colors.border }} />
                <div className="p-5 space-y-4">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white leading-snug">{proto.name}</h3>
                      <span
                        className="text-xs font-mono mt-0.5"
                        style={{ color: colors.text }}
                      >
                        {proto.id}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors mt-0.5 shrink-0" />
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{proto.description}</p>

                  {/* Meta row */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {proto.estimatedDuration && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {proto.estimatedDuration} min
                      </span>
                    )}
                    {(proto.comfortTierMin !== null && proto.comfortTierMax !== null) && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Tier {proto.comfortTierMin}–{proto.comfortTierMax}
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className="text-xs capitalize"
                      style={{ borderColor: colors.border, color: colors.text, background: colors.bg }}
                    >
                      {category.replace(/-/g, " ")}
                    </Badge>
                  </div>

                  {/* Chakra dots */}
                  {chakraIds.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground mr-1">Chakras:</span>
                      {chakraIds.map((cid) => (
                        <div
                          key={cid}
                          className="w-3 h-3 rounded-full border-2 border-card"
                          style={{ background: CHAKRA_COLORS[cid] ?? "#2BC9B8" }}
                          title={cid}
                        />
                      ))}
                    </div>
                  )}

                  {/* Instruments */}
                  {instruments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {instruments.slice(0, 5).map((id) => (
                        <span key={id} className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground font-mono">
                          {id}
                        </span>
                      ))}
                      {instruments.length > 5 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
                          +{instruments.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
