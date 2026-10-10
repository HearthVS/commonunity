/**
 * RadianceCard — Gene Keys Radiance Sphere synthesis display
 *
 * Shows the full cross-atlas resonance profile derived from a client's birth date.
 * If no birth data is present, renders a soft "Add birth data" prompt.
 *
 * Props:
 *   birthDate       — ISO "YYYY-MM-DD" (required for calculation)
 *   birthTime       — "HH:MM" (optional, improves line accuracy)
 *   compact         — if true, renders a condensed single-row summary (for result pages)
 *   questionnaireId — if provided, enables inline birth data editing via PATCH
 *   onBirthDataSaved — callback fired after a successful PATCH (passes updated questionnaire)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, ChevronDown, ChevronUp, Link2, AlertTriangle, Zap, Pencil, X, Check } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import type { RadianceProfile } from "@shared/genekeys";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// ─── Colour helpers ───────────────────────────────────────────────────────────

const CHAKRA_COLORS: Record<string, string> = {
  "CH-ROOT":      "#CC0000",
  "CH-SACRAL":    "#FF8C00",
  "CH-SOLAR":     "#FFD700",
  "CH-HEART":     "#228B22",
  "CH-THROAT":    "#1E90FF",
  "CH-THIRD-EYE": "#4B0082",
  "CH-CROWN":     "#9400D3",
};

function getChakraColor(chakraId: string) {
  return CHAKRA_COLORS[chakraId] ?? "#2BC9B8";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
      {children}
    </p>
  );
}

function InfoBlock({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white/[0.03] rounded-lg p-3">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-xs font-medium" style={accent ? { color: accent } : { color: "white" }}>
        {value}
      </p>
    </div>
  );
}

function InstrumentBadge({ id }: { id: string }) {
  return (
    <Link href={`/inventory/${id}`}>
      <span
        className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-mono cursor-pointer hover:bg-primary/35 transition-colors"
        data-testid={`radiance-badge-${id}`}
      >
        {id}
      </span>
    </Link>
  );
}

// ─── Inline birth data edit form ──────────────────────────────────────────────

interface BirthEditFormProps {
  questionnaireId: number;
  currentDate?: string | null;
  currentTime?: string | null;
  currentPlace?: string | null;
  onSaved: (updated: any) => void;
  onCancel: () => void;
}

function BirthEditForm({
  questionnaireId,
  currentDate,
  currentTime,
  currentPlace,
  onSaved,
  onCancel,
}: BirthEditFormProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState(currentDate ?? "");
  const [time, setTime] = useState(currentTime ?? "");
  const [place, setPlace] = useState(currentPlace ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/questionnaires/${questionnaireId}`, {
        birthDate: date || null,
        birthTime: time || null,
        birthPlace: place || null,
      });
      return res.json();
    },
    onSuccess: (updated) => {
      // Invalidate this questionnaire's cache so QuestionnaireResult re-fetches
      qc.invalidateQueries({ queryKey: ["/api/questionnaires", String(questionnaireId)] });
      // Also invalidate the radiance query so the card recalculates
      qc.invalidateQueries({ queryKey: ["/api/radiance"] });
      toast({ title: "Birth data saved" });
      onSaved(updated);
    },
    onError: () => {
      toast({ title: "Save failed", description: "Could not update birth data.", variant: "destructive" });
    },
  });

  return (
    <div className="mt-4 pt-4 border-t border-white/10 space-y-3" data-testid="radiance-birth-edit-form">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edit Birth Data</p>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Date of birth</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-background border-white/20 h-8 text-sm"
            data-testid="radiance-edit-birthDate"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Time <span className="text-white/30">(optional)</span></Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="bg-background border-white/20 h-8 text-sm"
              data-testid="radiance-edit-birthTime"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Place <span className="text-white/30">(optional)</span></Label>
            <Input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="City, Country"
              className="bg-background border-white/20 h-8 text-sm"
              data-testid="radiance-edit-birthPlace"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !date}
            className="bg-primary hover:bg-primary/90 h-7 text-xs px-3"
            data-testid="radiance-edit-save"
          >
            <Check size={12} className="mr-1" />
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={mutation.isPending}
            className="border-white/20 text-muted-foreground h-7 text-xs px-3"
            data-testid="radiance-edit-cancel"
          >
            <X size={12} className="mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Compact variant (for QuestionnaireResult) ─────────────────────────────────

function RadianceCompact({ profile }: { profile: RadianceProfile }) {
  const color = getChakraColor(profile.chakraId);
  return (
    <div
      className="rounded-xl border p-4 flex items-start gap-4"
      style={{ borderColor: `${color}40`, background: `${color}10` }}
    >
      <Sparkles size={16} style={{ color }} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white">
          Radiance GK {profile.activation.gate}.{profile.activation.line}
          {" · "}{profile.gift}
          {!profile.activation.precise && (
            <span className="ml-2 text-muted-foreground font-normal">(approx.)</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {profile.chakraName} · {profile.fieldKoshaName} · Line {profile.activation.line}: {profile.bodyLayer}
        </p>
        <p className="text-xs mt-1.5 text-white/70">
          {profile.koshasConverge ? (
            <span className="text-emerald-400/80">
              ✦ Strong convergence at {profile.fieldKoshaName}
            </span>
          ) : (
            <span style={{ color }}>
              Field: {profile.fieldKoshaName} · Somatic: {profile.somaticKoshaName}
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {profile.primaryInstruments.slice(0, 3).map(id => (
            <InstrumentBadge key={id} id={id} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Full card ────────────────────────────────────────────────────────────────

interface RadianceFullProps {
  profile: RadianceProfile;
  questionnaireId?: number;
  currentBirthDate?: string | null;
  currentBirthTime?: string | null;
  currentBirthPlace?: string | null;
  onBirthDataSaved?: (updated: any) => void;
}

function RadianceFull({
  profile,
  questionnaireId,
  currentBirthDate,
  currentBirthTime,
  currentBirthPlace,
  onBirthDataSaved,
}: RadianceFullProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const color = getChakraColor(profile.chakraId);

  return (
    <div
      className="bg-card border rounded-xl overflow-hidden"
      style={{ borderColor: `${color}50` }}
      data-testid="radiance-card"
    >
      {/* Accent bar */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${color}, ${color}80)` }} />

      {/* Always-visible header */}
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `${color}20`, border: `1px solid ${color}40` }}
          >
            <Sparkles size={16} style={{ color }} />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="font-bold text-white text-sm">Radiance Sphere</h3>
              <span className="text-xs text-muted-foreground">Venus Sequence · Gene Keys</span>
              {!profile.activation.precise && (
                <span className="text-xs text-amber-400/70 flex items-center gap-1">
                  <AlertTriangle size={10} /> approx.
                </span>
              )}
            </div>
            <p className="text-sm mt-0.5" style={{ color }}>
              GK {profile.activation.gate}.{profile.activation.line} — {profile.gkName}
            </p>
          </div>
          {/* Edit birth data button — only shown when questionnaireId is provided */}
          {questionnaireId && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
              title="Edit birth data"
              data-testid="radiance-edit-toggle"
            >
              <Pencil size={13} />
            </button>
          )}
        </div>

        {/* Shadow / Gift / Siddhi row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Shadow</p>
            <p className="text-xs font-semibold text-red-400/80">{profile.shadow}</p>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-2.5 text-center border border-white/10">
            <p className="text-xs text-muted-foreground mb-0.5">Gift</p>
            <p className="text-xs font-semibold text-emerald-400">{profile.gift}</p>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Siddhi</p>
            <p className="text-xs font-semibold" style={{ color }}>{profile.siddhi}</p>
          </div>
        </div>

        {/* Two-column: Gate chain + Line chain */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {/* Gate → Chakra → Kosha */}
          <div className="bg-white/[0.03] rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Gate → Field Layer
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">HD Center</span>
                <span className="text-white font-mono">{profile.hdCenter}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chakra</span>
                <span style={{ color }} className="font-medium">{profile.chakraName.split("(")[0].trim()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frequency</span>
                <span className="text-white font-mono">{profile.chakraFrequencyHz} Hz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kosha</span>
                <span className="text-white text-right">{profile.fieldKoshaName.replace(" Kosha", "")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Biofield</span>
                <span className="text-white/70 text-right">{profile.fieldBiofieldPosition}</span>
              </div>
            </div>
          </div>

          {/* Line → Body → Kosha */}
          <div className="bg-white/[0.03] rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Line {profile.activation.line} → Somatic Depth
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Archetype</span>
                <span className="text-white">{profile.lineArchetype}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Body layer</span>
                <span className="text-white text-right">{profile.bodyLayer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kosha</span>
                <span className="text-white text-right">{profile.somaticKoshaName.replace(" Kosha", "")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Depth</span>
                <span className="text-white/70 text-right">{profile.fieldDepth}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Convergence signal */}
        <div
          className="rounded-xl p-3 mb-4"
          style={{
            background: profile.koshasConverge ? "rgba(34,197,94,0.08)" : `${color}10`,
            border: `1px solid ${profile.koshasConverge ? "rgba(34,197,94,0.25)" : `${color}30`}`,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap size={12} style={{ color: profile.koshasConverge ? "#4ade80" : color }} />
            <p className="text-xs font-semibold" style={{ color: profile.koshasConverge ? "#4ade80" : color }}>
              {profile.koshasConverge ? "Strong Convergence" : "Split Signal"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{profile.convergenceNote}</p>
        </div>

        {/* Dosha / Element */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <InfoBlock label="Codon Ring" value={profile.codonRing.replace("Ring of ", "")} />
          <InfoBlock label="Element" value={profile.element} accent={color} />
          <InfoBlock label="Dosha tendency" value={profile.doshaTendency} />
        </div>

        {/* Instruments */}
        <div className="space-y-2 mb-4">
          <SectionLabel>Recommended Instruments</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {profile.primaryInstruments.map(id => (
              <InstrumentBadge key={id} id={id} />
            ))}
          </div>
          {profile.secondaryInstruments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {profile.secondaryInstruments.map(id => (
                <span key={id} className="text-xs px-2 py-0.5 rounded border border-white/15 text-muted-foreground font-mono">
                  {id}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Expand toggle for application + body layer description */}
        <button
          className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors py-1 border-t border-white/5 pt-3"
          onClick={() => setExpanded(e => !e)}
          data-testid="radiance-expand"
        >
          {expanded ? <><ChevronUp size={12} /> Less detail</> : <><ChevronDown size={12} /> Application protocol</>}
        </button>

        {expanded && (
          <div className="pt-4 space-y-4">
            {/* Body layer desc */}
            <div>
              <SectionLabel>Body Layer — {profile.bodyLayer}</SectionLabel>
              <p className="text-sm text-muted-foreground leading-relaxed">{profile.bodyLayerDescription}</p>
            </div>

            {/* Application mode */}
            <div
              className="rounded-xl p-4"
              style={{ background: `${color}08`, border: `1px solid ${color}20` }}
            >
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <Link2 size={11} style={{ color }} />
                Application Protocol
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{profile.applicationMode}</p>
            </div>

            {/* Attribution */}
            <p className="text-xs text-white/25 italic">
              Radiance sphere: Venus Sequence, Gene Keys (Richard Rudd, 2009/2013).
              HD center assignments: IHDS body graph. Synthesis: CommonUnity.
              {!profile.activation.precise && " Birth time not provided — line is approximate (±1)."}
            </p>
          </div>
        )}

        {/* Inline edit form */}
        {editing && questionnaireId && (
          <BirthEditForm
            questionnaireId={questionnaireId}
            currentDate={currentBirthDate}
            currentTime={currentBirthTime}
            currentPlace={currentBirthPlace}
            onSaved={(updated) => {
              setEditing(false);
              onBirthDataSaved?.(updated);
            }}
            onCancel={() => setEditing(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── No birth data prompt ─────────────────────────────────────────────────────

interface RadianceEmptyProps {
  questionnaireId?: number;
  onAddBirthData?: () => void;
}

function RadianceEmpty({ questionnaireId, onAddBirthData }: RadianceEmptyProps) {
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();

  const handleSaved = (updated: any) => {
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["/api/questionnaires", String(questionnaireId)] });
    qc.invalidateQueries({ queryKey: ["/api/radiance"] });
    onAddBirthData?.();
  };

  return (
    <div
      className="bg-card border border-dashed border-white/15 rounded-xl p-5"
      data-testid="radiance-empty"
    >
      <div className="flex items-center gap-4">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
          <Sparkles size={16} className="text-white/25" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white/50">Radiance Sphere</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add a date of birth to unlock the Gene Keys Radiance synthesis — chakra, kosha, body layer, and instrument recommendations derived from this client's path to health.
          </p>
        </div>
        {(questionnaireId || onAddBirthData) && !editing && (
          <button
            onClick={() => questionnaireId ? setEditing(true) : onAddBirthData?.()}
            className="shrink-0 text-xs text-primary hover:text-white border border-primary/40 hover:border-primary rounded-lg px-3 py-1.5 transition-colors"
            data-testid="radiance-add-birth"
          >
            Add birth data
          </button>
        )}
      </div>

      {editing && questionnaireId && (
        <BirthEditForm
          questionnaireId={questionnaireId}
          onSaved={handleSaved}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface RadianceCardProps {
  birthDate?: string | null;
  birthTime?: string | null;
  birthPlace?: string | null;
  compact?: boolean;
  questionnaireId?: number;
  onAddBirthData?: () => void;
  onBirthDataSaved?: (updated: any) => void;
}

export default function RadianceCard({
  birthDate,
  birthTime,
  birthPlace,
  compact = false,
  questionnaireId,
  onAddBirthData,
  onBirthDataSaved,
}: RadianceCardProps) {
  const { data: profile, isLoading, isError } = useQuery<RadianceProfile>({
    queryKey: ["/api/radiance", birthDate, birthTime],
    queryFn: () =>
      apiRequest("POST", "/api/radiance", { birthDate, birthTime }).then(r => r.json()),
    enabled: !!birthDate,
    staleTime: Infinity, // pure computation — never stale
  });

  if (!birthDate) {
    return compact ? null : (
      <RadianceEmpty
        questionnaireId={questionnaireId}
        onAddBirthData={onAddBirthData}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="bg-card border border-white/10 rounded-xl p-5 animate-pulse" data-testid="radiance-loading">
        <div className="h-4 bg-white/10 rounded w-40 mb-3" />
        <div className="h-3 bg-white/5 rounded w-full mb-2" />
        <div className="h-3 bg-white/5 rounded w-3/4" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="bg-card border border-red-500/20 rounded-xl p-4 text-xs text-red-400/70">
        Radiance calculation failed — check birth date format (YYYY-MM-DD).
      </div>
    );
  }

  if (compact) return <RadianceCompact profile={profile} />;
  return (
    <RadianceFull
      profile={profile}
      questionnaireId={questionnaireId}
      currentBirthDate={birthDate}
      currentBirthTime={birthTime}
      currentBirthPlace={birthPlace}
      onBirthDataSaved={onBirthDataSaved}
    />
  );
}
