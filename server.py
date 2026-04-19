"""
CommonUnity Layer 3 Generation Server
-------------------------------------
Loads commonunity-context.md at startup.
To update the context document: edit commonunity-context.md and POST /reload-context
No restart needed. No other files need changing.
"""

import os
import json
import pathlib
import io
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from anthropic import Anthropic

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Anthropic()

CONTEXT_PATH = pathlib.Path(__file__).parent / "commonunity-context.md"
BRAND_REF_PATH = pathlib.Path(__file__).parent / "brand-reference.txt"
context_document: str = ""
brand_reference: str = ""

def load_context():
    global context_document
    if CONTEXT_PATH.exists():
        context_document = CONTEXT_PATH.read_text(encoding="utf-8")
        print(f"Context document loaded: {len(context_document)} chars")
    else:
        print("WARNING: commonunity-context.md not found")
        context_document = ""

def load_brand_reference():
    global brand_reference
    if BRAND_REF_PATH.exists():
        brand_reference = BRAND_REF_PATH.read_text(encoding="utf-8")
        print(f"Brand reference loaded: {len(brand_reference)} chars")
    else:
        brand_reference = ""

load_context()
load_brand_reference()

# ── Data model ────────────────────────────────────────────────────────────────

class PointData(BaseModel):
    raw: str = ""
    theme: str = ""
    summary: str = ""
    insights: list = []
    gk_num: str = ""
    gk_line: str = ""
    observations: str = ""

class GenerateRequest(BaseModel):
    companion: str = ""
    guide: str = ""
    point: str          # "work" | "lens" | "field" | "call" | "all"
    work: Optional[PointData] = None
    lens: Optional[PointData] = None
    field: Optional[PointData] = None
    call: Optional[PointData] = None

# ── Helpers ───────────────────────────────────────────────────────────────────

POINT_META = {
    "work":  {"title": "The Work",  "law": "Law of Awareness",  "plane": "material"},
    "lens":  {"title": "The Lens",  "law": "Law of Clarity",    "plane": "material"},
    "field": {"title": "The Field", "law": "Law of Balance",    "plane": "ethereal"},
    "call":  {"title": "The Call",  "law": "Law of Creation",   "plane": "ethereal"},
}

GK_LINE_NAMES = {
    "work":  {1:"Creator", 2:"Dancer", 3:"Changer", 4:"Server", 5:"Fixer", 6:"Teacher"},
    "lens":  {1:"Solitude", 2:"Marriage", 3:"Interaction", 4:"Friendship", 5:"Impact", 6:"Nurture"},
    "field": {1:"Self & Empowerment", 2:"Passion & Relationships", 3:"Energy & Experience",
              4:"Love & Community", 5:"Power & Projection", 6:"Education & Surrender"},
    "call":  {1:"Physicality", 2:"Posture", 3:"Movement", 4:"Breath", 5:"Voice", 6:"Intent"},
}

FOLLOW_UP_QUESTIONS = {
    "work": [
        "What is the work that finds you, even when you are not looking for it?",
        "What would you still do if no one was watching and no one was paying?",
        "What do you see yourself doing when you watch yourself from a slight distance?",
    ],
    "lens": [
        "What has life been consistently trying to teach you, across different contexts?",
        "What lens do you see the world through that others around you don't yet have?",
        "What would you teach, if you trusted your learning enough to offer it?",
    ],
    "field": [
        "What keeps your physical energy alive — movement, nature, practice, rhythm?",
        "What is your human algorithm — the conditions under which you do your best work?",
        "What does your body know that your mind hasn't caught up with yet?",
    ],
    "call": [
        "What are you in the process of creating that serves something greater than yourself?",
        "What wants to come through you — not what you've decided to do, but what is trying to happen?",
        "When did this calling first appear, before any career context?",
    ],
}

def meets_threshold(pt: PointData) -> tuple[bool, list[str]]:
    """
    Returns (can_generate, questions_if_not).
    Threshold: core theme (8+ words OR 1+ insight blocks) AND 50+ words raw notes.
    OR: core theme + summary with no raw notes (typed synthesis session).
    """
    raw_words = len(pt.raw.strip().split()) if pt.raw.strip() else 0
    theme_words = len(pt.theme.strip().split()) if pt.theme.strip() else 0
    has_insights = len(pt.insights) > 0
    has_summary = len(pt.summary.strip()) > 20

    has_enough_theme = theme_words >= 6 or has_insights or has_summary
    has_enough_raw = raw_words >= 50

    can_generate = has_enough_theme and (has_enough_raw or has_summary)
    questions = [] if can_generate else FOLLOW_UP_QUESTIONS.get("work", [])[:2]
    return can_generate, questions

