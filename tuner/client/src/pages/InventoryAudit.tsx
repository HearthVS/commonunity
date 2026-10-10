/**
 * InventoryAudit — gap analysis + Nexus acquisition suggestions.
 *
 * Reads GET /api/inventory/audit and renders:
 *   - Coverage summary (owned count, gap count, category breakdown)
 *   - Prioritised suggestion cards (urgency-coded, collapsible rationale)
 *   - Buying guide + search terms for each gap
 *
 * Design: matches Inventory.tsx conventions — PageHeader, badge pills,
 * TYPE_COLORS / TYPE_BG, card hover pattern.
 */

import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, ChevronDown, ChevronUp, Check, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn, formatHz, TYPE_COLORS, TYPE_BG, CHAKRA_COLORS } from "@/lib/utils";
import { setNexusContext } from "../components/NexusPanel";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AcquisitionSuggestion {
  id: string;
  name: string;
  type: "fork" | "bowl" | "bell";
  weighting: string;
  frequency: number;
  lineage: string;
  chakraAffinity: string;
  category: string;
  priority: number;
  rationale: string;
  buyingGuide: string;
  searchTerms: string[];
  coversGap: string[];
  urgency: "high" | "medium" | "low";
  covered: boolean;
}

interface AuditResponse {
  ownedCount: number;
  idealSetCount: number;
  coveredCount: number;
  gapCount: number;
  coveragePercent: number;
  categoryCoverage: Record<string, { total: number; covered: number }>;
  suggestions: AcquisitionSuggestion[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const URGENCY_COLOR: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#2BC9B8",
};

const URGENCY_BG: Record<string, string> = {
  high: "rgba(239,68,68,0.12)",
  medium: "rgba(245,158,11,0.12)",
  low: "rgba(43,201,184,0.12)",
};

const CATEGORY_LABELS: Record<string, string> = {
  solfeggio: "Solfeggio",
  fibonacci: "Fibonacci",
  om: "OM",
  bowl: "Bowls",
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function InventoryAudit() {
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [showCovered, setShowCovered] = useState(false);

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ["/api/inventory/audit"],
  });

  // Nexus context
  useEffect(() => {
    setNexusContext(
      "Inventory Audit — Gap Analysis\n" +
        "Reviewing frequency coverage gaps and acquisition suggestions to complete the ideal instrument set."
    );
    return () => setNexusContext("Frequency toolkit — OM Tuner");
  }, []);

  const suggestions = (data?.suggestions ?? []).filter((s) => {
    if (!showCovered && s.covered) return false;
    if (urgencyFilter !== "all" && s.urgency !== urgencyFilter) return false;
    return true;
  });

