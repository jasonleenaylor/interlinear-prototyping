/**
 * Interlinearizer Interlinear Model — App copy
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  THIS FILE IS A COPY OF  results/interlinear-model.ts          ║
 * ║                                                                ║
 * ║  The canonical source of truth lives in:                       ║
 * ║    results/interlinear-model.ts                                ║
 * ║                                                                ║
 * ║  The authoritative documentation lives in:                     ║
 * ║    interlinear-model-analyses/unified-model-proposal.md        ║
 * ║                                                                ║
 * ║  SYNC INSTRUCTIONS (for humans and AI agents):                 ║
 * ║  1. All model changes MUST be made in results/interlinear-     ║
 * ║     model.ts first.                                            ║
 * ║  2. After changing the canonical file, copy the full content   ║
 * ║     into this file (lib/interlinear-model.ts), preserving      ║
 * ║     only this header comment block.                            ║
 * ║  3. Update the proposal doc (unified-model-proposal.md) to    ║
 * ║     reflect any structural changes.                            ║
 * ║  4. Update sample data (lib/sample-data.ts) if new required   ║
 * ║     fields were added or existing shapes changed.              ║
 * ║  5. Never edit this file without first editing the canonical   ║
 * ║     source — the two must always be identical (minus this      ║
 * ║     header).                                                   ║
 * ╚══════════════════════════════════════════════════════════════════╝
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
 * - `high`
 * - `medium`
 * - `low`
 * - `guess`
 */
export enum Confidence {
  Guess = "guess",
  Low = "low",
  Medium = "medium",
  High = "high",
}

/**
 * Lifecycle status of an assignment or alignment link.
 *
 * - `approved`  — human-confirmed.
 * - `suggested` — machine-generated or unreviewed.
 * - `candidate` — proposed but not yet reviewed.
 * - `rejected`  — explicitly rejected by a human.
 */
export enum AssignmentStatus {
  Approved = "approved",
  Suggested = "suggested",
  Candidate = "candidate",
  Rejected = "rejected",
}

// ---------------------------------------------------------------------------
// §1.1 Interlinearization
// ---------------------------------------------------------------------------

/**
 * Top-level container for all interlinear data.
 *
 * Source-system mapping:
 * - LCM: one `IScripture` instance (singleton per project).
 * - Paratext: merged from per-book, per-language `InterlinearData` files.
 * - BT Extension: one `Translation` (project scope).
 */
export interface Interlinearization {
  id: string;

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
  id: string;

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
 * A range of text in a book — could be a sentence, clause, or verse —
 * which groups ordered occurrences.
 *
 * Source-system mapping:
 * - LCM: `ISegment` owned by `IScrTxtPara` within `IScrSection`.
 * - Paratext: a verse (`VerseRef`) within `VerseData`.
 * - BT Extension: a `Verse` (BCV identifier).
 */
export interface Segment {
  id: string;

  /** Inclusive start of the text range for this segment, anchored to a specific character position within its verse. */
  startRef: ScriptureRef;

  /** Inclusive end of the text range for this segment, anchored to a specific character position within its verse. */
  endRef: ScriptureRef;

  /** Raw text of the segment, for validation and convenience. */
  baselineText?: string;

  /** Idiomatic translation of the segment. */
  freeTranslation?: MultiString;

  /** Word-for-word translation, can be generated from the analysis glosses. */
  literalTranslation?: MultiString;

  /** Ordered word / punctuation tokens in this segment. */
  occurrences: Occurrence[];
}

/**
 * A character-level scripture reference anchored to a specific position
 * within a verse's baseline text.
 *
 * `charIndex` is the zero-based character offset within the verse's
 * baseline text. When absent the reference is verse-level only.
 */
export interface ScriptureRef {
  book: string;
  chapter: number;
  verse: number;
  /** Optional zero-based character offset within the verse's baseline text. */
  charIndex?: number;
}

/** A string value keyed by BCP 47 writing-system tag. */
export type MultiString = Record<string, string>;

// ---------------------------------------------------------------------------
// §1.4 Occurrence
// ---------------------------------------------------------------------------

/**
 * A single word or punctuation token in a segment's ordered sequence.
 *
 * Source-system mapping:
 * - LCM: entry in `ISegment.AnalysesRS` at a given index.
 * - Paratext: `ClusterData` within `VerseData`.
 * - BT Extension: `Token` (API) / `Instance` (DB).
 */
export interface Occurrence {
  id: string;

  /** The text as it appears in the source. */
  surfaceText: string;

  /** Writing system of `surfaceText`. */
  writingSystem: string;

  /** Whether this token is a word or punctuation. */
  type: OccurrenceType;

