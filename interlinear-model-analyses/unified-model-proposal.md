# Unified Interlinear Model Proposal

## Purpose

This document proposes a unified interlinear model that can represent data from LCM (FieldWorks), Paratext 9, and BT Extension. The model is designed to support:

- **Multiple analyses per occurrence** — any word in text may have competing analyses from different tools or users.
- **Confidence scoring** — every analysis-to-occurrence assignment carries a confidence level.
- **Text versioning** — the version of the source text being analyzed is tracked so analyses can be validated against text changes.
- **Lexicon connection** — morpheme bundles link directly to the LCM lexical model (Lexeme, Sense, Grammar).

The interlinear model does **not** attempt to round‑trip LCM's `IWfiWordform`, `ISegment`, or Paratext's `InterlinearData` structures. It is a common representation into which all three systems can export and from which consumers can read.

---

## 1. Interlinear Model

### 1.1 Interlinearization

The top-level container for all interlinear data. An Interlinearization holds the set of analysis languages and the collection of analyzed books.

| Property | Type | Description |
|---|---|---|
| `id` | string | Unique identifier. |
| `sourceWritingSystem` | string | Writing system of the source text being analyzed. |
| `analysisLanguages[]` | string | Writing systems in which analyses are provided (e.g. `en`, `fr`). A single interlinearization can hold analyses in multiple languages. |
| `books[]` | AnalyzedBook | The books of scripture (or other texts) that have been analyzed. |

**Source-system mapping:**

- **LCM:** One `Interlinearization` corresponds to one `IScripture` instance — the singleton scripture container in a FieldWorks project. `sourceWritingSystem` is the project's vernacular writing system. LCM supports analyses in many languages simultaneously; each analysis language appears in `analysisLanguages[]`.
- **Paratext:** Multiple `InterlinearData` files contribute to one `Interlinearization`. Paratext creates a separate file per analysis language per book (`Interlinear_{language}/Interlinear_{language}_{book}.xml`). During import, all language files for the same source text are merged into one `Interlinearization`, with each file's gloss language added to `analysisLanguages[]`.
- **BT Extension:** One `Interlinearization` corresponds to a `Translation` (project scope). Analysis is typically in a single language; `analysisLanguages[]` contains that language.

---

### 1.2 AnalyzedBook

Represents one book of scripture (or other text unit) that has been analyzed within an Interlinear. Tracks the version of the source text so analyses can be validated against changes.

| Property | Type | Description |
|---|---|---|
| `id` | string | Unique identifier. |
| `bookRef` | string | Book identifier (e.g. `GEN`, `MAT`, or a text name). |
| `textVersion` | string | Hash or version stamp of the source text at the time of analysis. Used to detect when the underlying text has changed and analyses may be stale. |
| `segments[]` | Segment | Ordered segments that compose this book. |

**Source-system mapping:**

- **LCM:** One `AnalyzedBook` corresponds to one `IScrBook`. `bookRef` = `IScrBook.BookId` (3-letter SIL code derived from `CanonicalNum`, e.g. `MAT`). `textVersion` can be derived from `IScrBook.ImportedCheckSum` (Paratext sync checksum) or a hash of the book's paragraph contents.
- **Paratext:** One `AnalyzedBook` corresponds to the book-level data in `InterlinearData` (one file per book per language, merged here). `textVersion` is derived from `VerseData.Hash` values across the book's verses.
- **BT Extension:** One `AnalyzedBook` corresponds to one book within a `Translation`. `textVersion` is not natively tracked; it must be computed from token checksums at import time.

---

### 1.3 Segment

A segment is a sentence, clause, or verse — the unit within which occurrences are ordered.

| Property | Type | Description |
|---|---|---|
| `id` | string | Unique identifier. |
| `segmentRef` | string | Canonical reference (e.g. verse reference, paragraph index + offset range). |
| `baselineText` | string (optional) | The raw text of the segment, for display and validation. |
| `freeTranslation` | MultiString (optional) | Idiomatic translation of the segment. |
| `literalTranslation` | MultiString (optional) | Word-for-word translation. |
| `occurrences[]` | Occurrence | Ordered word/punctuation tokens in this segment. |

**Source-system mapping:**

- **LCM:** `ISegment` owned by an `IScrTxtPara` within an `IScrSection`. `segmentRef` is derived from `IScrSection.VerseRefStart`/`VerseRefEnd` (BBCCCVVV encoded integers) combined with paragraph index and `ISegment.BeginOffset`–`EndOffset`. `baselineText` = `ISegment.BaselineText`. `freeTranslation` and `literalTranslation` map directly to the same-named `ISegment` properties.
- **Paratext:** A verse (`VerseRef`) within `VerseData`. `segmentRef` = verse reference string. `baselineText` is the verse USFM content. Free/literal translations are not stored in Paratext interlinear data.
- **BT Extension:** A `Verse` (BCV identifier). `segmentRef` = `verseId`/`verseBcv`. `baselineText` is reconstructed from `Token.before` + `Token.text` + `Token.after` values (the `after` field is required and `before` is optional, containing inter-token whitespace and punctuation).

