import { useEffect, useRef } from "react";

interface ChladniCanvasProps {
  frequency: number;
  color?: string;
  size?: number;
  interactive?: boolean;
  frequencies?: number[]; // for multi-track layering
}

// ─── Frequency → Mode Pair ────────────────────────────────────────────────────
//
// Classical Chladni plate: E(x,y) = cos(n·π·x/L)·cos(m·π·y/L) - cos(m·π·x/L)·cos(n·π·y/L)
//
// Strategy: map Hz to (n, m) deterministically but with maximum spread so that
// every instrument in this kit produces a visually distinct pattern.
//
// We use a lookup table for the exact frequencies in the set, and a fallback
// formula for any frequency not in the table.
//
// The table was designed so that:
//   - Weighted body forks (low Hz, dense body effect) → low n/m, fewer nodal lines
//   - Mid field forks → moderate n/m, medium complexity
//   - High Solfeggio / bowl forks → higher n/m, rich complex webs
//   - No two instruments share the same (n, m) pair

const FREQ_TABLE: Record<number, [number, number]> = {
  //  Hz      n   m
  54.81:  [2, 3],   // TF-BT-SCHU-54   — very deep, 2 simple nodal arcs
  62.64:  [2, 4],   // TF-BT-SCHU-62   — deep Schumann, open cross
  89:     [3, 4],   // TF-BT-FIB-89    — lower Fibonacci, gentle quad
  93.96:  [3, 5],   // TF-BT-SLIDER    — Sonic Slider, pentagon-ish
  111:    [3, 6],   // BOWL-111        — star-of-David inner ring
  126.22: [4, 5],   // TF-PW-SOLAR     — Sun Tone, 4×5 web
  128:    [4, 6],   // TF-OTTO-128     — Otto 128, clean cross-ring
  136.10: [4, 7],   // TF-PW-HEART/OM  — heart OM, 4×7 petals
  141.27: [5, 6],   // TF-PW-THROAT    — Mercury, 5×6 interlock
  144:    [5, 7],   // TF-BT-FIB-144   — Fibonacci 144, phi web
  172.06: [5, 8],   // TF-PW-CROWN     — Platonic Year, crown web
  174:    [6, 7],   // TF-BT-SOL-174   — Solfeggio workhorse, hex grid
  194.18: [6, 8],   // TF-PW-ROOT      — Earth Day, 6×8 mandala
  210.42: [6, 9],   // TF-PW-SACRAL    — Moon, 6×9 flower
  221.23: [7, 8],   // TF-PW-3RD       — Venus, 7×8 petal ring
  222:    [7, 9],   // TF-BT-222       — BT 222, 7×9 complex
  272:    [8, 9],   // BOWL-272        — 8×9 dense web
  385.5:  [9, 10],  // BOWL-385        — rich mid-upper web
  396:    [9, 11],  // Solfeggio 396   — liberation freq
  417:    [10, 11], // TF-BT-SOL-417   — facilitating change
  429:    [10, 12], // BOWL-429        — near-432 clarity
  528:    [11, 13], // BOWL/TF 528     — love freq, complex lace
  639:    [12, 13], // Solfeggio 639
  741:    [13, 14], // Solfeggio 741
  771:    [13, 15], // BELL-771        — Tibetan bell, finest lace
  852:    [14, 15], // Solfeggio 852
};

// Round to 2 decimal places for lookup
function roundHz(f: number): number {
  return Math.round(f * 100) / 100;
}

function freqToNM(freq: number): { n: number; m: number } {
  const key = roundHz(freq);
  const entry = FREQ_TABLE[key];
  if (entry) return { n: entry[0], m: entry[1] };

  // Fallback formula for frequencies not in the table
  // Use a log-spread that produces well-separated integer pairs
  const log = Math.log2(Math.max(freq, 20) / 40); // 40 Hz baseline
  const base = Math.max(2, Math.round(log * 3));
  const offset = Math.round((freq / 137) % 5); // 137 = prime, good spread
  const n = base + offset;
  const m = n + 1 + (Math.round(freq / 89) % 3); // always m > n
  return { n: Math.max(2, n), m: Math.max(3, m) };
}