  /** The analysis assignment for this occurrence, if one has been made. */
  assignment?: AnalysisAssignment;
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
  id: string;

  analysisType: AnalysisType;

  confidence: Confidence;

  /** Identifies the producer of this analysis — a person or any kind of automated process. */
  producer: string;

  /** Identifies who or what performed this specific analysis — a person's ID or a stable identifier for the process that generated it. */
  sourceUser: string;

  /** Word-level gloss text, keyed by BCP 47 language tag (e.g. `{ en: "beginning" }`). */
  glossText?: MultiString;

  /** Part of speech. */
  pos?: string;

  /** Morphosyntactic features as a flat attribute-value map (e.g. `{ Case: "Nom", Number: "Sg" }`). */
  features?: Record<string, string>;

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
 * Links an occurrence to an analysis, recording who approved it and optionally
 * grouping it with other occurrences into a phrase.
 *
 * **Phrase grouping via `groupId`**
 *
 * When two or more occurrences are glossed or analyzed as a single unit
 * (a phrase, a discontinuous expression, etc.) each occurrence carries
 * its own AnalysisAssignment but all such assignments share the same
 * `groupId`.  Grouped occurrences may be:
 *
 *   - Adjacent within one segment  ("en el" → "in the")
 *   - Disjoint within one segment   (French "ne … pas" → "not")
 *   - Spanning multiple segments     (rare, but permitted)
 *
 * A single-word assignment simply omits `groupId` (or sets it to
 * `undefined`).  The shared Analysis carries the group-level gloss,
 * POS, morpheme bundles, etc.
 *
 * Source-system mapping:
 * - LCM: `ISegment.AnalysesRS[i]` referencing `IWfiGloss` or
 *   `IWfiAnalysis`.  Typically single-occurrence; `groupId` is absent.
 * - Paratext: `ClusterData` with selected `LexemeData`.  Paratext's
 *   `Phrase` cluster type spans multiple words — each word's
 *   assignment shares the same `groupId`.
 * - BT Extension: `Token` linked to senses (`senseIds`). Status
 *   inferred from `Instance.termStatusNum` (BiblicalTermStatus enum).
 *   `groupId` is not natively tracked; it must be synthesized during
 *   migration when adjacent tokens share the same gloss/sense.
 */
export interface AnalysisAssignment {
  id: string;

  /** The occurrence being analyzed. */
  occurrenceId: string;

  /** The analysis applied. */
  analysisId: string;

  /** Review status — where this assignment sits in the analysis lifecycle. */
  status: AssignmentStatus;

  /**
   * Optional group identifier for multi-occurrence phrases.
   *
   * All AnalysisAssignments that share the same `groupId` form a
   * single phrase group — they reference the same Analysis and are
   * treated as one glossing / annotation unit in the UI.
   *
   * The grouped occurrences need not be adjacent and may reside in
   * different segments (cross-segment grouping).
   *
   * When absent the assignment is a normal single-word assignment.
   */
  groupId?: string;
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
  id: string;

  /** The morpheme form as it appears in this analysis (surface text). */
  form: string;

  /** Writing system of `form`. */
  writingSystem: string;

  /** Reference to a specific allomorph in the lexical model. */
  allomorphRef?: string;

  /** Reference to a lexeme in the lexical model. */
  lexemeRef?: string;

  /** Reference to a sense in the lexical model. */
  senseRef?: string;

  /** Reference to a grammatical / morphosyntactic analysis in the lexical model. */
  grammarRef?: string;
}

// ---------------------------------------------------------------------------
// §1.8 InterlinearAlignment
// ---------------------------------------------------------------------------

/**
 * A project pairing a source-language interlinearization and a
 * target-language interlinear with morph-level alignment links
 * between them.
 *
 * Both interlinearizations carry their own analyzed books, segments,
 * occurrences, and analyses.  AlignmentLinks bridge the two,
 * connecting individual morphemes (MorphemeBundles) or whole
 * unanalyzed words (Occurrences) across the language boundary.
 *
 * Source-system mapping:
 * - LCM: LCM has no native alignment or bilingual pairing model.
 *   An InterlinearAlignment is constructed by pairing a Scripture-
 *   based interlinearization (vernacular) with a source-text
 *   interlinearization produced externally (e.g. Greek/Hebrew
 *   resource text).
 * - Paratext: not directly represented.  Can be constructed from
 *   parallel projects that share the same versification.
 * - BT Extension: one `Translation` scoped to source + target
 *   sides (`Translation.sideNum`: 1 = source, 2 = target).  Each
 *   side becomes an `Interlinearization`.  `Alignment` records become
 *   `AlignmentLink`s.
 */
export interface InterlinearAlignment {
  id: string;