---

### 1.4 Occurrence

An occurrence is a single word or punctuation token at a specific position in the text. The occurrence inherits its text version from its parent AnalyzedBook.

| Property | Type | Description |
|---|---|---|
| `id` | string | Unique identifier. |
| `segmentId` | string | Parent segment. |
| `index` | int | Zero-based position within the segment (preserves word order). |
| `anchor` | string | Positional anchor in the source text. Supports BCVWP, BCVWP+partNum, StringRange, or character offset depending on source system. |
| `surfaceText` | string | The text as it appears in the source. |
| `writingSystem` | string | Writing system of `surfaceText`. |
| `type` | enum | `word` · `punctuation` |
| `assignments[]` | AnalysisAssignment | All analysis assignments for this occurrence (zero or more). |

**Source-system mapping:**

- **LCM:** Each entry in `ISegment.AnalysesRS` at a given index (segment owned by `IScrTxtPara`). `surfaceText` comes from the `ITsString` span. `type` = `word` for `IWfiWordform`/`IWfiAnalysis`/`IWfiGloss`, `punctuation` for `IPunctuationForm`. `anchor` = paragraph offset within the `IScrSection` content. Chapter/verse context is inherited from the owning `IScrSection.VerseRefStart`/`VerseRefEnd`.
- **Paratext:** Each `ClusterData` within a `VerseData`. `anchor` = `ClusterData.TextRange` (StringRange). `surfaceText` = the text span identified by that range. `PunctuationData` items become `type = punctuation`.
- **BT Extension:** Each `Token`/`Instance`. `anchor` = `instanceBcvwp`. `surfaceText` = `Token.text` (API) / `Instance.instanceText` (DB). `type` = `word` (BT Extension does not explicitly model punctuation tokens).

---

### 1.5 Analysis

A reusable analysis describing a linguistic interpretation of a word. The same analysis can be assigned to many occurrences. Confidence and provenance belong to the analysis itself because they describe how the interpretation was produced.

| Property | Type | Description |
|---|---|---|
| `id` | string | Unique identifier. |
| `analysisLanguage` | string | Writing system of the analysis (e.g. the gloss language). |
| `analysisType` | enum | `wordform` · `morph` · `gloss` · `punctuation` |
| `confidence` | enum | `guess` · `low` · `medium` · `high`. Describes how the analysis was produced. `high` = human-created or human-confirmed. `medium`/`low` = AI or tool-assisted with varying certainty. `guess` = unreviewed machine suggestion. |
| `sourceSystem` | string | System that produced the analysis (e.g. `lcm`, `paratext`, `bt-extension`, `ai`). |
| `sourceUser` | string | User/agent identifier within that system (e.g. `parser-v3`, `jsmith`, `auto-glosser`). |
| `glossText` | string (optional) | Word-level gloss text. |
| `pos` | string (optional) | Part of speech. |
| `features` | object (optional) | Morphosyntactic feature structure. |
| `morphemeBundles[]` | MorphemeBundle (optional) | Ordered morpheme breakdown, when analysis is at the morpheme level. |

**Source-system mapping:**