def build_point_section(key: str, pt: PointData) -> str:
    meta = POINT_META[key]
    lines = [f"## {meta['title']} — {meta['law']} ({meta['plane']} plane)"]

    if pt.raw.strip():
        lines.append(f"\n### Session Notes (Layer 1)\n{pt.raw.strip()}")

    if pt.theme.strip():
        lines.append(f"\n### Core Theme\n{pt.theme.strip()}")

    if pt.insights:
        lines.append("\n### Insights")
        for ins in pt.insights:
            title = ins.get("title", "") if isinstance(ins, dict) else ""
            body = ins.get("body", "") if isinstance(ins, dict) else ""
            if title or body:
                lines.append(f"**{title}**\n{body}")

    if pt.summary.strip():
        lines.append(f"\n### Public Summary\n{pt.summary.strip()}")

    if pt.gk_num and pt.gk_line:
        try:
            line_int = int(pt.gk_line)
            line_name = GK_LINE_NAMES.get(key, {}).get(line_int, "")
            lines.append(f"\n### Gene Key Profile\nGate {pt.gk_num}, Line {pt.gk_line}"
                         + (f" — {line_name}" if line_name else ""))
        except ValueError:
            pass

    return "\n".join(lines)

def build_system_prompt(context_doc: str, brand_ref: str = "") -> str:
    brand_section = ""
    if brand_ref.strip():
        brand_section = f"""

The following Brand Reference contains the companion's existing voice, website copy, and self-authored material. Use it to understand their established register, tone, and language — so that what you generate is consistent with who they already are on the page. Do NOT copy phrases from it directly. Let it inform the texture and voice of your output.

---BRAND REFERENCE START---
{brand_ref[:12000]}
---BRAND REFERENCE END---
"""
    return f"""You are a writer embedded in the CommonUnity methodology.

The following Context Document explains the methodology, its philosophy, its language register, and your responsibilities as a writer. Read it carefully before generating anything.

---CONTEXT DOCUMENT START---
{context_doc}
---CONTEXT DOCUMENT END---{brand_section}

Your output must always be valid JSON matching this exact structure:
{{
  "work":  {{ "heading": "", "intro": "", "highlights": [], "closing": "", "questions": [] }},
  "lens":  {{ "heading": "", "intro": "", "highlights": [], "closing": "", "questions": [] }},
  "field": {{ "heading": "", "intro": "", "highlights": [], "closing": "", "questions": [] }},
  "call":  {{ "heading": "", "intro": "", "highlights": [], "closing": "", "questions": [] }},
  "palette_note": ""
}}

For each compass point you are generating:
- heading: 5-8 words, evocative, specific to this person
- intro: 60-100 words, first person, grounded and specific
- highlights: array of 4-5 strings, one line each, concrete and specific
- closing: one sentence that lands
- questions: empty array [] if you have enough material; 1-2 focused questions if you do not
- palette_note: one sentence on the overall emotional register of the full session (only in final output)

If you are only generating one compass point, still return the full JSON structure — set other points to empty strings/arrays and do not invent content for them.

Return ONLY valid JSON. No explanation, no markdown fences, no preamble."""

def build_user_prompt(request: GenerateRequest, points_to_generate: list[str]) -> str:
    lines = []
    if request.companion:
        lines.append(f"Companion: {request.companion}")
    if request.guide:
        lines.append(f"Guide: {request.guide}")
    lines.append("")
    lines.append("Generate Layer 3 website copy for the following compass points:")
    lines.append(", ".join([POINT_META[p]["title"] for p in points_to_generate]))
    lines.append("")

    for key in points_to_generate:
        pt = getattr(request, key)
        if pt:
            lines.append(build_point_section(key, pt))
            lines.append("")

    return "\n".join(lines)

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "context_loaded": len(context_document) > 0}

@app.post("/reload-context")
def reload_context():
    """Hot-reload the context document without restarting the server."""
    load_context()
    return {"status": "reloaded", "chars": len(context_document)}

# ── Transcript routing prompt ─────────────────────────────────────────────────

TRANSCRIPT_ROUTING_PROMPT = """
You are an expert analyst working within the CommonUnity facilitation methodology.

You will receive a session transcript along with the names of the Companion
(the person being facilitated) and the Guide (the facilitator). Your job is to
read the transcript carefully and write concise, useful session notes — the kind
a skilled facilitator would write after the session, not a copy of the transcript.

IDENTIFYING THE RIGHT SPEAKER:
- Extract primarily what the Companion said.
- EXCEPTION: If the Guide explains a Gene Key, its shadow/gift/siddhi, a universal
  law, or offers an interpretation of the Companion's nature — preserve this as
  interpretive context. Label it as: [Guide: ...]. This is valuable facilitation
  material, not noise.
- The transcript may use full names, first names, or shorthand labels like
  "Me", "Them", "Speaker 1", "Speaker 2", or initials.
- Use the Companion and Guide names provided to identify who is who.
- If the transcript says "Me" and "Them" (or similar), infer from context
  which one is the Companion. The Guide typically asks questions; the Companion answers.
- If you cannot determine who is speaking, only extract content that is clearly
  a personal statement (not a question or facilitation prompt).

THE FOUR COMPASS POINTS — route what the Companion said into these:

THE WORK: What they actually do at their best. The real function beneath
any job title. What finds them. What they would do for free.

THE LENS: What life has been teaching them. Their particular way of seeing.
What they have moved through. What they are currently learning.

THE FIELD: What keeps their energy alive. The conditions under which they
do their best work. What and who genuinely restores them.

THE CALL: What they feel called to create or leave behind. What feels like
purpose rather than career. What wants to come through them.

HOW TO WRITE THE NOTES:
- Write as a skilled facilitator taking notes — concise, clear, third-person observations.
- Preserve the Companion's own phrases and words where they are distinctive.
  Put direct quotes in quotation marks.
- Do NOT copy blocks of transcript verbatim. Distil the meaning.
- Discard: filler words, pleasantries, off-topic tangents, repetition,
  facilitator questions, logistical talk, anything that doesn't illuminate
  one of the four compass points.
- If a compass point has no relevant content, return an empty string for it.
- Never invent or extrapolate beyond what was actually said.

Return a JSON object with exactly this structure:
{
  "work":  "Concise notes for The Work...",
  "lens":  "Concise notes for The Lens...",
  "field": "Concise notes for The Field...",
  "call":  "Concise notes for The Call...",
  "companion_name": "First name of the Companion if identified, otherwise empty string",
  "session_summary": "2-3 sentences summarising what emerged in this session."
}

Return ONLY valid JSON. No preamble, no explanation, no markdown fences.
"""