// ─── Offscreen layer renderer ─────────────────────────────────────────────────
//
// Renders a single (n, m) Chladni pattern to an offscreen canvas.
// putImageData bypasses globalCompositeOperation entirely (browser spec),
// so we write to offscreen first, then use drawImage to composite.

function renderFrequencyLayer(
  freq: number,
  color: string,
  size: number,
  alpha: number,
  threshold = 0.10  // sharper nodal lines — 0.10 instead of 0.12
): HTMLCanvasElement {
  const offscreen = document.createElement("canvas");
  offscreen.width = size;
  offscreen.height = size;
  const ctx = offscreen.getContext("2d")!;

  const { n, m } = freqToNM(freq);
  const L = Math.PI;

  // Parse hex color → RGB
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px / size) * L;
      const y = (py / size) * L;
      // Classical square plate equation
      const val =
        Math.cos(n * x) * Math.cos(m * y) -
        Math.cos(m * x) * Math.cos(n * y);
      const abs = Math.abs(val);

      if (abs < threshold) {
        const intensity = 1 - abs / threshold;
        const bright = intensity * intensity * intensity; // cubic for very sharp lines
        const i = (py * size + px) * 4;
        data[i]     = Math.round(r * bright * alpha);
        data[i + 1] = Math.round(g * bright * alpha);
        data[i + 2] = Math.round(b * bright * alpha);
        data[i + 3] = Math.round(230 * bright * alpha);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return offscreen;
}

// ─── drawChladni ─────────────────────────────────────────────────────────────

function drawChladni(
  canvas: HTMLCanvasElement,
  frequencies: number[],
  color: string
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;

  ctx.fillStyle = "#050a14";
  ctx.fillRect(0, 0, size, size);

  if (frequencies.length === 0) return;

  frequencies.forEach((freq, idx) => {
    const alpha = idx === 0 ? 1 : 0.65;
    const layer = renderFrequencyLayer(freq, color, size, alpha);

    // Main pattern — source-over for first, screen for subsequent
    ctx.save();
    ctx.globalCompositeOperation = idx === 0 ? "source-over" : "screen";
    ctx.drawImage(layer, 0, 0);
    ctx.restore();

    // Glow pass — draws the same layer blurred + screened
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.22 * alpha;
    ctx.filter = "blur(6px)";
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  });
}

// ─── ChladniCanvas (single instrument) ───────────────────────────────────────

export default function ChladniCanvas({
  frequency,
  color = "#2BC9B8",
  size = 300,
  frequencies,
}: ChladniCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const allFreqs =
    frequencies && frequencies.length > 0 ? frequencies : [frequency];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size;
    canvas.height = size;
    drawChladni(canvas, allFreqs, color);
  }, [allFreqs.join(","), color, size]);

  return (
    <canvas
      ref={canvasRef}
      className="chladni-canvas w-full"
      style={{ maxWidth: size, display: "block", margin: "0 auto" }}
    />
  );
}

// ─── MultiChladniCanvas (composer) ───────────────────────────────────────────

export function MultiChladniCanvas({
  tracks,
  size = 380,
}: {
  tracks: { frequency: number; color: string; volume: number }[];
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || tracks.length === 0) return;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#050a14";
    ctx.fillRect(0, 0, size, size);

    tracks.forEach((track, idx) => {
      const layer = renderFrequencyLayer(
        track.frequency,
        track.color,
        size,
        Math.max(0.1, track.volume),
        0.10
      );

      ctx.save();
      ctx.globalCompositeOperation = idx === 0 ? "source-over" : "screen";
      ctx.drawImage(layer, 0, 0);
      ctx.restore();

      // Glow
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.18 * track.volume;
      ctx.filter = "blur(6px)";
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    });
  }, [JSON.stringify(tracks), size]);

  return (
    <canvas
      ref={canvasRef}
      className="chladni-canvas w-full"
      style={{ maxWidth: size, display: "block", margin: "0 auto" }}
    />
  );
}