- **LCM:** An `IWfiAnalysis` maps to an Analysis with `analysisType = morph` and `morphemeBundles` populated from `MorphBundlesOS`. An `IWfiGloss` maps to an Analysis with `analysisType = gloss` and `glossText` from `IWfiGloss.Form`. An `IWfiWordform` with no analyses maps to `analysisType = wordform`. `pos` comes from `IWfiAnalysis.CategoryRA`. `features` from `IWfiAnalysis.MsFeaturesOA`. Human-approved analyses get `confidence = high`, `sourceSystem = "lcm"`, `sourceUser = "human"`. Parser-generated analyses get `confidence = guess` or `low` based on `ICmAgentEvaluation`, `sourceSystem = "lcm"`, `sourceUser = "parser-v3"`.
- **Paratext:** A `LexemeCluster` with its `WordAnalysis` maps to an Analysis. If `LexemeCluster.Type = WordParse`, `analysisType = morph` and each `Lexeme` in the `WordAnalysis` becomes a `MorphemeBundle`. If `Type = Word`, `analysisType = wordform` or `gloss` depending on whether a gloss selection exists. `glossText` is resolved from the selected `LexiconSense` gloss. Human selections get `confidence = high`, `sourceSystem = "paratext"`, `sourceUser = <user>`. Auto-glossed entries with `IsGuess = true` get `confidence = guess`, `sourceSystem = "paratext"`, `sourceUser = "auto-glosser"`. `InterlinearLexeme.Score` can distinguish `low` vs `medium`.
- **BT Extension:** A `Token` with `gloss`/`lemmaText`/`senseIds` populated maps to an Analysis with `analysisType = gloss`. `glossText` = `Token.gloss`. `pos` from Macula TSV `pos` field when available. BT Extension does not produce morpheme-level analyses; `morphemeBundles` would be empty. BT Extension has no analysis-level confidence field; `confidence` must be inferred heuristically — e.g. if `Instance.termStatusNum = APPROVED (1)` or `OVERRIDDEN (3)`, infer `confidence = high`; if `termStatusNum = NEEDS_REVIEW (0)`, infer `confidence = guess`. Manually entered glosses set `sourceSystem = "bt-extension"`, `sourceUser = "human"`; automated imports should use a stable automation identifier. Note: eflomal produces **Alignment** records (§1.8), not analyses — it never populates gloss, lemma, or sense data on tokens. Because BT Extension stores gloss/sense data per-token (not as shared analysis objects), migration must deduplicate tokens with identical gloss+lemma+senseIds into a single reusable Analysis.

---

### 1.6 AnalysisAssignment

The join between an occurrence and an analysis. Multiple assignments per occurrence enable competing analyses. The `status` field indicates whether the assignment has been approved by a human or is still a suggestion.

**Phrase grouping via `groupId`:** When two or more occurrences are glossed or analyzed as a single unit (a phrase, a discontinuous expression, etc.) each occurrence carries its own AnalysisAssignment but all such assignments share the same `groupId` and reference the same Analysis. Grouped occurrences may be adjacent within one segment ("en el" → "in the"), disjoint within one segment (French "ne … pas" → "not"), or spanning multiple segments. A single-word assignment omits `groupId`.

| Property | Type | Description |
|---|---|---|
| `id` | string | Unique identifier. |
| `occurrenceId` | string | The occurrence being analyzed. |
| `analysisId` | string | The analysis applied. |
| `status` | enum | `approved` · `suggested` · `candidate` · `rejected`. Lifecycle status of this assignment. |
| `groupId` | string (optional) | Shared identifier linking assignments that form a multi-occurrence phrase group. Assignments with the same `groupId` reference the same Analysis and are treated as one annotation unit. Grouped occurrences need not be adjacent and may reside in different segments. When absent, the assignment is a normal single-word assignment. |
| `createdAt` | datetime (optional) | Timestamp of when the assignment was made. |

**Source-system mapping:**

- **LCM:** When `ISegment.AnalysesRS[i]` directly references an `IWfiGloss` or `IWfiAnalysis`, this creates an assignment with `status = approved` (the user selected this analysis for this position). Parser-suggested analyses that have not been confirmed by a user create assignments with `status = suggested`. LCM does not natively model multi-word phrases; `groupId` is absent.
- **Paratext:** A `ClusterData` with selected `LexemeData` (lexemeId + senseId) creates an assignment. If `InterlinearLexeme.IsGuess = false`, `status = approved`. If `IsGuess = true`, `status = suggested`. Paratext's `Phrase` cluster type spans multiple words — each word's assignment shares the same `groupId`.
- **BT Extension:** A `Token` linked to senses (`senseIds`) creates an assignment. `termStatusNum` is a per-`Instance` property mapped to `BiblicalTermStatus` (NEEDS_REVIEW=0, APPROVED=1, REJECTED=2, OVERRIDDEN=3). If `termStatusNum = APPROVED (1)` or `OVERRIDDEN (3)`, `status = approved`. If `termStatusNum = NEEDS_REVIEW (0)`, `status = suggested`. `groupId` is not natively tracked; it must be synthesized during migration when adjacent tokens share the same gloss/sense.

---

### 1.7 MorphemeBundle

An ordered morpheme within a morpheme-level analysis, linking to the lexicon.

| Property | Type | Description |
|---|---|---|
| `id` | string | Unique identifier. |
| `index` | int | Zero-based position within the analysis (preserves morpheme order). |
| `form` | string | The morpheme form as it appears in this analysis (surface text). |
| `writingSystem` | string | Writing system of `form`. |
| `allomorphRef` | string | Reference to a specific **Allomorph** (`IMoForm`) in the lexical model. An `ILexEntry` owns one *LexemeForm* (the elsewhere / citation allomorph) and zero-or-more *AlternateForms*. This field identifies which allomorph was matched. |
| `lexemeRef` | string (optional) | Reference to **Lexeme** (`ILexEntry`) in the lexical model. |
| `senseRef` | string (optional) | Reference to **Sense** (`ILexSense`) in the lexical model. |
| `grammarRef` | string (optional) | Reference to **Grammar** (`IMoMorphSynAnalysis`) in the lexical model. |

