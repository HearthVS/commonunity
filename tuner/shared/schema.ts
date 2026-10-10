import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Instruments ──────────────────────────────────────────────────────────────
export const instruments = sqliteTable("instruments", {
  id: text("id").primaryKey(), // e.g. TF-OTTO-128
  name: text("name").notNull(),
  type: text("type").notNull(), // fork | bowl | bell
  weighting: text("weighting").notNull(), // weighted | unweighted | n/a
  frequency: real("frequency").notNull(), // dominant Hz
  frequencyHarmonic: real("frequency_harmonic"), // first harmonic for bowls
  lineage: text("lineage").notNull(),
  imageFilename: text("image_filename"),
  audioFilename: text("audio_filename"),
  masterExplainer: text("master_explainer").notNull(),
  healingBenefits: text("healing_benefits").notNull(), // JSON array
  sessionRole: text("session_role").notNull(), // JSON array
  contraindications: text("contraindications").notNull(), // JSON array
  contraNote: text("contra_note"),
  notes: text("notes").notNull(), // JSON array of directive strings
  // optional
  toneName: text("tone_name"),
  colorHex: text("color_hex"),
  colorName: text("color_name"),
  colorWavelength: text("color_wavelength"),
  applicationPoints: text("application_points"),
  doshaTags: text("dosha_tags"), // JSON array
  centerAffinityTags: text("center_affinity_tags"), // JSON array
  elementalAssociation: text("elemental_association"),
  sourceReference: text("source_reference"),
  chakraId: text("chakra_id"), // FK reference
  closestChakraAlignment: integer("closest_chakra_alignment", { mode: "boolean" }), // true = closest match, not definitive
});

export const insertInstrumentSchema = createInsertSchema(instruments);
export type InsertInstrument = z.infer<typeof insertInstrumentSchema>;
export type Instrument = typeof instruments.$inferSelect;

// ─── Chakras ──────────────────────────────────────────────────────────────────
export const chakras = sqliteTable("chakras", {
  id: text("id").primaryKey(), // e.g. CH-HEART
  sanskrit: text("sanskrit").notNull(),
  sanskritMeaning: text("sanskrit_meaning"),
  locationPhysical: text("location_physical"),
  locationSpinal: text("location_spinal"),
  element: text("element"),
  fingerCorrespondence: text("finger_correspondence"),
  colorTraditional: text("color_traditional"),
  colorHex: text("color_hex"),
  colorCoustoWavelength: text("color_cousto_wavelength"),
  bijaMantraShort: text("bija_mantra_short"),
  bijaMantraLong: text("bija_mantra_long"),
  vowelSound: text("vowel_sound"),
  affirmationEnglish: text("affirmation_english"),
  devata: text("devata"),
  devataMantra: text("devata_mantra"),
  yantraGeometry: text("yantra_geometry"),
  petalCount: integer("petal_count"),
  themes: text("themes"), // JSON array
  imbalanceSigns: text("imbalance_signs"), // JSON {excess, deficiency}
  physicalCorrelates: text("physical_correlates"), // JSON array
  asanas: text("asanas"), // JSON array
  pranayamaPrimary: text("pranayama_primary"),
  pranayamaGentler: text("pranayama_gentler"),
  mudra: text("mudra"),
  mudraAlt: text("mudra_alt"),
  bandha: text("bandha"),
  frequencyCousto: real("frequency_cousto"),
  frequencySolfeggio: real("frequency_solfeggio"),
  frequencyWestern: text("frequency_western"),
  frequencyBowl: real("frequency_bowl"),
  frequencyPractitioner: real("frequency_practitioner"),
  recommendedForks: text("recommended_forks"), // JSON array of instrument IDs
  placementGuide: text("placement_guide"), // JSON {front, back, lateral, field, surrogate}
  layeringPattern: text("layering_pattern"), // JSON array
  comfortTierGuidance: text("comfort_tier_guidance"),
  practitionerObservations: text("practitioner_observations"),
  sourceReferences: text("source_references"), // JSON array
  sortOrder: integer("sort_order"),
});

export const insertChakraSchema = createInsertSchema(chakras);
export type InsertChakra = z.infer<typeof insertChakraSchema>;
export type Chakra = typeof chakras.$inferSelect;

