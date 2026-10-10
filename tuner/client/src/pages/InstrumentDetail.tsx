import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Play, Pause, Volume2, AlertTriangle, Info, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { parseArr, parseObj, formatHz, TYPE_COLORS, TYPE_BG, CHAKRA_COLORS, cn } from "@/lib/utils";
import type { Instrument } from "@shared/schema";
import ChladniCanvas from "../components/ChladniCanvas";
import { setNexusContext } from "../components/NexusPanel";

export default function InstrumentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: instrument, isLoading } = useQuery<Instrument>({
    queryKey: ["/api/instruments", id],
    queryFn: async () => {
      const res = await fetch(`/api/instruments/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  // Provide Nexus with contextual awareness of this instrument
  useEffect(() => {
    if (instrument) {
      const notes = parseArr(instrument.notes).slice(0, 3).join("; ");
      setNexusContext(
        `Viewing instrument: ${instrument.name}\n` +
        `Type: ${instrument.type} | Frequency: ${formatHz(instrument.frequency)}` +
        (instrument.solfeggio ? ` (Solfeggio: ${instrument.solfeggio} Hz)` : "") +
        (instrument.planetaryNote ? ` | Cousto: ${instrument.planetaryNote}` : "") +
        (instrument.chakraId ? ` | Chakra: ${instrument.chakraId}` : "") +
        (instrument.masterExplainer ? `\nDescription: ${instrument.masterExplainer.slice(0, 200)}` : "") +
        (notes ? `\nKey notes: ${notes}` : "")
      );
    }
    return () => setNexusContext("Frequency toolkit — OM Tuner");
  }, [instrument]);

  if (isLoading) return <div className="p-6"><Skeleton className="h-80"/></div>;
  if (!instrument) return <div className="p-6 text-muted-foreground">Instrument not found.</div>;

  const color = TYPE_COLORS[instrument.type] || "#2BC9B8";
  const bg = TYPE_BG[instrument.type] || "rgba(43,201,184,0.15)";
  const chakraColor = CHAKRA_COLORS[instrument.chakraId || ""] || "#2BC9B8";
  const benefits = parseArr(instrument.healingBenefits);
  const roles = parseArr(instrument.sessionRole);
  const contras = parseArr(instrument.contraindications);
  const notes = parseArr(instrument.notes);
  const doshaTags = parseArr(instrument.doshaTags);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <Link href="/inventory" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft size={14}/> Inventory
      </Link>

      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        {instrument.imageFilename ? (
          <div
            className="w-20 rounded-2xl flex-shrink-0 overflow-hidden flex items-center justify-center"
            style={{
              background: "#0b1120",
              border: `2px solid ${color}30`,
              height: instrument.type === 'fork' ? '120px' : '80px',
            }}
          >
            <img
              src={`/assets/images/${instrument.imageFilename}`}
              alt={instrument.name}
              className="w-full h-full object-cover"
              style={{ objectPosition: instrument.type === 'fork' ? 'top center' : 'center' }}
            />
          </div>
        ) : (
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-lg font-bold frequency-display flex-shrink-0"
            style={{ background: bg, color, border: `2px solid ${color}30` }}
          >
            {Math.round(instrument.frequency)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground">{instrument.id}</span>
            <Badge variant="outline" style={{color, borderColor: `${color}40`, background: bg}} className="text-xs">
              {instrument.type}
            </Badge>
            <Badge variant="outline" className="text-xs">{instrument.weighting}</Badge>
          </div>
          <h1 className="text-2xl font-bold mb-1">{instrument.name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
            <span className="font-semibold frequency-display" style={{color}}>{formatHz(instrument.frequency)}</span>
            {instrument.frequencyHarmonic && <span>+ {formatHz(instrument.frequencyHarmonic)} harmonic</span>}
            <span>·</span>
            <span>{instrument.lineage}</span>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{instrument.masterExplainer}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Chladni + audio */}
        <div className="lg:col-span-1 space-y-4">
          {/* Chladni visualization */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-primary"/>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chladni Pattern</span>
            </div>
            <ChladniCanvas
              frequency={instrument.frequency}
              color={chakraColor}
              size={300}
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Standing wave pattern at {formatHz(instrument.frequency)}
            </p>
          </div>

          {/* Audio player */}
          {instrument.audioFilename && (
            <AudioPlayer filename={instrument.audioFilename} color={color} />
          )}

          {/* Color association */}
          {instrument.colorHex && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Color Association</div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex-shrink-0" style={{background: instrument.colorHex}}/>
                <div>
                  <div className="text-sm font-medium">{instrument.colorName}</div>
                  {instrument.colorWavelength && (
                    <div className="text-xs text-muted-foreground">{instrument.colorWavelength}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Card content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Healing benefits */}
          <CardSection title="Healing Benefits" icon="✦" color={color}>
            <div className="flex flex-wrap gap-1.5">
              {benefits.map(b => (
                <span key={b} className="tag-pill" style={{background: bg, color, borderColor: `${color}30`}}>{b}</span>
              ))}
            </div>
          </CardSection>

          {/* Session role */}
          <CardSection title="Session Role" icon="▷" color={color}>
            <div className="flex flex-wrap gap-1.5">
              {roles.map(r => (
                <span key={r} className="tag-pill">{r}</span>
              ))}
            </div>
          </CardSection>

          {/* Notes */}
          <CardSection title="Practitioner Notes" icon="•">
            <ol className="space-y-1.5">
              {notes.map((n, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-muted-foreground flex-shrink-0 font-mono text-xs mt-0.5">{i+1}.</span>
                  <span>{n}</span>
                </li>
              ))}
            </ol>
          </CardSection>

          {/* Contraindications */}
          {contras.length > 0 && (
            <CardSection title="Contraindications" icon="⚠" color="#f97316">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {contras.map(c => (
                  <span key={c} className="tag-pill" style={{color: "#f97316", background: "rgba(249,115,22,0.1)", borderColor: "rgba(249,115,22,0.3)"}}>{c}</span>
                ))}
              </div>
              {instrument.contraNote && (
                <div className="flex gap-2 mt-2 p-2 rounded bg-orange-500/10 border border-orange-500/20">
                  <AlertTriangle size={14} className="text-orange-400 flex-shrink-0 mt-0.5"/>
                  <span className="text-xs text-orange-300">{instrument.contraNote}</span>
                </div>
              )}
            </CardSection>
          )}

          {/* Optional fields row */}
          <div className="grid grid-cols-2 gap-4">
            {doshaTags.length > 0 && (
              <CardSection title="Dosha Effects">
                <div className="flex flex-wrap gap-1">
                  {doshaTags.map(d => <span key={d} className="tag-pill text-xs">{d}</span>)}
                </div>
              </CardSection>
            )}
            {instrument.toneName && (
              <CardSection title="Tone Family">
                <div className="text-sm">{instrument.toneName}</div>
              </CardSection>
            )}
          </div>

          {/* Chakra link */}
          {instrument.chakraId && (
            <Link href={`/chakras/${instrument.chakraId}`}>
              <div className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/30 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{background: chakraColor}}/>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm font-medium">Associated Chakra: {instrument.chakraId}</span>
                    {instrument.closestChakraAlignment && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{background: `${chakraColor}18`, color: chakraColor, border: `1px solid ${chakraColor}40`}}>
                        closest alignment
                      </span>
                    )}
                  </div>
                  <ArrowLeft size={12} className="rotate-180 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"/>
                </div>
              </div>
            </Link>
          )}

          {/* Source reference */}
          {instrument.sourceReference && (
            <div className="text-xs text-muted-foreground p-3 bg-secondary/50 rounded-lg border border-border">
              <Info size={10} className="inline mr-1"/>
              {instrument.sourceReference}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CardSection({ title, icon, color, children }: { title: string; icon?: string; color?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-xs" style={{color: color || "hsl(var(--muted-foreground))"}}>{ icon}</span>}
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  );
}

function AudioPlayer({ filename, color }: { filename: string; color: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnd = () => setPlaying(false);
    el.addEventListener("ended", onEnd);
    return () => el.removeEventListener("ended", onEnd);
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Volume2 size={14} className="text-primary"/>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Audio Preview</span>
      </div>
      <audio ref={audioRef} src={`/assets/audio/${filename}`} preload="none"/>
      <button
        onClick={toggle}
        data-testid="button-audio-play"
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full justify-center"
        style={{background: playing ? "rgba(43,201,184,0.2)" : "rgba(43,201,184,0.1)", color, border: `1px solid ${color}30`}}
      >
        {playing ? <Pause size={16}/> : <Play size={16}/>}
        {playing ? "Pause" : "Play"}
      </button>
    </div>
  );
}
