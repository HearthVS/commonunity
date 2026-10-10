import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Parse JSON array field safely
export function parseArr(json: string | null | undefined): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

// Parse JSON object safely
export function parseObj(json: string | null | undefined): Record<string, any> {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

// Chakra color map
export const CHAKRA_COLORS: Record<string, string> = {
  "CH-ROOT": "#CC0000",
  "CH-SACRAL": "#FF8C00",
  "CH-SOLAR": "#FFD700",
  "CH-HEART": "#228B22",
  "CH-THROAT": "#1E90FF",
  "CH-THIRD-EYE": "#4B0082",
  "CH-CROWN": "#9400D3",
};

// Instrument type badge colors
export const TYPE_COLORS: Record<string, string> = {
  fork: "#2BC9B8",
  bowl: "hsl(160,84%,39%)",
  bell: "hsl(38,92%,50%)",
};

export const TYPE_BG: Record<string, string> = {
  fork: "rgba(43,201,184,0.15)",
  bowl: "rgba(16,185,129,0.15)",
  bell: "rgba(245,158,11,0.15)",
};

export function formatHz(hz: number): string {
  return hz % 1 === 0 ? `${hz} Hz` : `${hz.toFixed(2)} Hz`;
}

// Google Drive asset URL builder
const DRIVE_ROOT = "https://drive.google.com/uc?export=view&id=";

// Map filenames to direct Drive file IDs (populated when available)
// For now we use a placeholder image based on instrument type
export function getInstrumentImageUrl(filename: string | null | undefined): string {
  if (!filename) return "";
  // Try to serve from /assets/ if locally bundled
  return `/assets/${filename}`;
}

export function getInstrumentAudioUrl(filename: string | null | undefined): string {
  if (!filename) return "";
  return `/assets/${filename}`;
}

// Chladni pattern color per chakra
export function chladniColor(chakraId: string | null | undefined): string {
  return CHAKRA_COLORS[chakraId || ""] || "#2BC9B8";
}

// Comfort tier labels
export const COMFORT_TIERS = [
  { tier: 1, label: "Tier 1 — Receptive", desc: "Sound only, no body contact, no vocal engagement" },
  { tier: 2, label: "Tier 2 — Embodied", desc: "Sound + mudra description and guidance" },
  { tier: 3, label: "Tier 3 — Active Breath", desc: "Sound + mudra + pranayama" },
  { tier: 4, label: "Tier 4 — Vocal", desc: "Sound + mudra + breath + bija mantras" },
  { tier: 5, label: "Tier 5 — Full Immersion", desc: "Sound + mudra + breath + mantra + visualization + affirmation" },
];

// Dosha display names
export const DOSHA_LABELS: Record<string, string> = {
  vata: "Vāta (Air + Space)",
  pitta: "Pitta (Fire + Water)",
  kapha: "Kapha (Earth + Water)",
  balanced: "Sattva (Balanced)",
};

// Center display names
export const CENTER_LABELS: Record<string, string> = {
  physical: "Physical / Moving Center",
  emotional: "Emotional Center",
  intellectual: "Intellectual Center",
};