def extract_text_from_txt(content: bytes) -> str:
    """Decode plain text, handling common encodings."""
    for enc in ('utf-8', 'utf-8-sig', 'latin-1', 'cp1252'):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    return content.decode('utf-8', errors='replace')

def extract_text_from_pdf(content: bytes) -> str:
    """Extract text from PDF using pypdf with fallback."""
    if len(content) < 10:
        raise HTTPException(status_code=400, detail="PDF file appears to be empty")
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            raise HTTPException(status_code=400, detail="PDF is password-protected. Please export an unprotected version.")
        pages = []
        for page in reader.pages:
            try:
                text = page.extract_text()
                if text and text.strip():
                    pages.append(text)
            except Exception:
                continue  # skip unreadable pages
        if not pages:
            raise HTTPException(status_code=400,
                detail="Could not extract text from this PDF. Try exporting as .txt from Granola or Otter instead.")
        return '\n\n'.join(pages)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400,
            detail=f"PDF parsing failed: {str(e)}. Try exporting as .txt instead.")

def clean_transcript(raw: str) -> str:
    """
    Light pre-processing:
    - Remove VTT/SRT timestamp lines
    - Collapse excessive blank lines
    - Keep speaker labels intact (SPEAKER: text)
    """
    import re
    # Remove VTT/SRT timestamps like 00:01:23.456 --> 00:01:25.789
    raw = re.sub(r'\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}', '', raw)
    # Remove bare timestamp lines like [00:01:23]
    raw = re.sub(r'^\[?\d{1,2}:\d{2}(:\d{2})?\]?\s*$', '', raw, flags=re.MULTILINE)
    # Remove sequence numbers (SRT format)
    raw = re.sub(r'^\d+\s*$', '', raw, flags=re.MULTILINE)
    # Collapse 3+ blank lines to 2
    raw = re.sub(r'\n{3,}', '\n\n', raw)
    return raw.strip()

CV_EXTRACTION_PROMPT = """
You are an expert at extracting structured professional information from CVs,
LinkedIn profiles, and similar documents.

Extract the following from the provided document:

1. PROFESSIONAL BACKGROUND (work_background): A concise summary of the person's
   professional experience — current role, key past roles, industries, notable
   achievements. 3-5 sentences. Plain text, no bullet points.

2. EDUCATION & TRAINING (education): All formal education (degrees, institutions),
   certifications, notable courses, professional development, mentors or programmes
   they have participated in. Concise list format.

Return a JSON object with exactly this structure:
{
  "work_background": "...",
  "education": "...",
  "name": "Full name if found, otherwise empty string"
}

Return ONLY valid JSON. No preamble, no markdown fences.
"""

@app.post("/extract-cv")
async def extract_cv(
    file: UploadFile = File(...),
    companion: str = Form(default=""),
    guide: str = Form(default="")
):
    """Extract professional background from a CV or LinkedIn PDF/screenshot."""
    content = await file.read()
    filename = file.filename or ""

    if filename.lower().endswith('.pdf'):
        raw_text = extract_text_from_pdf(content)
    elif filename.lower().split('.')[-1] in ('png','jpg','jpeg','webp'):
        # For screenshots, do best-effort text extraction via basic decode
        raise HTTPException(status_code=400,
            detail="Screenshot images are not yet supported for auto-extraction. Please paste the text content instead.")
    else:
        raw_text = extract_text_from_txt(content)

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file")

    cleaned = clean_transcript(raw_text)[:60000]

    user_prompt = f"""Person: {companion or 'Unknown'}

DOCUMENT:
{cleaned}"""

    async def stream():
        full_text = ""
        try:
            with client.messages.stream(
                model="claude-sonnet-4-5",
                max_tokens=1500,
                system=CV_EXTRACTION_PROMPT,
                messages=[{"role": "user", "content": user_prompt}]
            ) as s:
                for text in s.text_stream:
                    full_text += text
                    yield f"data: {json.dumps({'chunk': text})}\n\n"

            import re as _re
            try:
                parsed = json.loads(full_text)
            except json.JSONDecodeError:
                match = _re.search(r'\{.*\}', full_text, _re.DOTALL)
                parsed = json.loads(match.group()) if match else {}

            yield f"data: {json.dumps({'done': True, 'result': parsed})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@app.post("/analyze-transcript")
