import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { setNexusContext } from "../components/NexusPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { parseArr, DOSHA_LABELS } from "@/lib/utils";
import {
  AlertTriangle, CheckCircle, Trash2, ArrowRight,
  Users, ClipboardList, Calendar, Upload
} from "lucide-react";
import type { QuestionnaireResponse } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { isCommonUnityKey } from "@sdk/key-schema";

const DOSHA_COLORS: Record<string, string> = {
  vata: "#a78bfa", pitta: "#f97316", kapha: "#34d399", balanced: "#6ee7b7",
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  intake: { label: "Remote intake", color: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  in_person: { label: "In-person", color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
};

export default function Clients() {
  // Follows the address the app is opened on (omtuner.com once it's live).
  const intakeUrl = `${window.location.origin}/intake`;
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const { data: profiles, isLoading } = useQuery<QuestionnaireResponse[]>({
    queryKey: ["/api/questionnaires"],
    queryFn: () => apiRequest("GET", "/api/questionnaires").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/questionnaires/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/questionnaires"] });
      setConfirmDelete(null);
    },
  });

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load a profile from a CommonUnity Key JSON file
  // Accepts both the current Key format and legacy _tunerExport files
  function handleLoadJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        let imported = 0;

        if (isCommonUnityKey(data)) {
          // ── CommonUnity Key format ──────────────────────────────────────
          const clients = data.tuner?.clients ?? [];
          const ownProfile = data.tuner?.ownProfile;
          const profiles = ownProfile ? [...clients, ownProfile] : clients;
          if (profiles.length === 0) {
            toast({ title: "Key contains no Tuner profiles", variant: "destructive" });
            return;
          }
          for (const profile of profiles) {
            const { radianceProfile: _rp, updatedAt: _ua, ...payload } = profile as any;
            await apiRequest("POST", "/api/questionnaires", payload);
            imported++;
          }
          qc.invalidateQueries({ queryKey: ["/api/questionnaires"] });
          toast({ title: `Key loaded — ${imported} profile${imported !== 1 ? "s" : ""} imported` });

        } else if (data._tunerExport) {
          // ── Legacy single-profile format (pre-Key) ──────────────────────
          const { _tunerExport, _exportedAt, id, ...payload } = data;
          await apiRequest("POST", "/api/questionnaires", payload);
          qc.invalidateQueries({ queryKey: ["/api/questionnaires"] });
          toast({ title: `Loaded: ${data.clientName ?? "profile"}` });

        } else {
          toast({ title: "Not a CommonUnity Key file", variant: "destructive" });
        }
      } catch {
        toast({ title: "Error loading file — invalid JSON", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  useEffect(() => {
    const count = profiles?.length ?? 0;
    setNexusContext(`Client Profiles page\n${count} client questionnaire${count !== 1 ? "s" : ""} on file`);
    return () => setNexusContext("Frequency toolkit — OM Tuner");
  }, [profiles]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Client Profiles
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All submitted intake forms — newest first. Click any entry to view the full session profile.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleLoadJSON}
            data-testid="input-load-json"
          />
          <Button
            variant="outline"
            className="border-white/20 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-load-json"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Load JSON
          </Button>
          <Link href="/questionnaire">
            <Button className="bg-primary hover:bg-primary/90">
              <ClipboardList className="w-4 h-4 mr-1.5" />
              In-person form
            </Button>
          </Link>
        </div>
      </div>

      {/* Remote intake link box */}
      <div className="bg-card border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Remote intake link</p>
          <p className="text-sm text-white font-mono truncate">
            {intakeUrl}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Share this with clients before their session. Submissions appear here automatically.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-white/20 text-muted-foreground shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(intakeUrl);
          }}
        >
          Copy link
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : !profiles || profiles.length === 0 ? (
        <div className="bg-card border border-white/10 rounded-xl p-12 text-center space-y-3">
          <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
          <p className="text-muted-foreground text-sm">No profiles yet.</p>
          <p className="text-xs text-muted-foreground opacity-60">
            Fill out an in-person form above, or share the remote intake link with a client.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => {
            const flags = parseArr(p.contraindicationFlags as unknown as string);
            const doshaColor = DOSHA_COLORS[p.dominantDosha ?? ""] ?? "#2BC9B8";
            const src = (p as any)._source as string | undefined;
            const srcInfo = src ? SOURCE_LABELS[src] : null;

            return (
              <div
                key={p.id}
                className="bg-card border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Left: main info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white truncate">
                        {p.clientName ?? "Unnamed"}
                      </span>
                      {srcInfo && (
                        <Badge className={`text-xs border ${srcInfo.color}`}>{srcInfo.label}</Badge>
                      )}
                      {flags.length > 0 ? (
                        <span className="flex items-center gap-1 text-xs text-red-400">
                          <AlertTriangle className="w-3 h-3" />
                          {flags.length} flag{flags.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle className="w-3 h-3" />
                          Clear
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {p.sessionDate ?? "—"}
                      </span>
                      {p.dominantDosha && (
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ background: doshaColor }}
                          />
                          <span style={{ color: doshaColor }} className="capitalize">
                            {p.dominantDosha}
                          </span>
                        </span>
                      )}
                      {p.dominantCenter && (
                        <span className="capitalize">{p.dominantCenter} center</span>
                      )}
                      {p.recommendedProtocolId && (
                        <span className="font-mono text-primary">{p.recommendedProtocolId}</span>
                      )}
                    </div>

                    {p.intentionText && (
                      <p className="text-xs text-muted-foreground italic truncate">
                        "{p.intentionText}"
                      </p>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/questionnaire/result/${p.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/20 text-muted-foreground hover:text-white"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>

                    {confirmDelete === p.id ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs px-2 h-7"
                          onClick={() => deleteMutation.mutate(p.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs px-2 h-7 border-white/20 text-muted-foreground"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => setConfirmDelete(p.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
