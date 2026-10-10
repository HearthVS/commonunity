import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useEffect } from "react";
import { setNexusContext } from "../components/NexusPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseArr, parseObj, CHAKRA_COLORS, COMFORT_TIERS, formatHz } from "@/lib/utils";
import { Clock, Users, ArrowLeft, ChevronRight } from "lucide-react";
import type { ProtocolTemplate } from "@shared/schema";

interface ProtocolPhase {
  name: string;
  duration: string;
  instruments: string[];
  technique: string;
  placement?: string;
  tier?: number;
  notes?: string;
}

const OM_OPENER = {
  name: "Universal OM Opener",
  duration: "3–5 min",
  instruments: ["TF-PW-HEART", "TF-OM-136W"],
  technique: "Co-chanting at 136.10 Hz. Practitioner strikes both forks and holds them at client's sternum (or off-body). Tone OM together for 3 rounds. Set intention in silence.",
  placement: "Sternum / heart centre",
  notes: "This is the ceremonial container opener. Non-negotiable in every session.",
};

const OM_CLOSER = {
  name: "Universal OM Closer",
  duration: "3–5 min",
  instruments: ["TF-PW-HEART", "TF-OM-136W"],
  technique: "Return to 136.10 Hz. Three slow OM tones together. Moment of complete silence. Gentle re-entry guidance.",
  placement: "Sternum / heart centre",
  notes: "Close every session here. Allow 2 minutes of silence after the final tone.",
};