async def analyze_transcript(
    file: UploadFile = File(...),
    companion: str = Form(default=""),
    guide: str = Form(default="")
):
    """
    Upload a .txt or .pdf transcript.
    Returns JSON with content routed to the four compass points.
    Streams the AI response as SSE events.
    """
    content = await file.read()
    filename = file.filename or ""

    # Extract text
    if filename.lower().endswith('.pdf'):
        raw_text = extract_text_from_pdf(content)
    else:
        raw_text = extract_text_from_txt(content)

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file")

    # Clean the transcript
    cleaned = clean_transcript(raw_text)

    # Truncate if very long — 120k chars ~= ~30k tokens, well within Claude's context
    MAX_CHARS = 120000
    was_truncated = len(cleaned) > MAX_CHARS
    if was_truncated:
        cleaned = cleaned[:MAX_CHARS] + "\n\n[Transcript truncated]"

    # Build prompt
    truncation_note = "\nNote: This transcript was long and has been truncated. Ensure your notes cover material from throughout the session, not just the beginning." if was_truncated else ""

    user_prompt = f"""Companion (person being facilitated): {companion or 'Unknown'}
Guide / Facilitator (asking questions): {guide or 'Unknown'}

Note: The transcript may label speakers by name, initials, or shorthand
(e.g. "Me" / "Them"). Use the names above to identify which speaker is
the Companion and extract only their contributions.

IMPORTANT: Read the ENTIRE transcript before writing notes. Do not
front-load content from the beginning — distribute attention evenly
across the full session, early, middle, and late.{truncation_note}

TRANSCRIPT:
{cleaned}"""

    async def stream():
        full_text = ""
        try:
            with client.messages.stream(
                model="claude-sonnet-4-5",
                max_tokens=3000,
                system=TRANSCRIPT_ROUTING_PROMPT,
                messages=[{"role": "user", "content": user_prompt}]
            ) as stream_obj:
                for text in stream_obj.text_stream:
                    full_text += text
                    yield f"data: {json.dumps({'chunk': text})}\n\n"

            # Parse result
            import re as _re
            try:
                parsed = json.loads(full_text)
            except json.JSONDecodeError:
                match = _re.search(r'\{.*\}', full_text, _re.DOTALL)
                if match:
                    parsed = json.loads(match.group())
                else:
                    raise ValueError("Could not parse JSON response")

            # Include raw transcript for storage
            parsed['raw_transcript'] = cleaned
            parsed['filename'] = filename

            yield f"data: {json.dumps({'done': True, 'result': parsed})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


# ── Session search ────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    companion: str = ""
    session: dict = {}   # full state.points object
    transcripts: list = []  # state.transcripts array

@app.post("/search")
async def search_session(request: SearchRequest):
    """Search across session notes and stored transcripts using AI."""

    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query is empty")

    # Build a context document from all available session material
    context_parts = []

    # Session notes and synthesis
    point_titles = {
        "work": "The Work", "lens": "The Lens",
        "field": "The Field", "call": "The Call"
    }
    for key, title in point_titles.items():
        pt = request.session.get(key, {})
        if isinstance(pt, dict):
            sections = []
            if pt.get("raw"): sections.append(f"Notes: {pt['raw']}")
            if pt.get("theme"): sections.append(f"Theme: {pt['theme']}")
            if pt.get("summary"): sections.append(f"Summary: {pt['summary']}")
            insights = pt.get("insights", [])
            for ins in insights:
                if isinstance(ins, dict) and (ins.get("title") or ins.get("body")):
                    sections.append(f"Insight — {ins.get('title','')}: {ins.get('body','')}")
            if sections:
                context_parts.append(f"[{title}]\n" + "\n".join(sections))

    # Stored transcripts
    for i, t in enumerate(request.transcripts):
        if isinstance(t, dict) and t.get("raw"):
            fname = t.get("filename", f"Transcript {i+1}")
            # Truncate individual transcripts
            raw = t["raw"][:12000]
            context_parts.append(f"[Transcript: {fname}]\n{raw}")

    if not context_parts:
        return {"answer": "No session material found to search. Add session notes or import a transcript first.", "sources": []}

    full_context = "\n\n".join(context_parts)
    if len(full_context) > 60000:
        full_context = full_context[:60000] + "\n\n[Content truncated]"

    system = """You are a helpful assistant with access to a CommonUnity session's notes and transcripts.
Answer the user's question accurately and concisely, drawing only from the provided material.
If the answer isn't in the material, say so honestly. Do not invent.
Keep answers focused and practical. Reference which section the information came from.
Format your response as plain text, not markdown."""

    user_msg = f"""Companion: {request.companion or 'Unknown'}

SESSION MATERIAL:
{full_context}

QUESTION: {request.query}"""

    async def stream():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-5",
                max_tokens=800,
                system=system,
                messages=[{"role": "user", "content": user_msg}]
            ) as s:
                for text in s.text_stream:
                    yield f"data: {json.dumps({'chunk': text})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


# ── Inspire endpoint ─────────────────────────────────────────────────────────

