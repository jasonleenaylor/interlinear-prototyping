# Interlinear Text Analysis Model Documentation

## Overview

The **SIL.LCModel** (Language and Culture Model) library is the core FieldWorks model for linguistic analyses of languages. This model supports **interlinear text analysis backed by a comprehensive lexicon**.

- **Primary Language**: C# (.NET Framework 4.6.2 and .NET Standard 2.0)
- **Approximate Model Classes**: 100+ generated classes/interfaces from XML model definition
- **Architecture**: Generated model from `MasterLCModel.xml` using NVelocity templates
- **Key Feature**: Full integration between text corpus analysis and lexical database

---

## Core Domain Concepts

### Text & Document Structure

#### **IText** - Document/Text Representation
A `IText` represents a complete text document (story, conversation, elicitation session, etc.).

**Key Properties:**
- `ContentsOA` (IStText): The actual structured text content
- `Name` (IMultiUnicode): The title/name of the text
- `Abbreviation` (IMultiUnicode): Short reference abbreviation
- `GenresRC` (ILcmReferenceCollection<ICmPossibility>): Associated text genres
- `Source` (IMultiString): Source/origin information
- `MediaFilesOA` (ICmMediaContainer): Associated media files (audio/video)
- `IsTranslated` (bool): Whether this is a translated text

**Relationships:** Owns one `IStText` which contains the paragraph structure.

---

#### **IStText** - Structured Text
An `IStText` represents a sequence of styled paragraphs (the actual text content).

**Key Properties:**
- `ParagraphsOS` (ILcmOwningSequence<IStPara>): Ordered sequence of paragraphs
- `RightToLeft` (bool): Document direction setting
- `TagsOC` (ILcmOwningCollection<ITextTag>): Tags/annotations on the text
- `DateModified` (DateTime): Last modification timestamp

**Relationships:** 
- Owned by: `IText`
- Owns: Multiple `IStPara` paragraphs (typically `IStTxtPara`)

---

#### **IStTxtPara** - Paragraph (Text Segment Container)
An `IStTxtPara` represents a single paragraph of text containing the baseline text and its segmentation.

**Key Properties:**
- `Contents` (ITsString): The actual text string (with formatting/writing systems)
- `SegmentsOS` (ILcmOwningSequence<ISegment>): Ordered segments (sentences/clauses)
- `StyleName` (string): Paragraph style reference
- `ParseIsCurrent` (bool): Whether the paragraph has been parsed/segmented
- `TranslationsOC` (ILcmOwningCollection<ICmTranslation>): Back translations

**Relationships:**
- Owned by: `IStText`
- Owns: Multiple `ISegment` objects representing sentences/clauses

**Cardinality:** One-to-many (paragraph → segments)

---

### Scripture Structure

Scripture in LCM is modelled as a parallel text hierarchy that converges with the
general `IStText → IStTxtPara → ISegment` pipeline at the paragraph level.
Once text reaches `IScrTxtPara` (a thin subclass of `IStTxtPara`), all downstream
interlinear analysis objects (`ISegment`, `IWfiWordform`, `IWfiAnalysis`, etc.)
are shared with non-Scripture texts.

```
IScripture
  └─ ScriptureBooksOS ──► IScrBook[]          (one per canonical book)
       └─ SectionsOS ──► IScrSection[]        (passage-level divisions)
            ├─ HeadingOA ──► IStText           (section heading paragraphs)
            └─ ContentOA ──► IStText           (section body paragraphs)
                 └─ ParagraphsOS ──► IScrTxtPara[]
                      └─ SegmentsOS ──► ISegment[]   ← shared interlinear pipeline
```

