import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { COMFORT_TIERS, DOSHA_LABELS, CHAKRA_COLORS, parseArr } from "@/lib/utils";
import { AlertTriangle, CheckCircle, ArrowRight, BookOpen, Trash2, User, Calendar, Clock, MapPin, Mail, Phone, Stethoscope, Download } from "lucide-react";
import type { QuestionnaireResponse } from "@shared/schema";
import RadianceCard from "@/components/RadianceCard";
import { setNexusContext } from "../components/NexusPanel";
import type { RadianceProfile } from "@shared/genekeys";
import type { CommonUnityKey } from "@sdk/key-schema";
import { KEY_SCHEMA_VERSION } from "@sdk/key-schema";
import { useToast } from "@/hooks/use-toast";

const DOSHA_COLORS: Record<string, string> = {
  vata: "#a78bfa",
  pitta: "#f97316",
  kapha: "#34d399",
  balanced: "#6ee7b7",
};

const CONTRA_LABELS: Record<string, string> = {
  "pacemaker-caution": "Pacemaker / cardiac device — no direct body contact over chest",
  "epilepsy-seizure-caution": "Epilepsy / seizure history — avoid strong binaural or strobing patterns",
  "pregnancy-caution": "Pregnancy — avoid weighted forks on lower abdomen/sacrum in first trimester",
  "recent-surgery-caution": "Recent surgery / fracture — avoid direct contact over healing sites",
  "implanted-device-caution": "Implanted electronic device — work off-body only",
  "sound-sensitivity-caution": "Sound sensitivity / tinnitus — reduce volume; watch for distress",
  "tinnitus-caution": "Tinnitus present — avoid prolonged high-frequency tones near ears",
  "acute-trauma-caution": "Acute trauma / crisis — grounding-only protocols; no deep emotional excavation",
  "severe-mental-health-caution": "Acute mental health episode — work only with GP/therapist permission",
  "postpartum-caution": "Postpartum (within 6 weeks) — avoid weighted forks on lower abdomen/sacrum; keep the session gentle",
};

