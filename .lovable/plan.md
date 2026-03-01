# Two-Phase Screenplay Intelligence System

## Architecture Overview
Phase 1 (Pre-Vision Lock): Objective parse — extract entities exactly as written, no aesthetic interpretation
Phase 2 (Post-Vision Lock): Style enrichment — apply Director DNA, Production Bible, Style Contract

## Phase 1 — Objective Parse Engine

### Entity Classification Model (13 categories)
- CHARACTER, LOCATION, VEHICLE, PROP, WARDROBE, ANIMAL
- PRACTICAL_LIGHT_SOURCE, SOUND_EVENT, ENVIRONMENTAL_CONDITION
- DOCUMENT, WEAPON, DEVICE, FOOD_OR_DRINK

### Entity Normalization System
- Character canonicalization (aliases, titles, first-name resolution)
- Vehicle canonicalization (possessive forms, generic references)
- Location canonicalization (base + sublocations)
- Prop grouping & ownership (character/location association)
- Wardrobe state tracking (character + scene state changes)

### Phase 1 Extraction Requirements
**Scene Data:** scene_number, INT/EXT, location, sublocation, time_of_day, continuity_marker, flashback/dream/montage flags, scene_length, dialogue_density
**Character Metrics:** first_appearance, total_scenes, dialogue_lines, dialogue_word_count, interruptions, emotional_descriptors, action_verbs
**Object & Logistics:** vehicles, weapons, devices, documents, practical_lights, weather, crowd, stunt, blood/injury, fire/smoke, animals

### Database Schema
- `script_entities`: master entity registry with canonical names, aliases, metadata per type
- `scene_entity_links`: per-scene entity associations with contextual data
- `parsed_scenes`: structural columns for sublocation, continuity_marker, is_flashback, is_dream, is_montage, dialogue metrics, phase1_locked

### Implementation Order
1. [x] Database migration: script_entities + scene_entity_links + parsed_scenes structural columns
2. [x] Rewrite parse-script: split scenes + deterministic heading parse + dialogue metrics (NO enrichment trigger)
3. [x] extract-entities edge function: AI-assisted entity extraction into 13 categories (no style)
4. [x] Entity normalization logic in _shared/entity-normalization.ts
5. [x] Stop auto-enrichment in Development.tsx during upload
6. [x] Lock Vision handler: persist ai_notes_approved, compile style contract, run Phase 2 enrichment
7. [ ] Wire extract-entities call into Development.tsx as explicit Phase 1 step (after Lock Fundamentals)
8. [ ] Update finalize-analysis for Phase 1 output schema
9. [x] Update GlobalElementsManager to use entity registry

## Phase 2 — Style Enrichment Engine (Post-Vision Lock)
1. [ ] Scene style overlay computation from Style Contract + Director DNA
2. [ ] Axis-to-department mapping enforcement
3. [ ] Style Contract assembly
4. [ ] Modify enrich-scene to become Phase 2 only (requires style contract inputs)
5. [ ] Update Lock Vision handler to trigger Phase 2 pipeline

## Critical Validation Requirements
- Duplicate entity detection
- Alias resolution confidence scoring
- Ambiguity flagging for human review
- No cross-category contamination
- Canonical entity ID stability across regeneration

## Separation Enforcement
- Phase 1 data immutable once locked
- Phase 2 reads but never modifies Phase 1 entity IDs
- Style updates regenerate scene_style_profiles but never re-parse entities
