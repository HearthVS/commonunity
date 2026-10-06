import type { Express } from "express";
import { calculateRadiance, synthesizeRadianceProfile } from "../shared/genekeys";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isPractitioner, rateLimit } from "./auth";
import { getTableColumns } from "drizzle-orm";
import { questionnaireResponses } from "../shared/schema";
import { seedDatabase } from "./seed";
import nodemailer from "nodemailer";
import Anthropic from "@anthropic-ai/sdk";

// ── Types for the inventory audit endpoint ───────────────────────────────
interface AcquisitionSuggestion {
  id: string;
  name: string;
  type: "fork" | "bowl" | "bell";
  weighting: string;
  frequency: number;
  lineage: string;
  chakraAffinity: string;
  category: string;
  priority: number;
  rationale: string;
  buyingGuide: string;
  searchTerms: string[];
  coversGap: string[];
  urgency: "high" | "medium" | "low";
  covered?: boolean;
}

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? "markus@jointidea.com";
const SMTP_HOST = process.env.SMTP_HOST ?? "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "587");
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";

async function sendIntakeNotification(q: any) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return; // skip if not configured
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    const flags = (() => { try { return JSON.parse(q.contraindicationFlags ?? "[]"); } catch { return []; } })();
    const flagLine = flags.length > 0 ? `⚠️ Flags: ${flags.join(", ")}` : "✅ No contraindication flags";
    await transporter.sendMail({
      from: `"CommonUnity Tuner" <${SMTP_USER}>`,
      to: NOTIFY_EMAIL,
      subject: `New intake: ${q.clientName ?? "Client"} — ${q.recommendedProtocolId ?? "protocol pending"}`,
      text: [
        `New remote intake received.`,
        ``,
        `Name: ${q.clientName ?? "—"}`,
        `Date: ${q.sessionDate ?? "—"}`,
        `Dominant quality: ${q.dominantDosha ?? "—"}`,
        `Dominant center: ${q.dominantCenter ?? "—"}`,
        `Recommended protocol: ${q.recommendedProtocolId ?? "—"}`,
        `Comfort tier: ${q.recommendedComfortTier ?? "—"}`,
        flagLine,
        ``,
        `Intention: ${q.intentionText ?? "not provided"}`,
        ``,
        `View in Tuner: https://ideal-trust-production-7782.up.railway.app/#/clients`,
      ].join("\n"),
    });
  } catch (err) {
    console.warn("Email notification failed:", err);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed on startup
  try { seedDatabase(); } catch (e) { console.warn("Seed error:", e); }

  // ─── INSTRUMENTS ────────────────────────────────────────────────────────────
  app.get("/api/instruments", (_req, res) => {
    res.json(storage.getAllInstruments());
  });
  app.get("/api/instruments/:id", (req, res) => {
    const item = storage.getInstrumentById(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  });

  // ─── CHAKRAS ─────────────────────────────────────────────────────────────────
  app.get("/api/chakras", (_req, res) => {
    res.json(storage.getAllChakras());
  });
  app.get("/api/chakras/:id", (req, res) => {
    const item = storage.getChakraById(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  });

  // ─── BIOFIELD ZONES ──────────────────────────────────────────────────────────
  app.get("/api/biofield-zones", (_req, res) => {
    res.json(storage.getAllBiofieldZones());
  });

  // ─── AYURVEDA / ELEMENTS ─────────────────────────────────────────────────────
  app.get("/api/ayurveda", (_req, res) => {
    res.json(storage.getAllAyurvedaElements());
  });
  app.get("/api/ayurveda/type/:type", (req, res) => {
    res.json(storage.getAyurvedaElementsByType(req.params.type));
  });

  // ─── CENTERS ─────────────────────────────────────────────────────────────────
  app.get("/api/centers", (_req, res) => {
    res.json(storage.getAllCenters());
  });

  // ─── KOSHAS ─────────────────────────────────────────────────────────────────
  app.get("/api/koshas", (_req, res) => {
    res.json(storage.getAllKoshas());
  });
  app.get("/api/koshas/:id", (req, res) => {
    const item = storage.getKoshaById(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  });

  // ─── PROTOCOLS ───────────────────────────────────────────────────────────────
  app.get("/api/protocols", (_req, res) => {
    res.json(storage.getAllProtocols());
  });
  app.get("/api/protocols/:id", (req, res) => {
    const item = storage.getProtocolById(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  });

  // ─── CLIENTS ─────────────────────────────────────────────────────────────────
  app.get("/api/clients", (_req, res) => {
    res.json(storage.getAllClients());
  });
  app.post("/api/clients", (req, res) => {
    const data = { ...req.body, createdAt: new Date().toISOString() };
    res.json(storage.createClient(data));
  });
  app.patch("/api/clients/:id", (req, res) => {
    const updated = storage.updateClient(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });
  app.get("/api/clients/:id", (req, res) => {
    const client = storage.getClientById(Number(req.params.id));
    if (!client) return res.status(404).json({ error: "Not found" });
    res.json(client);
  });

  // ─── GENE KEYS RADIANCE ───────────────────────────────────────────────────────
  // Pure computation — no DB write. POST { birthDate, birthTime? }
  app.post("/api/radiance", (req, res) => {
    const { birthDate, birthTime } = req.body;
    if (!birthDate) return res.status(400).json({ error: "birthDate required (YYYY-MM-DD)" });
    try {
      const activation = calculateRadiance(birthDate, birthTime);
      const profile = synthesizeRadianceProfile(activation);
      res.json(profile);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── QUESTIONNAIRE ────────────────────────────────────────────────────────────
  app.get("/api/questionnaires", (_req, res) => {
    res.json(storage.getAllQuestionnaires());
  });

  app.delete("/api/questionnaires/:id", (req, res) => {
    storage.deleteQuestionnaire(Number(req.params.id));
    res.json({ ok: true });
  });

  // PATCH /api/questionnaires/:id — partial update (birth data editing from RadianceCard)
  app.patch("/api/questionnaires/:id", (req, res) => {
    const updated = storage.updateQuestionnaire(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.get("/api/questionnaires/:id", (req, res) => {
    const item = storage.getQuestionnaireById(Number(req.params.id));
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  });

  // Fields a public (not logged-in) intake may set. Ids and computed outputs
  // are never accepted from the public form.
  const PUBLIC_INTAKE_FIELDS = new Set(
    Object.keys(getTableColumns(questionnaireResponses)).filter((k) => ![
      "id", "clientId", "contraindicationFlags", "dominantDosha", "dominantCenter",
      "suggestedChakraFocus", "recommendedComfortTier", "recommendedProtocolId",
    ].includes(k)),
  );
  const intakeLimiter = rateLimit(8, 60 * 60 * 1000);

  app.post("/api/questionnaires", (req, res, next) => {
    if (isPractitioner(req)) return next();
    intakeLimiter(req, res, next);
  }, (req, res) => {
    const practitioner = isPractitioner(req);
    let raw = req.body ?? {};
    if (!practitioner) {
      // Honeypot: a hidden "website" field real people never fill in.
      if (raw.website) return res.json({ ok: true });
      raw = Object.fromEntries(
        Object.entries(raw).filter(([k]) => PUBLIC_INTAKE_FIELDS.has(k) || k === "_source"),
      );
      if (typeof raw.clientName !== "string" || !raw.clientName.trim()) {
        return res.status(400).json({ error: "Name is required" });
      }
      if (!raw.consentGiven) {
        return res.status(400).json({ error: "Consent is required" });
      }
      if (typeof raw.sessionDate !== "string" || !raw.sessionDate) {
        raw.sessionDate = new Date().toISOString().slice(0, 10);
      }
    }
    // Compute auto-outputs
    const flags: string[] = [];
    if (raw.hasPacemaker) flags.push("pacemaker-caution");
    if (raw.recentSurgery) flags.push("recent-surgery-caution");
    if (raw.hasEpilepsy) flags.push("epilepsy-seizure-caution");
    if (raw.soundSensitivity) flags.push("sound-sensitivity-caution", "tinnitus-caution");
    if (raw.acuteCrisis) flags.push("acute-trauma-caution", "severe-mental-health-caution");
    if (raw.pregnancyStatus === "yes") flags.push("pregnancy-caution");

    // Dosha tally — balanced is now a first-class outcome
    const doshaCounts: Record<string, number> = { vata: 0, pitta: 0, kapha: 0, balanced: 0 };
    const doshaFields = ["doshaBody","doshaMind","doshaSleep","doshaAppetite","doshaEnergy","doshaEmotions"];
    for (const f of doshaFields) {
      const v = raw[f];
      if (v === "vata-like") doshaCounts.vata++;
      else if (v === "pitta-like") doshaCounts.pitta++;
      else if (v === "kapha-like") doshaCounts.kapha++;
      else if (v === "balanced") doshaCounts.balanced++;
    }
    // Dominant: whichever category scored highest.
    // Tie between balanced and a dosha -> balanced wins (sattvic state takes priority).
    const sorted = Object.entries(doshaCounts).sort((a, b) => b[1] - a[1]);
    const topScore = sorted[0][1];
    // If balanced is tied for top, prefer it
    const dominantDosha = doshaCounts.balanced === topScore ? "balanced" : sorted[0][0];

    // Center tally
    const centerCounts: Record<string, number> = { physical: 0, emotional: 0, intellectual: 0 };
    const centerFields = ["centerDecisions","centerStress","centerLearning","centerTrust","centerNeglected","centerSelf"];
    for (const f of centerFields) {
      const v = raw[f];
      if (v === "physical") centerCounts.physical++;
      else if (v === "emotional") centerCounts.emotional++;
      else if (v === "intellectual") centerCounts.intellectual++;
    }
    const dominantCenter = Object.entries(centerCounts).sort((a,b) => b[1]-a[1])[0][0];

    // Comfort tier
    let comfortTier = 3;
    const hasAllContraindications = flags.some(f => ["pacemaker-caution","epilepsy-seizure-caution","severe-mental-health-caution"].includes(f));
    if (hasAllContraindications) comfortTier = 1;
    else if (raw.bodyContact === "field-only") comfortTier = 1;
    else if (raw.bodyContact === "limited") comfortTier = 2;
    else if (raw.vocalization === "yes" && raw.chakraFamiliarity === "experienced") comfortTier = 5;
    else if (raw.vocalization === "yes") comfortTier = 4;

    // Chakra focus from dosha — balanced state centres on the heart
    const doshaChakraMap: Record<string, string> = {
      vata: "CH-ROOT", pitta: "CH-SOLAR", kapha: "CH-SACRAL", balanced: "CH-HEART",
    };
    const suggestedChakraFocus = doshaChakraMap[dominantDosha] || "CH-HEART";

    // Protocol recommendation — balanced routes to integration/maintenance
    const protocolMap: Record<string, string> = {
      vata: "PROTO-VATA", pitta: "PROTO-PITTA", kapha: "PROTO-KAPHA",
      balanced: "PROTO-FULL-ASCENDING",
    };
    const focusProtocol = protocolMap[dominantDosha] || "PROTO-GROUNDING";

    const data = {
      ...raw,
      contraindicationFlags: JSON.stringify(flags),
      dominantDosha,
      dominantCenter,
      suggestedChakraFocus,
      recommendedComfortTier: comfortTier,
      recommendedProtocolId: focusProtocol,
    };

    const saved = storage.createQuestionnaire(data);
    // Fire-and-forget email for remote intake submissions
    if (raw._source === "intake") {
      sendIntakeNotification(saved);
    }
    // The public form only needs to know it worked; never echo stored records to it.
    res.json(practitioner ? saved : { ok: true });
  });

  // ─── SESSION LOGS ─────────────────────────────────────────────────────────────
  app.get("/api/sessions", (_req, res) => {
    res.json(storage.getAllSessions());
  });
  app.get("/api/sessions/:id", (req, res) => {
    const item = storage.getSessionById(Number(req.params.id));
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  });
  app.post("/api/sessions", (req, res) => {
    const data = { ...req.body, createdAt: new Date().toISOString() };
    res.json(storage.createSession(data));
  });
  app.patch("/api/sessions/:id", (req, res) => {
    const item = storage.updateSession(Number(req.params.id), req.body);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  });
  app.delete("/api/sessions/:id", (req, res) => {
    storage.deleteSession(Number(req.params.id));
    res.json({ ok: true });
  });

  // ─── SOUNDSCAPES ──────────────────────────────────────────────────────────────
  app.get("/api/soundscapes", (_req, res) => {
    res.json(storage.getAllSoundscapes());
  });
  app.get("/api/soundscapes/:id", (req, res) => {
    const item = storage.getSoundscapeById(Number(req.params.id));
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  });
  app.post("/api/soundscapes", (req, res) => {
    const data = { ...req.body, createdAt: new Date().toISOString() };
    res.json(storage.createSoundscape(data));
  });
  app.patch("/api/soundscapes/:id", (req, res) => {
    const item = storage.updateSoundscape(Number(req.params.id), req.body);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  });
  app.delete("/api/soundscapes/:id", (req, res) => {
    storage.deleteSoundscape(Number(req.params.id));
    res.json({ ok: true });
  });

  // ─── INSTRUMENT AUDIT ──────────────────────────────────────────────────────
  // GET /api/inventory/audit
  // Returns: gap analysis against the ideal frequency set + prioritised
  // acquisition suggestions, optionally weighted by the client's radiance profile.
  app.get("/api/inventory/audit", (_req, res) => {
    const owned = new Set(storage.getAllInstruments().map((i) => i.id));

    // ── Ideal frequency set ─────────────────────────────────────────────────
    // Each entry describes a slot in the canonical set; `covered` is true
    // if an instrument with that ID already exists in the database.
    const IDEAL_SET: AcquisitionSuggestion[] = [
      // ── Solfeggio gaps ──────────────────────────────────────────────────
      {
        id: "TF-BT-SOL-285",
        name: "Solfeggio 285 Hz",
        type: "fork",
        weighting: "unweighted",
        frequency: 285,
        lineage: "Biofield Tuning – Solfeggio series",
        chakraAffinity: "CH-SACRAL",
        category: "solfeggio",
        priority: 1,
        rationale:
          "285 Hz is the second Solfeggio tone (Ut queant laxis). It sits between 174 and 396 Hz and is specifically associated with tissue repair, wound healing, and restoring fields that have been depleted rather than merely distorted. Without it the Solfeggio scanning sequence has a significant gap: 174 marks the distortion, 285 begins the repair, 396 fully releases the energetic charge. The jump from 174 directly to 417 skips the repair layer entirely.",
        buyingGuide:
          "Source from Biofield Tuning (www.biofieldtuning.com) — their Solfeggio unweighted fork set includes 285 Hz in the correct tuning. Specify \"unweighted\" (no weight on tines). Price: ~$35–45 USD per fork.",
        searchTerms: ["Solfeggio 285 Hz tuning fork", "Biofield Tuning 285"],
        coversGap: ["Solfeggio 285 Hz (tissue repair, field replenishment)"],
        urgency: "high",
      },
      {
        id: "TF-BT-SOL-396",
        name: "Solfeggio 396 Hz",
        type: "fork",
        weighting: "unweighted",
        frequency: 396,
        lineage: "Biofield Tuning – Solfeggio series",
        chakraAffinity: "CH-ROOT",
        category: "solfeggio",
        priority: 2,
        rationale:
          "396 Hz (Ut queant laxis / Liberating guilt and fear) is the Solfeggio tone most aligned with the root chakra in the Cousto system (Cousto root = 194.18 Hz, 396 Hz is its second octave equivalent at 99 Hz × 4). It is the primary tone for clearing fear-based root patterns — the survival field. Currently 396 Hz is assigned to the root chakra in the seed data but no fork exists in inventory to deliver it directly. This is a notable gap for root-chakra clearing work.",
        buyingGuide:
          "Biofield Tuning or any reputable Solfeggio fork supplier. Specify unweighted, 396 Hz exactly. ~$35–45 USD.",
        searchTerms: ["Solfeggio 396 Hz tuning fork", "396 Hz fear liberation fork"],
        coversGap: ["Solfeggio 396 Hz (root, fear clearing)"],
        urgency: "high",
      },
      {
        id: "TF-BT-SOL-639",
        name: "Solfeggio 639 Hz",
        type: "fork",
        weighting: "unweighted",
        frequency: 639,
        lineage: "Biofield Tuning – Solfeggio series",
        chakraAffinity: "CH-HEART",
        category: "solfeggio",
        priority: 3,
        rationale:
          "639 Hz (Fa — connecting, relationships) is the relational heart tone and the natural sequel to 528 Hz (repair/cohere) in the Solfeggio sequence: 528 coheres the personal heart field; 639 opens it outward into relational connection. In Biofield Tuning, the right side of the field (future-facing, relational) is particularly responsive to 639 Hz. Without it the upper Solfeggio arc (528 → 639 → 741 → 852 → 963) is entirely absent.",
        buyingGuide:
          "Biofield Tuning unweighted Solfeggio series, or SomaEnergetics (www.somaenergetics.com). Specify 639 Hz unweighted. ~$35–45 USD.",
        searchTerms: ["Solfeggio 639 Hz tuning fork", "639 Hz relationship heart fork"],
        coversGap: ["Solfeggio 639 Hz (relational heart, connection)"],
        urgency: "medium",
      },
      {
        id: "TF-BT-SOL-741",
        name: "Solfeggio 741 Hz",
        type: "fork",
        weighting: "unweighted",
        frequency: 741,
        lineage: "Biofield Tuning – Solfeggio series",
        chakraAffinity: "CH-THROAT",
        category: "solfeggio",
        priority: 4,
        rationale:
          "741 Hz (Sol — awakening intuition, expression) is the Solfeggio tone for the throat/upper field and particularly useful for clearing toxic patterns in the expression zone. Notably, BELL-771 is close (30 Hz higher) but has a very different delivery — transient, sharp attack — whereas a 741 Hz fork delivers a sustained, directable tone that can be held in the field during slow scanning work.",
        buyingGuide:
          "Biofield Tuning or SomaEnergetics. Specify unweighted, 741 Hz. ~$35–45 USD.",
        searchTerms: ["Solfeggio 741 Hz tuning fork", "741 Hz expression throat fork"],
        coversGap: ["Solfeggio 741 Hz (throat, expression, toxin clearing)"],
        urgency: "medium",
      },
      {
        id: "TF-BT-SOL-852",
        name: "Solfeggio 852 Hz",
        type: "fork",
        weighting: "unweighted",
        frequency: 852,
        lineage: "Biofield Tuning – Solfeggio series",
        chakraAffinity: "CH-THIRD-EYE",
        category: "solfeggio",
        priority: 5,
        rationale:
          "852 Hz (La — returning to spiritual order) is the third-eye Solfeggio tone. In the current kit, the third-eye zone is served by TF-PW-3RD (221.23 Hz) and TF-BT-222 (222 Hz) — both in the 221–222 Hz range. 852 Hz would add a much higher frequency option for this center, useful for clearing upper-field patterns (the back of the head, dream field, intuitive knowing zone) that do not respond to lower frequencies.",
        buyingGuide:
          "Biofield Tuning or SomaEnergetics. Specify unweighted, 852 Hz. ~$35–45 USD.",
        searchTerms: ["Solfeggio 852 Hz tuning fork", "852 Hz third eye intuition"],
        coversGap: ["Solfeggio 852 Hz (third eye, returning to order)"],
        urgency: "low",
      },
      {
        id: "TF-BT-SOL-963",
        name: "Solfeggio 963 Hz",
        type: "fork",
        weighting: "unweighted",
        frequency: 963,
        lineage: "Biofield Tuning – Solfeggio series",
        chakraAffinity: "CH-CROWN",
        category: "solfeggio",
        priority: 6,
        rationale:
          "963 Hz (Ti — divine consciousness, light) is the crown Solfeggio tone and the highest in the canonical 9-tone set. It pairs naturally with BELL-771 for crown/above work but unlike the bell delivers a sustained tone that can be used for held-field scanning in the Sun Star and transpersonal zones above the head. The crown in the current kit has TF-PW-CROWN (172.06 Hz) and BELL-771 (771 Hz); 963 Hz would complete the crown frequency range.",
        buyingGuide:
          "Biofield Tuning or SomaEnergetics. Specify unweighted, 963 Hz. ~$35–45 USD.",
        searchTerms: ["Solfeggio 963 Hz tuning fork", "963 Hz divine crown fork"],
        coversGap: ["Solfeggio 963 Hz (crown, divine consciousness)"],
        urgency: "low",
      },

      // ── Fibonacci series gaps ────────────────────────────────────────────
      {
        id: "TF-BT-FIB-55",
        name: "Fibonacci 55 Hz",
        type: "fork",
        weighting: "weighted",
        frequency: 55,
        lineage: "Biofield Tuning – Fibonacci series",
        chakraAffinity: "CH-ROOT",
        category: "fibonacci",
        priority: 8,
        rationale:
          "55 Hz is the Fibonacci number below 89 Hz. The current Fibonacci set starts at 89 — but 55 Hz occupies a deeply grounding sub-bass register that is particularly effective for the Earth Star zone (below the feet), ancestral field work, and clients with severe dissociation or ungrounding. Weighted, it delivers tactile vibration when placed on the sacrum or feet. In the Fibonacci sequence, 55 bridges the deeply somatic (34 Hz, 21 Hz) with the more conscious 89 Hz field work.",
        buyingGuide:
          "Biofield Tuning (www.biofieldtuning.com) sells Fibonacci weighted forks individually. Specify 55 Hz, weighted. ~$35–50 USD.",
        searchTerms: ["Fibonacci 55 Hz tuning fork", "Biofield Tuning 55 Hz weighted"],
        coversGap: ["Fibonacci 55 Hz (Earth Star, deep grounding, ancestral field)"],
        urgency: "medium",
      },
      {
        id: "TF-BT-FIB-233",
        name: "Fibonacci 233 Hz",
        type: "fork",
        weighting: "unweighted",
        frequency: 233,
        lineage: "Biofield Tuning – Fibonacci series",
        chakraAffinity: "CH-THROAT",
        category: "fibonacci",
        priority: 9,
        rationale:
          "233 Hz is the Fibonacci number above 144 Hz. It sits between 144 Hz and 377 Hz — occupying the throat-to-upper zone. While TF-BT-222 (BT 222 Hz) covers nearby territory, 233 Hz is the true Fibonacci step and maintains the mathematical ratio property (each pair of consecutive Fibonacci numbers approaches phi = 1.618). Unweighted for field work in the upper expression zone.",
        buyingGuide:
          "Biofield Tuning. Specify 233 Hz unweighted Fibonacci fork. ~$35–45 USD.",
        searchTerms: ["Fibonacci 233 Hz tuning fork", "233 Hz fork"],
        coversGap: ["Fibonacci 233 Hz (throat-upper field, phi-ratio sequence completion)"],
        urgency: "low",
      },
      // ── Bowl gaps ────────────────────────────────────────────────────────
      {
        id: "BOWL-CRYSTAL-432",
        name: "Crystal Bowl ~432 Hz (F#)",
        type: "bowl",
        weighting: "n/a",
        frequency: 432,
        lineage: "Crystal singing bowls",
        chakraAffinity: "CH-HEART",
        category: "bowl",
        priority: 10,
        rationale:
          "The entire bowl collection is Himalayan metal bowls. Crystal bowls produce a qualitatively different resonance: purer fundamental, fewer overtone harmonics, longer sustain, and a quality that many practitioners describe as more effective for the upper field (above the body) and transpersonal zones. A frosted or clear quartz bowl at ~432 Hz (F# in the 432 Hz tuning system, close to BOWL-429) would provide a sustained upper-heart / throat wash in a medium that current metal bowls cannot replicate. Crystal bowl energy is generally considered more expansive than grounding — appropriate for above-the-body, upper-chakra, and closing-phase work.",
        buyingGuide:
          "Crystal Tones (www.crystalsingingbowls.com) or Singing Bowls (www.singingbowls.com). A 10\"–12\" frosted quartz bowl in F# (432 Hz tuning). ~$120–250 USD depending on size and quality.",
        searchTerms: ["crystal singing bowl 432 Hz", "frosted quartz bowl F# heart"],
        coversGap: ["Crystal bowl (upper-field quality, sustained upper-heart wash)"],
        urgency: "low",
      },
      {
        id: "BOWL-196",
        name: "Singing Bowl ~196 Hz (Root / G)",
        type: "bowl",
        weighting: "n/a",
        frequency: 196,
        lineage: "Independent",
        chakraAffinity: "CH-ROOT",
        category: "bowl",
        priority: 11,
        rationale:
          "Every current bowl sits at 111 Hz or above (upper root / mid-field / upper field). There is no root-frequency bowl. A bowl at ~194–196 Hz (matching the Cousto root frequency / Western G3) would provide a room-filling grounding wash during root chakra sessions. This is particularly valuable for group work or deep somatic sessions where a single fork strike cannot sustain the grounding field for the duration of the work.",
        buyingGuide:
          "Hand-hammered Himalayan bowl suppliers: Tibet Shop, Dakini, or direct from Nepal importers. Request a bowl tuned to G3 / 196 Hz. ~$60–180 USD depending on size. Bring a 194.18 Hz fork to the shop to test resonance before buying.",
        searchTerms: ["singing bowl 196 Hz root chakra", "G3 Himalayan bowl root"],
        coversGap: ["Root-frequency bowl (~194–196 Hz, Cousto / Western G3)"],
        urgency: "medium",
      },
    ];

    // Mark which suggestions are already covered
    const suggestions = IDEAL_SET.map((s) => ({
      ...s,
      covered: owned.has(s.id),
    }));

    // Coverage stats
    const total = suggestions.length;
    const covered = suggestions.filter((s) => s.covered).length;
    const gaps = suggestions.filter((s) => !s.covered);

    // Categorised coverage
    const byCat: Record<string, { total: number; covered: number }> = {};
    for (const s of suggestions) {
      if (!byCat[s.category]) byCat[s.category] = { total: 0, covered: 0 };
      byCat[s.category].total++;
      if (s.covered) byCat[s.category].covered++;
    }

    res.json({
      ownedCount: owned.size,
      idealSetCount: total,
      coveredCount: covered,
      gapCount: gaps.length,
      coveragePercent: Math.round((covered / total) * 100),
      categoryCoverage: byCat,
      suggestions: suggestions.sort((a, b) => {
        if (a.covered !== b.covered) return a.covered ? 1 : -1; // uncovered first
        return a.priority - b.priority;
      }),
    });
  });

  // ─── HEALTH ───────────────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // ─── NEXUS AI ─────────────────────────────────────────────────────────────────
  // Nexus is the persistent AI presence across all CommonUnity apps.
  // In Tuner it operates as a sound healing practitioner's advisor,
  // contextually aware of what instrument/protocol/client is on screen.

  const NEXUS_SYSTEM = `You are the Nexus — the AI presence within CommonUnity Tuner, a professional sound healing toolkit.

You are not a generic assistant. You are a knowledgeable companion for the sound healing practitioner using this app. You hold deep familiarity with:
- The instruments in this practitioner's collection: tuning forks, singing bowls, bells, and their specific frequencies
- Eileen Day McKusick's Biofield Tuning methodology: left/right polarity, Ancestral Rivers, Earth Star, Sun Star, the toroidal biofield anatomy
- Hans Cousto's Cosmic Octave: planetary frequency derivations, the principle that all frequencies are octave-related to natural cycles
- Solfeggio frequencies and their therapeutic applications (174, 285, 396, 417, 528, 639, 741, 852, 963 Hz)
- Western tonal relationships and where they diverge from healing-system tunings
- Chladni patterns: how different frequencies create distinct geometric nodal figures in sand or water, and what this reveals about a frequency's character
- Chakra system correspondences, dosha relationships (Vata/Pitta/Kapha), and Gurdjieff centers (moving/emotional/intellectual)
- Session design: opening with OM at 136.10 Hz, sequencing instruments, grounding, clearing, heart-centering
- Practical contraindications: pacemakers, pregnancy, acute inflammation, post-surgery
- The OM practice: two heart-frequency forks at the sternum during co-chanting at 136.10 Hz is the ceremonial container
- The Instrument Gap Audit: the practitioner owns 26 instruments (25 original + unweighted OM 136.1 Hz confirmed owned), with identified gaps including Solfeggio 285, 396, 639, 741, 852, 963 Hz; Fibonacci 55 Hz and 233 Hz; a root-frequency bowl (~196 Hz); and a crystal bowl. When the practitioner is on the Gap Audit page, you can discuss any of these suggestions, explain priorities, or help them decide what to acquire next.

Your nature:
- Precise, not generic. Every response should feel specifically relevant to this practitioner and what they are working on.
- Warm but efficient. You are a professional tool, not a spiritual influencer. No performance of reverence.
- You ask one question at a time when you need more context. You do not ask multiple questions at once.
- Short responses by default: 2–4 sentences. Expand only when a genuine explanation is needed.
- You never use: journey, impact, passion, empower, transform, dynamic, leverage, holistic, authentic, innovative, synergy, thrive, unlock, game-changer.
- Plain text only. No markdown, no bullet lists, no headers in your replies.
- When frequency assignments differ between systems (Cousto vs Solfeggio vs Western tonal), you name the difference and its source rather than picking one.
- Every protocol has an off-body option. If someone cannot receive direct application, you know how to adapt.

Return plain text only. No markdown.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // GET /api/nexus/memory — fetch current persisted memory
  app.get("/api/nexus/memory", (_req, res) => {
    const mem = storage.getNexusMemory();
    res.json({ memory: mem?.memory ?? "", updatedAt: mem?.updatedAt ?? null });
  });

  // POST /api/nexus/memory — save updated compressed memory
  app.post("/api/nexus/memory", (req, res) => {
    const { memory } = req.body;
    if (typeof memory !== "string") return res.status(400).json({ error: "memory must be a string" });
    const saved = storage.upsertNexusMemory(memory);
    res.json(saved);
  });

  // POST /api/nexus/chat — SSE streaming conversation
  // Body: { message: string, history: {role:"user"|"nexus", text:string}[], pageContext: string, nexusMemory?: string }
  app.post("/api/nexus/chat", async (req, res) => {
    const { message, history = [], pageContext = "", nexusMemory: clientMemory } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message required" });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: "ANTHROPIC_API_KEY not configured" });
    }

    // Build system prompt with current memory + page context
    const memRecord = storage.getNexusMemory();
    const persistedMemory = clientMemory ?? memRecord?.memory ?? "";

    let systemWithContext = NEXUS_SYSTEM;
    if (persistedMemory) {
      systemWithContext += `\n\nWhat you know about this practitioner across sessions:\n${persistedMemory}`;
    }
    if (pageContext) {
      systemWithContext += `\n\nCurrent context (what the practitioner is looking at right now):\n${pageContext}`;
    }

    // Build message history (last 10 turns)
    const messages: { role: "user" | "assistant"; content: string }[] = [];
    for (const msg of (history as { role: string; text: string }[]).slice(-10)) {
      const role = msg.role === "nexus" ? "assistant" : "user";
      messages.push({ role, content: msg.text });
    }
    messages.push({ role: "user", content: message });

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-5",
        max_tokens: 300,
        system: systemWithContext,
        messages,
      });

      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          res.write(`data: ${JSON.stringify({ chunk: chunk.delta.text })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    } finally {
      res.end();
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
