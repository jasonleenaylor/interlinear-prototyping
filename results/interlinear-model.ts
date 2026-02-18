/**
 * Unified Interlinear Model
 *
 * A common representation for interlinear data from LCM (FieldWorks),
 * Paratext 9, and BT Extension. Designed for export/import — not a
 * round-trip of any single system's internal structures.
 *
 * See unified-model-proposal.md for full source-system mappings and
 * migration risk analysis.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Whether an occurrence position holds a word or punctuation. */
export enum OccurrenceType {
  Word = "word",
  Punctuation = "punctuation",
}

/** The kind of linguistic analysis represented. */
export enum AnalysisType {
  /** Surface wordform only — no gloss or morpheme breakdown. */
  Wordform = "wordform",
  /** Morpheme-level analysis with MorphemeBundles. */
  Morph = "morph",
  /** Word-level gloss (no morpheme decomposition). */
  Gloss = "gloss",
  /** Punctuation placeholder. */
  Punctuation = "punctuation",
}

/**
 * How the analysis was produced.
 *
 * - `high`   — human-created or human-confirmed.
 * - `medium` — AI / tool-assisted with moderate certainty.
 * - `low`    — AI / tool-assisted with low certainty.
 * - `guess`  — unreviewed machine suggestion.
 */
export enum Confidence {
  Guess = "guess",
  Low = "low",
  Medium = "medium",
  High = "high",
}

/** Whether a human has confirmed an analysis assignment for an occurrence. */
export enum AssignmentStatus {
  Approved = "approved",
  Suggested = "suggested",
}

/** Approval state of an alignment link. */
export enum AlignmentStatus {
  Approved = "approved",
  Candidate = "candidate",
  Rejected = "rejected",
}

// ---------------------------------------------------------------------------
// §1.1 Interlinear
// ---------------------------------------------------------------------------

/**
 * Top-level container for all interlinear data.
 *
 * Source-system mapping:
 * - LCM: one `IScripture` instance (singleton per project).
 * - Paratext: merged from per-book, per-language `InterlinearData` files.
 * - BT Extension: one `Translation` (project scope).
 */
export interface Interlinear {
  interlinearId: string;

  /** Writing system of the source text being analyzed. */
  sourceWritingSystem: string;

  /**
   * Writing systems in which analyses are provided (e.g. `["en", "fr"]`).
   * A single interlinear can hold analyses in multiple languages.
   */
  analysisLanguages: string[];

  /** Books of scripture (or other texts) that have been analyzed. */
  books: AnalyzedBook[];
}

// ---------------------------------------------------------------------------
// §1.2 AnalyzedBook
// ---------------------------------------------------------------------------

/**
 * One book of scripture (or other text unit) analyzed within an Interlinear.
 *
 * Source-system mapping:
 * - LCM: `IScrBook`. `bookRef` = `BookId` (3-letter SIL code).
 * - Paratext: book-level `InterlinearData` (merged across languages).
 * - BT Extension: one book within a `Translation`.
 */
export interface AnalyzedBook {
  analyzedBookId: string;

  /** Book identifier (e.g. `"GEN"`, `"MAT"`). */
  bookRef: string;

  /**
   * Hash or version stamp of the source text at analysis time.
   * Used to detect when the underlying text has changed and analyses
   * may be stale.
   */
  textVersion: string;

  /** Ordered segments that compose this book. */
  segments: Segment[];
}

// ---------------------------------------------------------------------------
// §1.3 Segment
// ---------------------------------------------------------------------------

/**
 * A sentence, clause, or verse — the unit within which occurrences are
 * ordered.
 *
 * Source-system mapping:
 * - LCM: `ISegment` owned by `IScrTxtPara` within `IScrSection`.
 * - Paratext: a verse (`VerseRef`) within `VerseData`.
 * - BT Extension: a `Verse` (BCV identifier).
 */
export interface Segment {
  segmentId: string;

  /**
   * Canonical reference (e.g. verse reference, paragraph index + offset
   * range).
   */
  segmentRef: string;

  /** Raw text of the segment, for display and validation. */
  baselineText?: string;

  /** Idiomatic translation of the segment. */
  freeTranslation?: MultiString;

  /** Word-for-word translation. */
  literalTranslation?: MultiString;

  /** Ordered word / punctuation tokens in this segment. */
  occurrences: Occurrence[];
}

/** A string value keyed by writing-system tag. */
export type MultiString = Record<string, string>;

// ---------------------------------------------------------------------------
// §1.4 Occurrence
// ---------------------------------------------------------------------------