export default function QuestionnaireResult() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Save this profile as a CommonUnity Key JSON file
  // The Key is the portable identity carrier for the entire ecosystem.
  // Format: {name}-commonunity-{date}.json
  function saveProfileJSON() {
    if (!result) return;
    const clientProfile = {
      clientName:               result.clientName,
      clientEmail:              (result as any).clientEmail,
      practitionerName:         (result as any).practitionerName,
      sessionDate:              result.sessionDate,
      dominantDosha:            result.dominantDosha,
      dominantCenter:           result.dominantCenter,
      suggestedChakraFocus:     result.suggestedChakraFocus,
      recommendedProtocolId:    result.recommendedProtocolId,
      recommendedComfortTier:   result.recommendedComfortTier,
      intentionText:            result.intentionText,
      contraindicationFlags:    result.contraindicationFlags,
      birthDate:                (result as any).birthDate,
      birthTime:                (result as any).birthTime,
      birthPlace:               (result as any).birthPlace,
      radianceProfile:          radianceProfile ?? undefined,
      updatedAt:                new Date().toISOString(),
    };

    const key: CommonUnityKey = {
      _schemaVersion:   KEY_SCHEMA_VERSION,
      _exportedAt:      new Date().toISOString(),
      _exportedBy:      "tuner",
      _commonUnityKey:  true,
      name:             result.clientName ?? "profile",
      tuner: {
        clients: [clientProfile],
      },
    };

    const slug = (result.clientName ?? "profile").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${slug}-commonunity-${date}.json`;
    const blob = new Blob([JSON.stringify(key, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Key saved: ${filename}` });
  }

  const { data: result, isLoading } = useQuery<QuestionnaireResponse>({
    queryKey: ["/api/questionnaires", id],
    queryFn: () => apiRequest("GET", `/api/questionnaires/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/questionnaires/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/questionnaires"] });
      toast({ title: "Profile deleted" });
      navigate("/clients");
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

  const birthDate = (result as any)?.birthDate as string | undefined;
  const birthTime = (result as any)?.birthTime as string | undefined;
  const birthPlace = (result as any)?.birthPlace as string | undefined;

  const { data: radianceProfile } = useQuery<RadianceProfile>({
    queryKey: ["/api/radiance", birthDate, birthTime],
    queryFn: () => apiRequest("POST", "/api/radiance", { birthDate, birthTime }).then(r => r.json()),
    enabled: !!birthDate,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!result) return;
    const lines = [
      `Session Profile — ${result.clientName ?? "Client"} (${result.sessionDate ?? "today"})`,
      `Dominant dosha: ${result.dominantDosha ?? "unknown"} | Center: ${result.dominantCenter ?? "unknown"}`,
      `Protocol: ${result.recommendedProtocolId ?? "pending"} | Tier: ${result.recommendedComfortTier ?? "3"}`,
      radianceProfile ? radianceProfile.nexusSummary : "Radiance sphere: birth data not provided.",
    ];
    setNexusContext(lines.join("\n"));
    return () => setNexusContext("Frequency toolkit — OM Tuner");
  }, [result, radianceProfile]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Session profile not found.</p>
        <Link href="/questionnaire">
          <Button variant="outline" className="mt-4 border-white/20">New Questionnaire</Button>
        </Link>
      </div>
    );
  }

  const flags = parseArr(result.contraindicationFlags as unknown as string);
  // Null means the client skipped those questions; say so instead of guessing.
  const dominantDosha = result.dominantDosha ?? "not answered";
  const dominantCenter = result.dominantCenter ?? "not answered";
  const comfortTier = result.recommendedComfortTier ?? 3;
  const tierInfo = COMFORT_TIERS.find((t) => t.tier === comfortTier) ?? COMFORT_TIERS[2];
  const doshaColor = DOSHA_COLORS[dominantDosha] ?? "#2BC9B8";
  const chakraColor = CHAKRA_COLORS[result.suggestedChakraFocus ?? "CH-HEART"] ?? "#228B22";

  // Dosha label subtitle — handle "balanced" which has no parenthetical
  const doshaSub = dominantDosha === "balanced"
    ? "Sattvic state"
    : (DOSHA_LABELS[dominantDosha]?.split(" (")[1]?.replace(")", "") ?? "");

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Session Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generated for {result.clientName ?? "Client"} · {result.sessionDate ?? "Today"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {confirmDelete ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="text-xs"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Deleting…" : "Confirm delete"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                className="border-white/20 text-muted-foreground text-xs"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                data-testid="button-delete-profile"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Link href={`/protocols/${result.recommendedProtocolId}`}>
                <Button className="bg-primary hover:bg-primary/90" data-testid="button-view-protocol">
                  View Protocol
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Client info card */}
      <div className="bg-card border border-white/10 rounded-xl p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Client Information</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
          <div className="flex items-start gap-2">
            <User className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="text-sm text-white font-medium">{result.clientName ?? "—"}</p>
            </div>
          </div>
          {result.clientEmail && (
            <div className="flex items-start gap-2">
              <Mail className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm text-white truncate">{result.clientEmail}</p>
              </div>
            </div>
          )}
          {result.clientPhone && (
            <div className="flex items-start gap-2">
              <Phone className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm text-white truncate">{result.clientPhone}</p>
              </div>
            </div>
          )}
          {(result as any).practitionerName && (
            <div className="flex items-start gap-2">
              <Stethoscope className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Practitioner</p>
                <p className="text-sm text-white">{(result as any).practitionerName}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Session date</p>
              <p className="text-sm text-white">{result.sessionDate ?? "—"}</p>
            </div>
          </div>
          {birthDate && (
            <div className="flex items-start gap-2">
              <Calendar className="w-3.5 h-3.5 text-primary/70 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Date of birth</p>
                <p className="text-sm text-white">{birthDate}</p>
              </div>
            </div>
          )}
          {birthTime && (
            <div className="flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 text-primary/70 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Time of birth</p>
                <p className="text-sm text-white">{birthTime}</p>
              </div>
            </div>
          )}
          {birthPlace && (
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-primary/70 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Place of birth</p>
                <p className="text-sm text-white">{birthPlace}</p>
              </div>
            </div>
          )}
          {!birthDate && (
            <div className="col-span-2 md:col-span-3">
              <p className="text-xs text-muted-foreground italic">
                No birth data recorded — add it via the Radiance Sphere card below to unlock Gene Keys synthesis.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Contraindication flags */}
      {flags.length > 0 ? (
        <div className="bg-red-900/20 border border-red-500/40 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="font-semibold text-red-300 text-sm">
              {flags.length} Contraindication Flag{flags.length > 1 ? "s" : ""} — Review Before Session
            </span>
          </div>
          <ul className="space-y-2">
            {flags.map((flag) => (
              <li key={flag} className="flex items-start gap-2 text-sm text-red-200">
                <span className="text-red-400 mt-0.5">·</span>
                <span>{CONTRA_LABELS[flag] ?? flag}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-emerald-200">No contraindication flags — full protocol range available</span>
        </div>
      )}

      {/* Summary grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Dosha */}
        <div className="bg-card border border-white/10 rounded-xl p-4 space-y-1.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Dominant Quality</p>
          <p className="font-bold capitalize" style={{ color: doshaColor }}>{dominantDosha}</p>
          <p className="text-xs text-muted-foreground">{doshaSub}</p>
        </div>

        {/* Center */}
        <div className="bg-card border border-white/10 rounded-xl p-4 space-y-1.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Dominant Center</p>
          <p className="font-bold capitalize text-white">{dominantCenter}</p>
          <p className="text-xs text-muted-foreground">Center focus</p>
        </div>

        {/* Chakra */}
        <div className="bg-card border border-white/10 rounded-xl p-4 space-y-1.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Chakra Focus</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: chakraColor }} />
            <p className="font-bold text-white text-sm">{result.suggestedChakraFocus?.replace("CH-", "") ?? "Heart"}</p>
          </div>
        </div>

        {/* Comfort tier */}
        <div className="bg-card border border-white/10 rounded-xl p-4 space-y-1.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Comfort Tier</p>
          <p className="font-bold text-primary">Tier {comfortTier}</p>
          <p className="text-xs text-muted-foreground">{tierInfo.label.replace(`Tier ${comfortTier} — `, "")}</p>
        </div>
      </div>

      {/* Tier description */}
      <div className="bg-card border border-white/10 rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/20 text-primary border-primary/40">
            {tierInfo.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{tierInfo.desc}</p>
      </div>

      {/* Recommended protocol */}
      {result.recommendedProtocolId && (
        <div className="bg-card border border-white/10 rounded-xl p-5 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recommended Protocol</p>
          <div className="flex items-center justify-between">
            <span className="font-mono text-white">{result.recommendedProtocolId}</span>
            <Link href={`/protocols/${result.recommendedProtocolId}`}>
              <Button variant="outline" size="sm" className="border-white/20 text-muted-foreground">
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                Open
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Intentions */}
      {result.intentionText && (
        <div className="bg-card border border-white/10 rounded-xl p-5 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client Intentions</p>
          <p className="text-sm text-white leading-relaxed italic">"{result.intentionText}"</p>
        </div>
      )}

      {/* Client notes */}
      {(result.attentionAreas || result.otherNotes) && (
        <div className="bg-card border border-white/10 rounded-xl p-5 space-y-3">
          {result.attentionAreas && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Areas needing attention</p>
              <p className="text-sm text-white leading-relaxed whitespace-pre-line">{result.attentionAreas}</p>
            </div>
          )}
          {result.otherNotes && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Anything else</p>
              <p className="text-sm text-white leading-relaxed whitespace-pre-line">{result.otherNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Gene Keys Radiance Sphere */}
      <RadianceCard
        birthDate={(result as any).birthDate}
        birthTime={(result as any).birthTime}
        birthPlace={(result as any).birthPlace}
        questionnaireId={result.id}
      />

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button
          variant="outline"
          className="border-white/20 text-muted-foreground"
          onClick={saveProfileJSON}
          data-testid="button-save-json"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Save JSON
        </Button>
        <Link href="/clients">
          <Button variant="outline" className="border-white/20 text-muted-foreground" data-testid="button-all-profiles">
            All Profiles
          </Button>
        </Link>
        <Link href="/sessions">
          <Button variant="outline" className="border-white/20 text-muted-foreground" data-testid="button-log-session">
            Log a Session
          </Button>
        </Link>
        <Link href="/questionnaire">
          <Button variant="outline" className="border-white/20 text-muted-foreground" data-testid="button-new-questionnaire">
            New Questionnaire
          </Button>
        </Link>
      </div>
    </div>
  );
}