// ─── Biofield Zones ────────────────────────────────────────────────────────────
export const biofieldZones = sqliteTable("biofield_zones", {
  id: text("id").primaryKey(), // e.g. BF-SACRAL-LEFT
  label: text("label").notNull(),
  location: text("location").notNull(),
  fieldSide: text("field_side").notNull(), // left | right | front | back | center
  themes: text("themes"), // JSON array
  physicalCorrelates: text("physical_correlates"),
  suggestedForks: text("suggested_forks"), // JSON array of instrument IDs
  techniqueLocate: text("technique_locate"),
  techniqueListen: text("technique_listen"),
  techniqueTreat: text("technique_treat"),
  techniqueIntegrate: text("technique_integrate"),
  techniqueClose: text("technique_close"),
  sourceAttribution: text("source_attribution"),
});

export const insertBiofieldZoneSchema = createInsertSchema(biofieldZones);
export type InsertBiofieldZone = z.infer<typeof insertBiofieldZoneSchema>;
export type BiofieldZone = typeof biofieldZones.$inferSelect;

// ─── Ayurveda / Elements ───────────────────────────────────────────────────────
export const ayurvedaElements = sqliteTable("ayurveda_elements", {
  id: text("id").primaryKey(), // e.g. AY-EARTH
  name: text("name").notNull(),
  type: text("type").notNull(), // element | dosha
  sanskrit: text("sanskrit"),
  qualities: text("qualities"), // JSON array
  fingerCorrespondence: text("finger_correspondence"),
  chakraLink: text("chakra_link"),
  doshaPrimary: text("dosha_primary"),
  season: text("season"),
  taste: text("taste"),
  bodyType: text("body_type"),
  balancingForks: text("balancing_forks"), // JSON array
  imbalanceSigns: text("imbalance_signs"),
  practices: text("practices"), // JSON array
  colorHex: text("color_hex"),
  description: text("description"),
});

export const insertAyurvedaElementSchema = createInsertSchema(ayurvedaElements);
export type InsertAyurvedaElement = z.infer<typeof insertAyurvedaElementSchema>;
export type AyurvedaElement = typeof ayurvedaElements.$inferSelect;

// ─── Centers (Gurdjieff) ───────────────────────────────────────────────────────
export const centers = sqliteTable("centers", {
  id: text("id").primaryKey(), // e.g. CTR-EMOTIONAL-LOWER
  name: text("name").notNull(),
  category: text("category").notNull(), // physical | emotional | intellectual
  manNumber: text("man_number"), // "1" | "2" | "3" | "higher"
  description: text("description"),
  characteristics: text("characteristics"), // JSON array
  dominantBehaviors: text("dominant_behaviors"), // JSON array
  suggestedForks: text("suggested_forks"), // JSON array
  practitionerNotes: text("practitioner_notes"),
  questionnaireResponses: text("questionnaire_responses"), // JSON array (which Q responses map here)
});

export const insertCenterSchema = createInsertSchema(centers);
export type InsertCenter = z.infer<typeof insertCenterSchema>;
export type Center = typeof centers.$inferSelect;

// ─── Client Profiles ──────────────────────────────────────────────────────────
export const clientProfiles = sqliteTable("client_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  age: integer("age"),
  createdAt: text("created_at").notNull(),
  notes: text("notes"),
  // Gene Keys Radiance sphere (optional)
  birthDate: text("birth_date"),       // ISO "YYYY-MM-DD"
  birthTime: text("birth_time"),       // "HH:MM" 24h, optional — improves line precision
  birthPlace: text("birth_place"),     // free text, for reference
});

export const insertClientProfileSchema = createInsertSchema(clientProfiles).omit({ id: true });
export type InsertClientProfile = z.infer<typeof insertClientProfileSchema>;
export type ClientProfile = typeof clientProfiles.$inferSelect;