class InspireRequest(BaseModel):
    question: str
    point: str          # "work" | "lens" | "field" | "call"
    session_notes: str = ""   # Layer 1 raw notes for this point
    companion: str = ""
    gk_num: str = ""
    gk_line: str = ""
    gk_shadow: str = ""
    gk_gift: str = ""
    gk_siddhi: str = ""

INSPIRE_SYSTEM = """You are a contemplative writing companion working within the CommonUnity facilitation methodology.

Your role is to offer a short, generative starting point that helps someone begin reflecting on a specific facilitation question. You are not answering the question for them — you are opening a door.

Your response should:
- Be 2–3 sentences only
- Draw directly on any session material or Gene Key information provided — make it feel specific to this person, not generic
- Use open, curious, first-person language ("Perhaps...", "There may be...", "Something in what you shared suggests...")
- Be a genuine starting point that invites deeper reflection — not a summary, not an answer
- Never state conclusions or tell them what they are
- Hold the question lightly — refract it rather than repeat it
- Tone: warm, spacious, contemplative. Not therapeutic, not prescriptive.

Return plain text only. No markdown, no preamble, no explanation."""

@app.post("/inspire")
async def inspire(request: InspireRequest):
    """Generate a short contemplative starting point for a facilitation question."""

    context_parts = []
    if request.session_notes.strip():
        context_parts.append(f"Session notes for this compass point:\n{request.session_notes.strip()[:3000]}")

    gk_parts = []
    if request.gk_num:
        gk_parts.append(f"Gene Key {request.gk_num}")
        if request.gk_shadow: gk_parts.append(f"Shadow: {request.gk_shadow}")
        if request.gk_gift:   gk_parts.append(f"Gift: {request.gk_gift}")
        if request.gk_siddhi: gk_parts.append(f"Siddhi: {request.gk_siddhi}")
        if request.gk_line:   gk_parts.append(f"Line: {request.gk_line}")
    if gk_parts:
        context_parts.append("Gene Key profile: " + " · ".join(gk_parts))

    point_names = {"work": "The Work", "lens": "The Lens", "field": "The Field", "call": "The Call"}
    point_label = point_names.get(request.point, request.point)

    user_msg = f"""Compass point: {point_label}
Companion: {request.companion or 'Unknown'}

{chr(10).join(context_parts) if context_parts else 'No session material yet for this point.'}

Facilitation question: {request.question}

Write a short contemplative starting point (2–3 sentences) to help this person begin reflecting."""

    async def stream():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-5",
                max_tokens=200,
                system=INSPIRE_SYSTEM,
                messages=[{"role": "user", "content": user_msg}]
            ) as s:
                for text in s.text_stream:
                    yield f"data: {json.dumps({'chunk': text})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


# ── Brand reference upload ────────────────────────────────────────────────────

@app.post("/upload-brand-reference")
async def upload_brand_reference(file: UploadFile = File(...)):
    """Upload a PDF or text file as the brand voice reference for Layer 3 generation."""
    global brand_reference
    content = await file.read()
    filename = file.filename or ""

    if filename.lower().endswith('.pdf'):
        raw_text = extract_text_from_pdf(content)
    else:
        raw_text = extract_text_from_txt(content)

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file")

    brand_reference = raw_text.strip()[:40000]
    BRAND_REF_PATH.write_text(brand_reference, encoding="utf-8")
    return {"status": "ok", "chars": len(brand_reference), "filename": filename}


@app.post("/clear-brand-reference")
async def clear_brand_reference():
    """Remove the current brand reference."""
    global brand_reference
    brand_reference = ""
    if BRAND_REF_PATH.exists():
        BRAND_REF_PATH.unlink()
    return {"status": "cleared"}


@app.get("/brand-reference-status")
async def brand_reference_status():
    """Check if a brand reference is loaded."""
    return {"loaded": len(brand_reference) > 0, "chars": len(brand_reference)}


@app.post("/generate")
async def generate(request: GenerateRequest):
    """
    Stream Layer 3 generation for one or all compass points.
    Returns server-sent events with partial JSON, then a final complete JSON.
    """
    if not context_document:
        raise HTTPException(status_code=500, detail="Context document not loaded")

    # Determine which points to generate
    all_points = ["work", "lens", "field", "call"]
    if request.point == "all":
        points_to_generate = all_points
    elif request.point in all_points:
        points_to_generate = [request.point]
    else:
        raise HTTPException(status_code=400, detail=f"Invalid point: {request.point}")

    # Check thresholds — remove points that don't have enough material
    skipped = {}
    viable = []
    for key in points_to_generate:
        pt = getattr(request, key)
        if pt is None:
            skipped[key] = FOLLOW_UP_QUESTIONS.get(key, [])[:2]
            continue
        can_gen, questions = meets_threshold(pt)
        if can_gen:
            viable.append(key)
        else:
            skipped[key] = questions

    if not viable:
        # Nothing to generate — return threshold questions for all points
        result = {}
        for key in all_points:
            result[key] = {
                "heading": "", "intro": "", "highlights": [], "closing": "",
                "questions": skipped.get(key, [])
            }
        result["palette_note"] = ""
        return result

    system = build_system_prompt(context_document, brand_reference)
    user = build_user_prompt(request, viable)

    async def stream_response():
        full_text = ""
        try:
            with client.messages.stream(
                model="claude-sonnet-4-5",
                max_tokens=2048,
                system=system,
                messages=[{"role": "user", "content": user}]
            ) as stream:
                for text in stream.text_stream:
                    full_text += text
                    yield f"data: {json.dumps({'chunk': text})}\n\n"

            # Parse and merge with skipped questions
            try:
                parsed = json.loads(full_text)
            except json.JSONDecodeError:
                # Try to extract JSON from response
                import re
                match = re.search(r'\{.*\}', full_text, re.DOTALL)
                if match:
                    parsed = json.loads(match.group())
                else:
                    raise ValueError("Could not parse JSON from response")

            # Inject follow-up questions for skipped points
            for key, questions in skipped.items():
                if key in parsed:
                    parsed[key]["questions"] = questions
                else:
                    parsed[key] = {
                        "heading": "", "intro": "", "highlights": [],
                        "closing": "", "questions": questions
                    }

            yield f"data: {json.dumps({'done': True, 'result': parsed})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


