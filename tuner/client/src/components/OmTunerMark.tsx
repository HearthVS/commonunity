// The OM Tuner mark, "The Octave": the Lissajous figure two tones draw when
// one is exactly an octave (1:2) above the other. Two loops, one line.
// x = sin(t), y = sin(2t + 0.42), on a 200×200 box.

function octavePath(): string {
  const steps = 200;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = 100 + 78 * Math.sin(t);
    const y = 100 + 62 * Math.sin(2 * t + 0.42);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d + "Z";
}

export const OCTAVE_PATH = octavePath();

interface OmTunerMarkProps {
  size?: number;
  /** Stroke in the mark's 200-unit box; heavier reads better at small sizes. */
  strokeWidth?: number;
  className?: string;
  title?: string;
}

export default function OmTunerMark({ size = 32, strokeWidth = 14, className, title }: OmTunerMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
    >
      <path d={OCTAVE_PATH} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mark plus the lowercase wordmark, as in the brand proposal. */
export function OmTunerLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <OmTunerMark size={size} className="text-primary" />
      <span className="font-display font-semibold tracking-tight text-foreground" style={{ fontSize: size * 0.72 }}>
        om tuner
      </span>
    </span>
  );
}
