import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { parseArr } from "@/lib/utils";
import { ArrowLeft, Save, Trash2, Calendar } from "lucide-react";
import type { SessionLog } from "@shared/schema";
import { setNexusContext } from "../components/NexusPanel";

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<SessionLog>>({});

  const { data: session, isLoading } = useQuery<SessionLog>({
    queryKey: ["/api/sessions", id],
    queryFn: () => apiRequest("GET", `/api/sessions/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  useEffect(() => {
    if (session) {
      setNexusContext(
        `Session detail: ${session.clientName || "unnamed client"} — ${session.sessionDate}\n` +
        (session.goalPresentingNeed ? `Goal: ${session.goalPresentingNeed.slice(0, 100)}\n` : "") +
        (session.selectedProtocolId ? `Protocol: ${session.selectedProtocolId}` : "")
      );
    }
    return () => setNexusContext("Sound healing practitioner tool — OM Tuner");
  }, [session]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SessionLog>) =>
      apiRequest("PATCH", `/api/sessions/${id}`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
      setEditing(false);
      toast({ title: "Session updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/sessions/${id}`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      navigate("/sessions");
      toast({ title: "Session deleted" });
    },
  });

  const startEdit = () => {
    if (!session) return;
    setForm({
      clientName: session.clientName ?? "",
      sessionDate: session.sessionDate ?? "",
      goalPresentingNeed: session.goalPresentingNeed ?? "",
      observedResponse: session.observedResponse ?? "",
      outcomeNotes: session.outcomeNotes ?? "",
      followUpNotes: session.followUpNotes ?? "",
      deviationsFromProtocol: session.deviationsFromProtocol ?? "",
      wouldRepeat: session.wouldRepeat ?? 1,
    });
    setEditing(true);
  };

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Session not found.</p>
        <Link href="/sessions">
          <Button variant="outline" className="mt-4 border-white/20">Back to Log</Button>
        </Link>
      </div>
    );
  }

  const instruments = parseArr(session.actualInstrumentsUsed as unknown as string);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/sessions">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Session Log
        </button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">{session.clientName ?? "Session"}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {session.sessionDate}
            </span>
            {session.selectedProtocolId && (
              <Link href={`/protocols/${session.selectedProtocolId}`}>
                <span className="text-xs font-mono bg-primary/20 text-primary px-2 py-0.5 rounded hover:bg-primary/30 cursor-pointer">
                  {session.selectedProtocolId}
                </span>
              </Link>
            )}
            {session.wouldRepeat === 1 && (
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Would Repeat</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {!editing && (
            <Button variant="outline" size="sm" className="border-white/20 text-muted-foreground" onClick={startEdit} data-testid="button-edit-session">
              Edit
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="border-red-500/30 text-red-400 hover:border-red-500/60"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid="button-delete-session"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="bg-card border border-white/10 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Session date</Label>
              <Input type="date" value={(form.sessionDate as string) ?? ""} onChange={(e) => set("sessionDate", e.target.value)} className="bg-background border-white/20" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Would repeat?</Label>
              <Select value={String(form.wouldRepeat ?? 1)} onValueChange={(v) => set("wouldRepeat", parseInt(v))}>
                <SelectTrigger className="bg-background border-white/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Yes</SelectItem>
                  <SelectItem value="0">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Presenting goal</Label>
            <Input value={(form.goalPresentingNeed as string) ?? ""} onChange={(e) => set("goalPresentingNeed", e.target.value)} className="bg-background border-white/20" />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Observed response</Label>
            <Textarea value={(form.observedResponse as string) ?? ""} onChange={(e) => set("observedResponse", e.target.value)} className="bg-background border-white/20 min-h-[80px]" />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Outcome notes</Label>
            <Textarea value={(form.outcomeNotes as string) ?? ""} onChange={(e) => set("outcomeNotes", e.target.value)} className="bg-background border-white/20 min-h-[60px]" />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Deviations from protocol</Label>
            <Input value={(form.deviationsFromProtocol as string) ?? ""} onChange={(e) => set("deviationsFromProtocol", e.target.value)} className="bg-background border-white/20" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(false)} className="border-white/20 text-muted-foreground">Cancel</Button>
            <Button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending} data-testid="button-save-edit">
              <Save className="w-4 h-4 mr-1.5" />
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Goal */}
          {session.goalPresentingNeed && (
            <div className="bg-card border border-white/10 rounded-xl p-5 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Presenting Goal</p>
              <p className="text-sm text-white">{session.goalPresentingNeed}</p>
            </div>
          )}

          {/* Instruments */}
          {instruments.length > 0 && (
            <div className="bg-card border border-white/10 rounded-xl p-5 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Instruments Used</p>
              <div className="flex flex-wrap gap-2">
                {instruments.map((id) => (
                  <Link key={id} href={`/inventory/${id}`}>
                    <span className="text-xs px-2.5 py-1 rounded bg-primary/20 text-primary font-mono hover:bg-primary/30 cursor-pointer">
                      {id}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Observed response */}
          {session.observedResponse && (
            <div className="bg-card border border-white/10 rounded-xl p-5 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Observed Response</p>
              <p className="text-sm text-white leading-relaxed">{session.observedResponse}</p>
            </div>
          )}

          {/* Outcome notes */}
          {session.outcomeNotes && (
            <div className="bg-card border border-white/10 rounded-xl p-5 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outcome Notes</p>
              <p className="text-sm text-white leading-relaxed">{session.outcomeNotes}</p>
            </div>
          )}

          {/* Follow-up */}
          {session.followUpNotes && (
            <div className="bg-card border border-white/10 rounded-xl p-5 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Follow-Up Notes</p>
              <p className="text-sm text-white">{session.followUpNotes}</p>
            </div>
          )}

          {/* Deviations */}
          {session.deviationsFromProtocol && (
            <div className="bg-card border border-white/10 rounded-xl p-5 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deviations from Protocol</p>
              <p className="text-sm text-muted-foreground">{session.deviationsFromProtocol}</p>
            </div>
          )}

          {/* Lessons */}
          {session.lessonsLearned && (
            <div className="bg-card border border-white/10 rounded-xl p-5 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lessons Learned</p>
              <p className="text-sm text-muted-foreground">{session.lessonsLearned}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
