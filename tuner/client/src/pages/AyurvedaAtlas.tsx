import { useEffect } from "react";
import { Leaf } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseArr, DOSHA_LABELS } from "@/lib/utils";
import type { AyurvedaElement } from "@shared/schema";
import { setNexusContext } from "../components/NexusPanel";

const DOSHA_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  vata: { border: "#a78bfa", bg: "#a78bfa18", text: "#a78bfa" },
  pitta: { border: "#f97316", bg: "#f9731618", text: "#f97316" },
  kapha: { border: "#34d399", bg: "#34d39918", text: "#34d399" },
};

const ELEMENT_COLORS: Record<string, string> = {
  air: "#a78bfa", akasha: "#C9B6F7", space: "#C9B6F7",
  fire: "#f97316", water: "#38bdf8", earth: "#86efac",
};

function getDoshaColor(id: string) {
  const lower = id.toLowerCase();
  if (lower.includes("vata")) return DOSHA_COLORS.vata;
  if (lower.includes("pitta")) return DOSHA_COLORS.pitta;
  if (lower.includes("kapha")) return DOSHA_COLORS.kapha;
  return DOSHA_COLORS.vata;
}

function getElementColor(sanskrit: string | null | undefined) {
  const lower = (sanskrit ?? "").toLowerCase();
  for (const [k, v] of Object.entries(ELEMENT_COLORS)) {
    if (lower.includes(k)) return v;
  }
  return "#2BC9B8";
}

export default function AyurvedaAtlas() {
  const { data: elements = [], isLoading } = useQuery<AyurvedaElement[]>({
    queryKey: ["/api/ayurveda"],
    queryFn: () => apiRequest("GET", "/api/ayurveda").then((r) => r.json()),
  });

  const doshaElements = elements.filter((e) => e.type === "dosha");
  const elementEls = elements.filter((e) => e.type === "element");

  useEffect(() => {
    setNexusContext("Ayurveda & Elements\nVata, Pitta, Kapha doshas — elemental correspondences, balancing forks, and dosha-specific session guidance.");
    return () => setNexusContext("Sound healing practitioner tool — OM Tuner");
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <PageHeader
          icon={<Leaf size={20}/>}
          title="Āyurveda Atlas"
          description="Āyurvedic constitutional mapping for sound healing. Each dosha governs distinct physiological, emotional, and elemental qualities. Instrument selection is guided by pacifying imbalanced doshas while tonifying depleted ones."
        />
      </div>

      <Tabs defaultValue="doshas">
        <TabsList className="bg-card border border-white/10">
          <TabsTrigger value="doshas">Doshas (Constitutions)</TabsTrigger>
          <TabsTrigger value="elements">Pañcamahābhūta (Elements)</TabsTrigger>
        </TabsList>

        {/* ─── DOSHAS ─── */}
        <TabsContent value="doshas" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(["vata", "pitta", "kapha"] as const).map((doshKey) => {
              const dosha = doshaElements.find((d) => d.id?.toLowerCase().includes(doshKey));
              if (!dosha) return null;
              const colors = getDoshaColor(dosha.id);
              const instruments = parseArr(dosha.balancingForks as unknown as string);
              const qualities = parseArr(dosha.qualities as unknown as string);
              const imbalanceSigns = parseArr(dosha.imbalanceSigns as unknown as string);

              return (
                <div
                  key={doshKey}
                  className="bg-card border rounded-xl overflow-hidden"
                  style={{ borderColor: colors.border }}
                  data-testid={`card-dosha-${doshKey}`}
                >
                  <div className="h-1.5" style={{ background: colors.border }} />
                  <div className="p-5 space-y-4">
                    <div>
                      <h3 className="font-bold text-white">{DOSHA_LABELS[doshKey] ?? dosha.name}</h3>
                      <p className="text-xs mt-0.5" style={{ color: colors.text }}>
                        {dosha.sanskrit}
                      </p>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">{dosha.description}</p>

                    {qualities.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Qualities (Guṇas)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {qualities.map((q) => (
                            <span
                              key={q}
                              className="text-xs px-2 py-0.5 rounded-full border capitalize"
                              style={{ borderColor: colors.border, color: colors.text, background: colors.bg }}
                            >
                              {q}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {imbalanceSigns.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Imbalance Signs</p>
                        <ul className="space-y-1">
                          {imbalanceSigns.slice(0, 4).map((s) => (
                            <li key={s} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span style={{ color: colors.text }} className="mt-0.5">·</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {instruments.length > 0 && (
                      <div className="pt-3 border-t border-white/5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Balancing Forks</p>
                        <div className="flex flex-wrap gap-1.5">
                          {instruments.map((id) => (
                            <span key={id} className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-mono">
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 bg-orange-900/20 border border-orange-500/30 rounded-xl p-4">
            <p className="text-sm text-orange-200">
              <span className="font-semibold">Agni (digestive fire):</span> Assess the client's current
              state (vikṛti) rather than birth constitution (prakṛti). The goal is always to restore
              balance, not intensify an already-dominant quality.
            </p>
          </div>
        </TabsContent>

        {/* ─── ELEMENTS ─── */}
        <TabsContent value="elements" className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {elementEls.map((el) => {
              const instruments = parseArr(el.balancingForks as unknown as string);
              const qualities = parseArr(el.qualities as unknown as string);
              const color = getElementColor(el.sanskrit);

              return (
                <div
                  key={el.id}
                  className="bg-card border border-white/10 rounded-xl overflow-hidden"
                  data-testid={`card-element-${el.id}`}
                >
                  <div className="h-1.5" style={{ background: color }} />
                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="font-semibold text-white">{el.name}</h3>
                      {el.sanskrit && <p className="text-xs mt-0.5" style={{ color }}>Sanskrit: {el.sanskrit}</p>}
                    </div>
                    {el.description && <p className="text-sm text-muted-foreground">{el.description}</p>}
                    {qualities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {qualities.map((q) => (
                          <span
                            key={q}
                            className="text-xs px-2 py-0.5 rounded-full border capitalize"
                            style={{ borderColor: color, color, background: `${color}18` }}
                          >
                            {q}
                          </span>
                        ))}
                      </div>
                    )}
                    {instruments.length > 0 && (
                      <div className="pt-2 border-t border-white/5">
                        <div className="flex flex-wrap gap-1.5">
                          {instruments.map((id) => (
                            <span key={id} className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-mono">
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