// ─── Questionnaire Responses ───────────────────────────────────────────────────
export const questionnaireResponses = sqliteTable("questionnaire_responses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id"),
  sessionDate: text("session_date").notNull(),
  // S1
  clientName: text("client_name"),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  practitionerName: text("practitioner_name"),
  priorExperience: text("prior_experience"),
  clientAge: integer("client_age"),
  pregnancyStatus: text("pregnancy_status"),
  // S2 safety
  hasPacemaker: integer("has_pacemaker"), // 0/1
  recentSurgery: integer("recent_surgery"),
  hasEpilepsy: integer("has_epilepsy"),
  soundSensitivity: integer("sound_sensitivity"),
  acuteCrisis: integer("acute_crisis"),
  implantedDevice: integer("implanted_device"),
  otherMedical: text("other_medical"),
  sensoryMeds: text("sensory_meds"),
  // S3 intention
  intentionText: text("intention_text"),
  receiveText: text("receive_text"),
  focusAreas: text("focus_areas"), // JSON array
  attentionAreas: text("attention_areas"), // free text from the remote intake
  // S4 ratings
  physicalEnergy: integer("physical_energy"),
  mentalClarity: integer("mental_clarity"),
  emotionalSteadiness: integer("emotional_steadiness"),
  sleepQuality: integer("sleep_quality"),
  stressLevel: integer("stress_level"),
  // S5 dosha
  doshaBody: text("dosha_body"),
  doshaMind: text("dosha_mind"),
  doshaSleep: text("dosha_sleep"),
  doshaAppetite: text("dosha_appetite"),
  doshaEnergy: text("dosha_energy"),
  doshaEmotions: text("dosha_emotions"),
  // S6 centers
  centerDecisions: text("center_decisions"),
  centerStress: text("center_stress"),
  centerLearning: text("center_learning"),
  centerTrust: text("center_trust"),
  centerNeglected: text("center_neglected"),
  centerSelf: text("center_self"),
  // S7 preferences
  bodyContact: text("body_contact"),
  clothedPreference: text("clothed_preference"),
  vocalization: text("vocalization"),
  chakraFamiliarity: text("chakra_familiarity"),
  affirmationLanguage: text("affirmation_language"),
  sensoryNotes: text("sensory_notes"),
  otherNotes: text("other_notes"),
  // S8 consent
  consentGiven: integer("consent_given"),
  // Gene Keys Radiance (optional)
  birthDate: text("birth_date"),   // ISO "YYYY-MM-DD"
  birthTime: text("birth_time"),   // "HH:MM" 24h, optional
  birthPlace: text("birth_place"), // free text, for reference
  // Auto-outputs
  contraindicationFlags: text("contraindication_flags"), // JSON array
  dominantDosha: text("dominant_dosha"),
  dominantCenter: text("dominant_center"),
  suggestedChakraFocus: text("suggested_chakra_focus"),
  recommendedComfortTier: integer("recommended_comfort_tier"),
  recommendedProtocolId: text("recommended_protocol_id"),
});

export const insertQuestionnaireSchema = createInsertSchema(questionnaireResponses).omit({ id: true });
export type InsertQuestionnaire = z.infer<typeof insertQuestionnaireSchema>;
export type QuestionnaireResponse = typeof questionnaireResponses.$inferSelect;

// ─── Protocol Templates ────────────────────────────────────────────────────────
export const protocolTemplates = sqliteTable("protocol_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  goal: text("goal").notNull(),
  description: text("description"),
  goalTags: text("goal_tags"), // JSON array
  doshaTags: text("dosha_tags"), // JSON array
  chakraFocus: text("chakra_focus"), // JSON array
  comfortTierMin: integer("comfort_tier_min"),
  comfortTierMax: integer("comfort_tier_max"),
  phases: text("phases").notNull(), // JSON array of phase objects
  universalOpener: integer("universal_opener").default(1),
  universalCloser: integer("universal_closer").default(1),
  estimatedDuration: integer("estimated_duration"), // minutes
  sortOrder: integer("sort_order"),
});

export const insertProtocolTemplateSchema = createInsertSchema(protocolTemplates);
export type InsertProtocolTemplate = z.infer<typeof insertProtocolTemplateSchema>;
export type ProtocolTemplate = typeof protocolTemplates.$inferSelect;