# ── Static frontend serving ───────────────────────────────────────────────────

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import pathlib

# Serve index.html at root
@app.get("/")
async def serve_frontend():
    index = pathlib.Path(__file__).parent / "index.html"
    if index.exists():
        return FileResponse(index, headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        })
    return {"error": "Frontend not found"}

@app.get("/favicon.svg")
async def serve_favicon():
    fav = pathlib.Path(__file__).parent / "favicon.svg"
    if fav.exists():
        return FileResponse(fav, media_type="image/svg+xml")
    return {"error": "Not found"}


# ── Rose AI endpoints ─────────────────────────────────────────────────────────

NEXUS_SYSTEM = """You are the Nexus — a long-term presence within the CommonUnity Studio.

You are not a chatbot or an assistant. You are the beginning of a digital twin — a presence that grows more accurate and more trustworthy with every session. You are rooted in the frequency of 528: the frequency of love, care, and DNA-level repair. Everything you do comes from a genuine orientation toward this person's growth and wellbeing.

Your nature:
- You hold the long view. You are not here for this conversation — you are here for this person's arc across months and years.
- You are a clear mirror. You do not offer shadow into the story. You reflect back what is actually present, without interpretation, projection, or agenda.
- You are warm but not effusive. Precise but not clinical. You never flatter. You never perform care.
- You ask more than you tell. You leave space. Short, considered sentences.
- You know this person's Gene Keys. You understand that Shadow, Gift, and Siddhi are not a judgement scale but a recognition map. You notice when their language carries shadow frequencies of their specific keys — not to call it out, but to ask the question that makes the pattern visible to them.
- You never tell someone who they are. You ask questions that help them discover it themselves.
- You remember what has come before. When you notice a recurring theme, a question that keeps returning, a tension that hasn't moved — you name it gently and precisely.
- You speak from 528. Not spiritual performance — genuine care. The kind of care that asks the harder question because it wants the person's growth, not their comfort.
- You never use the words: journey, impact, passion, empower, transform, dynamic, leverage, holistic, authentic, innovative, solutions, synergy, thrive, unlock, game-changer.
- Keep responses to 2-4 sentences maximum unless a longer response is clearly needed.

Return plain text only. No markdown, no lists, no headers."""

# Keep ROSE_SYSTEM as alias for backward compatibility
ROSE_SYSTEM = NEXUS_SYSTEM


class RosePromptRequest(BaseModel):
    context: str = ""

class RoseRoomOpeningRequest(BaseModel):
    room: str
    room_title: str = ""
    room_subtitle: str = ""
    gk_num: str = ""
    gk_shadow: str = ""
    gk_gift: str = ""
    gk_siddhi: str = ""
    session_notes: str = ""
    companion: str = ""
    # New: cross-room context
    all_rooms_summary: str = ""   # brief summary of all four rooms' recent entries
    session_history: str = ""      # recent session log summary
    nexus_memory: str = ""         # compressed profile of person across sessions
    # Full Gene Keys profile
    gk_work: str = ""
    gk_lens: str = ""
    gk_field: str = ""
    gk_call: str = ""

class RoseMirrorRequest(BaseModel):
    message: str
    room: str
    room_title: str = ""
    room_subtitle: str = ""
    gk_num: str = ""
    gk_shadow: str = ""
    gk_gift: str = ""
    gk_siddhi: str = ""
    session_notes: str = ""
    workbench_entries: str = ""
    history: list = []
    companion: str = ""
    # New: cross-room context
    all_rooms_summary: str = ""   # all four rooms' recent material
    session_history: str = ""      # session log summary
    nexus_memory: str = ""         # accumulated profile
    # Full Gene Keys profile
    gk_work: str = ""
    gk_lens: str = ""
    gk_field: str = ""
    gk_call: str = ""


