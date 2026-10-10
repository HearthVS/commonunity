import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "./db";
// The lib path avoids pdf-parse's index.js, which runs a self-test when bundled.
// @ts-expect-error pdf-parse ships no type declarations
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// ── Practitioner library ─────────────────────────────────────────────────────
// Books and notes the practitioner adds for reference. Files live on the
// private Railway volume next to the database (never in the public repo);
// their text is indexed page by page in an SQLite FTS5 table so both the
// Library page and Nexus can find the passages that matter.
// Every /api/library route sits behind the practitioner login (see auth.ts).

const DB_FILE = process.env.DATABASE_URL || path.join(process.cwd(), "data.db");
const LIBRARY_DIR = process.env.LIBRARY_DIR || path.join(path.dirname(DB_FILE), "library");
const MAX_UPLOAD = "60mb";
const NOTE_CHUNK = 2500; // characters per "page" for plain-text resources

const STOPWORDS = new Set(
  ("the and for are but not you all any can had her was one our out has his how its may new now old see two who boy did " +
   "get let put say she too use what when where which while with this that these those from into about would could should " +
   "there their them they then than also just very much more most some such only over your yours have been were will shall " +
   "does done being because between after before under again further once here why each few both other same so nor own " +
   "please tell explain give show know like want need make " +
   "of to in is it on at an as be by or we he me my no so up us do if go am")
    .split(" "),
);

type Page = { page: number; text: string };

