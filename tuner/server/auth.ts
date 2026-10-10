import type { Express, Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

// ── Practitioner access ───────────────────────────────────────────────────────
// Tuner holds client health data, so everything under /api is practitioner-only
// except the public intake submission and the auth endpoints themselves.
// One shared practitioner password (TUNER_PRACTITIONER_PASSWORD) unlocks a
// signed, HttpOnly session cookie. Changing the password signs everyone out.

const PASSWORD = process.env.TUNER_PRACTITIONER_PASSWORD ?? "";
const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE = "tuner_session";
const SESSION_DAYS = 30;

// Local development without a password stays open; production fails closed.
const AUTH_DISABLED = !PASSWORD && !IS_PROD;

const PUBLIC_API = new Set([
  "POST /api/questionnaires",
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "GET /api/auth/me",
]);

function sign(value: string): string {
  return crypto.createHmac("sha256", `tuner-session:${PASSWORD}`).update(value).digest("base64url");
}

function makeToken(): string {
  const expires = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  return `${expires}.${sign(expires)}`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function isPractitioner(req: Request): boolean {
  if (AUTH_DISABLED) return true;
  if (!PASSWORD) return false;
  const token = readCookie(req, COOKIE);
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || !safeEqual(sig, sign(expires))) return false;
  return Number(expires) > Date.now();
}

function setSessionCookie(res: Response, token: string, maxAgeSeconds: number) {
  const parts = [
    `${COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (IS_PROD) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

// Small in-memory fixed-window limiter, keyed by client IP. Good enough for a
// single Railway instance; resets on restart.
export function rateLimit(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 5000) {
        hits.forEach((v, k) => { if (v.resetAt <= now) hits.delete(k); });
      }
      return next();
    }
    entry.count++;
    if (entry.count > limit) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: "Too many attempts. Please wait and try again." });
    }
    next();
  };
}

export function registerAuth(app: Express) {
  // Railway terminates TLS one proxy hop in front of us; trust it so req.ip is
  // the real client address for rate limiting.
  app.set("trust proxy", 1);

  if (!PASSWORD && IS_PROD) {
    console.error("[auth] TUNER_PRACTITIONER_PASSWORD is not set — practitioner API is locked for everyone.");
  }

  app.use("/api", (req, res, next) => {
    if (PUBLIC_API.has(`${req.method} ${req.baseUrl}${req.path}`)) return next();
    if (isPractitioner(req)) return next();
    res.status(401).json({ error: "Practitioner login required" });
  });

  app.get("/api/auth/me", (req, res) => {
    res.json({ authenticated: isPractitioner(req), configured: Boolean(PASSWORD) || AUTH_DISABLED });
  });

  app.post("/api/auth/login", rateLimit(10, 15 * 60 * 1000), (req, res) => {
    if (AUTH_DISABLED) return res.json({ authenticated: true });
    if (!PASSWORD) return res.status(503).json({ error: "Practitioner login is not configured on the server." });
    const given = typeof req.body?.password === "string" ? req.body.password : "";
    const a = crypto.createHash("sha256").update(given).digest();
    const b = crypto.createHash("sha256").update(PASSWORD).digest();
    if (!crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "That password isn't right." });
    }
    setSessionCookie(res, makeToken(), SESSION_DAYS * 24 * 60 * 60);
    res.json({ authenticated: true });
  });

  app.post("/api/auth/logout", (_req, res) => {
    setSessionCookie(res, "", 0);
    res.json({ authenticated: false });
  });
}
