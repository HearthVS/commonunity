import { db } from "./db";
import { sql } from "drizzle-orm";

export function runMigrations() {
  // Create all tables if they don't exist
  db.run(sql`CREATE TABLE IF NOT EXISTS instruments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    weighting TEXT NOT NULL,
    frequency REAL NOT NULL,
    frequency_harmonic REAL,
    lineage TEXT NOT NULL,
    image_filename TEXT,
    audio_filename TEXT,
    master_explainer TEXT NOT NULL,
    healing_benefits TEXT NOT NULL,
    session_role TEXT NOT NULL,
    contraindications TEXT NOT NULL,
    contra_note TEXT,
    notes TEXT NOT NULL,
    tone_name TEXT,
    color_hex TEXT,
    color_name TEXT,
    color_wavelength TEXT,
    application_points TEXT,
    dosha_tags TEXT,
    center_affinity_tags TEXT,
    elemental_association TEXT,
    source_reference TEXT,
    chakra_id TEXT,
    closest_chakra_alignment INTEGER DEFAULT 0
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS chakras (
    id TEXT PRIMARY KEY,
    sanskrit TEXT NOT NULL,
    sanskrit_meaning TEXT,
    location_physical TEXT,
    location_spinal TEXT,
    element TEXT,
    finger_correspondence TEXT,
    color_traditional TEXT,
    color_hex TEXT,
    color_cousto_wavelength TEXT,
    bija_mantra_short TEXT,
    bija_mantra_long TEXT,
    vowel_sound TEXT,
    affirmation_english TEXT,
    devata TEXT,
    devata_mantra TEXT,
    yantra_geometry TEXT,
    petal_count INTEGER,
    themes TEXT,
    imbalance_signs TEXT,
    physical_correlates TEXT,
    asanas TEXT,
    pranayama_primary TEXT,
    pranayama_gentler TEXT,
    mudra TEXT,
    mudra_alt TEXT,
    bandha TEXT,
    frequency_cousto REAL,
    frequency_solfeggio REAL,
    frequency_western TEXT,
    frequency_bowl REAL,
    frequency_practitioner REAL,
    recommended_forks TEXT,
    placement_guide TEXT,
    layering_pattern TEXT,
    comfort_tier_guidance TEXT,
    practitioner_observations TEXT,
    source_references TEXT,
    sort_order INTEGER
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS biofield_zones (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    location TEXT NOT NULL,
    field_side TEXT NOT NULL,
    themes TEXT,
    physical_correlates TEXT,
    suggested_forks TEXT,
    technique_locate TEXT,
    technique_listen TEXT,
    technique_treat TEXT,
    technique_integrate TEXT,
    technique_close TEXT,
    source_attribution TEXT
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS ayurveda_elements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    sanskrit TEXT,
    qualities TEXT,
    finger_correspondence TEXT,
    chakra_link TEXT,
    dosha_primary TEXT,
    season TEXT,
    taste TEXT,
    body_type TEXT,
    balancing_forks TEXT,
    imbalance_signs TEXT,
    practices TEXT,
    color_hex TEXT,
    description TEXT
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS centers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    man_number TEXT,
    description TEXT,
    characteristics TEXT,
    dominant_behaviors TEXT,
    suggested_forks TEXT,
    practitioner_notes TEXT,
    questionnaire_responses TEXT
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS client_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER,
    created_at TEXT NOT NULL,
    notes TEXT
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    session_date TEXT NOT NULL,
    client_name TEXT,
    client_age INTEGER,
    pregnancy_status TEXT,
    has_pacemaker INTEGER,
    recent_surgery INTEGER,
    has_epilepsy INTEGER,
    sound_sensitivity INTEGER,
    acute_crisis INTEGER,
    other_medical TEXT,
    sensory_meds TEXT,
    intention_text TEXT,
    receive_text TEXT,
    focus_areas TEXT,
    physical_energy INTEGER,
    mental_clarity INTEGER,
    emotional_steadiness INTEGER,
    sleep_quality INTEGER,
    stress_level INTEGER,
    dosha_body TEXT, dosha_mind TEXT, dosha_sleep TEXT,
    dosha_appetite TEXT, dosha_energy TEXT, dosha_emotions TEXT,
    center_decisions TEXT, center_stress TEXT, center_learning TEXT,
    center_trust TEXT, center_neglected TEXT, center_self TEXT,
    body_contact TEXT, clothed_preference TEXT, vocalization TEXT,
    chakra_familiarity TEXT, affirmation_language TEXT,
    sensory_notes TEXT, other_notes TEXT,
    consent_given INTEGER,
    contraindication_flags TEXT,
    dominant_dosha TEXT,
    dominant_center TEXT,
    suggested_chakra_focus TEXT,
    recommended_comfort_tier INTEGER,
    recommended_protocol_id TEXT
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS protocol_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    goal TEXT NOT NULL,
    description TEXT,
    goal_tags TEXT,
    dosha_tags TEXT,
    chakra_focus TEXT,
    comfort_tier_min INTEGER,
    comfort_tier_max INTEGER,
    phases TEXT NOT NULL,
    universal_opener INTEGER DEFAULT 1,
    universal_closer INTEGER DEFAULT 1,
    estimated_duration INTEGER,
    sort_order INTEGER
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS session_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_date TEXT NOT NULL,
    client_id INTEGER,
    client_name TEXT,
    questionnaire_id INTEGER,
    goal_presenting_need TEXT,
    selected_protocol_id TEXT,
    actual_instruments_used TEXT,
    deviations_from_protocol TEXT,
    observed_response TEXT,
    outcome_notes TEXT,
    follow_up_notes TEXT,
    would_repeat INTEGER,
    lessons_learned TEXT,
    created_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS soundscapes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    duration INTEGER,
    tracks TEXT NOT NULL,
    linked_instrument_ids TEXT,
    goal_tags TEXT,
    dosha_tags TEXT,
    comfort_tier INTEGER,
    notes TEXT,
    creator TEXT,
    version INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    rendered_export_file TEXT
  )`);

  // Add closest_chakra_alignment column if missing (migration for existing DBs)
  try {
    db.run(sql`ALTER TABLE instruments ADD COLUMN closest_chakra_alignment INTEGER DEFAULT 0`);
  } catch (_) { /* column already exists */ }

  // Gene Keys Radiance — birth data columns (migration for existing DBs)
  try {
    db.run(sql`ALTER TABLE client_profiles ADD COLUMN birth_date TEXT`);
  } catch (_) { /* column already exists */ }
  try {
    db.run(sql`ALTER TABLE client_profiles ADD COLUMN birth_time TEXT`);
  } catch (_) { /* column already exists */ }
  try {
    db.run(sql`ALTER TABLE client_profiles ADD COLUMN birth_place TEXT`);
  } catch (_) { /* column already exists */ }

  // Gene Keys Radiance — questionnaire response columns
  try {
    db.run(sql`ALTER TABLE questionnaire_responses ADD COLUMN birth_date TEXT`);
  } catch (_) { /* column already exists */ }
  try {
    db.run(sql`ALTER TABLE questionnaire_responses ADD COLUMN birth_time TEXT`);
  } catch (_) { /* column already exists */ }
  try {
    db.run(sql`ALTER TABLE questionnaire_responses ADD COLUMN birth_place TEXT`);
  } catch (_) { /* column already exists */ }

  // Remote intake fields that were collected but had no column to land in
  for (const col of [
    "client_email TEXT", "client_phone TEXT", "implanted_device INTEGER", "attention_areas TEXT",
  ]) {
    try {
      db.run(sql.raw(`ALTER TABLE questionnaire_responses ADD COLUMN ${col}`));
    } catch (_) { /* column already exists */ }
  }

  // Nexus AI memory — single-row global store for beta
  db.run(sql`CREATE TABLE IF NOT EXISTS nexus_memory (
    key TEXT PRIMARY KEY,
    memory TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS koshas (
    id TEXT PRIMARY KEY,
    layer_number INTEGER NOT NULL,
    sanskrit_name TEXT NOT NULL,
    english_name TEXT NOT NULL,
    theosophical_name TEXT,
    brennan_level TEXT,
    gene_key_seal TEXT,
    gene_key_siddhi TEXT,
    gene_key_shadow TEXT,
    gene_key_gift TEXT,
    domain TEXT NOT NULL,
    governing_principle TEXT,
    vibrational_quality TEXT,
    frequency_range TEXT,
    biofield_position TEXT,
    chakra_id TEXT,
    sound_healing_interaction TEXT,
    primary_instruments TEXT NOT NULL,
    secondary_instruments TEXT,
    application_mode TEXT NOT NULL,
    color_hex TEXT,
    is_extended_kosha INTEGER DEFAULT 0,
    sort_order INTEGER NOT NULL
  )`);

}