**Source-system mapping:**

**`form` vs `allomorphRef`:** `form` is the surface text of the morpheme as it appeared in this specific analysis context. `allomorphRef` is a reference (ID) to the canonical allomorph object in the lexicon. These can legitimately differ: in LCM, `IWfiMorphBundle.Form` may reflect phonological conditioning that differs from the canonical `IMoForm.Form`. When `allomorphRef` is absent, `form` is the only record of the morpheme shape.

- **LCM:** `IWfiMorphBundle` maps 1:1. `form` = `IWfiMorphBundle.Form`. `allomorphRef` = GUID of `IWfiMorphBundle.MorphRA` (`IMoForm` — the specific allomorph matched). `lexemeRef` = GUID of the `ILexEntry` that owns that `IMoForm` (via `LexemeFormOA` or `AlternateFormsOS`). `senseRef` = GUID of `IWfiMorphBundle.SenseRA`. `grammarRef` = GUID of `IWfiMorphBundle.MsaRA`.
- **Paratext:** Each `Lexeme` within a `WordAnalysis` maps to one MorphemeBundle. `form` = `Lexeme.LexicalForm`. Paratext's built-in XML lexicon has **no allomorph concept distinct from the entry** — `Lexeme.AlternateForms` exists in the interface but returns empty. `allomorphRef` is therefore **omitted** for the built-in lexicon (the entry and its single form are the same object). When an integrated provider (e.g. FLEx via `IntegratedLexicalProvider`) is active, `AllomorphEntry` surfaces actual allomorphs and `allomorphRef` can be populated with the allomorph's ID. `lexemeRef` = `Lexeme.Id` (LexemeKey-derived). `senseRef` = selected `SenseId` from `LexemeData`. `grammarRef` = not directly available (Paratext stores POS at the lexeme level, not per-bundle).
- **BT Extension:** BT Extension does not decompose words into morphemes. A whole-word bundle can be synthesized: `form` = `Token.text`, `allomorphRef` = `headwordId` (the BT Extension "morph" concept corresponds to the FieldWorks Allomorph / `IMoForm`; the HeadWord's lemma text is the *LexemeForm* — the elsewhere / citation allomorph), `lexemeRef` = `headwordId`, `senseRef` = `senseIds[0]`. Morphological detail from Macula TSV (`morph`, `stem` fields) can supply the specific allomorphic form when it differs from the lemma.

---

### 1.8 InterlinearAlignment

A project pairing a source-language interlinearization and a target-language interlinearization with morph-level alignment links between them. Both interlinearizations carry their own analyzed books, segments, occurrences, and analyses. AlignmentLinks bridge the two, connecting individual morphemes (MorphemeBundles) or whole unanalyzed words (Occurrences) across the language boundary.

| Property | Type | Description |
|---|---|---|
| `id` | string | Unique identifier. |
| `source` | Interlinearization | The source-language interlinearization (e.g. Greek / Hebrew). |
| `target` | Interlinearization | The target-language interlinearization (e.g. vernacular translation). |
| `links[]` | AlignmentLink | Morph-level alignment links connecting endpoints in the source interlinear to endpoints in the target interlinear. |

**Source-system mapping:**

- **LCM:** LCM has no native alignment or bilingual pairing model. An InterlinearAlignment is constructed by pairing a Scripture-based Interlinearization (vernacular) with a source-text Interlinearization produced externally (e.g. Greek/Hebrew resource text).
- **Paratext:** Not directly represented. Can be constructed from parallel projects that share the same versification.
- **BT Extension:** One `Translation` scoped to source + target sides (`Translation.sideNum`: 1 = source, 2 = target). Each side becomes an `Interlinearization`. `Alignment` records become `AlignmentLink`s.

---

### 1.9 AlignmentLink

A directional alignment link from one or more source-text morphemes/words to one or more target-text morphemes/words.  Each endpoint resolves to either a specific MorphemeBundle within a fully analyzed occurrence (connecting at the allomorph level) or a whole unanalyzed occurrence.

Typical workflow: the user selects a morph from the source-text interlinear and connects it to an allomorph of a fully analyzed occurrence in the target-text interlinear — or to an unanalyzed occurrence if the target word has not yet been broken into morphemes.

| Property | Type | Description |
|---|---|---|
| `linkId` | string | Unique identifier. |
| `sourceEndpoints[]` | AlignmentEndpoint | Source-side endpoints (one or more morphemes / words from the source interlinear). |
| `targetEndpoints[]` | AlignmentEndpoint | Target-side endpoints (one or more morphemes / words from the target interlinear). |
| `status` | enum | `approved` · `suggested` · `candidate` · `rejected` |
| `origin` | string (optional) | How the alignment was created (manual, automatic tool, etc.). |
| `confidence` | enum (optional) | `guess` · `low` · `medium` · `high`. Independent of the confidence on the analyses at each endpoint. |
| `notes` | string (optional) | Free-text annotation. |

**Source-system mapping:**

- **LCM:** No native alignment model; links are produced by external tools.
- **Paratext:** Not stored in interlinear data; derivable from parallel interlinear selections when two projects share versification.
- **BT Extension:** `Alignment` entity. Each `Alignment` record with `sourceInstances` / `targetInstances` is decomposed into `AlignmentEndpoint`s — one per instance. BT Extension's "morph" concept (the token's morphological form) maps to a MorphemeBundle-level endpoint when a morpheme analysis is present; otherwise the endpoint targets the whole occurrence. `status` from `statusNum` via BT Extension's `AlignmentStatus` enum (CREATED=0, REJECTED=1, APPROVED=2, NEEDS_REVIEW=3) — lossy mapping where both CREATED and NEEDS_REVIEW collapse to `candidate`. `origin` from `originNum` — an undocumented integer with no enum; descriptive strings must be defined externally. Eflomal-generated alignments leave `originNum` and `statusNum` unset, so both default to 0 (`CREATED`). `confidence` is not natively tracked — inferred from status.