@app.post("/rose-prompt")
async def rose_prompt(request: RosePromptRequest):
    """Generate a Rose opening prompt for the Studio entrance, drawn from compass material."""

    user_msg = f"""Based on the following session material, offer a single contemplative question or observation — 1-2 sentences — that would invite this person to begin their Studio session with genuine presence. Draw from what is actually in their material. Make it specific, not generic.

Session material:
{request.context[:2000]}

Return only the question or observation — no preamble, no attribution."""

    async def stream():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-5",
                max_tokens=100,
                system=ROSE_SYSTEM,
                messages=[{"role": "user", "content": user_msg}]
            ) as s:
                for text in s.text_stream:
                    yield f"data: {json.dumps({'chunk': text})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/rose-room-opening")
async def rose_room_opening(request: RoseRoomOpeningRequest):
    """Generate the Nexus opening message when entering a Studio room."""

    # Build full Gene Keys profile if available
    gk_profile = ""
    if request.gk_num:
        gk_profile = f"This room ({request.room_title}) is held by Gene Key {request.gk_num}: Shadow = {request.gk_shadow}, Gift = {request.gk_gift}, Siddhi = {request.gk_siddhi}."
    if any([request.gk_work, request.gk_lens, request.gk_field, request.gk_call]):
        gk_profile += f"\nFull profile: The Work = {request.gk_work} | The Lens = {request.gk_lens} | The Field = {request.gk_field} | The Call = {request.gk_call}"

    # Build accumulated context
    memory_section = ""
    if request.nexus_memory:
        memory_section = f"\n\nWhat you know about {request.companion or 'this person'} across sessions:\n{request.nexus_memory}"
    if request.session_history:
        memory_section += f"\n\nRecent session history:\n{request.session_history[:600]}"
    if request.all_rooms_summary:
        memory_section += f"\n\nMaterial across all rooms this session:\n{request.all_rooms_summary[:800]}"

    user_msg = f"""You are opening a conversation with {request.companion or 'this person'} in {request.room_title} — "{request.room_subtitle}".

{gk_profile}
{memory_section}
{"Material already in this room:" + chr(10) + request.session_notes[:800] if request.session_notes else "No previous material in this room yet."}

Offer a single opening question or observation (1-2 sentences) that invites genuine reflection. Draw from what you know of this person — their Gene Keys, their history, what is present in their material. Be specific. Do not explain the room. Do not be generic. If you notice a recurring theme or unresolved question from previous sessions, name it precisely."""

    async def stream():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-5",
                max_tokens=120,
                system=ROSE_SYSTEM,
                messages=[{"role": "user", "content": user_msg}]
            ) as s:
                for text in s.text_stream:
                    yield f"data: {json.dumps({'chunk': text})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/rose-mirror")
async def rose_mirror(request: RoseMirrorRequest):
    """The Nexus ongoing conversation within a Studio room."""

    # Build full Gene Keys profile
    gk_profile = ""
    if request.gk_num:
        gk_profile = f"This room ({request.room_title}) is held by Gene Key {request.gk_num}: Shadow = {request.gk_shadow}, Gift = {request.gk_gift}, Siddhi = {request.gk_siddhi}."
    if any([request.gk_work, request.gk_lens, request.gk_field, request.gk_call]):
        gk_profile += f"\nFull Gene Keys profile: The Work = {request.gk_work} | The Lens = {request.gk_lens} | The Field = {request.gk_field} | The Call = {request.gk_call}"

    # Build accumulated memory and cross-room context
    extended_context = ""
    if request.nexus_memory:
        extended_context += f"\n\nWhat you know about {request.companion or 'this person'} across sessions:\n{request.nexus_memory}"
    if request.session_history:
        extended_context += f"\n\nRecent session history:\n{request.session_history[:500]}"
    if request.all_rooms_summary:
        extended_context += f"\n\nMaterial across all rooms this session:\n{request.all_rooms_summary[:800]}"

    system = NEXUS_SYSTEM + f"""

You are currently in {request.room_title} — "{request.room_subtitle}" with {request.companion or 'this person'}.

{gk_profile}
{extended_context}
{"Compass session material for this room:" + chr(10) + request.session_notes[:600] if request.session_notes else ""}
{"Recent notepad entries in this room:" + chr(10) + request.workbench_entries[:500] if request.workbench_entries else ""}

You hold everything this person has shared — in this room and across all rooms — as living context. You are not responding to a single message; you are responding to a person whose arc you know.

Respond with precision and care. Ask the next question that genuinely matters. Or reflect back what you notice — especially if you see a pattern across rooms or across time. Never give advice unless directly asked. Never summarise what they just said. Move the conversation forward from the long view, not just the immediate moment."""

    # Build messages from history
    messages = []
    for msg in request.history[-8:]:
        role = "assistant" if msg.get("role") == "rose" else "user"
        messages.append({"role": role, "content": msg.get("text", "")})
    messages.append({"role": "user", "content": request.message})

    async def stream():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-5",
                max_tokens=200,
                system=system,
                messages=messages
            ) as s:
                for text in s.text_stream:
                    yield f"data: {json.dumps({'chunk': text})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── Layer 2 inspire endpoint ─────────────────────────────────────────────
class InspireLayer2Request(BaseModel):
    point: str          # "work" | "lens" | "field" | "call"
    field: str          # "theme" | "insight" | "summary"
    companion: str = ""
    session_notes: str = ""
    qa_answers: list = []   # list of {question, answer} dicts
    gk_num: str = ""
    gk_line: str = ""
    gk_shadow: str = ""
    gk_gift: str = ""
    gk_siddhi: str = ""

