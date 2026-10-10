/**
 * BiofieldAtlas — Interactive McKusick biofield map.
 *
 * Two reference images (Energetic Imbalances + Trigger Points) act as the
 * visual anatomy. Tap/click any zone hotspot to zoom into a detail panel.
 * Tap the back arrow or press Escape to zoom out. A polarity strip filters
 * the visible zones by field side.
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { parseArr } from "@/lib/utils";
import { ArrowLeft, ZoomIn, Activity } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import type { BiofieldZone } from "@shared/schema";
import { setNexusContext } from "../components/NexusPanel";
import biofieldImbalances from "@assets/biofield-imbalances.jpg";
import biofieldTrigger from "@assets/biofield-trigger-points.jpg";

// ─── Zone layout config ───────────────────────────────────────────────────────
// Each entry positions a tap target over the image as % of image dimensions.
// x/y are centre points, w/h are the hit area size — all in percent of the
// image container width/height.

interface HotspotDef {
  id: string;
  label: string;
  x: number; // % from left
  y: number; // % from top
  w: number;
  h: number;
  color: string;
}

const HOTSPOTS: HotspotDef[] = [
  // ── Central axis ──────────────────────────────────────────────────────
  { id: "BF-SUN-STAR",    label: "Sun Star",        x: 50,  y: 6,   w: 20, h: 7,  color: "#f59e0b" },
  { id: "BF-CROWN-ABOVE", label: "Crown",           x: 50,  y: 13,  w: 14, h: 6,  color: "#9b59b6" },
  // Image is front-facing: Left/Feminine appears on RIGHT side of image,
  // Right/Masculine appears on LEFT side of image (mirror of viewer's perspective)
  { id: "BF-3RD-EYE-LEFT",label: "Third Eye L",     x: 64,  y: 20,  w: 13, h: 5,  color: "#8b5cf6" },
  { id: "BF-3RD-EYE-RIGHT",label:"Third Eye R",     x: 36,  y: 20,  w: 13, h: 5,  color: "#8b5cf6" },
  { id: "BF-THROAT-LEFT", label: "Throat L",        x: 65,  y: 27,  w: 13, h: 5,  color: "#1E90FF" },
  { id: "BF-THROAT-RIGHT",label: "Throat R",        x: 35,  y: 27,  w: 13, h: 5,  color: "#1E90FF" },
  { id: "BF-HEART-LEFT",  label: "Heart L",         x: 65,  y: 35,  w: 13, h: 5,  color: "#228B22" },
  { id: "BF-HEART-RIGHT", label: "Heart R",         x: 35,  y: 35,  w: 13, h: 5,  color: "#228B22" },
  { id: "BF-HEART-FRONT", label: "Heart Front",     x: 50,  y: 35,  w: 10, h: 5,  color: "#228B22" },
  { id: "BF-SOLAR-LEFT",  label: "Solar L",         x: 65,  y: 46,  w: 13, h: 5,  color: "#FFD700" },
  { id: "BF-SOLAR-RIGHT", label: "Solar R",         x: 35,  y: 46,  w: 13, h: 5,  color: "#FFD700" },
  { id: "BF-SACRAL-LEFT", label: "Sacral L",        x: 64,  y: 57,  w: 13, h: 5,  color: "#FF8C00" },
  { id: "BF-SACRAL-RIGHT",label: "Sacral R",        x: 36,  y: 57,  w: 13, h: 5,  color: "#FF8C00" },
  { id: "BF-ROOT-LEFT",   label: "Root L",          x: 64,  y: 67,  w: 13, h: 5,  color: "#CC0000" },
  { id: "BF-ROOT-RIGHT",  label: "Root R",          x: 36,  y: 67,  w: 13, h: 5,  color: "#CC0000" },
  { id: "BF-ANCESTRAL-LEFT",  label: "Ancestral L", x: 80,  y: 38,  w: 12, h: 22, color: "#14b8a6" },
  { id: "BF-ANCESTRAL-RIGHT", label: "Ancestral R", x: 20,  y: 38,  w: 12, h: 22, color: "#14b8a6" },
  { id: "BF-EARTH-STAR",  label: "Earth Star",      x: 50,  y: 89,  w: 20, h: 7,  color: "#6b7280" },
];

const SIDE_CONFIG: Record<string, { label: string; color: string }> = {
  left:    { label: "Left · Feminine",   color: "#ec4899" },
  right:   { label: "Right · Masculine", color: "#A98BF0" },
  back:    { label: "Back · Receiving",  color: "#f59e0b" },
  center:  { label: "Central axis",      color: "#a78bfa" },
  front:   { label: "Front",             color: "#14b8a6" },
};

const FILTERS = ["all", "left", "right", "back", "center"] as const;
type Filter = typeof FILTERS[number];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BiofieldAtlas() {
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [activeImage, setActiveImage] = useState<"imbalances" | "trigger">("imbalances");

  const { data: zones = [], isLoading } = useQuery<BiofieldZone[]>({
    queryKey: ["/api/biofield-zones"],
    queryFn: () => apiRequest("GET", "/api/biofield-zones").then((r) => r.json()),
  });

  const activeZone = zones.find((z) => z.id === activeZoneId) ?? null;

  // Keyboard: Escape to close detail
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setActiveZoneId(null);
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Nexus context
  useEffect(() => {
    if (activeZone) {
      const themes = parseArr(activeZone.themes as unknown as string).join(", ");
      const side = SIDE_CONFIG[activeZone.fieldSide ?? ""]?.label ?? activeZone.fieldSide;
      setNexusContext(
        `Viewing biofield zone: ${activeZone.label}\n` +
        `Side: ${side} | Location: ${activeZone.location}\n` +
        (themes ? `Themes: ${themes}` : "")
      );
    } else {
      setNexusContext("Biofield Atlas — McKusick biofield anatomy map");
    }
    return () => setNexusContext("Frequency toolkit — OM Tuner");
  }, [activeZone]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (activeZone) {
    const themes = parseArr(activeZone.themes as unknown as string);
    const physical = parseArr(activeZone.physicalCorrelates as unknown as string);
    const forks = parseArr(activeZone.suggestedForks as unknown as string);
    const sideInfo = SIDE_CONFIG[activeZone.fieldSide ?? ""] ?? { label: activeZone.fieldSide, color: "#2BC9B8" };
    const hotspot = HOTSPOTS.find((h) => h.id === activeZoneId);
    const color = hotspot?.color ?? "#2BC9B8";

    return (
      <div className="p-5 max-w-2xl mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
        {/* Back */}
        <button
          onClick={() => setActiveZoneId(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
          Back to map
        </button>

        {/* Zone header */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="h-1.5" style={{ background: color }} />
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-foreground">{activeZone.label}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{activeZone.location}</p>
              </div>
              <Badge
                variant="outline"
                className="text-xs shrink-0"
                style={{ borderColor: sideInfo.color, color: sideInfo.color }}
              >
                {sideInfo.label}
              </Badge>
            </div>

            {/* Themes */}
            {themes.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                  Emotional themes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {themes.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2.5 py-1 rounded-full border"
                      style={{ borderColor: `${color}55`, color, background: `${color}15` }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Physical correlates */}
            {physical.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                  Physical correlates
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {physical.map((p) => (
                    <span key={p} className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-muted-foreground border border-white/10">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Technique */}
        {(activeZone.techniqueLocate || activeZone.techniqueListen || activeZone.techniqueTreat || activeZone.techniqueIntegrate || activeZone.techniqueClose) && (
          <div className="rounded-xl border border-border p-5 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Technique</p>
            {[
              { label: "Locate", val: activeZone.techniqueLocate },
              { label: "Listen", val: activeZone.techniqueListen },
              { label: "Treat",  val: activeZone.techniqueTreat },
              { label: "Integrate", val: activeZone.techniqueIntegrate },
              { label: "Close", val: activeZone.techniqueClose },
            ].filter((s) => s.val).map(({ label, val }) => (
              <div key={label} className="flex gap-3 text-sm">
                <span className="text-muted-foreground w-16 shrink-0 font-medium">{label}</span>
                <span className="text-foreground leading-relaxed">{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Suggested forks */}
        {forks.length > 0 && (
          <div className="rounded-xl border border-border p-5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Suggested instruments
            </p>
            <div className="flex flex-wrap gap-2">
              {forks.map((id) => (
                <span
                  key={id}
                  className="text-xs px-3 py-1.5 rounded-lg font-mono"
                  style={{ background: `${color}20`, color }}
                >
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Source */}
        {activeZone.sourceAttribution && (
          <p className="text-xs text-muted-foreground italic px-1">
            {activeZone.sourceAttribution}
          </p>
        )}

        {/* Modesty note */}
        <div className="rounded-xl bg-amber-900/20 border border-amber-500/30 p-4">
          <p className="text-xs text-amber-200 leading-relaxed">
            All zones can be worked off-body (5–30 cm above surface) or via surrogate.
            Default to field work for new clients or where direct contact is contraindicated.
          </p>
        </div>
      </div>
    );
  }

  // ── Map view ────────────────────────────────────────────────────────────────

  // Filter hotspots by active side filter
  const visibleHotspots = HOTSPOTS.filter((h) => {
    if (filter === "all") return true;
    const zone = zones.find((z) => z.id === h.id);
    return zone?.fieldSide === filter;
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">

      <PageHeader
        icon={<Activity size={20}/>}
        title="Biofield Atlas"
        description="Interactive McKusick biofield map. Tap any zone to explore its energetic themes, treatment technique, and suggested tuning forks. Based on Eileen Day McKusick's Biofield Anatomy."
      />

      {/* Filter strip */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "all" ? "All zones" : SIDE_CONFIG[f]?.label ?? f}
          </button>
        ))}
      </div>

      {/* Image toggle */}
      <div className="flex gap-2">
        {(["imbalances", "trigger"] as const).map((img) => (
          <button
            key={img}
            onClick={() => setActiveImage(img)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeImage === img
                ? "bg-card border border-primary/50 text-primary"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {img === "imbalances" ? "Energetic Imbalances" : "Trigger Points / Pain"}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-border bg-card">
        {/* Reference image */}
        <img
          src={activeImage === "imbalances" ? biofieldImbalances : biofieldTrigger}
          alt={activeImage === "imbalances" ? "Biofield Anatomy — Energetic Imbalances" : "Biofield Anatomy — Trigger Points"}
          className="w-full h-auto block"
          draggable={false}
        />

        {/* Tap zone hotspots overlaid on image */}
        {visibleHotspots.map((h) => {
          const zone = zones.find((z) => z.id === h.id);
          if (!zone) return null;
          return (
            <button
              key={h.id}
              data-testid={`hotspot-${h.id}`}
              onClick={() => setActiveZoneId(h.id)}
              style={{
                position: "absolute",
                left: `${h.x - h.w / 2}%`,
                top: `${h.y - h.h / 2}%`,
                width: `${h.w}%`,
                height: `${h.h}%`,
                borderColor: `${h.color}80`,
                background: `${h.color}18`,
              }}
              className={cn(
                "rounded-lg border flex items-center justify-center",
                "transition-all duration-150 group cursor-pointer",
                "hover:border-opacity-100 hover:scale-105",
                "active:scale-95"
              )}
              title={h.label}
            >
              {/* Label — shown on hover */}
              <span
                className={cn(
                  "text-[9px] font-semibold leading-tight text-center px-1 opacity-0",
                  "group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                )}
                style={{ color: h.color, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
              >
                {h.label}
              </span>

              {/* Zoom icon — always visible but subtle */}
              <ZoomIn
                size={10}
                className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-60 transition-opacity"
                style={{ color: h.color }}
              />
            </button>
          );
        })}
      </div>

      {/* Zone list — quick-access below map */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
          All zones {filter !== "all" ? `— ${SIDE_CONFIG[filter]?.label}` : ""}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {zones
            .filter((z) => filter === "all" || z.fieldSide === filter)
            .map((zone) => {
              const h = HOTSPOTS.find((hs) => hs.id === zone.id);
              const color = h?.color ?? "#2BC9B8";
              const sideInfo = SIDE_CONFIG[zone.fieldSide ?? ""] ?? { label: zone.fieldSide, color };
              return (
                <button
                  key={zone.id}
                  data-testid={`zone-btn-${zone.id}`}
                  onClick={() => setActiveZoneId(zone.id ?? null)}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg bg-card border border-border hover:border-primary/40 hover:bg-accent text-left transition-all group"
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-xs text-foreground group-hover:text-primary transition-colors leading-tight truncate">
                    {zone.label}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      {/* McKusick attribution */}
      <p className="text-[10px] text-muted-foreground italic text-center pb-2">
        Reference cards © 2026 Biofield Tuning — biofieldtuning.com
      </p>
    </div>
  );
}