---

### 1.10 AlignmentEndpoint

One side of an alignment link, identifying a precise point of connection within an interlinear text.

| Property | Type | Description |
|---|---|---|
| `occurrenceId` | string | The word or punctuation occurrence in the text. |
| `bundleId` | string (optional) | Identifies a specific MorphemeBundle within one of the occurrence's analyses. When set, the alignment connects at the allomorph / morpheme level. When absent, the alignment connects to the whole (unanalyzed) occurrence. |

**Resolution chains:**

- **Fully analyzed:** AlignmentEndpoint → Occurrence → AnalysisAssignment → Analysis → MorphemeBundle → `allomorphRef` (IMoForm), `lexemeRef` (ILexEntry), `senseRef` (ILexSense), `grammarRef` (IMoMorphSynAnalysis).
- **Unanalyzed:** AlignmentEndpoint → Occurrence → `surfaceText` only.

---

### 1.11 Model Diagram

```
InterlinearAlignment
  ├─ source: Interlinearization (e.g. Greek / Hebrew)
  ├─ target: Interlinearization (e.g. vernacular translation)
  └─ links: AlignmentLink[]

Interlinearization (sourceWritingSystem, analysisLanguages[])
  └─ AnalyzedBook[] (bookRef, textVersion)
       └─ Segment[] (segmentRef, baselineText, freeTranslation, literalTranslation)
            └─ Occurrence[] (surfaceText, anchor, word | punctuation)
                 └─ AnalysisAssignment[] (status, groupId?)
                      └─ Analysis (glossText, pos, confidence, sourceSystem, sourceUser)
                           └─ MorphemeBundle[] (optional; form, writingSystem)
                                ├─ allomorphRef → IMoForm (specific allomorph)
                                ├─ lexemeRef    → ILexEntry (owning entry)
                                ├─ senseRef     → ILexSense (meaning)
                                └─ grammarRef   → IMoMorphSynAnalysis (grammar)

Phrase grouping:
  Occurrence "en"  → AnalysisAssignment (groupId: "g1") ─┐
  Occurrence "el"  → AnalysisAssignment (groupId: "g1") ─┴─→ Analysis (gloss: "in the")

AlignmentLink (status, origin, confidence, notes)
  ├─ sourceEndpoints[] → AlignmentEndpoint
  └─ targetEndpoints[] → AlignmentEndpoint

AlignmentEndpoint
  ├─ occurrenceId → Occurrence        (always)
  └─ bundleId?    → MorphemeBundle    (when morph-level analysis exists)
```

#### Alignment Workflow

```
SOURCE INTERLINEAR                        TARGET INTERLINEAR
──────────────────                        ──────────────────
Occurrence "λόγον"                        Occurrence "word"
 └─ Analysis (morph)                       └─ Analysis (morph)
      └─ MorphemeBundle "λογ-"                  └─ MorphemeBundle "word"
           │  allomorphRef → IMoForm                 │  allomorphRef → IMoForm
           │                                         │
           └──────── AlignmentLink ──────────────────┘
                sourceEndpoint        targetEndpoint
                (bundleId set)        (bundleId set)

Occurrence "τοῦ"                          Occurrence "the"  (unanalyzed)
 └─ Analysis (morph)                       │  (no analysis)
      └─ MorphemeBundle "τοῦ"              │
           │                               │
           └──────── AlignmentLink ────────┘
                sourceEndpoint        targetEndpoint
                (bundleId set)        (bundleId absent)
```