*Verified against `GeneratedInterfaces.cs` and `InterfaceAdditions.cs` in
[liblcm](https://github.com/sillsdev/liblcm) (`src/SIL.LCModel`).*

---

#### **IScripture** - Scripture Container (ICmMajorObject)
The singleton entry point for all Scripture data in a FieldWorks project.

**Key Properties:**
| Property | Type | Description |
|---|---|---|
| `ScriptureBooksOS` | `ILcmOwningSequence<IScrBook>` | Ordered collection of canonical books |
| `StylesOC` | `ILcmOwningCollection<IStStyle>` | Scripture-specific style sheet (separate from LangProject styles) |
| `Versification` | `ScrVers` | Versification scheme — enum matching Paratext: 0=Unknown, 1=Original, 2=Septuagint, 3=Vulgate, 4=English, 5=Custom |
| `BookAnnotationsOS` | `ILcmOwningSequence<IScrBookAnnotations>` | Book-by-book annotations / scripture notes |
| `NoteCategoriesOA` | `ICmPossibilityList` | Categories for scripture notes |
| `ImportSettingsOC` | `ILcmOwningCollection<IScrImportSet>` | Named import configurations (Paratext, Other) |
| `ArchivedDraftsOC` | `ILcmOwningCollection<IScrDraft>` | Saved draft snapshots |
| `RefSepr` | `string` | Reference separator (typically `;`) |
| `ChapterVerseSepr` | `string` | Chapter–verse separator (typically `:`) |
| `VerseSepr` | `string` | Non-contiguous verse separator (typically `,`) |
| `Bridge` | `string` | Range bridge character (typically `-`) |
| `UseScriptDigits` | `bool` | Use script-native digits for chapter/verse numbers |
| `ScriptDigitZero` | `int` | Unicode code-point of zero in the target script |
| `FootnoteMarkerType` | `FootnoteMarkerTypes` | Enum: 0=alphabetic, 1=custom symbol, 2=no marker |
| `FootnoteMarkerSymbol` | `string` | Custom footnote callout character |

**Relationships:**
- Owned by: `ILangProject` (one per project)
- Owns: Multiple `IScrBook`, styles, annotations, drafts, import settings

---

#### **IScrBook** - Scripture Book (ICmObject)
Represents a single canonical book of scripture (e.g., Matthew, Genesis).

**Key Properties (generated):**
| Property | Type | Description |
|---|---|---|
| `SectionsOS` | `ILcmOwningSequence<IScrSection>` | Ordered sections composing the book |
| `CanonicalNum` | `int` | Canonical book number (1-based; 1=Genesis … 66=Revelation) |
| `Name` | `IMultiUnicode` | Full book name (initialised from `IScrBookRef.BookName`) |
| `Abbrev` | `IMultiUnicode` | Abbreviation (initialised from `IScrBookRef.BookAbbrev`) |
| `BookIdRA` | `IScrBookRef` | Reference to the canonical book-naming metadata |
| `TitleOA` | `IStText` | Book title (may contain Main Title + SubTitle paragraphs) |
| `IdText` | `string` | ID line from standard-format files (import/export) |
| `FootnotesOS` | `ILcmOwningSequence<IScrFootnote>` | Footnotes owned by this book |
| `ImportedCheckSum` | `string` | Checksum of last import from an external source (e.g., Paratext) |
| `ImportedBtCheckSum` | `IMultiUnicode` | Per-writing-system checksums for imported back translations |

**Key Properties (business-layer additions from `InterfaceAdditions.cs`):**
| Property | Type | Description |
|---|---|---|
| `BookId` | `string` | SIL 3-letter book code derived from `CanonicalNum` (e.g., `MAT`) |
| `BestUIName` | `string` | Best available name for UI display |
| `BestUIAbbrev` | `string` | Best available abbreviation for UI |
| `FirstSection` | `IScrSection` | First section in the book |
| `FirstScriptureSection` | `IScrSection` | First non-introduction section |
| `LastSection` | `IScrSection` | Last section in the book |
| `Paragraphs` | `IEnumerable<IScrTxtPara>` | All paragraphs in natural order (title → intro → scripture) |
| `BackTransWs` | `HashSet<int>` | Writing-system HVOs that have back translations in this book |

**Relationships:**
- Owned by: `IScripture` (via `ScriptureBooksOS`)
- Owns: Multiple `IScrSection`, `IScrFootnote`, title `IStText`
- References: `IScrBookRef` (via `BookIdRA`)

---

#### **IScrSection** - Scripture Section / Passage (ICmObject)
A passage-level division within a book, typically defined by a section heading.
Example: Matthew 1:1–17 — "The Genealogy of Jesus" in the NIV.

**Key Properties (generated):**
| Property | Type | Description |
|---|---|---|
| `HeadingOA` | `IStText` | Section heading (may be multi-paragraph with heading/sub-heading styles) |
| `ContentOA` | `IStText` | Section body — the actual verse material (multi-paragraph) |
| `VerseRefStart` | `int` | Start reference in **BBCCCVVV** format (BB=book, CCC=chapter, VVV=verse) |
| `VerseRefEnd` | `int` | End reference in **BBCCCVVV** format |
| `VerseRefMin` | `int` | Minimum reference found in section (calculated, stored for convenience) |
| `VerseRefMax` | `int` | Maximum reference found in section (calculated, stored for convenience) |

**Key Properties (business-layer additions):**
| Property | Type | Description |
|---|---|---|
| `IsIntro` | `bool` | Whether this is an introduction section |
| `ContainsChapter(int)` | method | Whether the section contains a given chapter number |
| `ContentParagraphCount` | `int` | Number of content paragraphs |
| `HeadingParagraphCount` | `int` | Number of heading paragraphs |
| `Paragraphs` | `IEnumerable<IScrTxtPara>` | All paragraphs — headings first, then content |
| `IsFirstScriptureSection` | `bool` | Whether this is the first non-intro section |
| `PreviousSection` | `IScrSection` | Previous section (or null) |
| `NextSection` | `IScrSection` | Next section (or null) |
| `FirstContentParagraph` | `IStTxtPara` | First body paragraph |
| `LastContentParagraph` | `IStTxtPara` | Last body paragraph |

**Reference Encoding (BBCCCVVV):**
The `VerseRefStart` / `VerseRefEnd` integers encode a full scripture reference:
- **BB** — book number (01–66, redundant since section is owned by a book)
- **CCC** — chapter number (001–150)
- **VVV** — verse number (001–176)

Example: Matthew 24:16 → `40024016`

**Relationships:**
- Owned by: `IScrBook` (via `SectionsOS`)
- Owns: Heading `IStText` and Content `IStText`

---

#### **IScrTxtPara** - Scripture Paragraph (extends IStTxtPara)
A thin subclass of `IStTxtPara` that identifies paragraphs belonging to
Scripture. The generated interface adds **no new properties**; all additions
come from the business layer.

**Key Properties (business-layer additions):**
| Property | Type | Description |
|---|---|---|
| `Context` | `ContextValues` | Context of the paragraph (e.g., Scripture body, intro, title) |
| `DefaultStyleName` | `string` | Default style based on context/structure |
| `OwningSection` | `IScrSection` | The section that owns this paragraph (null if in a book title) |
| `HasChapterOrVerseNumbers()` | `bool` | Whether the paragraph contains chapter or verse number runs |

**Key Inherited Properties (from `IStTxtPara`):**
- `Contents` (ITsString) — The text string with embedded formatting and writing-system runs
- `SegmentsOS` (ILcmOwningSequence<ISegment>) — Sentence/clause segments → interlinear pipeline
- `ParseIsCurrent` (bool) — Whether the paragraph has been parsed/segmented
- `TranslationsOC` (ILcmOwningCollection<ICmTranslation>) — Back translations

**Convergence Point:** Once an `IScrTxtPara` is segmented, its `SegmentsOS`
contains the same `ISegment` objects used for all interlinear analysis.
Chapter and verse references are encoded as character-style runs within
the paragraph's `Contents` string, not as separate structural objects.

**Relationships:**
- Owned by: `IStText` (which is owned by an `IScrSection` heading or content)
- Owns: Multiple `ISegment` objects (inherited)

---

#### **IScrBookRef** - Canonical Book Naming Metadata (ICmObject)
Stores default naming metadata for a canonical scripture book across writing systems.
Managed by `IScrRefSystem` which holds the complete set of book references.

**Key Properties:**
| Property | Type | Description |
|---|---|---|
| `BookName` | `IMultiUnicode` | Full book name per writing system (e.g., "2 Corinthians") |
| `BookAbbrev` | `IMultiUnicode` | Abbreviated name per writing system (e.g., "2 Cor.") |
| `BookNameAlt` | `IMultiUnicode` | Alternate full name per writing system (e.g., "II Corinthians") |

**Relationships:**
- Owned by: `IScrRefSystem` (via `BooksOS`)
- Referenced by: `IScrBook` (via `BookIdRA`)

> **Note:** The 3-letter UBS book reference code (e.g., `MAT`, `GEN`) is no
> longer stored in the model — it is managed by the business layer and derived
> from `IScrBook.CanonicalNum` via `BCVRef.NumberToBookCode()`.

---

#### **IScrRefSystem** - Scripture Reference System (ICmObject)
Stores the complete set of canonical book names and abbreviations. One per project.

**Key Properties:**
| Property | Type | Description |
|---|---|---|
| `BooksOS` | `ILcmOwningSequence<IScrBookRef>` | Ordered collection of all canonical book references |

**Relationships:**
- Owns: Multiple `IScrBookRef` objects (one per canonical book)

---

#### **IScrFootnote** - Scripture Footnote (extends IStFootnote)
Footnotes attached to scripture text, owned at the book level.

**Key Properties:**
| Property | Type | Description |
|---|---|---|
| `ParaContainingOrcRA` | `IScrTxtPara` | The scripture paragraph containing the ORC (Object Replacement Character) marker for this footnote |

**Relationships:**
- Owned by: `IScrBook` (via `FootnotesOS`)
- References: The `IScrTxtPara` that anchors the footnote in the text

---

#### **IScrDraft** - Archived Draft
A saved snapshot of scripture books, used for version comparison and recovery.

**Relationships:**
- Owned by: `IScripture` (via `ArchivedDraftsOC`)
- Owns: Copies of `IScrBook` objects

---

#### **ISegment** - Analyzable Unit (Sentence/Clause)
An `ISegment` represents a sentence or clause-level unit that can be analyzed word-by-word.

**Key Properties:**
- `BeginOffset` (int): Character offset in paragraph where segment starts
- `EndOffset` (int): Character offset where segment ends
- `AnalysesRS` (ILcmReferenceSequence<IAnalysis>): Ordered sequence of word/punctuation analyses
- `FreeTranslation` (IMultiString): Free (idiomatic) translation
- `LiteralTranslation` (IMultiString): Word-for-word translation
- `NotesOS` (ILcmOwningSequence<INote>): Notes about the segment
- `BaselineText` (ITsString): The actual text of this segment

**Relationships:**
- Owned by: `IStTxtPara`
- References: Multiple `IAnalysis` objects (wordforms, analyses, glosses, or punctuation)

**Cardinality:** One-to-many (segment → analyses)

**Notable Constraints:** BeginOffset and EndOffset define substring boundaries within the paragraph's Contents.

---

### Analysis & Annotation

#### **IAnalysis** - Base Analysis Interface
A unifying interface for different levels of linguistic analysis.

**Implementors:**
- `IWfiWordform` - Unannotated word form
- `IWfiAnalysis` - Morphologically analyzed word
- `IWfiGloss` - Specific meaning/gloss of an analysis
- `IPunctuationForm` - Punctuation marks

**Key Methods:**
- `Wordform`: Returns the associated wordform (or null for punctuation)
- `Analysis`: Returns the associated analysis (if any)
- `GetForm(int ws)`: Returns the form in a specific writing system
- `HasWordform`: Boolean indicating if this is a real word (not punctuation)

**Design Pattern:** This interface allows segments to reference different levels of specificity for each word occurrence.

---

#### **IPunctuationForm** - Punctuation
Represents punctuation marks and other non-word tokens in text.

**Key Properties:**
- `Form` (ITsString): The punctuation character(s)

**Relationships:**
- Referenced by: `ISegment.AnalysesRS` (interspersed with wordforms)
- Does NOT have: Analyses, glosses, or morphological breakdown

**Design Pattern:** Punctuation forms are lightweight objects that allow proper representation of sentence structure without forcing linguistic analysis on non-linguistic elements.

**Notable Features:**
- Common punctuation: `.`, `!`, `?`, `,`, `'`, `"`, `<`, `>`
- Hard line breaks are also treated as punctuation
- Numbers can be treated as wordforms or punctuation depending on configuration
- Factory method: `WfiWordformServices.FindOrCreatePunctuationform()`

**Usage:**
```
ISegment.AnalysesRS might contain:
  [0] IWfiWordform: "Hello"
  [1] IPunctuationForm: ","
  [2] IWfiWordform: "world"
  [3] IPunctuationForm: "!"
```

---

#### **IWfiWordform** - Word Form (Unanalyzed)
Represents a surface word form as it appears in text, before morphological analysis.

**Key Properties:**
- `Form` (IMultiUnicode): The word form in various writing systems
- `AnalysesOC` (ILcmOwningCollection<IWfiAnalysis>): Possible morphological analyses
- `SpellingStatus` (int): Correct/incorrect/undecided spelling status
- `Checksum` (int): Parser result checksum for change detection

**Relationships:**
- Referenced by: Multiple `ISegment.AnalysesRS` (many text occurrences)
- Owns: Multiple `IWfiAnalysis` objects (possible morphological breakdowns)

**Cardinality:** One-to-many (wordform → analyses)

**Notable Features:**
- Serves as concordance key (tracks all text occurrences)
- Can exist without any morphological analysis (just surface form)
- `OccurrencesInTexts`: Virtual property returning all segments containing this wordform

---

#### **IWfiAnalysis** - Morphological Analysis
Represents one possible morphological breakdown of a wordform.

**Key Properties:**
- `MorphBundlesOS` (ILcmOwningSequence<IWfiMorphBundle>): Ordered morpheme breakdowns
- `CategoryRA` (IPartOfSpeech): Part of speech for the whole word
- `MeaningsOC` (ILcmOwningCollection<IWfiGloss>): Possible meanings/glosses
- `MsFeaturesOA` (IFsFeatStruc): Morphosyntactic features
- `EvaluationsRC` (ILcmReferenceCollection<ICmAgentEvaluation>): Parser/human approvals

**Relationships:**
- Owned by: `IWfiWordform`
- Owns: Multiple `IWfiMorphBundle` (morpheme-by-morpheme breakdown)
- Owns: Multiple `IWfiGloss` (different contextual glosses)
- Referenced by: `ISegment.AnalysesRS` when this analysis is chosen

**Cardinality:** One-to-many (analysis → morpheme bundles, glosses)

**Design Pattern:** Allows multiple competing analyses per wordform, with human/parser evaluation tracking.

---

#### **IWfiMorphBundle** - Morpheme Instance
Represents one morpheme within a morphological analysis, linking text occurrence to lexicon.

**Key Properties:**
- `Form` (IMultiString): The actual form of this morpheme in context
- `MorphRA` (IMoForm): Link to lexicon allomorph
- `SenseRA` (ILexSense): Link to lexicon sense (meaning)
- `MsaRA` (IMoMorphSynAnalysis): Link to morphosyntactic analysis in lexicon
- `InflTypeRA` (ILexEntryInflType): Inflection type if applicable

**Relationships:**
- Owned by: `IWfiAnalysis`
- References: `IMoForm` (lexicon allomorph), `ILexSense` (lexicon meaning), `IMoMorphSynAnalysis` (grammatical info)

**Cardinality:** Many-to-one (bundle → lexicon entries)

**This is the critical link between TEXT and LEXICON!**

---

#### **IWfiGloss** - Contextual Gloss
Represents a specific gloss/meaning of an analysis in a particular context.

**Key Properties:**
- `Form` (IMultiUnicode): The gloss text in various analysis languages

**Relationships:**
- Owned by: `IWfiAnalysis`
- Referenced by: `ISegment.AnalysesRS` when this specific gloss is chosen

**Cardinality:** Many-to-one (gloss → analysis)

**Usage Pattern:** Allows selecting the most appropriate gloss for a specific text occurrence without creating new analyses.

---

### Lexicon

#### **ILexEntry** - Lexical Entry
Represents a dictionary entry (lexeme).

**Key Properties:**
- `LexemeFormOA` (IMoForm): The citation/lexeme form
- `CitationForm` (IMultiUnicode): Form used in dictionary citations (defaults to lexeme form)
- `SensesOS` (ILcmOwningSequence<ILexSense>): Ordered list of meanings
- `MorphoSyntaxAnalysesOC` (ILcmOwningCollection<IMoMorphSynAnalysis>): Grammatical information (MSAs)
- `AlternateFormsOS` (ILcmOwningSequence<IMoForm>): Allomorphs/variants
- `PronunciationsOS` (ILcmOwningSequence<ILexPronunciation>): Pronunciation info
- `EtymologyOS` (ILcmOwningSequence<ILexEtymology>): Etymology information
- `HomographNumber` (int): Distinguishes homographs
- `DateCreated`, `DateModified` (DateTime): Timestamps
- `DoNotUseForParsing` (bool): Exclude from automatic analysis

**Relationships:**
- Owns: `ILexSense` (meanings), `IMoForm` (forms), `IMoMorphSynAnalysis` (grammar)
- Referenced by: `IWfiMorphBundle` (from text analysis)

**Cardinality:** 
- One-to-many (entry → senses, allomorphs, MSAs)
- Many-to-many (entry ← text occurrences via morpheme bundles)

---

#### **ILexSense** - Word Sense (Meaning)
Represents one meaning/sense of a lexical entry.

**Key Properties:**
- `Gloss` (IMultiUnicode): Short gloss in analysis languages
- `Definition` (IMultiString): Full definition (with formatting)
- `MorphoSyntaxAnalysisRA` (IMoMorphSynAnalysis): Link to grammatical information
- `ExamplesOS` (ILcmOwningSequence<ILexExampleSentence>): Usage examples
- `SensesOS` (ILcmOwningSequence<ILexSense>): Subsenses (recursive)
- `SemanticDomainsRC` (ILcmReferenceCollection<ICmSemanticDomain>): Semantic classification
- `PicturesOS` (ILcmOwningSequence<ICmPicture>): Associated images
- `AnthroCodesRC`, `DomainTypesRC`, `UsageTypesRC`: Various classifications

**Relationships:**
- Owned by: `ILexEntry` or another `ILexSense` (subsense)
- Referenced by: `IWfiMorphBundle.SenseRA`
- References: `IMoMorphSynAnalysis` (grammatical behavior)

**Cardinality:** One-to-one (sense → MSA), many-to-many (sense ← text occurrences)

---

#### **IMoForm** - Allomorph/Word Form
Represents a phonological/orthographic form (allomorph) of a morpheme or lexeme.

**Key Properties:**
- `Form` (IMultiUnicode): The actual form in various writing systems
- `MorphTypeRA` (IMoMorphType): Type (root, prefix, suffix, stem, etc.)
- `IsAbstract` (bool): Whether this is an abstract underlying form

**Subclasses:**
- `IMoStemAllomorph`: For stems/roots
- `IMoAffixAllomorph`: For affixes (with environment constraints)

**Relationships:**
- Owned by: `ILexEntry` (in `LexemeFormOA` or `AlternateFormsOS`)
- Referenced by: `IWfiMorphBundle.MorphRA`

**Cardinality:** Many-to-many (forms ← text via morpheme bundles)

---

#### **IMoMorphSynAnalysis** (MSA) - Morphosyntactic Information
Represents the grammatical behavior of a morpheme or word.

**Key Properties:**
- `ComponentsRS` (ILcmReferenceSequence<IMoMorphSynAnalysis>): For composite forms
- `GlossString` (string): Generated gloss from gloss items
- `GlossBundleRS` (ILcmReferenceSequence<IMoGlossItem>): Functional gloss elements

**Subclasses:**
- `IMoStemMsa`: For stems (links to PartOfSpeech, inflection class)
- `IMoDerivAffMsa`: For derivational affixes
- `IMoInflAffMsa`: For inflectional affixes
- `IMoUnclassifiedAffixMsa`: For unanalyzed affixes

**Relationships:**
- Owned by: `ILexEntry`
- Referenced by: `ILexSense.MorphoSyntaxAnalysisRA`, `IWfiMorphBundle.MsaRA`, `IWfiAnalysis.CategoryRA`

**Cardinality:** Many-to-many (MSAs ← senses, analyses)

---

### Relationships & References

#### **Text-to-Lexicon Links**
The connection from text analysis to lexicon happens through **`IWfiMorphBundle`**:

```
ISegment.AnalysesRS → IWfiAnalysis → IWfiMorphBundle → {
    MorphRA → IMoForm (in ILexEntry.AlternateFormsOS or LexemeFormOA)
    SenseRA → ILexSense (in ILexEntry.SensesOS)
    MsaRA → IMoMorphSynAnalysis (in ILexEntry.MorphoSyntaxAnalysesOC)
}
```

**Design Pattern:** Three-way reference ensures:
1. Form identification (which allomorph)
2. Semantic identification (which meaning)
3. Grammatical identification (which grammatical behavior)

---

#### **Morphological Decomposition**
An `IWfiAnalysis` owns a **sequence** of `IWfiMorphBundle` objects representing the left-to-right morpheme breakdown:

```
Word: "unhappiness"
Analysis:
  MorphBundle[0]: un-    → Prefix, negation sense
  MorphBundle[1]: happy  → Stem, "happy" sense
  MorphBundle[2]: -ness  → Suffix, nominalization
```

**Ordering:** The sequence order corresponds to surface morpheme order (important for infixes, circumfixes).

---

#### **Analysis Relationships - Interlinear Tiers**
The model supports multiple "tiers" of specificity:

1. **Wordform Level** (IWfiWordform): Just the surface form - no analysis yet
2. **Analysis Level** (IWfiAnalysis): Morphological breakdown chosen
3. **Gloss Level** (IWfiGloss): Specific contextual meaning chosen
4. **Punctuation Level** (IPunctuationForm): Non-word tokens

A segment can reference any of these levels via `ISegment.AnalysesRS` (which holds `IAnalysis` interface):

```
ISegment.AnalysesRS[0] could be:
  - IWfiWordform (word not yet analyzed)
  - IWfiAnalysis (morphological analysis selected)
  - IWfiGloss (specific meaning selected for this context)
  - IPunctuationForm (punctuation mark)
```

---

#### **Lexical Relationships**
- **Subentries/Variants:** `ILexEntry.EntryRefsOS` contains `ILexEntryRef` objects linking to main entries
- **Complex Forms:** `ILexEntry.MainEntriesOrSensesRS` references component entries/senses
- **Sense Hierarchies:** `ILexSense.SensesOS` allows recursive subsenses

---

## Key Data Structures

### ISegment
**Purpose:** Represents a sentence/clause-level unit of text with word-by-word analysis.

**Key Properties:**
- `BeginOffset` (int): Start position in paragraph
- `AnalysesRS` (ILcmReferenceSequence<IAnalysis>): Word-by-word analyses (ordered)
- `FreeTranslation` (IMultiString): Sentence-level translation
- `LiteralTranslation` (IMultiString): Word-for-word translation
- `BaselineText` (ITsString): The actual text substring

**Relationships:** 
- Owned by `IStTxtPara`
- References multiple `IAnalysis` objects

**Cardinality:** One-to-many (segment → analyses, with order preserved)

**Notable Constraints:** 
- BeginOffset + sum of analysis lengths = EndOffset
- Must align with paragraph text boundaries

---

### IPunctuationForm
**Purpose:** Represents punctuation marks and other non-word tokens.

**Key Properties:**
- `Form` (ITsString): The punctuation character(s)

**Relationships:**
- Referenced from `ISegment.AnalysesRS`
- Implements `IAnalysis` but has no linguistic analysis

**Cardinality:** Many-to-many (punctuation form ← segment references)

**Design Pattern:** Simple immutable objects created on-demand via factory method.

---

### IWfiWordform
**Purpose:** Concordance key representing a surface word form across all texts.

**Key Properties:**
- `Form` (IMultiUnicode): The word form
- `AnalysesOC` (ILcmOwningCollection<IWfiAnalysis>): Competing morphological analyses
- `OccurrencesInTexts` (IEnumerable<ISegment>): All text occurrences (virtual)
- `SpellingStatus` (int): Spelling correctness flag

**Relationships:** 
- Owns multiple analyses
- Referenced from many segments

**Cardinality:** One-to-many (wordform → analyses, occurrences)

**Design Pattern:** Acts as "wordform inventory" - single object represents all occurrences of that form.

---

### IWfiAnalysis
**Purpose:** One possible morphological parse of a wordform.

**Key Properties:**
- `MorphBundlesOS` (ILcmOwningSequence<IWfiMorphBundle>): Morpheme-by-morpheme breakdown
- `CategoryRA` (IPartOfSpeech): Resulting part of speech
- `MeaningsOC` (ILcmOwningCollection<IWfiGloss>): Contextual glosses
- `EvaluationsRC` (ILcmReferenceCollection<ICmAgentEvaluation>): Human/parser opinions

**Relationships:** 
- Owned by `IWfiWordform`
- Owns morpheme bundles and glosses
- Referenced from segments

**Cardinality:** 
- One-to-many (analysis → bundles, glosses)
- Many-to-many (analysis ← segment occurrences)

---

### IWfiMorphBundle
**Purpose:** Links one morpheme occurrence to lexicon (form, sense, grammar).

**Key Properties:**
- `Form` (IMultiString): Contextual form
- `MorphRA` (IMoForm): Lexicon allomorph
- `SenseRA` (ILexSense): Lexicon sense
- `MsaRA` (IMoMorphSynAnalysis): Grammatical info

**Relationships:** The critical TEXT→LEXICON link!
- Owned by `IWfiAnalysis`
- References three lexicon objects

**Cardinality:** Many-to-one (bundles → lexicon items)

---

### ILexEntry
**Purpose:** Dictionary entry representing a lexeme.

**Key Properties:**
- `LexemeFormOA` (IMoForm): Primary form
- `AlternateFormsOS` (ILcmOwningSequence<IMoForm>): Allomorphs
- `SensesOS` (ILcmOwningSequence<ILexSense>): Meanings
- `MorphoSyntaxAnalysesOC` (ILcmOwningCollection<IMoMorphSynAnalysis>): Grammar

**Relationships:** 
- Owns forms, senses, MSAs
- Referenced from `IWfiMorphBundle`

**Cardinality:** One-to-many (entry → senses, forms, MSAs)

---

### ILexSense
**Purpose:** One meaning of a lexical entry.

**Key Properties:**
- `Gloss` (IMultiUnicode): Short gloss
- `Definition` (IMultiString): Full definition
- `MorphoSyntaxAnalysisRA` (IMoMorphSynAnalysis): Grammatical behavior
- `ExamplesOS` (ILcmOwningSequence<ILexExampleSentence>): Usage examples

**Relationships:**
- Owned by `ILexEntry` or `ILexSense` (subsense)
- References `IMoMorphSynAnalysis`
- Referenced from `IWfiMorphBundle.SenseRA`

**Cardinality:** One-to-one (sense → MSA)

---

### AnalysisOccurrence (Helper Class)
**Purpose:** Identifies a specific analysis at a specific position in a text.

**Key Properties:**
- `Segment` (ISegment): The containing segment
- `Index` (int): Position within segment's AnalysesRS
- `Analysis` (IAnalysis): The analysis at that position
- `BaselineText` (ITsString): The actual text
- `HasWordform` (bool): Whether this is a wordform (not punctuation)

**Usage:** Enables navigation through interlinear text, concordance generation, and text editing operations.

---

## Design Patterns & Architectural Choices

### **Identity & References**
- **GUIDs:** All objects have persistent GUIDs for cross-database references
- **HVOs (Handle to Virtual Object):** Integer IDs used for efficient runtime access
- **Reference Types:**
  - Owning references (parent-child, cascade delete)
  - Non-owning references (many-to-many associations)

---

### **Ownership & Containment Hierarchy**
```
IText
  └─ IStText
      └─ IStTxtPara (sequence)
          ├─ Contents (ITsString - the text)
          └─ ISegment (sequence)
              └─ AnalysesRS (references to IAnalysis)
                  ├─ IWfiWordform
                  ├─ IWfiAnalysis
                  ├─ IWfiGloss
                  └─ IPunctuationForm
```

**Parallel Lexicon Hierarchy:**
```
ILexDb
  └─ ILexEntry (collection)
      ├─ IMoForm (lexeme + alternates)
      ├─ ILexSense (sequence)
      │   └─ ILexSense (subsenses, recursive)
      └─ IMoMorphSynAnalysis (collection)
```

---

### **Immutability**
- **Mutable:** All model objects support modification
- **Change Tracking:** Unit of Work pattern tracks all changes for Undo/Redo
- **Timestamps:** Key objects (ILexEntry, IStText) have DateModified

---

### **Versioning/History**
- **Change Tracking:** Built into infrastructure via `IUnitOfWorkService`
- **Undo/Redo:** Full undo stack for all operations
- **Checksum:** `IWfiWordform.Checksum` detects when parser results have changed

---

### **Extensibility**
- **Custom Fields:** Support via `ICmPossibility` lists and extensibility mechanisms
- **Import Residue:** `ImportResidue` and `LiftResidue` properties preserve unmodeled data
- **Subclassing:** Many classes are abstract with concrete implementations

---

## Serialization & Persistence

### **Storage Format**
- **Primary:** XML-based serialization (see `ToXMLStringInternal`, `LoadFromDataStoreInternal` methods)
- **Backend:** Originally SQL Server, now supports multiple backends
- **Model Definition:** `MasterLCModel.xml` drives code generation via NVelocity templates

---

### **Import/Export**
- **LIFT (Lexicon Interchange Format):** Standard XML format for lexicon exchange
- **FLEX XML:** Native FieldWorks format
- **Standard Format (SFM):** Toolbox/MDF import/export
- **Residue Fields:** Preserve unprocessed import data (`ImportResidue`, `LiftResidue`)

---

### **Schema/Format Version**
- **Model Version:** Tracked in `MasterLCModel.xml`
- **Migration:** Automatic data migration between versions
- **Generated Code:** All model classes generated from XML definition ensures consistency

---

## Special Features or Constraints

### **Language-Specific Features**

#### **Writing Systems**
- **IMultiUnicode:** Properties support multiple writing systems (vernacular, analysis, pronunciation)
- **ITsString:** Rich text with embedded writing system and formatting info
- **Right-to-Left:** `IStText.RightToLeft` property for RTL scripts

#### **Linguistic Features**
- **Tone/Phonology:** `ILexPronunciation` supports phonetic representations
- **Morphology:** Full morpheme-based interlinear with environment constraints
- **Complex Features:** `IFsFeatStruc` (Feature Structures) for detailed grammatical analysis
- **Allomorphy:** Multiple `IMoForm` objects per entry with phonological environments

---

### **Performance Considerations**
- **Virtual Properties:** Many collections computed on-demand (e.g., `OccurrencesInTexts`)
- **Lazy Loading:** Collections initialized only when accessed
- **Caching:** `LcmCache` object provides central access point
- **Repositories:** Type-specific repositories for efficient queries
- **Parse Caching:** `ParseIsCurrent` flag prevents unnecessary re-parsing

---

### **Migration/Compatibility**
- **Legacy Support:** Model evolved from FDO (FieldWorks Data Objects)
- **Import Residue:** Preserves data from older formats
- **Backward Compatibility:** Careful versioning and data migration

---

### **Known Limitations**
- **Flat Segment Structure:** Segments don't nest (no hierarchical clause/phrase structure within sentences)
- **Single Parse:** While multiple analyses exist, only one can be "current" per occurrence
- **No Direct Syntax Trees:** The model focuses on morphology; syntax requires external representation
- **Punctuation Simplicity:** Punctuation forms have no internal structure or classification beyond the character itself

---

## Code Examples

### Example 1: Creating a Basic Interlinear Analysis

```csharp
// Get a segment from a text
IStTxtPara para = text.ContentsOA.ParagraphsOS[0] as IStTxtPara;
ISegment segment = para.SegmentsOS[0];

// Get the first wordform occurrence in the segment
IWfiWordform wordform = segment.AnalysesRS[0] as IWfiWordform;

// Create a new morphological analysis for the wordform
IWfiAnalysis analysis = Cache.ServiceLocator.GetInstance<IWfiAnalysisFactory>().Create();
wordform.AnalysesOC.Add(analysis);

// Create morpheme bundles (e.g., for "walked" = "walk" + "ed")
var bundle1 = Cache.ServiceLocator.GetInstance<IWfiMorphBundleFactory>().Create();
analysis.MorphBundlesOS.Add(bundle1);
bundle1.Form.VernacularDefaultWritingSystem = 
    TsStringUtils.MakeString("walk", Cache.DefaultVernWs);

var bundle2 = Cache.ServiceLocator.GetInstance<IWfiMorphBundleFactory>().Create();
analysis.MorphBundlesOS.Add(bundle2);
bundle2.Form.VernacularDefaultWritingSystem = 
    TsStringUtils.MakeString("ed", Cache.DefaultVernWs);

// Set the analysis as the chosen one for this occurrence
segment.AnalysesRS[0] = analysis;
```

### Example 2: Linking Text Word to Lexicon Entry

```csharp
// Assume we have an existing lexicon entry for "walk"
ILexEntry walkEntry = Cache.ServiceLocator.GetInstance<ILexEntryRepository>()
    .GetMatchingEntry(Cache.DefaultVernWs, "walk");
ILexSense walkSense = walkEntry.SensesOS[0]; // First sense
IMoMorphSynAnalysis walkMsa = walkSense.MorphoSyntaxAnalysisRA;

// Get the morpheme bundle from text analysis
IWfiMorphBundle bundle = analysis.MorphBundlesOS[0]; // The "walk" bundle

// Link the text occurrence to lexicon
bundle.MorphRA = walkEntry.LexemeFormOA; // Link to the allomorph
bundle.SenseRA = walkSense;               // Link to the meaning
bundle.MsaRA = walkMsa;                   // Link to grammatical info
```

### Example 3: Retrieving All Glosses for a Segment (Including Punctuation)

```csharp
ISegment segment = GetCurrentSegment();

// Iterate through each analysis in the segment
var glosses = new List<string>();
foreach (IAnalysis analysis in segment.AnalysesRS)
{
    if (analysis is IPunctuationForm punct)
    {
        // Just include the punctuation as-is
        glosses.Add(punct.Form.Text);
    }
    else if (analysis is IWfiGloss gloss)
    {
        // This occurrence has a specific gloss selected
        glosses.Add(gloss.Form.AnalysisDefaultWritingSystem.Text);
    }
    else if (analysis is IWfiAnalysis wfiAnalysis)
    {
        // Get the default gloss from the morpheme bundles
        var bundleGlosses = wfiAnalysis.MorphBundlesOS
            .Where(b => b.SenseRA != null)
            .Select(b => b.SenseRA.Gloss.AnalysisDefaultWritingSystem.Text);
        glosses.Add(string.Join("-", bundleGlosses));
    }
    else if (analysis is IWfiWordform wordform)
    {
        // Not yet analyzed - just show the form
        glosses.Add($"[{wordform.Form.VernacularDefaultWritingSystem.Text}]");
    }
}

// Result: e.g., ["he", "walk-PAST", "quickly", "."]
```

### Example 4: Creating Punctuation in a Segment

```csharp
// Create or find a punctuation form
ITsString periodForm = TsStringUtils.MakeString(".", Cache.DefaultVernWs);
IPunctuationForm period = WfiWordformServices.FindOrCreatePunctuationform(Cache, periodForm);

// Add it to the segment's analyses
segment.AnalysesRS.Append(period);

// The segment now ends with punctuation
```

---

## Model Diagram

```
                                TEXT STRUCTURE
┌─────────────────────────────────────────────────────────────────┐
│  IText (Document)                                               │
│    └─ IStText (Structured Text)                                │
│         └─ IStTxtPara (Paragraph)                              │
│              ├─ Contents: ITsString                             │
│              └─ ISegment (Sentence) ────────────────────┐      │
│                   └─ AnalysesRS: IAnalysis[] (ordered)  │      │
└─────────────────────────────────────────────────────────┼──────┘
                                                          │
                          ┌───────────────────────────────┘
                          │
                    ANALYSIS LEVEL (IAnalysis implementors)
          ┌───────────────┼───────────────┬──────────────┐
          │               │               │              │
    IWfiWordform    IWfiAnalysis    IWfiGloss    IPunctuationForm
    (surface form)  (morphology)    (meaning)    (punctuation)
          │               │               │              │
          └───owns────────┘               │              │
          │                               │              │
          └─────owns──────────────────────┘              │
                                                         │
                                             (no structure)
    
                    TEXT-TO-LEXICON BRIDGE
    ┌────────────────────────────────────────────────┐
    │  IWfiAnalysis                                  │
    │    └─ IWfiMorphBundle[] (morphemes)           │
    │         ├─ MorphRA ──────┐                    │
    │         ├─ SenseRA ──────┼───────┐            │
    │         └─ MsaRA ────────┼───────┼────┐       │
    └──────────────────────────┼───────┼────┼───────┘
                               │       │    │
                               ↓       ↓    ↓
                         LEXICON STRUCTURE
    ┌────────────────────────────────────────────────┐
    │  ILexEntry (Dictionary Entry)                  │
    │    ├─ LexemeFormOA: IMoForm ←─────────────────┼ Morph
    │    ├─ AlternateFormsOS: IMoForm[]             │
    │    ├─ SensesOS: ILexSense[] ←─────────────────┼ Sense
    │    │    ├─ Gloss: IMultiUnicode               │
    │    │    ├─ Definition: IMultiString            │
    │    │    ├─ MorphoSyntaxAnalysisRA ←───────────┼ MSA
    │    │    └─ ExamplesOS                          │
    │    └─ MorphoSyntaxAnalysesOC: IMoMorphSynAnalysis[] │
    └────────────────────────────────────────────────┘
```

---

## Analysis Notes

### **Terminology Choices**
- **"Wfi"** prefix: Wordform Inventory (legacy naming from earlier system)
- **"Msa"**: MorphoSyntactic Analysis (instead of full "MorphoSyntaxAnalysis")
- **"RS" suffix**: Reference Sequence (ordered references)
- **"RC" suffix**: Reference Collection (unordered references)
- **"OS" suffix**: Owning Sequence
- **"OC" suffix**: Owning Collection
- **"RA" suffix**: Reference Atomic (single reference)
- **"OA" suffix**: Owning Atomic (single owned object)

### **Implicit vs Explicit**

#### Explicit:
- Morpheme boundaries via `IWfiMorphBundle` sequence
- Text-to-lexicon links via three-way references (Morph, Sense, MSA)
- Segment boundaries via BeginOffset/EndOffset
- Punctuation placement via `IPunctuationForm` in `AnalysesRS`

#### Implicit:
- Word boundaries (derived from spacing and punctuation in paragraph Contents)
- Allomorph selection rules (referenced but not fully modeled)
- Phonological/morphological rules (external to this model)
- Punctuation classification (no grammatical properties stored)

---

### **Strengths**
1. **Flexible Analysis Levels:** Can represent text at wordform, analysis, gloss, or punctuation level
2. **Rich Lexicon Integration:** Three-way linking (form, meaning, grammar) is comprehensive
3. **Multilingual Support:** Built-in multi-writing-system support throughout
4. **Evaluation Tracking:** Parser vs. human decisions explicitly tracked
5. **Extensibility:** Import residue and possibility lists allow project-specific extensions
6. **Subsense Support:** Recursive sense structure handles complex polysemy
7. **Concordance-Ready:** Wordform inventory design makes concordances efficient
8. **Punctuation Handling:** Clean separation between linguistic words and non-linguistic tokens
9. **Text Integrity:** Punctuation preserved exactly as it appears in source text

---

### **Weaknesses**
1. **No Syntactic Structure:** No built-in phrase structure or constituent trees
2. **Flat Segmentation:** Segments can't nest hierarchically
3. **Complex Navigation:** Finding all occurrences requires virtual properties and searching
4. **MSA Sharing:** Senses share MSAs, but relationship can be unclear when MSAs are edited
5. **Morpheme Order Only:** No explicit morphotactic constraints beyond sequence order
6. **Performance:** Deep object graphs can be expensive to traverse for large texts
7. **Learning Curve:** The Wfi*/MSA/Morph terminology and three-way linking requires significant learning
8. **Punctuation Simplicity:** No grammatical classification of punctuation types (sentence-final, clause-separating, etc.)
9. **Mixed Analyses:** AnalysesRS mixes wordforms, analyses, glosses, and punctuation, requiring type checking

---

This model excels at **morphologically-rich interlinear analysis** with deep lexicon integration, making it ideal for field linguistics and language documentation. The four-tier analysis system (wordform → analysis → gloss, plus punctuation) provides flexibility for incremental annotation workflows while maintaining proper representation of text structure including non-linguistic elements.
