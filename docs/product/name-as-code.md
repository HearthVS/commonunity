# Name as Code — the Name Gateway

Status: v0.1 canonical feature spec. Full source preserved at [`../source-material/om-cipher-name-as-code.md`](../source-material/om-cipher-name-as-code.md). A **Layer 1 supplement** in the Compass / OM Cipher onboarding flow.

## In one sentence

Before the numbers, gates, and frequencies are shown, the person is invited into a deeper relationship with the most fundamental code they have ever been given: **their own first name.**

The OM Cipher begins here — **not with calculation, but with listening.**

## Philosophical foundation

*(This text, or a distillation, opens the section in the UI — second person, direct, warm, not academic.)*

A name is given, usually before there was a self to consent. From that moment, every time the sound is spoken, something turns toward it. **Every name is a code** — not a secret to be broken, but a *carrier*: a vessel holding history, archetype, sound, and intention compressed into a few syllables. Like a mirror others hold up each time they call to you, your name has shaped you — through the frequency of its consonants, the openness of its vowels, the history in its syllables — beneath your awareness.

In the digital era, a name travels farther than any broadcast in history: every email, platform, and search result carries it at the speed of light into contexts you will never know. Many carry a low-level discomfort at this propagation, as if something intimate and vibratory is transmitted without full understanding of what it carries. Coming to understand one's first name — its etymology, vibration, sonic quality, tradition — is **a practice of self-recognition**: an honest relationship with the signal one is already broadcasting.

## The contemplative practice — Name as Mantra (with Bhramari)

*(A guided practice card, styled as an invitation, not an instruction manual. 5–10 minutes, seated, eyes closed, spine upright.)*

1. **Settle (2 min).** Three slow breaths; bring awareness to the space behind the face — nasal passage, palate, sinus.
2. **Speak your name aloud (×3).** Slowly, as if hearing it for the first time. Notice where it lands in the body — chest, throat, face — any contraction, any expansion.
3. **Hum your name (Bhramari).** Lips soft, hum each syllable as a tone, then the whole name as one continuous hum; 5–8 rounds. Feel the vibration in the face. (This is the same humming-bee breath that anchors the OM Cipher's Bhramari capture — see [`../foundation/om-cipher.md`](../foundation/om-cipher.md).)
4. **Rest in silence (1–2 min).** Notice what has shifted.
5. **The inquiry.** Hold — not to answer quickly, but to let work over days: *Who gave me this name, and why? What does its sound feel like in my body? What archetype does it carry that I recognise — and one I have resisted? If my name is a frequency I broadcast continuously, what am I broadcasting? If I could choose a name today, would I choose this one?* The last question is the most revealing; there is no wrong answer.

## The AI-assisted etymological narrative

*(Implementation spec for the Compass / Nexus engine.)* For each user's **first name**, the system generates a ~400–600-word narrative weaving:

1. **Linguistic origin** — language family, root, original meaning.
2. **Archetypal history** — who carried this name, which traditions and cultures.
3. **Famous bearers** — 2–3 notable historical carriers and what they embodied.
4. **Sonic analysis** — phonetic qualities (vowels, consonants, syllabic rhythm) and their vibrational character.
5. **Pythagorean bridge** — how the etymology connects to and illuminates the numerology results, so the numbers land as *echoes of a living tradition* rather than random facts.

A full worked example (the name **MARKUS** → Marcus/Mars → "holds the field so life can grow"; Marcus Aurelius the steward-philosopher, Mark the Evangelist the interpreter; the *M* of gathering/Bhramari; bridged to Expression 8, Life Path 22, Soul Urge 6, Personality 11) is in the [source doc](../source-material/om-cipher-name-as-code.md).

### Prompt template (for Nexus / AI generation)

```
You are the etymological researcher and narrative writer for the OM Cipher system within CommonUnity.

Given:
- First name: [NAME]
- Pythagorean numerology results: [LAYER_1_JSON]
- Human Design profile summary: [LAYER_2_SUMMARY]
- Birth date and place: [DATE, PLACE]

Write a 400–600 word narrative:
1. Linguistic and historical origin (2–3 paragraphs)
2. 2–3 notable historical bearers and what they embodied (1–2 paragraphs)
3. A sonic / phonetic analysis — what the consonants and vowels suggest vibrationally (1 paragraph)
4. A bridge paragraph connecting etymology and sound back to the numerology — the numbers echo an archetype the name has carried for a long time

Tone: warm, contemplative, intelligent but not academic. Second person, name addressed directly. Grounded and specific, not mystical-vague. The reader should feel their name has been taken seriously.

Do not mention CommonUnity or the OM Cipher by name in the narrative itself.
```

> Governance: this narrative is generated by an external-AI process (Nexus). It uses **first name + numerology/HD summary + birth date/place** — not the full OM Cipher, not raw reflections. Keep it minimal and layered per [`../governance/external-ai-boundary.md`](../governance/external-ai-boundary.md).

## UI placement in Compass

The Name Gateway appears **before** the numerology cards — as the entry point into Layer 1, not a supplement to it:

```
1. Onboarding      → first name, last name, birth date/time/place
2. Name Gateway    ← THIS FEATURE
   · opening philosophical text (abbreviated, 2–3 paragraphs)
   · the contemplative practice card (expandable / optional)
   · the etymological narrative (AI-generated, ~500 words)
   · "Your name in numbers →" CTA into the numerology cards
3. Numerology cards → now the numbers land as recognition, not revelation
4. Human Design / Gene Keys → Layer 2
5. I Ching temporal → Layer 3
6. Vibrational frequency → Layer 4
7. Cipher name + sigil → Layers 5 / 6
```

## Why this matters

The name narrative is what makes the OM Cipher feel like a **mirror** rather than a profile form — the moment the person feels *seen*, not merely data-collected, because the system takes seriously something they have carried their whole life. It is also the most **shareable** feature (intimate enough to feel personal, universal enough to feel meaningful to anyone). In the cOMmons and Living Profile, the name narrative becomes the **opening entry** in a person's record — the origin story of their signal.

---

Related: [`./compass.md`](./compass.md), [`../foundation/om-cipher.md`](../foundation/om-cipher.md), [`../foundation/om-cipher-white-paper.md`](../foundation/om-cipher-white-paper.md) (Layer 5, Name Intelligence & emergent cipher name).