---

## 2. Paratext Lexicon → LCM Lexical Model Migration

This section describes how Paratext lexical data can be migrated into the LCM lexical model.

### 2.1 Entity Mapping

| Paratext | LCM | Notes |
|---|---|---|
| `XmlLexeme` / `LexemeKey` | `ILexEntry` | One Paratext lexeme becomes one LCM entry. `LexemeKey.Id` is preserved as an external reference; a new LCM GUID is generated. |
| `LexemeKey.LexicalForm` | `ILexEntry.LexemeFormOA` (`IMoStemAllomorph` or `IMoAffixAllomorph`) | The lexical form string populates the form in the project's vernacular writing system. `LexemeKey.Type` determines whether to create a stem allomorph or affix allomorph. |
| `LexemeKey.Type` (Word, Prefix, Suffix, Infix) | `IMoForm.MorphTypeRA` | `Word` → stem/root morph type. `Prefix`/`Suffix`/`Infix` → corresponding LCM morph types. |
| `LexemeKey.Homograph` | `ILexEntry.HomographNumber` | Direct mapping. |
| `XmlLexiconSense` | `ILexSense` | One Paratext sense becomes one LCM sense owned by the entry. Paratext's random 8-char sense ID is preserved as an external reference. |
| `XmlLexiconGloss` (per language) | `ILexSense.Gloss` (IMultiUnicode) | Each gloss language tag maps to a writing system in LCM's multi-unicode gloss field. |
| `Lexeme.AlternateForms` | `ILexEntry.AlternateFormsOS` | When available from external providers (not the built-in XML lexicon). Each alternate form becomes an additional `IMoForm`. |
| `LexicalRelation` | `ILexEntryRef` / `EntryRefsOS` | When available from external providers. Relationship type labels must be mapped to LCM relation types. |
| `WordAnalysis` (word → lexeme sequence) | Not directly migrated to lexicon | Word analyses are interlinear data, not lexical data. They map into the interlinear model's Analysis + MorphemeBundle entities. |

### 2.2 Migration Procedure

1. **Enumerate Paratext lexicon entries.** Iterate `LexiconData.Entries` (keyed by `LexemeKey`).
2. **Create LCM entries.** For each `XmlLexeme`:
   - Create an `ILexEntry` with a new GUID.
   - Create the primary `IMoForm` from `LexemeKey.LexicalForm` and `LexemeKey.Type`.
   - Set `HomographNumber` from `LexemeKey.Homograph`.
3. **Create senses.** For each `XmlLexiconSense`:
   - Create an `ILexSense` owned by the entry.
   - Populate `Gloss` with each `XmlLexiconGloss` language+text pair.
4. **Create MSAs.** Paratext does not store structured POS/grammar per entry in the built-in XML lexicon. When POS data is available (from external providers or interlinear selections), create the appropriate `IMoMorphSynAnalysis` subclass and link it from the sense.
5. **Preserve origin identifiers.** Store the original `LexemeKey.Id` and sense IDs in LCM's `ImportResidue` or a custom field so round-trip identity can be recovered.
6. **Handle alternate forms and relations.** If migrating from an integrated lexical provider (e.g. FLEx-linked Paratext project), import `AlternateForms` as additional `IMoForm` objects and `LexicalRelation` entries as `ILexEntryRef` objects.

### 2.3 Fields Not Migrated (built-in XML lexicon)

The following fields exist in the LCM model but have no equivalent in the Paratext built-in XML lexicon. They will be empty after migration:

- `ILexEntry.CitationForm` — Paratext's `XmlLexeme.CitationForm` returns `null`.
- `ILexSense.Definition` — Paratext stores only glosses, not full definitions.
- `ILexSense.SemanticDomainsRC` — interface exists but returns empty in XML lexicon.
- `ILexSense.ExamplesOS` — no example/citation model in the built-in lexicon.
- `ILexEntry.PronunciationsOS`, `EtymologyOS` — not stored.
- `IMoMorphSynAnalysis` subtype detail — inflection class, feature structures, gloss bundle items are not available from Paratext.

---

## 3. Migration Risk Analysis

### 3.1 Paratext → Unified Interlinear Model

