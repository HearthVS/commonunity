// Renders a Composer soundscape to an MP3 file in the browser, so it can be
// downloaded or shared. The mix matches the Composer preview: each recording
// loops at the track's volume, and tracks without a recording play a sine
// tone at their frequency. Mixing is done by hand in small blocks, so long
// renders stay light on memory.

export interface ExportTrack {
  frequency: number;
  gain: number; // 0-100
  label: string;
  audioFilename?: string;
}

const SAMPLE_RATE = 44100;
const KBPS = 128;
const TARGET_PEAK = 0.89; // about -1 dBFS
const BLOCK = 1152 * 20; // MP3 frame multiple

type Voice =
  | { kind: "sample"; left: Float32Array; right: Float32Array; gain: number }
  | { kind: "sine"; step: number; gain: number };

async function loadVoices(tracks: ExportTrack[]): Promise<Voice[]> {
  // An OfflineAudioContext decodes and resamples to SAMPLE_RATE.
  const decoder = new OfflineAudioContext(2, 1, SAMPLE_RATE);
  return Promise.all(
    tracks.map(async (t): Promise<Voice> => {
      const sine: Voice = {
        kind: "sine",
        step: (2 * Math.PI * t.frequency) / SAMPLE_RATE,
        gain: (t.gain / 100) * 0.3,
      };
      if (!t.audioFilename) return sine;
      try {
        const res = await fetch(`/assets/audio/${t.audioFilename}`);
        if (!res.ok) return sine;
        const buf = await decoder.decodeAudioData(await res.arrayBuffer());
        const left = buf.getChannelData(0);
        const right = buf.numberOfChannels > 1 ? buf.getChannelData(1) : left;
        return { kind: "sample", left, right, gain: (t.gain / 100) * 0.7 };
      } catch {
        return sine; // same fallback as the preview
      }
    }),
  );
}

// Fades scale with length so long meditations open and close softly:
// 1 min → 2 s in / 3 s out, 60 min → 10 s in / 30 s out.
export function fadeSeconds(seconds: number): { fadeIn: number; fadeOut: number } {
  return {
    fadeIn: Math.max(2, Math.min(10, seconds * 0.02)),
    fadeOut: Math.max(3, Math.min(30, seconds * 0.05)),
  };
}

function envelope(n: number, total: number, fadeIn: number, fadeOut: number): number {
  if (n < fadeIn) return n / fadeIn;
  if (n > total - fadeOut) return Math.max(0, (total - n) / fadeOut);
  return 1;
}

// Mixes samples [start, start+len) into out arrays (before envelope/scaling).
function mixBlock(voices: Voice[], start: number, len: number, outL: Float32Array, outR: Float32Array) {
  outL.fill(0, 0, len);
  outR.fill(0, 0, len);
  for (const v of voices) {
    if (v.kind === "sample") {
      const size = v.left.length;
      let idx = start % size;
      for (let i = 0; i < len; i++) {
        outL[i] += v.left[idx] * v.gain;
        outR[i] += v.right[idx] * v.gain;
        if (++idx === size) idx = 0;
      }
    } else {
      for (let i = 0; i < len; i++) {
        const s = Math.sin(v.step * (start + i)) * v.gain;
        outL[i] += s;
        outR[i] += s;
      }
    }
  }
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

export async function renderSoundscapeMp3(
  tracks: ExportTrack[],
  seconds: number,
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  const active = tracks.filter((t) => t.frequency > 0 && t.gain > 0);
  if (active.length === 0) throw new Error("No audible tracks to export");

  const [{ Mp3Encoder }, voices] = await Promise.all([
    import("@breezystack/lamejs"),
    loadVoices(active),
  ]);

  const total = Math.round(seconds * SAMPLE_RATE);
  const fades = fadeSeconds(seconds);
  const fadeIn = fades.fadeIn * SAMPLE_RATE;
  const fadeOut = fades.fadeOut * SAMPLE_RATE;
  const outL = new Float32Array(BLOCK);
  const outR = new Float32Array(BLOCK);

  // Pass 1: find the peak so the file is loud enough but never clips.
  let peak = 0;
  for (let start = 0; start < total; start += BLOCK) {
    const len = Math.min(BLOCK, total - start);
    mixBlock(voices, start, len, outL, outR);
    for (let i = 0; i < len; i++) {
      const a = Math.abs(outL[i]);
      const b = Math.abs(outR[i]);
      if (a > peak) peak = a;
      if (b > peak) peak = b;
    }
    if ((start / BLOCK) % 40 === 0) {
      onProgress?.((start / total) * 0.25);
      await yieldToUi();
    }
  }
  const scale = peak > 0 ? TARGET_PEAK / peak : 1;

  // Pass 2: apply fades and scaling, encode.
  const encoder = new Mp3Encoder(2, SAMPLE_RATE, KBPS);
  const chunks: Uint8Array[] = [];
  const intL = new Int16Array(BLOCK);
  const intR = new Int16Array(BLOCK);
  for (let start = 0; start < total; start += BLOCK) {
    const len = Math.min(BLOCK, total - start);
    mixBlock(voices, start, len, outL, outR);
    for (let i = 0; i < len; i++) {
      const g = envelope(start + i, total, fadeIn, fadeOut) * scale;
      intL[i] = Math.max(-1, Math.min(1, outL[i] * g)) * 0x7fff;
      intR[i] = Math.max(-1, Math.min(1, outR[i] * g)) * 0x7fff;
    }
    const mp3 = encoder.encodeBuffer(intL.subarray(0, len), intR.subarray(0, len));
    if (mp3.length > 0) chunks.push(new Uint8Array(mp3));
    if ((start / BLOCK) % 10 === 0) {
      onProgress?.(0.25 + (start / total) * 0.75);
      await yieldToUi();
    }
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(new Uint8Array(tail));
  onProgress?.(1);
  return new Blob(chunks, { type: "audio/mpeg" });
}

// Rough size of the exported MP3 (128 kbps stereo).
export function estimatedSizeMB(minutes: number): number {
  return (KBPS * 1000 * 60 * minutes) / 8 / 1_048_576;
}

export function soundscapeFileName(name: string): string {
  const slug = (name || "soundscape")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "soundscape"}.mp3`;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// True when this browser can open the system share sheet with a file.
export function canShareAudioFile(): boolean {
  try {
    const probe = new File([new Uint8Array(1)], "probe.mp3", { type: "audio/mpeg" });
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}