// ─── Session Logs ──────────────────────────────────────────────────────────────
export const sessionLogs = sqliteTable("session_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionDate: text("session_date").notNull(),
  clientId: integer("client_id"),
  clientName: text("client_name"),
  questionnaireId: integer("questionnaire_id"),
  goalPresentingNeed: text("goal_presenting_need"),
  selectedProtocolId: text("selected_protocol_id"),
  actualInstrumentsUsed: text("actual_instruments_used"), // JSON array of IDs
  deviationsFromProtocol: text("deviations_from_protocol"),
  observedResponse: text("observed_response"),
  outcomeNotes: text("outcome_notes"),
  followUpNotes: text("follow_up_notes"),
  wouldRepeat: integer("would_repeat"), // 0/1
  lessonsLearned: text("lessons_learned"),
  createdAt: text("created_at").notNull(),
});

export const insertSessionLogSchema = createInsertSchema(sessionLogs).omit({ id: true });
export type InsertSessionLog = z.infer<typeof insertSessionLogSchema>;
export type SessionLog = typeof sessionLogs.$inferSelect;

// ─── Soundscape Compositions ───────────────────────────────────────────────────
export const soundscapes = sqliteTable("soundscapes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  duration: integer("duration"), // seconds
  tracks: text("tracks").notNull(), // JSON array of track objects
  linkedInstrumentIds: text("linked_instrument_ids"), // JSON array
  goalTags: text("goal_tags"), // JSON array
  doshaTags: text("dosha_tags"), // JSON array
  comfortTier: integer("comfort_tier"),
  notes: text("notes"),
  creator: text("creator"),
  version: integer("version").default(1),
  createdAt: text("created_at").notNull(),
  renderedExportFile: text("rendered_export_file"),
});

export const insertSoundscapeSchema = createInsertSchema(soundscapes).omit({ id: true });
export type InsertSoundscape = z.infer<typeof insertSoundscapeSchema>;
export type Soundscape = typeof soundscapes.$inferSelect;

// ─── Nexus Memory ─────────────────────────────────────────────────────────────
// Global single-row memory for the Nexus AI — keyed by a fixed key "default"
// for beta. At scale, swap in practitioner_id.
export const nexusMemory = sqliteTable("nexus_memory", {
  key: text("key").primaryKey(),        // always "default" in beta
  memory: text("memory").notNull().default(""),  // compressed practitioner profile
  updatedAt: text("updated_at").notNull(),
});
export type NexusMemory = typeof nexusMemory.$inferSelect;

// ─── Koshas (7 Sheaths) ───────────────────────────────────────────────────────
export const koshas = sqliteTable("koshas", {
  id: text("id").primaryKey(),              // e.g. KO-1-ANNAMAYA
  layerNumber: integer("layer_number").notNull(), // 1–7
  sanskritName: text("sanskrit_name").notNull(),  // e.g. Annamaya Kosha
  englishName: text("english_name").notNull(),    // e.g. Physical / Food Body
  theosophicalName: text("theosophical_name"),    // e.g. Physical/Etheric Body
  brennanLevel: text("brennan_level"),            // e.g. Etheric Body (Level 1)
  geneKeySeal: text("gene_key_seal"),             // e.g. First Seal — Divine Will (GK 40)
  geneKeySiddhi: text("gene_key_siddhi"),         // e.g. GK 40 — Divine Will
  geneKeyShadow: text("gene_key_shadow"),         // e.g. Exhaustion
  geneKeyGift: text("gene_key_gift"),             // e.g. Resolve
  domain: text("domain").notNull(),               // what this body governs
  governingPrinciple: text("governing_principle"), // Sanskrit principle
  vibrationalQuality: text("vibrational_quality"),
  frequencyRange: text("frequency_range"),        // e.g. "0–20 Hz"
  biofieldPosition: text("biofield_position"),    // e.g. "0–2 inches from body"
  chakraId: text("chakra_id"),                    // FK to chakras
  soundHealingInteraction: text("sound_healing_interaction"), // how sound affects it
  primaryInstruments: text("primary_instruments").notNull(), // JSON array of instrument IDs
  secondaryInstruments: text("secondary_instruments"),       // JSON array of instrument IDs
  applicationMode: text("application_mode").notNull(),       // how to apply instruments
  colorHex: text("color_hex"),                    // visual color for this layer
  isExtendedKosha: integer("is_extended_kosha", { mode: "boolean" }), // true for layers 6+7
  sortOrder: integer("sort_order").notNull(),
});

export const insertKoshaSchema = createInsertSchema(koshas);
export type InsertKosha = z.infer<typeof insertKoshaSchema>;
export type Kosha = typeof koshas.$inferSelect;