| Risk | Severity | Description |
|---|---|---|
| **Text version detection** | Medium | Paratext uses `VerseData.Hash` to detect verse changes, but this hash is tied to USFM content and is not a global version stamp. If the USFM is edited and the hash changes, all existing cluster selections for that verse are invalidated. Migration must capture the hash at export time and flag stale analyses. |
| **Loss of guess/score metadata** | Medium | `InterlinearLexeme.IsGuess` and `.Score` carry useful provenance information. The unified model captures this via `AnalysisAssignment.confidence` and `status`, but the mapping requires inferring a numeric confidence from a boolean guess flag and a display-oriented score value. Fidelity may be reduced. |
| **Gloss-only references** | Medium | Paratext interlinear data stores `LexemeId` + `SenseId` references. The actual gloss text is resolved at render time from the lexicon. If the lexicon is not migrated alongside the interlinear data, the analysis will have valid references but no displayable text. Migration must include the lexicon or snapshot the gloss text. |
| **StringRange anchor fragility** | High | Paratext anchors clusters to verse text via `StringRange` (character offsets). Any USFM editing that changes character positions will invalidate these anchors. The unified model supports multiple anchor types; migration should also capture the surface text for re-anchoring. |
| **Phrase and multi-word clusters** | Low | Paratext `LexemeCluster.Type` can be `Phrase`, spanning multiple words. The unified model treats each word as an occurrence with its own AnalysisAssignment. Phrase clusters are decomposed so that each word's assignment shares a `groupId` and references the same Analysis — see §1.6. |
| **Missing morpheme-level grammar** | Low | Paratext does not store per-morpheme POS/grammar in the built-in lexicon. `MorphemeBundle.grammarRef` will be empty for Paratext-sourced morpheme analyses unless enriched from an external provider. |
| **Per-book, per-language file scoping** | Low | Paratext stores interlinear data per book per gloss language. The unified model is not scoped this way. Migration must merge per-language files into a single analyzed text with language-tagged analyses. |

### 3.2 LCM → Unified Interlinear Model

| Risk | Severity | Description |
|---|---|---|
| **Analysis tier ambiguity** | Medium | LCM's `ISegment.AnalysesRS` can reference `IWfiWordform`, `IWfiAnalysis`, or `IWfiGloss` for the same position. These represent three different levels of specificity. The unified model maps each to a different `analysisType`, but the intent behind a wordform-level reference (unannotated vs. deliberately left at wordform) is implicit and may be lost. |
| **Multiple glosses per analysis** | Medium | LCM allows `IWfiAnalysis.MeaningsOC` to hold multiple `IWfiGloss` objects. In the unified model, each gloss becomes a separate Analysis. If the segment references only the analysis (not a specific gloss), migration must decide whether to create assignments for all glosses or only the first. |
| **Parser evaluations** | Medium | LCM tracks parser/human evaluations via `ICmAgentEvaluation`. These carry approval/disapproval per agent. Mapping to a single `confidence` float and `status` enum requires a reduction of multi-agent evaluation data. A strategy (e.g. majority-vote, max-confidence) must be chosen. |
| **Text version tracking** | Low | LCM does not have an explicit text version field. `IScrBook.ImportedCheckSum` (Paratext sync checksum) provides a coarse version signal; alternatively, `IWfiWordform.Checksum` or a hash of `IScrTxtPara.Contents` across the book's sections can approximate version tracking. The unified model's `textVersion` must be synthesized from these sources. |
| **Punctuation identity** | Low | LCM `IPunctuationForm` objects are created on demand and may not have stable GUIDs. Occurrence IDs for punctuation in the unified model must be generated during migration rather than mapped from LCM identifiers. |
| **Feature structures** | Low | LCM `IFsFeatStruc` objects on `IWfiAnalysis.MsFeaturesOA` are complex recursive structures. The unified model stores `features` as a generic object. Serialization must preserve the full structure without data loss. |

### 3.3 BT Extension → Unified Interlinear Model

| Risk | Severity | Description |
|---|---|---|
| **No morpheme decomposition** | Medium | BT Extension does not model explicit morphemes. All analyses are whole-word. Migration can only produce single-bundle morpheme analyses or leave `morphemeBundles` empty. Morphological detail from Macula TSV is available for source-language tokens but not for target-language tokens. |
| **Numeric vs GUID identity** | Medium | BT Extension uses auto-increment integer IDs and composite BCVWP strings. The unified model uses string identifiers (GUIDs). Migration must generate stable string IDs from the BT numeric IDs and BCVWP values. |
| **No text versioning** | Medium | BT Extension does not track text versions. All migrated data will have a synthesized `textVersion` (e.g. import-time hash). Subsequent changes to the underlying text cannot be compared to the original analysis context. |
| **Alignment is core, interlinear is secondary** | Low | BT Extension's primary model is alignment (source ↔ target token links), not interlinear annotation. The interlinear text field (`Token.interlinearText`) is a display string, not a structured analysis. Migration must treat alignment records as first-class and synthesize interlinear analyses from gloss/sense data. |
| **Sense identity mismatch** | Medium | BT Extension sense IDs are local integers tied to a `Translation`. LCM and Paratext use GUIDs or composite keys. Migrated sense references must be reconciled with the lexicon migration to produce consistent cross-system references. |