  const gaps = (data?.suggestions ?? []).filter((s) => !s.covered);
  const highCount = gaps.filter((s) => s.urgency === "high").length;
  const medCount = gaps.filter((s) => s.urgency === "medium").length;
  const lowCount = gaps.filter((s) => s.urgency === "low").length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        icon={<ShoppingBag size={20} />}
        title="Instrument Audit"
        description="Gap analysis against the ideal frequency set — with Nexus acquisition suggestions."
        actions={
          isLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <Badge variant="outline">{data?.gapCount ?? 0} gaps identified</Badge>
          )
        }
      />

      {/* ── Coverage summary ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <div className="mb-8 space-y-4">
          {/* Stat row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Owned" value={String(data.ownedCount)} sub="instruments" color="#2BC9B8" />
            <StatCard
              label="Ideal Set"
              value={String(data.idealSetCount)}
              sub="target slots"
              color="#14b8a6"
            />
            <StatCard
              label="Covered"
              value={`${data.coveragePercent}%`}
              sub={`${data.coveredCount} of ${data.idealSetCount}`}
              color="#22c55e"
            />
            <StatCard label="Gaps" value={String(data.gapCount)} sub="to fill" color="#f59e0b" />
          </div>

          {/* Category coverage */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Coverage by Category
            </div>
            <div className="space-y-2.5">
              {Object.entries(data.categoryCoverage).map(([cat, { total, covered }]) => {
                const pct = Math.round((covered / total) * 100);
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-muted-foreground">{CATEGORY_LABELS[cat] ?? cat}</div>
                    <div className="flex-1">
                      <Progress value={pct} className="h-1.5" />
                    </div>
                    <div className="w-16 text-right text-xs font-mono text-muted-foreground">
                      {covered}/{total}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Urgency breakdown */}
          <div className="flex flex-wrap gap-2 text-xs">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
            >
              <AlertTriangle size={11} />
              <span className="font-semibold">{highCount}</span> high priority
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}
            >
              <Info size={11} />
              <span className="font-semibold">{medCount}</span> medium
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(43,201,184,0.1)", color: "#2BC9B8" }}
            >
              <Info size={11} />
              <span className="font-semibold">{lowCount}</span> lower priority
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(["all", "high", "medium", "low"] as const).map((u) => (
          <button
            key={u}
            data-testid={`filter-urgency-${u}`}
            onClick={() => setUrgencyFilter(u)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
              urgencyFilter === u
                ? "bg-primary text-white border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
            style={
              urgencyFilter === u && u !== "all"
                ? { background: URGENCY_COLOR[u], borderColor: URGENCY_COLOR[u] }
                : {}
            }
          >
            {u === "all" ? "All urgencies" : u.charAt(0).toUpperCase() + u.slice(1)}
          </button>
        ))}
        <label className="flex items-center gap-2 ml-auto cursor-pointer text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showCovered}
            onChange={(e) => setShowCovered(e.target.checked)}
            className="rounded"
          />
          Show already-covered slots
        </label>
      </div>

      {/* ── Suggestion cards ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Check size={32} className="mx-auto mb-3 opacity-30" />
          No gaps in this filter — your set is complete here.
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

// ── Suggestion card ───────────────────────────────────────────────────────────

function SuggestionCard({ suggestion: s }: { suggestion: AcquisitionSuggestion }) {
  const [expanded, setExpanded] = useState(false);

  const typeColor = TYPE_COLORS[s.type] || "#2BC9B8";
  const typeBg = TYPE_BG[s.type] || "rgba(43,201,184,0.15)";
  const urgencyColor = URGENCY_COLOR[s.urgency] || "#2BC9B8";
  const urgencyBg = URGENCY_BG[s.urgency] || "rgba(43,201,184,0.12)";
  const chakraColor = CHAKRA_COLORS[s.chakraAffinity] || undefined;

  return (
    <div
      data-testid={`card-suggestion-${s.id}`}
      className={cn(
        "bg-card border rounded-xl transition-all duration-200",
        s.covered ? "border-border opacity-60" : "border-border hover:border-primary/30"
      )}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4 flex items-start gap-3"
        aria-expanded={expanded}
      >
        {/* Frequency circle */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold frequency-display"
          style={{ background: typeBg, color: typeColor, border: `1.5px solid ${typeColor}40` }}
        >
          {Math.round(s.frequency)}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-foreground">{s.name}</span>
            {s.covered && (
              <span className="inline-flex items-center gap-1 text-[10px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                <Check size={9} /> Covered
              </span>
            )}
            {!s.covered && (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: urgencyBg, color: urgencyColor }}
              >
                {s.urgency}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="font-mono">{formatHz(s.frequency)}</span>
            <span>·</span>
            <span>{s.weighting}</span>
            <span>·</span>
            <span>{s.lineage}</span>
            {chakraColor && (
              <span
                className="w-2 h-2 rounded-full ml-1 flex-shrink-0"
                style={{ background: chakraColor }}
                title={s.chakraAffinity}
              />
            )}
          </div>
          {/* Gap summary — always visible */}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {s.coversGap.map((g) => (
              <span key={g} className="tag-pill text-[10px]" style={{ color: typeColor, background: typeBg, borderColor: `${typeColor}30` }}>
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* Expand icon */}
        <div className="text-muted-foreground flex-shrink-0 mt-0.5">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border space-y-4 pt-4">
          {/* Rationale */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              Why This Gap Matters
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.rationale}</p>
          </div>

          {/* Buying guide */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              Buying Guide
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.buyingGuide}</p>
          </div>

          {/* Search terms */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              Search For
            </div>
            <div className="flex flex-wrap gap-2">
              {s.searchTerms.map((term) => (
                <a
                  key={term}
                  href={`https://www.google.com/search?q=${encodeURIComponent(term)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`link-search-${s.id}`}
                  className="text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  {term} ↗
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