  /** The source-language interlinearization (e.g. Greek / Hebrew). */
  source: Interlinearization;

  /** The target-language interlinearization (e.g. vernacular translation). */
  target: Interlinearization;

  /**
   * Morph-level alignment links connecting endpoints in the source
   * interlinear to endpoints in the target interlinear.
   */
  links: AlignmentLink[];
}

// ---------------------------------------------------------------------------
// §1.9 AlignmentLink
// ---------------------------------------------------------------------------

/**
 * A directional alignment link from one or more source-text
 * morphemes / words to one or more target-text morphemes / words.
 *
 * Each endpoint resolves to either:
 * - A specific MorphemeBundle within a fully analyzed occurrence,
 *   connecting at the allomorph level (via `allomorphRef`).
 * - A whole unanalyzed occurrence, when no morpheme-level analysis
 *   exists.
 *
 * Typical workflow:  the user selects a morph from the source-text
 * interlinear and connects it to an allomorph of a fully analyzed
 * occurrence in the target-text interlinear — or to an unanalyzed
 * occurrence if the target word has not yet been broken into
 * morphemes.
 *
 * Source-system mapping:
 * - LCM: no native alignment model; links are produced by
 *   external tools.
 * - Paratext: not stored in interlinear data; derivable from
 *   parallel interlinear selections when two projects share
 *   versification.
 * - BT Extension: `Alignment` entity.  Each `Alignment` record
 *   with `sourceInstances` / `targetInstances` is decomposed
 *   into `AlignmentEndpoint`s — one per instance.  BT Extension's
 *   "morph" concept (the token's morphological form) maps to a
 *   MorphemeBundle-level endpoint when a morpheme analysis is
 *   present; otherwise the endpoint targets the whole occurrence.
 *   `status` from `statusNum` via BT Extension's `AlignmentStatus` enum
 *   (CREATED=0, REJECTED=1, APPROVED=2, NEEDS_REVIEW=3) — lossy
 *   mapping where both CREATED and NEEDS_REVIEW collapse to
 *   `candidate`.  `origin` from `originNum` — an undocumented
 *   integer with no enum; descriptive strings must be defined
 *   externally.  Eflomal-generated alignments leave `originNum`
 *   and `statusNum` unset, so both default to 0 (`CREATED`).
 */
export interface AlignmentLink {
  id: string;

  /**
   * Source-side endpoints (one or more morphemes / words from the
   * source interlinear).
   */
  sourceEndpoints: AlignmentEndpoint[];

  /**
   * Target-side endpoints (one or more morphemes / words from the
   * target interlinear).
   */
  targetEndpoints: AlignmentEndpoint[];

  status: AssignmentStatus;

  /** How the alignment was created (manual, automatic tool, etc.). */

  origin?: string;

  /**
   * Confidence in this alignment link, independent of the
   * confidence on the analyses at each endpoint.
   */
  confidence?: Confidence;

  /** Multilingual notes keyed by writing system (e.g. UI locale). */
  notes?: MultiString;
}

// ---------------------------------------------------------------------------
// §1.10 AlignmentEndpoint
// ---------------------------------------------------------------------------

/**
 * One side of an alignment link, identifying a precise point of
 * connection within an interlinear text.
 *
 * When the referenced occurrence has a morpheme-level analysis,
 * `bundleId` identifies the specific MorphemeBundle — and by
 * extension its `allomorphRef` (IMoForm), `lexemeRef` (ILexEntry),
 * `senseRef` (ILexSense), and `grammarRef` (IMoMorphSynAnalysis).
 *
 * When the occurrence is unanalyzed, `bundleId` is absent and the
 * link targets the whole word.
 *
 * Resolution chain (fully analyzed):
 *   AlignmentEndpoint
 *     → Occurrence
 *       → AnalysisAssignment → Analysis → MorphemeBundle
 *         → allomorphRef (IMoForm)
 *         → lexemeRef    (ILexEntry)
 *         → senseRef     (ILexSense)
 *         → grammarRef   (IMoMorphSynAnalysis)
 *
 * Resolution chain (unanalyzed):
 *   AlignmentEndpoint
 *     → Occurrence
 *       → surfaceText only
 */
export interface AlignmentEndpoint {
  /** The word or punctuation occurrence in the text. */
  occurrenceId: string;

  /**
   * Identifies a specific MorphemeBundle within one of the
   * occurrence's analyses.  When set, the alignment connects at the
   * allomorph / morpheme level.  When absent, the alignment
   * connects to the whole (unanalyzed) occurrence.
   */
  bundleId?: string;
}