export default function ProtocolDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: proto, isLoading } = useQuery<ProtocolTemplate>({
    queryKey: ["/api/protocols", id],
    queryFn: () => apiRequest("GET", `/api/protocols/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  useEffect(() => {
    if (proto) {
      const phases = parseArr(proto.phases);
      setNexusContext(
        `Viewing protocol: ${proto.name}\n` +
        `Goal: ${proto.primaryGoal || "general healing"} | Duration: ${proto.durationMinutes || "?"} min | Comfort tier: ${proto.comfortTier ?? 1}\n` +
        (proto.description ? `Description: ${proto.description.slice(0, 200)}\n` : "") +
        `Phases: ${phases.length} phases in this protocol`
      );
    }
    return () => setNexusContext("Frequency toolkit — OM Tuner");
  }, [proto]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!proto) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Protocol not found.</p>
        <Link href="/protocols">
          <Button variant="outline" className="mt-4 border-white/20">Back to Library</Button>
        </Link>
      </div>
    );
  }

  const primaryInstruments = parseArr(proto.goalTags as unknown as string);
  const chakraSequence = parseArr(proto.chakraFocus as unknown as string);
  const doshaTags = parseArr(proto.doshaTags as unknown as string);
  const centerFocus: string[] = [];
  const rawPhases = proto.phases ? (typeof proto.phases === "string" ? JSON.parse(proto.phases) : proto.phases) : [];
  const phases: ProtocolPhase[] = Array.isArray(rawPhases) ? rawPhases : [];

  const allPhases = [OM_OPENER, ...phases, OM_CLOSER];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Back */}
      <Link href="/protocols">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Protocol Library
        </button>
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-mono text-primary">{proto.id}</span>
            <h1 className="text-xl font-bold text-white mt-0.5">{proto.name}</h1>
          </div>
          <div className="flex gap-2 shrink-0">
            {proto.estimatedDuration && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white/5 px-3 py-1.5 rounded-lg">
                <Clock className="w-3.5 h-3.5" />
                {proto.estimatedDuration} min
              </div>
            )}
            {(proto.comfortTierMin !== null && proto.comfortTierMax !== null) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white/5 px-3 py-1.5 rounded-lg">
                <Users className="w-3.5 h-3.5" />
                Tier {proto.comfortTierMin}–{proto.comfortTierMax}
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{proto.description}</p>
      </div>

      {/* Meta tags */}
      <div className="flex flex-wrap gap-2">
        {chakraSequence.map((cid) => (
          <Badge key={cid} variant="outline" style={{ borderColor: CHAKRA_COLORS[cid] ?? "#2BC9B8", color: CHAKRA_COLORS[cid] ?? "#2BC9B8" }}>
            <div className="w-2 h-2 rounded-full mr-1.5" style={{ background: CHAKRA_COLORS[cid] ?? "#2BC9B8" }} />
            {cid.replace("CH-", "")}
          </Badge>
        ))}
        {doshaTags.map((d) => (
          <Badge key={d} variant="outline" className="border-white/20 text-muted-foreground capitalize">
            {d}
          </Badge>
        ))}
        {centerFocus.map((c) => (
          <Badge key={c} variant="outline" className="border-white/20 text-muted-foreground capitalize">
            {c} center
          </Badge>
        ))}
      </div>

      {/* Primary instruments */}
      {primaryInstruments.length > 0 && (
        <div className="bg-card border border-white/10 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Instrument Set</h2>
          <div className="flex flex-wrap gap-2">
            {primaryInstruments.map((id) => (
              <Link key={id} href={`/inventory/${id}`}>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-primary/20 text-primary font-mono hover:bg-primary/30 transition-colors cursor-pointer">
                  {id}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Comfort tiers */}
      {(proto.comfortTierMin !== null && proto.comfortTierMax !== null) && (
        <div className="bg-card border border-white/10 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Comfort Tiers</h2>
          <div className="space-y-2">
            {COMFORT_TIERS.filter((t) => t.tier >= (proto.comfortTierMin ?? 1) && t.tier <= (proto.comfortTierMax ?? 5)).map((t) => (
              <div key={t.tier} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs text-primary font-bold">{t.tier}</span>
                </div>
                <div>
                  <p className="text-sm text-white font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Protocol phases */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Session Phases</h2>
        <div className="space-y-3">
          {allPhases.map((phase, idx) => {
            const isOM = idx === 0 || idx === allPhases.length - 1;
            return (
              <div
                key={idx}
                className={`bg-card border rounded-xl overflow-hidden ${
                  isOM ? "border-teal-500/40" : "border-white/10"
                }`}
                data-testid={`phase-${idx}`}
              >
                {isOM && <div className="h-1 bg-gradient-to-r from-teal-500 to-cyan-400" />}
                <div className="p-5 space-y-3">
                  {/* Phase header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isOM ? "bg-teal-500/20 text-teal-300" : "bg-primary/20 text-primary"
                      }`}>
                        {idx === 0 ? "↑" : idx === allPhases.length - 1 ? "↓" : idx}
                      </div>
                      <div>
                        <h3 className={`font-semibold ${isOM ? "text-teal-200" : "text-white"}`}>{phase.name}</h3>
                        {phase.duration && (
                          <span className="text-xs text-muted-foreground">{phase.duration}</span>
                        )}
                      </div>
                    </div>
                    {phase.placement && (
                      <span className="text-xs bg-white/5 text-muted-foreground px-2 py-1 rounded shrink-0">
                        {phase.placement}
                      </span>
                    )}
                  </div>

                  {/* Technique */}
                  <p className="text-sm text-muted-foreground leading-relaxed">{phase.technique}</p>

                  {/* Instruments */}
                  {phase.instruments?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {phase.instruments.map((id) => (
                        <span key={id} className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">
                          {id}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {phase.notes && (
                    <p className="text-xs text-muted-foreground italic border-l-2 border-white/10 pl-3">
                      {phase.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Off-body alternatives */}
      <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4">
        <p className="text-sm text-amber-200">
          <span className="font-semibold">Off-body & surrogate alternatives:</span> Every placement in this
          protocol has an equivalent off-body (5–30 cm hover) or surrogate technique. For clients with
          contraindications or discomfort with body contact, default to field work throughout.
        </p>
      </div>

      {/* Goal */}
      {proto.goal && (
        <div className="text-xs text-muted-foreground border-t border-white/5 pt-4">
          Goal: {proto.goal}
        </div>
      )}
    </div>
  );
}