/**
 * A single word or punctuation token at a specific position in the text.
 * Inherits its text version from the parent AnalyzedBook.
 *
 * Source-system mapping:
 * - LCM: entry in `ISegment.AnalysesRS` at a given index.
 * - Paratext: `ClusterData` within `VerseData`.
 * - BT Extension: `Token` (API) / `Instance` (DB).
 */
export interface Occurrence {
  occurrenceId: string;

  /** Parent segment. */
  segmentId: string;

  /** Zero-based position within the segment (preserves word order). */
  index: number;

  /**
   * Positional anchor in the source text.
   * Supports BCVWP, BCVWP+partNum, StringRange, or character offset
   * depending on source system.
   */
  anchor: string;

  /** The text as it appears in the source. */
  surfaceText: string;

  /** Writing system of `surfaceText`. */
  writingSystem: string;

  type: OccurrenceType;

  /** All analysis assignments for this occurrence (zero or more). */
  assignments: AnalysisAssignment[];
}

// ---------------------------------------------------------------------------
// §1.5 Analysis
// ---------------------------------------------------------------------------

/**
 * A reusable analysis describing a linguistic interpretation of a word.
 * The same analysis can be assigned to many occurrences.
 *
 * Confidence and provenance belong to the analysis itself because they
 * describe how the interpretation was produced.
 *
 * Source-system mapping:
 * - LCM: `IWfiAnalysis` (morph), `IWfiGloss` (gloss), or bare
 *   `IWfiWordform` (wordform).
 * - Paratext: `LexemeCluster` + `WordAnalysis`.
 * - BT Extension: synthesized from `Token.gloss` / `lemmaText` /
 *   `senseIds`. Requires deduplication — BT Extension stores
 *   gloss/sense per-token, not as shared analysis objects.
 */
export interface Analysis {
  analysisId: string;

  /** Writing system of the analysis (e.g. the gloss language). */
  analysisLanguage: string;

  analysisType: AnalysisType;

  confidence: Confidence;

  /**
   * Provenance of the analysis, combining system and creator.
   * Format: `system:creator`
   * (e.g. `"lcm:parser-v3"`, `"paratext:jsmith"`,
   *  `"bt-extension:human"`, `"ai:gpt-4"`).
   */
  origin: string;

  /** Word-level gloss text. */
  glossText?: string;

  /** Part of speech. */
  pos?: string;

  /** Morphosyntactic feature structure. */
  features?: Record<string, unknown>;

  /**
   * Ordered morpheme breakdown, when analysis is at the morpheme level
   * (`analysisType = morph`).
   */
  morphemeBundles?: MorphemeBundle[];
}

// ---------------------------------------------------------------------------
// §1.6 AnalysisAssignment
// ---------------------------------------------------------------------------

/**
 * The join between an occurrence and an analysis. Multiple assignments per
 * occurrence enable competing analyses.
 *
 * Source-system mapping:
 * - LCM: `ISegment.AnalysesRS[i]` referencing `IWfiGloss` or
 *   `IWfiAnalysis`.
 * - Paratext: `ClusterData` with selected `LexemeData`.
 * - BT Extension: `Token` linked to senses (`senseIds`). Status inferred
 *   from `Instance.termStatusNum` (BiblicalTermStatus enum).
 */
export interface AnalysisAssignment {
  assignmentId: string;

  /** The occurrence being analyzed. */
  occurrenceId: string;

  /** The analysis applied. */
  analysisId: string;

  /** Whether a human has confirmed this analysis for this occurrence. */
  status: AssignmentStatus;

