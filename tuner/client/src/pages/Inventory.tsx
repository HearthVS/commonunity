import { useState, useMemo, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, Filter, Music2, ChevronRight, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, parseArr, formatHz, TYPE_COLORS, TYPE_BG, CHAKRA_COLORS } from "@/lib/utils";
import type { Instrument } from "@shared/schema";
import { setNexusContext } from "../components/NexusPanel";

const LINEAGE_OPTIONS = ["All", "Planetware", "Biofield Tuning", "Independent"];
const TYPE_OPTIONS = ["All", "fork", "bowl", "bell"];

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [lineageFilter, setLineageFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const { data: instruments = [], isLoading } = useQuery<Instrument[]>({
    queryKey: ["/api/instruments"],
  });

  // Nexus context — instrument inventory overview
  useEffect(() => {
    setNexusContext("Instrument Inventory\nFull collection of tuning forks, singing bowls, and bells — browse or search by type, lineage, or chakra.");
    return () => setNexusContext("Sound healing practitioner tool — OM Tuner");
  }, []);

  const filtered = useMemo(() => {
    return instruments.filter(i => {
      const q = search.toLowerCase();
      const matchSearch = !q || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) ||
        i.masterExplainer.toLowerCase().includes(q) || String(i.frequency).includes(q);
      const matchLineage = lineageFilter === "All" || i.lineage.includes(lineageFilter);
      const matchType = typeFilter === "All" || i.type === typeFilter;
      return matchSearch && matchLineage && matchType;
    });
  }, [instruments, search, lineageFilter, typeFilter]);

  // Group by type for display
  const forks = filtered.filter(i => i.type === "fork");
  const bowls = filtered.filter(i => i.type === "bowl");
  const bells = filtered.filter(i => i.type === "bell");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <PageHeader
        icon={<Music2 size={20}/>}
        title="Instrument Inventory"
        description="25 instruments — tuning forks, singing bowls, and bell — with full practitioner reference cards."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{instruments.length} instruments</Badge>
            <Link href="/inventory/audit">
              <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors" data-testid="link-audit">
                <ShoppingBag size={12} />
                Gap Audit
              </button>
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="input-search"
            placeholder="Search by name, ID, frequency…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt}
              data-testid={`filter-type-${opt}`}
              onClick={() => setTypeFilter(opt)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                typeFilter === opt
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {opt === "All" ? "All" : opt.charAt(0).toUpperCase() + opt.slice(1) + "s"}
            </button>
          ))}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {LINEAGE_OPTIONS.map(opt => (
          <button
            key={opt}
            onClick={() => setLineageFilter(opt)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
              lineageFilter === opt
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {opt}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({length:9}).map((_,i) => <Skeleton key={i} className="h-40 rounded-xl"/>)}
        </div>
      ) : (
        <div className="space-y-8">
          {forks.length > 0 && <InstrumentSection title="Tuning Forks" instruments={forks} />}
          {bowls.length > 0 && <InstrumentSection title="Singing Bowls" instruments={bowls} />}
          {bells.length > 0 && <InstrumentSection title="Bell" instruments={bells} />}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Music2 size={32} className="mx-auto mb-3 opacity-30"/>
              No instruments match your search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InstrumentSection({ title, instruments }: { title: string; instruments: Instrument[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {instruments.map(i => <InstrumentCard key={i.id} instrument={i} />)}
      </div>
    </div>
  );
}

function InstrumentCard({ instrument: i }: { instrument: Instrument }) {
  const color = TYPE_COLORS[i.type] || "#2BC9B8";
  const bg = TYPE_BG[i.type] || "rgba(43,201,184,0.15)";
  const chakraColor = CHAKRA_COLORS[i.chakraId || ""] || undefined;
  const benefits = parseArr(i.healingBenefits).slice(0, 3);
  const roles = parseArr(i.sessionRole).slice(0, 2);

  return (
    <Link href={`/inventory/${i.id}`} data-testid={`card-instrument-${i.id}`}>
      <div className="instrument-card bg-card border border-border rounded-xl p-4 cursor-pointer group">
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Instrument photo or frequency circle fallback */}
            {i.imageFilename ? (
              <div
                className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
                style={{ background: "#0b1120", border: `1.5px solid ${color}40` }}
              >
                <img
                  src={`/assets/images/${i.imageFilename}`}
                  alt={i.name}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: i.type === 'fork' ? 'top center' : 'center' }}
                />
              </div>
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold frequency-display"
                style={{ background: bg, color, border: `1.5px solid ${color}40` }}
              >
                {Math.round(i.frequency)}
              </div>
            )}
            <div>
              <div className="text-xs text-muted-foreground font-mono">{i.id}</div>
              <div className="text-sm font-semibold text-foreground leading-tight">{i.name}</div>
            </div>
          </div>
          <ChevronRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1"/>
        </div>

        {/* Frequency + lineage */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold frequency-display" style={{color}}>{formatHz(i.frequency)}</span>
          {i.frequencyHarmonic && (
            <span className="text-xs text-muted-foreground">+ {formatHz(i.frequencyHarmonic)}</span>
          )}
          {chakraColor && (
            <div className="w-2 h-2 rounded-full ml-auto" style={{background: chakraColor}} title={i.chakraId || ""}/>
          )}
        </div>

        {/* Master explainer */}
        <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">{i.masterExplainer}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {roles.map(r => (
            <span key={r} className="tag-pill" style={{color, background: bg, borderColor: `${color}30`}}>{r}</span>
          ))}
          {benefits.slice(0, 2).map(b => (
            <span key={b} className="tag-pill">{b}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
