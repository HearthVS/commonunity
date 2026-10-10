# Integrity Review — Tuner becomes OM Tuner (standalone, lightly linked)

- **Date:** 2026-10-10
- **Steward:** Markus Lehto
- **Contributor(s):** Claude (Claude Code, internal builder mode)
- **Facilitator consulted (if relevant):** n/a
- **Linked PRs / commits:** #234 (practitioner login + intake), the OM Tuner rename PR (`feat/om-tuner-rename`), #233 (soundscape export)

## Milestone intention (one sentence)

> Let the Tuner stand on its own as **OM Tuner** — its own name and domain (omtuner.com), usable by a practitioner and their clients without passing through CommonUnity — while staying lightly linked to CommonUnity through Nexus and "tuning within the community: uncovering the frequencies that align people and connect them".

## Seat-setting

- [x] Re-read `foundation/commonunity-architecture-v0.2.md` (Tuner listed under Studio tools; Bhramari capture named as a future Tuner/Om Cipher activation flow)
- [x] Re-read `foundation/philosophical-principles.md`

## 8-limb walk

### 1. Yama — relational integrity

- Outcome: ✅
- Notes: The relationships touched are practitioner ↔ client and OM Tuner ↔ CommonUnity. The client side gains integrity in the same batch (#234): intake data behind a login, every safety answer stored and flagged, a privacy note. The CommonUnity link is honest and light ("Part of CommonUnity") rather than hidden or overstated.

### 2. Niyama — internal discipline

- Outcome: ✅
- Notes: The rename is recorded here and in the decision log; the service, domain, volume and required variables are in `architecture/deployment-model.md`; the brand guide carries a reconciliation note. A future steward can see why the name changed and what stayed shared.

### 3. Asana — structural seat

- Outcome: ⚠️
- Notes: The seat is clear in intent (a standalone tool in the CommonUnity field, sharing Nexus) but not yet in structure: the code still lives in the CommonUnity monorepo, deploys on every push to `main`, and serves copies of CommonUnity's marketing pages (`/home`, `/studio`, `/source-code`). **Reservation:** move those pages off the Tuner deploy and limit deploys to `tuner/` changes (deploy-config change needs the maintainer's approval first).

### 4. Pranayama — energy flow

- Outcome: ⚠️
- Notes: Breath catches at the domain: omtuner.com is bought but not yet live (DNS records not added), so clients still meet a raw Railway address. The intake and email links now follow whatever address the app is opened on, so no further code change is needed once DNS is in. **Reservation:** add the DNS records.

### 5. Pratyahara — removal of noise

- Outcome: ✅
- Notes: Removed the CommonUnity Compass/Studio sidebar links and the CommonUnity "Beta feedback" widget (it posted to a route the Tuner never had, so every message was lost). No new AI persona was introduced: Nexus stays Nexus.

### 6. Dharana — focused intention

- Outcome: ✅
- Notes: The one thing: OM Tuner helps a practitioner tune sessions with clients through sound, and helps people find what they resonate with. The rename, the light link and the shareable soundscapes all serve that.

### 7. Dhyana — coherence over time

- Outcome: ⚠️
- Notes: Two principles need guarding as OM Tuner grows. *Witnessing before tooling* (principle 2): if OM Tuner later opens to other practitioners with self-serve sign-up, that is a separate product and must not become a back door into CommonUnity membership, which stays invitation-led through Compass. *One canonical engine* (principle 6): any future Bhramari / Om Cipher capture in OM Tuner must call the single Om Cipher engine, never a fork. **Reservation:** carry both into the multi-practitioner plan when it is written.

### 8. Samadhi — service to Unity

- Outcome: ✅
- Notes: Unity is served, not only function added: the tool is framed around resonance between people (practitioner and client sounding together; frequencies that connect), and Nexus carries frequency expertise into all of CommonUnity rather than splitting into a separate persona.

## Outcome

**Complete with reservations (⚠️).** Accepted reservations, each with a named follow-up:

1. **Asana:** move CommonUnity marketing-page copies off the Tuner deploy; deploy OM Tuner only on `tuner/` changes (maintainer approval needed for the deploy change).
2. **Pranayama:** add the omtuner.com DNS records so the domain goes live.
3. **Dhyana:** write principles 2 and 6 into the future multi-practitioner plan.