function cleanText(t: string): string {
  return t.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function pdfPages(buf: Buffer): Promise<{ pages: Page[]; pageCount: number }> {
  const pages: Page[] = [];
  const result = await pdfParse(buf, {
    pagerender: async (pageData: any) => {
      const content = await pageData.getTextContent({ normalizeWhitespace: true });
      let lastY: number | undefined;
      let text = "";
      for (const item of content.items) {
        if (lastY !== undefined && lastY !== item.transform[5]) text += "\n";
        text += item.str;
        lastY = item.transform[5];
      }
      pages.push({ page: pageData.pageIndex + 1, text: cleanText(text) });
      return text;
    },
  });
  pages.sort((a, b) => a.page - b.page);
  return { pages, pageCount: result.numpages };
}

function textPages(text: string): Page[] {
  const paras = cleanText(text).split(/\n\s*\n/);
  const pages: Page[] = [];
  let current = "";
  for (const p of paras) {
    if (current && current.length + p.length > NOTE_CHUNK) {
      pages.push({ page: pages.length + 1, text: current });
      current = "";
    }
    current += (current ? "\n\n" : "") + p;
  }
  if (current) pages.push({ page: pages.length + 1, text: current });
  return pages;
}

// Letters and digits in any script (built at runtime: the tsc target predates the u flag).
const WORD_RE = new RegExp("[\\p{L}\\p{N}]+", "gu");

// Meaningful words from free text, quoted for FTS5.
function queryTerms(q: string): string[] {
  const words = (q.toLowerCase().match(WORD_RE) ?? [])
    .filter((w) => (w.length >= 2 || /^\d+$/.test(w)) && !STOPWORDS.has(w));
  return Array.from(new Set(words)).slice(0, 16).map((w) => `"${w}"`);
}

export type LibraryHit = {
  resourceId: number;
  title: string;
  author: string | null;
  page: number;
  snippet: string;
  content?: string;
};

function runSearch(match: string, limit: number, withContent: boolean): LibraryHit[] {
  return db.all(sql`
    SELECT library_pages.resource_id AS resourceId, library_pages.page AS page,
           snippet(library_pages, 0, char(1), char(2), ' … ', 28) AS snippet,
           ${withContent ? sql`library_pages.content` : sql`NULL`} AS content,
           r.title AS title, r.author AS author
    FROM library_pages
    JOIN library_resources r ON r.id = library_pages.resource_id
    WHERE library_pages MATCH ${match}
    ORDER BY bm25(library_pages)
    LIMIT ${limit}`) as LibraryHit[];
}

// Ranking tiers: the exact phrase first, then pages containing every search
// word, then pages with only some of them.
export function searchLibrary(q: string, limit = 20, withContent = false): LibraryHit[] {
  const terms = queryTerms(q);
  if (terms.length === 0) return [];
  const words = (q.toLowerCase().match(WORD_RE) ?? []).slice(0, 16);
  const tiers = [
    words.length >= 2 ? `"${words.join(" ")}"` : null,
    terms.length >= 2 ? terms.join(" AND ") : null,
    terms.join(" OR "),
  ].filter((t): t is string => t !== null);
  const results: LibraryHit[] = [];
  const seen = new Set<string>();
  try {
    for (const match of tiers) {
      for (const hit of runSearch(match, limit, withContent)) {
        const key = `${hit.resourceId}:${hit.page}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(hit);
        if (results.length >= limit) return results;
      }
    }
    return results;
  } catch (err) {
    console.warn("[library] search failed:", err);
    return results;
  }
}

export function registerLibrary(app: Express) {
  fs.mkdirSync(LIBRARY_DIR, { recursive: true });

  app.get("/api/library", (_req, res) => {
    const rows = db.all(sql`
      SELECT id, title, author, tags, notes, filename, mime, size, page_count AS pageCount,
             text_pages AS textPages, created_at AS createdAt
      FROM library_resources ORDER BY created_at DESC`);
    res.json(rows);
  });

  app.get("/api/library/search", (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    res.json(searchLibrary(q, 30));
  });

  // Upload: the file is the raw request body; details come in the query string.
  app.post(
    "/api/library",
    express.raw({ type: () => true, limit: MAX_UPLOAD }),
    async (req, res) => {
      const body = req.body as Buffer;
      const title = String(req.query.title ?? "").trim();
      const filename = String(req.query.filename ?? "").trim();
      const mime = String(req.headers["content-type"] ?? "").split(";")[0].trim();
      if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: "The file is empty." });
      if (!title) return res.status(400).json({ error: "A title is required." });

      const isPdf = mime === "application/pdf" || body.subarray(0, 5).toString() === "%PDF-";
      const isText = /^text\//.test(mime) || /\.(txt|md|markdown)$/i.test(filename);
      if (!isPdf && !isText) return res.status(400).json({ error: "Only PDF, .txt and .md files can be added for now." });

      let pages: Page[];
      let pageCount: number;
      try {
        if (isPdf) {
          ({ pages, pageCount } = await pdfPages(body));
        } else {
          pages = textPages(body.toString("utf-8"));
          pageCount = pages.length;
        }
      } catch (err) {
        console.warn("[library] could not read file:", err);
        return res.status(400).json({ error: "That file couldn't be read. Is it a valid PDF?" });
      }
      const withText = pages.filter((p) => p.text.length >= 40);

      const now = new Date().toISOString();
      const ext = isPdf ? "pdf" : "txt";
      const inserted = db.get(sql`
        INSERT INTO library_resources (title, author, tags, notes, filename, mime, size, page_count, text_pages, created_at)
        VALUES (${title}, ${String(req.query.author ?? "").trim() || null}, ${String(req.query.tags ?? "").trim() || null},
                ${String(req.query.notes ?? "").trim() || null}, ${filename || `resource.${ext}`},
                ${isPdf ? "application/pdf" : "text/plain"}, ${body.length}, ${pageCount}, ${withText.length}, ${now})
        RETURNING id`) as { id: number };
      const id = inserted.id;
      try {
        fs.writeFileSync(path.join(LIBRARY_DIR, `${id}.${ext}`), body);
        for (const p of withText) {
          db.run(sql`INSERT INTO library_pages (content, resource_id, page) VALUES (${p.text}, ${id}, ${p.page})`);
        }
      } catch (err) {
        db.run(sql`DELETE FROM library_pages WHERE resource_id = ${id}`);
        db.run(sql`DELETE FROM library_resources WHERE id = ${id}`);
        console.warn("[library] could not store file:", err);
        return res.status(500).json({ error: "The file couldn't be saved. Please try again." });
      }
      res.json({ id, title, pageCount, textPages: withText.length });
    },
  );

  // Opens the stored file; the browser's viewer handles #page=N.
  app.get("/api/library/:id/file", (req, res) => {
    const id = Number(req.params.id);
    const row = db.get(sql`SELECT filename, mime FROM library_resources WHERE id = ${id}`) as
      | { filename: string; mime: string }
      | undefined;
    if (!row) return res.status(404).json({ error: "Not found" });
    const file = path.join(LIBRARY_DIR, `${id}.${row.mime === "application/pdf" ? "pdf" : "txt"}`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: "File missing" });
    res.setHeader("Content-Type", row.mime === "application/pdf" ? "application/pdf" : "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="${row.filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "")}"`);
    res.setHeader("Cache-Control", "private, no-store");
    fs.createReadStream(file).pipe(res);
  });

  app.delete("/api/library/:id", (req, res) => {
    const id = Number(req.params.id);
    const row = db.get(sql`SELECT mime FROM library_resources WHERE id = ${id}`) as { mime: string } | undefined;
    if (!row) return res.status(404).json({ error: "Not found" });
    db.run(sql`DELETE FROM library_pages WHERE resource_id = ${id}`);
    db.run(sql`DELETE FROM library_resources WHERE id = ${id}`);
    try {
      fs.unlinkSync(path.join(LIBRARY_DIR, `${id}.${row.mime === "application/pdf" ? "pdf" : "txt"}`));
    } catch { /* already gone */ }
    res.json({ ok: true });
  });
}
