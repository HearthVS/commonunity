import { useState, useRef, useEffect, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { setNexusContext } from "../components/NexusPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { MultiChladniCanvas } from "@/components/ChladniCanvas";
import { parseArr, CHAKRA_COLORS, formatHz } from "@/lib/utils";
import { Plus, Trash2, Save, Play, Square, Volume2, Download, Share2 } from "lucide-react";
import { renderSoundscapeMp3, soundscapeFileName, downloadBlob, canShareAudioFile, estimatedSizeMB } from "@/lib/soundscapeExport";
import type { Instrument, Soundscape } from "@shared/schema";

interface Track {
  instrumentId: string;
  frequency: number;
  gain: number; // 0-100
  label: string;
  chakraId?: string;
  color: string;
  audioFilename?: string;
}

const EXPORT_LENGTHS = [1, 3, 5, 10, 15, 20, 30, 45, 60]; // minutes

const TRACK_COLORS = [
  "#2BC9B8", "#A98BF0", "#FF7A4D", "#7FE3D8",
  "#10b981", "#f97316", "#8b5cf6", "#06b6d4",
];

function TrackRow({
  track,
  index,
  instruments,
  onUpdate,
  onRemove,
}: {
  track: Track;
  index: number;
  instruments: Instrument[];
  onUpdate: (t: Partial<Track>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="bg-card border border-white/10 rounded-xl p-4 space-y-3"
      data-testid={`track-row-${index}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: track.color }} />
        <div className="flex-1 min-w-0">
          <select
            value={track.instrumentId}
            onChange={(e) => {
              const inst = instruments.find((i) => i.id === e.target.value);
              if (inst) {
                onUpdate({
                  instrumentId: inst.id,
                  frequency: inst.frequency,
                  label: inst.name,
                  chakraId: inst.chakraId ?? undefined,
                  audioFilename: inst.audioFilename ?? undefined,
                });
              }
            }}
            className="w-full bg-background border border-white/20 rounded-lg px-3 py-2 text-sm text-white"
            data-testid={`select-track-instrument-${index}`}
          >
            <option value="">— Select instrument —</option>
            {instruments.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name} ({formatHz(inst.frequency)})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors rounded"
          data-testid={`button-remove-track-${index}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2">
            <Volume2 className="w-3 h-3" />
            Volume: {track.gain}%
          </Label>
          <Slider
            value={[track.gain]}
            onValueChange={([v]) => onUpdate({ gain: v })}
            min={0}
            max={100}
            step={5}
            className="w-full"
            data-testid={`slider-track-gain-${index}`}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Frequency: {track.frequency > 0 ? formatHz(track.frequency) : "—"}
          </Label>
          {track.chakraId && (
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHAKRA_COLORS[track.chakraId] ?? "#2BC9B8" }} />
              <span className="text-xs text-muted-foreground">{track.chakraId?.replace("CH-", "")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Composer() {
  const { toast } = useToast();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundscapeName, setSoundscapeName] = useState("");
  const [soundscapeNotes, setSoundscapeNotes] = useState("");
  const [exportMinutes, setExportMinutes] = useState(10);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  // A rendered file ready to share; the share sheet must open straight from a tap.
  const [pendingShare, setPendingShare] = useState<{ key: string; file: File } | null>(null);
  const [shareSupported] = useState(canShareAudioFile);
  const [libraryFilter, setLibraryFilter] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playbackNodesRef = useRef<{ source: AudioBufferSourceNode | OscillatorNode; gain: GainNode }[]>([]);

  const { data: instruments = [] } = useQuery<Instrument[]>({
    queryKey: ["/api/instruments"],
    queryFn: () => apiRequest("GET", "/api/instruments").then((r) => r.json()),
  });

  const { data: soundscapes = [] } = useQuery<Soundscape[]>({
    queryKey: ["/api/soundscapes"],
    queryFn: () => apiRequest("GET", "/api/soundscapes").then((r) => r.json()),
  });

  // Keep Nexus aware of the current soundscape composition
  useEffect(() => {
    if (tracks.length === 0) {
      setNexusContext("Soundscape Composer — no tracks loaded yet");
    } else {
      const trackList = tracks
        .map((t) => `${t.label} (${t.frequency.toFixed(2)} Hz)`)
        .join(", ");
      const freqs = tracks.map((t) => t.frequency);
      const minHz = Math.min(...freqs).toFixed(2);
      const maxHz = Math.max(...freqs).toFixed(2);
      setNexusContext(
        `Soundscape Composer\n` +
        `${tracks.length} active track${tracks.length > 1 ? "s" : ""}: ${trackList}\n` +
        `Frequency range: ${minHz}–${maxHz} Hz`
      );
    }
    return () => setNexusContext("Sound healing practitioner tool — OM Tuner");
  }, [tracks]);

  const exportName = soundscapeName.trim() || "Untitled Soundscape";
  const exportKey = JSON.stringify([tracks, exportMinutes, exportName]);
  const audibleTracks = tracks.filter((t) => t.frequency > 0 && t.gain > 0);
  const exporting = exportProgress !== null;

  // Drop a prepared share file once the mix, length or name changes.
  useEffect(() => {
    if (pendingShare && pendingShare.key !== exportKey) setPendingShare(null);
  }, [exportKey, pendingShare]);

  const renderFile = async (): Promise<File> => {
    setExportProgress(0);
    try {
      const blob = await renderSoundscapeMp3(tracks, exportMinutes * 60, setExportProgress);
      return new File([blob], soundscapeFileName(exportName), { type: "audio/mpeg" });
    } finally {
      setExportProgress(null);
    }
  };

  const downloadAudio = async () => {
    try {
      const file = await renderFile();
      downloadBlob(file, file.name);
      toast({ title: "Audio downloaded", description: `${file.name} is in your Downloads folder.` });
    } catch {
      toast({ title: "Could not create the audio file", variant: "destructive" });
    }
  };

  const prepareShare = async () => {
    try {
      const file = await renderFile();
      setPendingShare({ key: exportKey, file });
    } catch {
      toast({ title: "Could not create the audio file", variant: "destructive" });
    }
  };

  const shareNow = async () => {
    if (!pendingShare) return;
    const list = audibleTracks.map((t) => `${t.label} (${formatHz(t.frequency)})`).join(", ");
    try {
      await navigator.share({
        files: [pendingShare.file],
        title: exportName,
        text: `${exportName} — a ${exportMinutes}-minute soundscape: ${list}`,
      });
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        toast({ title: "Sharing didn't work here", description: "Use Download instead and send the file.", variant: "destructive" });
      }
    }
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/soundscapes", {
        name: exportName,
        notes: soundscapeNotes,
        duration: exportMinutes * 60,
        tracks: JSON.stringify(tracks),
        instrumentIds: JSON.stringify(tracks.map((t) => t.instrumentId).filter(Boolean)),
      }).then((r) => r.json()),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soundscapes"] });
      toast({ title: "Soundscape saved", description: "Creating the audio file for your Downloads…" });
      await downloadAudio();
      setSoundscapeName("");
      setSoundscapeNotes("");
    },
    onError: () => {
      toast({ title: "Could not save the soundscape", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/soundscapes/${id}`).then((r) => r.json()),
    onSuccess: (_data, id) => {
      const name = soundscapes.find((sc) => sc.id === id)?.name;
      queryClient.invalidateQueries({ queryKey: ["/api/soundscapes"] });
      setConfirmDeleteId(null);
      toast({ title: name ? `Deleted: ${name}` : "Soundscape deleted" });
    },
    onError: () => {
      toast({ title: "Could not delete the soundscape", variant: "destructive" });
    },
  });

  const filteredSoundscapes = libraryFilter.trim()
    ? soundscapes.filter((sc) => sc.name.toLowerCase().includes(libraryFilter.trim().toLowerCase()))
    : soundscapes;

  const loadSoundscape = (sc: Soundscape) => {
    const loaded = parseArr(sc.tracks as unknown as string);
    if (loaded.length > 0) {
      try {
        setTracks(JSON.parse(sc.tracks as unknown as string));
        if (sc.duration && EXPORT_LENGTHS.includes(sc.duration / 60)) setExportMinutes(sc.duration / 60);
        setSoundscapeName(sc.name);
        setSoundscapeNotes(sc.notes ?? "");
        toast({ title: `Loaded: ${sc.name}` });
      } catch {
        toast({ title: "Could not load soundscape", variant: "destructive" });
      }
    }
  };

  const stopAudio = useCallback(() => {
    playbackNodesRef.current.forEach(({ source, gain }) => {
      try {
        gain.gain.setTargetAtTime(0, audioCtxRef.current!.currentTime, 0.1);
        source.stop(audioCtxRef.current!.currentTime + 0.2);
      } catch {}
    });
    playbackNodesRef.current = [];
    setIsPlaying(false);
  }, []);

  const startAudio = useCallback(async () => {
    if (isPlaying) { stopAudio(); return; }
    const activeTracks = tracks.filter((t) => t.frequency > 0 && t.gain > 0);
    if (activeTracks.length === 0) {
      toast({ title: "Add at least one instrument track to preview", variant: "destructive" });
      return;
    }

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    } else if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }

    const ctx = audioCtxRef.current;
    const nodes: { source: AudioBufferSourceNode | OscillatorNode; gain: GainNode }[] = [];

    await Promise.all(
      activeTracks.map(async (t) => {
        const gainNode = ctx.createGain();
        gainNode.gain.value = (t.gain / 100) * 0.7;
        gainNode.connect(ctx.destination);

        if (t.audioFilename) {
          try {
            const response = await fetch(`/assets/audio/${t.audioFilename}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.loop = true;
            source.connect(gainNode);
            source.start();
            nodes.push({ source, gain: gainNode });
          } catch {
            // Fallback to sine oscillator if sample load fails
            const osc = ctx.createOscillator();
            osc.type = "sine";
            osc.frequency.value = t.frequency;
            gainNode.gain.value = (t.gain / 100) * 0.3;
            osc.connect(gainNode);
            osc.start();
            nodes.push({ source: osc, gain: gainNode });
          }
        } else {
          // No recording — sine oscillator fallback
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = t.frequency;
          gainNode.gain.value = (t.gain / 100) * 0.3;
          osc.connect(gainNode);
          osc.start();
          nodes.push({ source: osc, gain: gainNode });
        }
      })
    );

    playbackNodesRef.current = nodes;
    setIsPlaying(true);
    toast({ title: "Playing your recordings — click Stop to end" });
  }, [tracks, isPlaying, stopAudio, toast]);

  useEffect(() => {
    return () => {
      if (isPlaying) stopAudio();
    };
  }, []);

  const addTrack = () => {
    const color = TRACK_COLORS[tracks.length % TRACK_COLORS.length];
    setTracks((ts) => [
      ...ts,
      { instrumentId: "", frequency: 0, gain: 70, label: "", chakraId: undefined, color },
    ]);
  };

  const updateTrack = (idx: number, update: Partial<Track>) => {
    setTracks((ts) => ts.map((t, i) => (i === idx ? { ...t, ...update } : t)));
  };

  const removeTrack = (idx: number) => {
    setTracks((ts) => ts.filter((_, i) => i !== idx));
  };

  const activeTracks = tracks.filter((t) => t.frequency > 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <PageHeader
          title="Soundscape Composer"
          description="Layer multiple instruments into a custom soundscape. Each track generates a live Chladni pattern and browser tone preview. Save compositions to the session library."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: Tracks ── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tracks ({tracks.length})</h2>
            <Button size="sm" variant="outline" onClick={addTrack} className="border-white/20 text-muted-foreground" data-testid="button-add-track">
              <Plus className="w-4 h-4 mr-1" />
              Add Track
            </Button>
          </div>

          {tracks.length === 0 ? (
            <div className="bg-card border border-white/10 rounded-xl p-10 text-center">
              <p className="text-sm text-muted-foreground">No tracks yet. Add an instrument to build your soundscape.</p>
              <Button onClick={addTrack} variant="outline" className="mt-4 border-white/20 text-muted-foreground">
                <Plus className="w-4 h-4 mr-1" />
                Add First Track
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {tracks.map((track, i) => (
                <TrackRow
                  key={i}
                  track={track}
                  index={i}
                  instruments={instruments}
                  onUpdate={(u) => updateTrack(i, u)}
                  onRemove={() => removeTrack(i)}
                />
              ))}
            </div>
          )}

          {/* Playback */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={isPlaying ? stopAudio : startAudio}
              className={isPlaying ? "bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30" : "bg-primary hover:bg-primary/90"}
              data-testid="button-toggle-playback"
            >
              {isPlaying ? (
                <><Square className="w-4 h-4 mr-1.5" /> Stop Preview</>
              ) : (
                <><Play className="w-4 h-4 mr-1.5" /> Preview Recordings</>
              )}
            </Button>
          </div>

          {/* Save soundscape */}
          <div className="bg-card border border-white/10 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Save &amp; share</h3>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Name</Label>
              <Input
                value={soundscapeName}
                onChange={(e) => setSoundscapeName(e.target.value)}
                placeholder="My morning grounding practice…"
                className="bg-background border-white/20"
                data-testid="input-soundscape-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Notes (optional)</Label>
              <Textarea
                value={soundscapeNotes}
                onChange={(e) => setSoundscapeNotes(e.target.value)}
                placeholder="Protocol context, client notes…"
                className="bg-background border-white/20 min-h-[60px]"
                data-testid="textarea-soundscape-notes"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="export-length" className="text-muted-foreground">Length</Label>
              <select
                id="export-length"
                value={exportMinutes}
                onChange={(e) => setExportMinutes(Number(e.target.value))}
                className="w-full bg-background border border-white/20 rounded-lg px-3 py-2 text-sm text-white"
                data-testid="select-export-length"
              >
                {EXPORT_LENGTHS.map((m) => (
                  <option key={m} value={m}>{m} minute{m > 1 ? "s" : ""}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                The recordings loop for the whole length, so it works as a meditation track, with a gentle
                fade in and out. Saved as an MP3 of about {Math.max(1, Math.round(estimatedSizeMB(exportMinutes)))} MB
                {exportMinutes >= 20 ? `, which takes up to ${Math.ceil(exportMinutes * 2 / 60)} minute${exportMinutes > 30 ? "s" : ""} to create` : ""}.
                {estimatedSizeMB(exportMinutes) > 20 && " That's too large for most email — share it through WhatsApp, AirDrop or a cloud drive instead."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || exporting || audibleTracks.length === 0}
                data-testid="button-save-soundscape"
              >
                <Save className="w-4 h-4 mr-1.5" />
                {saveMutation.isPending ? "Saving…" : "Save & download"}
              </Button>
              <Button
                variant="outline"
                onClick={downloadAudio}
                disabled={exporting || audibleTracks.length === 0}
                className="border-white/20"
                data-testid="button-download-soundscape"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Download only
              </Button>
              {shareSupported && (
                <Button
                  variant="outline"
                  onClick={pendingShare ? shareNow : prepareShare}
                  disabled={exporting || audibleTracks.length === 0}
                  className={pendingShare ? "border-primary text-white" : "border-white/20"}
                  data-testid="button-share-soundscape"
                >
                  <Share2 className="w-4 h-4 mr-1.5" />
                  {pendingShare ? "Share now" : "Share…"}
                </Button>
              )}
            </div>
            {exporting && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Creating audio… {Math.round((exportProgress ?? 0) * 100)}%
              </p>
            )}
            {pendingShare && !exporting && (
              <p className="text-xs text-muted-foreground">
                {pendingShare.file.name} is ready. Tap Share now to choose an app or person.
              </p>
            )}
          </div>
        </div>

        {/* ── Right: Visualization ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Multi-Chladni */}
          <div className="bg-card border border-white/10 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-white/5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Chladni Patterns</p>
            </div>
            <div className="p-4">
              {activeTracks.length > 0 ? (
                <MultiChladniCanvas
                  tracks={activeTracks.map((t) => ({
                    frequency: t.frequency,
                    color: t.color,
                    volume: t.gain / 100,
                  }))}
                  size={380}
                />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center text-muted-foreground text-sm border border-white/10 rounded-lg">
                  Add tracks to see Chladni patterns
                </div>
              )}
            </div>
          </div>

          {/* Frequency summary */}
          {activeTracks.length > 0 && (
            <div className="bg-card border border-white/10 rounded-xl p-4 space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Frequencies</p>
              <div className="space-y-2">
                {activeTracks.map((t, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <span className="text-sm text-white flex-1 truncate">{t.label || t.instrumentId}</span>
                    <span className="text-xs font-mono text-muted-foreground">{formatHz(t.frequency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OM special note */}
          <div className="bg-teal-900/20 border border-teal-500/30 rounded-xl p-4">
            <p className="text-xs text-teal-200">
              <span className="font-semibold">OM tip:</span> Begin every composition with{" "}
              TF-PW-HEART (136.10 Hz) to establish the ceremonial container before layering
              additional frequencies.
            </p>
          </div>

          {/* Saved soundscapes */}
          {soundscapes.length > 0 && (
            <div className="bg-card border border-white/10 rounded-xl p-4 space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Saved Soundscapes ({soundscapes.length})
              </p>
              {soundscapes.length > 8 && (
                <Input
                  value={libraryFilter}
                  onChange={(e) => setLibraryFilter(e.target.value)}
                  placeholder="Search by name…"
                  aria-label="Search saved soundscapes"
                  className="bg-background border-white/20 h-8 text-sm"
                  data-testid="input-filter-soundscapes"
                />
              )}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredSoundscapes.map((sc) => {
                  const minutes = sc.duration ? Math.round(sc.duration / 60) : null;
                  const confirming = confirmDeleteId === sc.id;
                  return (
                    <div
                      key={sc.id}
                      className="flex items-center gap-1 bg-white/5 rounded-lg pr-1"
                      data-testid={`row-soundscape-${sc.id}`}
                    >
                      {confirming ? (
                        <>
                          <div className="flex-1 min-w-0 px-3 py-2">
                            <p className="text-xs text-red-300">Delete this soundscape?</p>
                            <p className="text-sm text-white line-clamp-2 break-words">{sc.name}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-7 px-2 text-xs text-muted-foreground"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => deleteMutation.mutate(sc.id)}
                            disabled={deleteMutation.isPending}
                            className="h-7 px-2 text-xs bg-red-500/80 hover:bg-red-500 text-white"
                            data-testid={`button-confirm-delete-soundscape-${sc.id}`}
                          >
                            Delete
                          </Button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => loadSoundscape(sc)}
                            className="flex-1 min-w-0 flex items-center justify-between hover:bg-white/5 rounded-lg px-3 py-2 text-sm text-left transition-colors"
                            data-testid={`button-load-soundscape-${sc.id}`}
                          >
                            <span className="text-white line-clamp-2 break-words">{sc.name}</span>
                            <span className="text-xs text-muted-foreground ml-2 shrink-0">
                              {minutes ? `${minutes} min · ` : ""}Load
                            </span>
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(sc.id)}
                            className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors rounded shrink-0"
                            aria-label={`Delete ${sc.name}`}
                            title="Delete"
                            data-testid={`button-delete-soundscape-${sc.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
                {filteredSoundscapes.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1">No saved soundscapes match “{libraryFilter}”.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-card border border-white/10 rounded-xl p-4">
        <p className="text-xs text-muted-foreground">
          Preview plays your actual instrument recordings, looped and mixed in the browser via the Web Audio API.
          Each track's volume slider controls its mix level. The Chladni visualisation is a
          mathematical approximation based on the classical vibrating plate equation — not a direct
          simulation of physical sand patterns.
        </p>
      </div>
    </div>
  );
}