### 3.4 Cross-System Risks

| Risk | Severity | Description |
|---|---|---|
| **Lexicon identity reconciliation** | High | All three systems use different identity schemes for lexical entries and senses. LCM uses GUIDs (all objects inherit from `ICmObject`). Paratext uses composite string keys (`LexemeKey.Id` derived from `LexicalForm` + `Type` + `Homograph`; `XmlLexiconSense.Id` is a random 8-char string). BT Extension uses auto-increment integers (`HeadWord.id`, `Sense.id`). Merging interlinear data from multiple sources requires a consistent lexicon identity layer. Without it, the same lexical entry may appear as distinct entries with duplicate analyses. *Refs: lcm-interlinear-model.md §ILexEntry; paratext9-interlinear-model.md §LexemeKey; BT-Extension.md §HeadWord, §Sense.* |
| **Writing system normalization** | Low | All three systems use BCP-47-based language identifiers, so normalization risk is lower than initially assumed. LCM uses `IetfLanguageTag` (BCP-47) for writing system identifiers on `IMultiUnicode`/`ITsString` properties (*ref: liblcm `WritingSystemServices.cs`, `IetfLanguageTag.IsValid()`*). Paratext uses `LanguageId.Id`, documented as "a hyphen delimited string describing the BCP-47 ISO 639 code and RFC 5646 subtags" — this populates `XmlLexiconGloss.Language` and `InterlinearData.GlossLanguage` (*ref: `ParatextData/Languages/LanguageId.cs`, `ILanguage.cs` "typically the IETF BCP-47 language tag"*). BT Extension stores `Language.cldrCode` (CLDR locale codes, which are BCP-47 based — e.g. `grc`, `heb`) and surfaces it as `Verse.languageCode` (*ref: `data-manager/src/pbteRepository.ts` Language entity, `src/api/types/verses.ts`*). The remaining risk is minor format variation: Paratext may include script/region/variant subtags (e.g. `zh-Hans-CN`), BT Extension may use bare ISO 639 codes (e.g. `heb`), and LCM may include private-use subtags. A normalization pass should canonicalize all tags to the same BCP-47 form. |
| **Confidence calibration** | Medium | Confidence-relevant metadata differs in kind across systems and none produce a unified numeric score. LCM tracks per-agent approve/disapprove evaluations via `ICmAgentEvaluation` on `IWfiAnalysis`. Paratext stores a boolean `IsGuess` flag on `LexemeCluster` and a display-oriented `Score` on `InterlinearLexeme`. BT Extension has **no confidence or score value** — it tracks only workflow state (`Alignment.originNum` — an undocumented integer defaulting to 0 with no enum; `Alignment.statusNum` mapped via BT Extension's `AlignmentStatus`: CREATED=0, REJECTED=1, APPROVED=2, NEEDS_REVIEW=3; `Instance.termStatusNum` mapped via `BiblicalTermStatus`: NEEDS_REVIEW=0, APPROVED=1, REJECTED=2, OVERRIDDEN=3). Mapping these heterogeneous signals to the unified model's `confidence` enum requires per-system heuristics. *Refs: lcm-interlinear-model.md §IWfiAnalysis (EvaluationsRC); paratext9-interlinear-model.md §LexemeCluster (IsGuess), §InterlinearLexeme (Score); BT-Extension.md §Alignment (originNum, statusNum), §Instance (termStatusNum).* |
| **Anchor scheme heterogeneity** | Medium | LCM uses paragraph character offsets within `IScrSection` content (with verse context from BBCCCVVV references on `IScrSection.VerseRefStart`/`VerseRefEnd`). Paratext uses USFM `StringRange` objects (`ClusterData.TextRange`). BT Extension uses composite BCVWP strings (`Instance.instanceBcvwp`). The unified model accepts all schemes via the generic `anchor` field, but tooling that consumes the model must handle all three formats. Standardizing on BCVWP where possible reduces this burden. *Refs: lcm-interlinear-model.md §ISegment (BeginOffset/EndOffset), §IScrSection (VerseRefStart/VerseRefEnd); paratext9-interlinear-model.md §ClusterData (TextRange); BT-Extension.md §Instance (instanceBcvwp).* |
