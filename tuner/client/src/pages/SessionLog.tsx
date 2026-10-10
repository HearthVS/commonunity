import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, Trash2, ChevronRight } from "lucide-react";
import type { SessionLog as SessionLogType, ProtocolTemplate } from "@shared/schema";
import { setNexusContext } from "../components/NexusPanel";

export default function SessionLog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    sessionDate: new Date().toISOString().slice(0, 10),
    selectedProtocolId: "",
    goalPresentingNeed: "",
    actualInstrumentsUsed: "",
    observedResponse: "",
    outcomeNotes: "",
    followUpNotes: "",
    wouldRepeat: 1,
  });

  const { data: sessions = [], isLoading } = useQuery<SessionLogType[]>({
    queryKey: ["/api/sessions"],
    queryFn: () => apiRequest("GET", "/api/sessions").then((r) => r.json()),
  });

  const { data: protocols = [] } = useQuery<ProtocolTemplate[]>({
    queryKey: ["/api/protocols"],
    queryFn: () => apiRequest("GET", "/api/protocols").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiRequest("POST", "/api/sessions", {
        ...data,
        actualInstrumentsUsed: JSON.stringify(data.actualInstrumentsUsed.split(",").map((s) => s.trim()).filter(Boolean)),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      setOpen(false);
      setForm({ clientName: "", sessionDate: new Date().toISOString().slice(0, 10), selectedProtocolId: "", goalPresentingNeed: "", actualInstrumentsUsed: "", observedResponse: "", outcomeNotes: "", followUpNotes: "", wouldRepeat: 1 });
      toast({ title: "Session logged" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/sessions/${id}`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "Session deleted" });
    },
  });

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    setNexusContext("Session Log\nRecord of past sessions — outcomes, instruments used, protocol deviations, and follow-up notes.");
    return () => setNexusContext("Sound healing practitioner tool — OM Tuner");
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <PageHeader title="Session Log" description="Track all client sessions — notes, protocols used, and follow-up actions. Every session links back to the client profile and the protocol applied." />
          <p className="text-sm text-[var(--muted)] mt-0.5">{sessions.length} session{sessions.length !== 1 ? "s" : ""} recorded</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="button-new-session">
          <Plus className="w-4 h-4 mr-1.5" />
          Log Session
        </Button>
      </div>

      {/* Sessions list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-[var(--card)] border border-white/10 rounded-xl p-12 text-center space-y-3">
          <p className="text-[var(--muted)]">No sessions yet.</p>
          <Button onClick={() => setOpen(true)} variant="outline" className="border-white/20">
            <Plus className="w-4 h-4 mr-1.5" />
            Log your first session
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-[var(--card)] border border-white/10 rounded-xl p-5 flex items-center justify-between gap-4 hover:border-white/20 transition-colors"
              data-testid={`row-session-${session.id}`}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-white">{session.clientName ?? "Client"}</span>
                  {session.selectedProtocolId && (
                    <span className="text-xs font-mono bg-[var(--primary)]/20 text-[var(--primary)] px-2 py-0.5 rounded">
                      {session.selectedProtocolId}
                    </span>
                  )}
                  {session.wouldRepeat === 1 && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Repeat</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {session.sessionDate}
                  </span>
                </div>
                {session.goalPresentingNeed && (
                  <p className="text-xs text-[var(--muted)] truncate max-w-md">{session.goalPresentingNeed}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/sessions/${session.id}`}>
                  <Button variant="ghost" size="sm" className="text-[var(--muted)] hover:text-white">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--muted)] hover:text-red-400"
                  onClick={() => deleteMutation.mutate(session.id)}
                  data-testid={`button-delete-session-${session.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gap analysis */}
      {sessions.length >= 3 && (
        <div className="bg-[var(--card)] border border-white/10 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">Gap Analysis</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-[var(--muted)]">Total Sessions</p>
              <p className="text-2xl font-bold text-white">{sessions.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--muted)]">Would Repeat</p>
              <p className="text-2xl font-bold text-[var(--primary)]">
                {sessions.filter(s => s.wouldRepeat === 1).length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--muted)]">Last Session</p>
              <p className="text-sm font-semibold text-white">{sessions[0]?.sessionDate ?? "—"}</p>
            </div>
          </div>
        </div>
      )}

      {/* New session dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--card)] border-white/20 max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Log New Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[var(--muted)]">Client name</Label>
                <Input value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Client name" className="bg-[var(--bg)] border-white/20" data-testid="input-session-clientName" />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--muted)]">Session date</Label>
                <Input type="date" value={form.sessionDate} onChange={(e) => set("sessionDate", e.target.value)} className="bg-[var(--bg)] border-white/20" data-testid="input-session-date" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--muted)]">Protocol used</Label>
              <Select value={form.selectedProtocolId} onValueChange={(v) => set("selectedProtocolId", v)}>
                <SelectTrigger className="bg-[var(--bg)] border-white/20" data-testid="select-protocol">
                  <SelectValue placeholder="Select protocol…" />
                </SelectTrigger>
                <SelectContent>
                  {protocols.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--muted)]">Presenting goal / client need</Label>
              <Input value={form.goalPresentingNeed} onChange={(e) => set("goalPresentingNeed", e.target.value)} placeholder="Client's presenting goal…" className="bg-[var(--bg)] border-white/20" data-testid="input-session-goal" />
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--muted)]">Instruments used (comma-separated IDs)</Label>
              <Input value={form.actualInstrumentsUsed} onChange={(e) => set("actualInstrumentsUsed", e.target.value)} placeholder="TF-PW-HEART, TF-OM-136W, …" className="bg-[var(--bg)] border-white/20" data-testid="input-session-instruments" />
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--muted)]">Observed response</Label>
              <Textarea value={form.observedResponse} onChange={(e) => set("observedResponse", e.target.value)} placeholder="In-session client responses, body language, energy shifts…" className="bg-[var(--bg)] border-white/20 min-h-[70px]" data-testid="textarea-session-observed" />
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--muted)]">Outcome notes</Label>
              <Textarea value={form.outcomeNotes} onChange={(e) => set("outcomeNotes", e.target.value)} placeholder="Post-session reflection, outcomes, client feedback…" className="bg-[var(--bg)] border-white/20 min-h-[60px]" data-testid="textarea-session-outcome" />
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--muted)]">Follow-up notes</Label>
              <Input value={form.followUpNotes} onChange={(e) => set("followUpNotes", e.target.value)} placeholder="Recommended next steps…" className="bg-[var(--bg)] border-white/20" data-testid="input-session-followup" />
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--muted)]">Would you repeat this protocol with this client?</Label>
              <Select value={String(form.wouldRepeat)} onValueChange={(v) => set("wouldRepeat", parseInt(v))}>
                <SelectTrigger className="bg-[var(--bg)] border-white/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Yes</SelectItem>
                  <SelectItem value="0">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-white/20 text-[var(--muted)]">Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.clientName.trim()} data-testid="button-save-session">
              {createMutation.isPending ? "Saving…" : "Save Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