  /** Timestamp of when the assignment was made. */
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// §1.7 MorphemeBundle
// ---------------------------------------------------------------------------

/**
 * An ordered morpheme within a morpheme-level analysis, linking to the
 * lexicon.
 *
 * The four optional lexicon references mirror LCM's `IWfiMorphBundle`
 * three-way link plus the owning entry:
 *
 *   `allomorphRef` → `IMoForm`              (which surface form / allomorph)
 *   `lexemeRef`    → `ILexEntry`             (owning dictionary entry)
 *   `senseRef`     → `ILexSense`             (which meaning)
 *   `grammarRef`   → `IMoMorphSynAnalysis`   (grammatical behaviour)
 *
 * In LCM an `ILexEntry` owns one *LexemeForm* (the elsewhere / citation
 * allomorph) and zero-or-more *AlternateForms* — both are `IMoForm`.
 * `allomorphRef` identifies the specific `IMoForm` matched in this
 * context; `lexemeRef` identifies the entry that owns it.
 *
 * `form` vs `allomorphRef` — `form` is the surface text of the
 * morpheme as it appeared in this specific analysis context.
 * `allomorphRef` is a reference (ID) to the canonical allomorph
 * object in the lexicon.  These can legitimately differ: in LCM
 * `IWfiMorphBundle.Form` may reflect phonological conditioning
 * that differs from the canonical `IMoForm.Form`.  When
 * `allomorphRef` is absent, `form` is the only record of the
 * morpheme shape.
 *
 * Source-system mapping:
 * - LCM: `IWfiMorphBundle` (1:1). `allomorphRef` = GUID of
 *   `IWfiMorphBundle.MorphRA` (`IMoForm`). `lexemeRef` = GUID of the
 *   `ILexEntry` that owns that `IMoForm` (via `LexemeFormOA` or
 *   `AlternateFormsOS`).
 * - Paratext: each `Lexeme` within a `WordAnalysis`. Paratext's
 *   built-in XML lexicon has no allomorph concept distinct from the
 *   entry — `Lexeme.AlternateForms` exists in the interface but
 *   returns empty. `allomorphRef` is therefore omitted for the
 *   built-in lexicon. When an integrated provider (e.g. FLEx via
 *   `IntegratedLexicalProvider`) is active, `AllomorphEntry`
 *   surfaces actual allomorphs and `allomorphRef` can be populated.
 *   `lexemeRef` = `Lexeme.Id` (LexemeKey-derived).
 * - BT Extension: not natively modeled as morpheme bundles. A
 *   whole-word bundle can be synthesized: `form` = `Token.text`,
 *   `allomorphRef` = `headwordId` (the BT Extension "morph" concept
 *   corresponds to the FieldWorks Allomorph; the HeadWord's lemma is
 *   the elsewhere / LexemeForm allomorph), `lexemeRef` = `headwordId`,
 *   `senseRef` = `senseIds[0]`. Macula TSV `morph` field can supply
 *   the specific allomorphic form when it differs from the lemma.
 */
export interface MorphemeBundle {
  bundleId: string;

  /** Zero-based position within the analysis (preserves morpheme order). */
  index: number;

  /** The morpheme form as it appears in this analysis (surface text). */
  form: string;

  /** Writing system of `form`. */
  writingSystem: string;

  /**
   * Reference to a specific Allomorph (`IMoForm`) in the lexical model.
   *
   * An `ILexEntry` in LCM owns one *LexemeForm* (the elsewhere / citation
   * allomorph) and zero-or-more *AlternateForms*. This field identifies
   * which allomorph was matched in this morpheme position.
   *
   * In the BT Extension the "morph" concept aligns with this field:
   * the HeadWord's lemma acts as the LexemeForm (elsewhere allomorph).
   */
  allomorphRef?: string;

  /** Reference to Lexeme (`ILexEntry`) in the lexical model. */
  lexemeRef?: string;

  /** Reference to Sense (`ILexSense`) in the lexical model. */
  senseRef?: string;

  /** Reference to Grammar / MSA (`IMoMorphSynAnalysis`) in the lexical model. */
  grammarRef?: string;
}

// ---------------------------------------------------------------------------
// §1.8 Alignment
// ---------------------------------------------------------------------------

/**
 * Links occurrences across translations (source ↔ target).
 *
 * Source-system mapping:
 * - LCM: no native alignment model; present only if an external tool
 *   produced them.
 * - Paratext: not stored in interlinear data; can be derived from parallel
 *   interlinear selections.
 * - BT Extension: `Alignment` entity maps directly. `status` from
 *   `statusNum` via `AlignmentStatus` enum (CREATED=0, REJECTED=1,
 *   APPROVED=2, NEEDS_REVIEW=3) — lossy mapping where both CREATED and
 *   NEEDS_REVIEW collapse to `candidate`. `origin` from `originNum` —
 *   an undocumented integer with no enum.
 *
 *   **Allomorph-level note:** BT Extension alignments link *tokens*
 *   (source ↔ target), where each source token's morphological form
 *   (the "morph" concept in BT Extension) corresponds to a FieldWorks
 *   Allomorph (`IMoForm`). The HeadWord's lemma is the LexemeForm
 *   (elsewhere allomorph). When converting BT Extension alignments
 *   into the unified model, the aligned source occurrence can be
 *   further resolved to a `MorphemeBundle.allomorphRef` if morpheme-
 *   level analysis is also present, creating a richer link chain:
 *   Alignment → Occurrence → Analysis → MorphemeBundle → allomorphRef.
 */
export interface Alignment {
  alignmentId: string;

  /** Occurrence IDs on the source side. */
  sourceOccurrences: string[];

  /** Occurrence IDs on the target side. */
  targetOccurrences: string[];

  /** How the alignment was created (manual, automatic, etc.). */
  origin?: string;

  status: AlignmentStatus;

  /** Free-text annotation. */
  notes?: string;
}