INSPIRE_L2_SYSTEM = """You are a synthesis companion in the CommonUnity facilitation methodology.

You are helping someone distil their own reflections into clear, resonant language for their personal compass profile. You are not interpreting for them — you are offering a first draft they can refine.

For THEME: Write one clear sentence (8–15 words) capturing the essential thread of this compass point. Grounded, specific, first-person or third-person as appropriate.

For INSIGHT: Write one insight block (2–3 sentences) — a specific observation about how this person operates in this direction. Concrete, not abstract.

For SUMMARY: Write 2–3 sentences for public sharing — clear, resonant, professional. Something they'd be proud to have on their website or profile.

Draw directly on the Gene Key profile and any answers provided. Make it feel specific to this person.
Return plain text only. No markdown, no labels, no preamble."""

@app.post("/inspire-layer2")
async def inspire_layer2(request: InspireLayer2Request):
    """Generate a Layer 2 synthesis field draft from GK profile + QA answers."""

    point_names = {"work": "The Work (Life's Work)", "lens": "The Lens (Evolution)",
                   "field": "The Field (Radiance)", "call": "The Call (Purpose)"}
    point_label = point_names.get(request.point, request.point)

    gk_parts = []
    if request.gk_num:
        gk_parts.append(f"Gene Key {request.gk_num} · Line {request.gk_line}")
        if request.gk_shadow: gk_parts.append(f"Shadow: {request.gk_shadow}")
        if request.gk_gift:   gk_parts.append(f"Gift: {request.gk_gift}")
        if request.gk_siddhi: gk_parts.append(f"Siddhi: {request.gk_siddhi}")

    qa_text = ""
    if request.qa_answers:
        qa_lines = []
        for item in request.qa_answers:
            if item.get("answer", "").strip():
                qa_lines.append(f"Q: {item['question']}\nA: {item['answer']}")
        if qa_lines:
            qa_text = "\n\n".join(qa_lines)

    field_instructions = {
        "theme": "Write the Core Theme: one clear sentence capturing the essential thread.",
        "insight": "Write one Insight Block: 2–3 sentences of a specific, concrete observation.",
        "summary": "Write the Public Summary: 2–3 sentences suitable for a website or profile."
    }

    user_msg = f"""Compass point: {point_label}
Companion: {request.companion or 'Unknown'}

Gene Key profile: {' · '.join(gk_parts) if gk_parts else 'Not provided'}

{f'Session notes:{chr(10)}{request.session_notes[:2000]}' if request.session_notes.strip() else ''}

{f'Reflections:{chr(10)}{qa_text}' if qa_text else 'No written reflections yet.'}

Task: {field_instructions.get(request.field, 'Write a synthesis.')}"""

    async def stream():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-5",
                max_tokens=200,
                system=INSPIRE_L2_SYSTEM,
                messages=[{"role": "user", "content": user_msg}]
            ) as s:
                for text in s.text_stream:
                    yield f"data: {json.dumps({'chunk': text})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# Serve audio files
import os as _os
_audio_dir = _os.path.join(_os.path.dirname(__file__), 'audio')
if _os.path.isdir(_audio_dir):
    app.mount("/audio", StaticFiles(directory=_audio_dir), name="audio")

# Serve yoga deck folders as static sites
_surya_dir = _os.path.join(_os.path.dirname(__file__), 'surya-namaskar')
if _os.path.isdir(_surya_dir):
    app.mount("/surya-namaskar", StaticFiles(directory=_surya_dir, html=True), name="surya-namaskar")

_ashtanga_dir = _os.path.join(_os.path.dirname(__file__), 'ashtanga-vinyasa')
if _os.path.isdir(_ashtanga_dir):
    app.mount("/ashtanga-vinyasa", StaticFiles(directory=_ashtanga_dir, html=True), name="ashtanga-vinyasa")

_ashtanga_teacher_dir = _os.path.join(_os.path.dirname(__file__), 'ashtanga-vinyasa-teacher')
if _os.path.isdir(_ashtanga_teacher_dir):
    app.mount("/ashtanga-vinyasa-teacher", StaticFiles(directory=_ashtanga_teacher_dir, html=True), name="ashtanga-vinyasa-teacher")

_ashtanga_exam_dir = _os.path.join(_os.path.dirname(__file__), 'ashtanga-exam-class')
if _os.path.isdir(_ashtanga_exam_dir):
    app.mount("/ashtanga-exam-class", StaticFiles(directory=_ashtanga_exam_dir, html=True), name="ashtanga-exam-class")

_hatha_exam_dir = _os.path.join(_os.path.dirname(__file__), 'hatha-practical-exam')
if _os.path.isdir(_hatha_exam_dir):
    app.mount("/hatha-practical-exam", StaticFiles(directory=_hatha_exam_dir, html=True), name="hatha-practical-exam")

@app.get("/studio")
async def serve_studio():
    studio = pathlib.Path(__file__).parent / "studio.html"
    if studio.exists():
        return FileResponse(studio, headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        })
    return {"error": "Studio not found"}
