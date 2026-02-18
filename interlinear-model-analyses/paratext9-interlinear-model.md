# Interlinear Text Analysis Model Documentation

## Overview
- The system interlinearizes Scripture text (USFM/USX) by segmenting verses into lexeme clusters and attaching lexicon-based glosses and analyses, then persists those selections per verse and gloss language.
- Primary programming language(s): C# (.NET).
- Approximate number of model classes/types involved: ~20–30 across interlinear, lexicon, and word-analysis layers.

## Core Domain Concepts

### Text & Document Structure
- **Document/Text**: Text is represented as USFM/USX at the verse level; interlinearization operates on verse content and produces an `InterlinearVerse` with USFM and interlinearized USX output. See [Paratext/Interlinear/InterlinearVerse.cs](Paratext/Interlinear/InterlinearVerse.cs).
- **Segment/Line**: The primary segment unit is a verse (`VerseRef`) with per-verse stored data in `VerseData`. Each verse contains `ClusterData` and `PunctuationData` identified by `StringRange` offsets into the verse USFM. See [ParatextData/Interlinear/VerseData.cs](ParatextData/Interlinear/VerseData.cs).
- **Word/Token**: Tokens are represented as lexeme clusters (`LexemeCluster`) tied to a text range; clusters can represent a word, phrase, or word parse (morpheme breakdown). See [ParatextData/Linguistics/LexemeCluster.cs](ParatextData/Linguistics/LexemeCluster.cs).
- **Morpheme**: Morphemes are represented as `Lexeme` items within a `WordAnalysis`, with `LexemeType` indicating `Prefix`, `Suffix`, or `Infix`. There is also a separate XML interchange model (`WordFormInventoryInterchange`) for morpheme sequences. See [Paratext.LexicalContracts/LexemeType.cs](Paratext.LexicalContracts/LexemeType.cs) and [ParatextData/Linguistics/Morph/WordFormInventoryInterchange.cs](ParatextData/Linguistics/Morph/WordFormInventoryInterchange.cs).

### Analysis & Annotation
- **Gloss**: Glosses are stored as `LanguageText` implementations (`XmlLexiconGloss`) attached to `LexiconSense`. Gloss text is referenced during interlinearization and stored in per-verse data via sense IDs. See [ParatextData/Linguistics/LexiconData.cs](ParatextData/Linguistics/LexiconData.cs).
- **Interlinear Data**: Interlinear selections are persisted in `InterlinearData` and `VerseData` with `ClusterData` and `LexemeData`, referencing lexeme IDs and sense IDs rather than duplicating gloss text. See [ParatextData/Interlinear/InterlinearData.cs](ParatextData/Interlinear/InterlinearData.cs) and [ParatextData/Interlinear/VerseData.cs](ParatextData/Interlinear/VerseData.cs).
- **Annotation/Analysis**: Morphological analyses are represented as `WordAnalysis` (a sequence of `Lexeme`), and `LexemeCluster.Type` distinguishes word parses vs. word-level glossing. The model supports semantic domains, definitions, and grammatical categories in the `LexiconSense` interface, but the built-in XML lexicon returns empty values for these. See [Paratext.LexicalContracts/WordAnalysis.cs](Paratext.LexicalContracts/WordAnalysis.cs) and [Paratext.LexicalContracts/LexiconSense.cs](Paratext.LexicalContracts/LexiconSense.cs).

### Lexicon
- **Lexical Entry/Lexeme**: A lexeme is represented by the `Lexeme` interface and implemented by `XmlLexeme` in the built-in XML lexicon. Identity is derived from `LexemeKey`. See [Paratext.LexicalContracts/Lexeme.cs](Paratext.LexicalContracts/Lexeme.cs) and [ParatextData/Linguistics/LexiconData.cs](ParatextData/Linguistics/LexiconData.cs).
- **Word Form/Allomorph**: The core model provides `Lexeme.AlternateForms` and `LexicalRelation` interfaces; the XML lexicon returns empty sets, while integrated providers may surface allomorphs (e.g., `AllomorphEntry`). See [Paratext.LexicalContracts/Lexeme.cs](Paratext.LexicalContracts/Lexeme.cs) and [ParatextData/Linguistics/IntegratedLexicalProvider.cs](ParatextData/Linguistics/IntegratedLexicalProvider.cs).
- **Sense**: A `LexiconSense` represents a meaning with a unique ID and glosses per language. The XML lexicon implementation is `XmlLexiconSense`. See [Paratext.LexicalContracts/LexiconSense.cs](Paratext.LexicalContracts/LexiconSense.cs) and [ParatextData/Linguistics/LexiconData.cs](ParatextData/Linguistics/LexiconData.cs).
- **Example/Citation**: `Lexeme.CitationForm` exists in the interface, but the XML lexicon implementation returns `null`, and there is no explicit example/citation model in this built-in lexicon. See [Paratext.LexicalContracts/Lexeme.cs](Paratext.LexicalContracts/Lexeme.cs) and [ParatextData/Linguistics/LexiconData.cs](ParatextData/Linguistics/LexiconData.cs).

### Relationships & References
- **Text-to-Lexicon Links**: Interlinear data stores `LexemeId` and `SenseId` in `LexemeData`, referencing lexicon entries and senses by ID. See [ParatextData/Interlinear/VerseData.cs](ParatextData/Interlinear/VerseData.cs).
- **Morphological Decomposition**: `WordAnalysis` is an ordered list of `Lexeme` items; `LexemeCluster` wraps a `WordAnalysis` plus a `StringRange` to tie it to a text span. See [ParatextData/Linguistics/LexemeCluster.cs](ParatextData/Linguistics/LexemeCluster.cs) and [Paratext.LexicalContracts/WordAnalysis.cs](Paratext.LexicalContracts/WordAnalysis.cs).
- **Lexical Relationships**: The model includes `LexicalRelation` and `Lexeme.AlternateForms`, but the built-in XML lexicon returns empty relationships; richer relations are expected from external lexicon providers. See [Paratext.LexicalContracts/LexicalRelation.cs](Paratext.LexicalContracts/LexicalRelation.cs).

## Key Data Structures

### LexiconData
- **Purpose**: Built-in XML lexicon and word-analysis store.
- **Key Properties**:
  - `Entries`: map from `LexemeKey` to `XmlLexiconEntry`.
  - `Analyses`: map from word string to `ArrayOfLexeme` (legacy word analyses).
  - `Language`, `FontName`, `FontSize`.
  - `Lexemes`: enumerable view over entries.
  - Events: `LexemeAdded`, `LexiconSenseAdded`, `LexiconGlossAdded`.
- **Relationships**: Owns `XmlLexiconEntry` and `XmlLexiconSense`; creates `XmlLexeme` wrappers.
- **Cardinality**: One `LexiconData` → many `XmlLexiconEntry` → many `XmlLexiconSense` → many `XmlLexiconGloss`.
- **Notable Constraints**: `LexemeKey` must be unique; homographs are encoded in IDs. See [ParatextData/Linguistics/LexiconData.cs](ParatextData/Linguistics/LexiconData.cs).

### XmlLexeme
- **Purpose**: Concrete `Lexeme` implementation backed by `LexiconData`.
- **Key Properties**:
  - `Id` (from `LexemeKey.Id`).
  - `Type` (`LexemeType`).
  - `LexicalForm`.
  - `DisplayString` (formatted based on type).
  - `HomographNumber`.
  - `Senses` (from entry’s `XmlLexiconSense` list).
- **Relationships**: Wraps `LexemeKey` and links to `XmlLexiconEntry` via `LexiconData`.
- **Cardinality**: One `XmlLexeme` → many `XmlLexiconSense`.
- **Notable Constraints**: `CitationForm` is `null` in the XML implementation. See [ParatextData/Linguistics/LexiconData.cs](ParatextData/Linguistics/LexiconData.cs).

### XmlLexiconSense
- **Purpose**: Sense of a lexeme with glosses per language.
- **Key Properties**:
  - `Id` (unique within entry, generated as random 8-char base64 substring).
  - `Glosses`: list of `XmlLexiconGloss`.
  - `SenseNumber` (derived from index).
- **Relationships**: Belongs to one `XmlLexiconEntry`.
- **Cardinality**: One sense → many glosses.
- **Notable Constraints**: Only one gloss per language is expected by contract. See [ParatextData/Linguistics/LexiconData.cs](ParatextData/Linguistics/LexiconData.cs).

### LexemeKey
- **Purpose**: Stable identifier for lexeme entries.
- **Key Properties**:
  - `Type`, `LexicalForm`, `Homograph`.
  - `Id` string formatted as `<Type>:<Form>[:<Homograph>]`.
- **Relationships**: Used as key in lexicon entry maps and serialized in XML.
- **Cardinality**: One key ↔ one lexeme entry.
- **Notable Constraints**: Lexical form is expected to be normalized for the project. See [ParatextData/Linguistics/LexemeKey.cs](ParatextData/Linguistics/LexemeKey.cs).

### WordAnalysis (and SimpleWordAnalysis)
- **Purpose**: Ordered morphemic analysis of a word into lexemes.
- **Key Properties**:
  - `Word` (normalized surface form).
  - `Length` and indexer for lexeme access.
- **Relationships**: Contains a sequence of `Lexeme`.
- **Cardinality**: One word analysis → many lexemes.
- **Notable Constraints**: Word must be consistently normalized; `SimpleWordAnalysis` enforces this. See [ParatextData/Linguistics/SimpleWordAnalysis.cs](ParatextData/Linguistics/SimpleWordAnalysis.cs).

### LexemeCluster
- **Purpose**: Ties a `WordAnalysis` to a specific text span and analysis type.
- **Key Properties**:
  - `Morphology` (`WordAnalysis`).
  - `TextRange` (`StringRange`).
  - `IsGuess`.
  - `Type` (Word, Phrase, WordParse, Other).
- **Relationships**: Contains a `WordAnalysis` and references text offsets.
- **Cardinality**: One cluster → one analysis; analysis → many lexemes.
- **Notable Constraints**: Cluster `Id` concatenates lexeme IDs and text-range. See [ParatextData/Linguistics/LexemeCluster.cs](ParatextData/Linguistics/LexemeCluster.cs).

### VerseData / ClusterData / LexemeData
- **Purpose**: Persisted interlinear selections per verse.
- **Key Properties**:
  - `VerseData.Hash` (approval hash of verse USFM).
  - `ClusterData.TextRange`, `ClusterData.Lexemes`, `ClusterData.Excluded`.
  - `LexemeData.LexemeId`, `LexemeData.SenseId`.
- **Relationships**: Verse → many clusters; cluster → many lexemes.
- **Cardinality**: One verse → many clusters → many lexeme selections.
- **Notable Constraints**: `ClusterData.Matches` compares text ranges and lexeme IDs. See [ParatextData/Interlinear/VerseData.cs](ParatextData/Interlinear/VerseData.cs).

### InterlinearLexemeCluster / InterlinearLexeme
- **Purpose**: In-memory interlinearized cluster with gloss status and display info.
- **Key Properties**:
  - `InterlinearLexemeCluster.Cluster` (`LexemeCluster`).
  - `InterlinearLexeme.GlossState`, `SenseId`, `GlossText`, `CasedGlossText`, `Score`.
- **Relationships**: Cluster contains `InterlinearLexeme` instances linked to `Lexeme`.
- **Cardinality**: One interlinear cluster → many interlinear lexemes.
- **Notable Constraints**: Approval requires `GlossState` to be `Specific` or `Excluded`. See [Paratext/Interlinear/InterlinearLexemeCluster.cs](Paratext/Interlinear/InterlinearLexemeCluster.cs).

### InterlinearData / InterlinearDataFile
- **Purpose**: Persisted per-book interlinear data store per gloss language.
- **Key Properties**:
  - `GlossLanguage`, `BookId`.
  - `Verses` map from verse reference string to `VerseData`.
- **Relationships**: Owns verse data for a book; saves to XML on disk.
- **Cardinality**: One file → many verses.
- **Notable Constraints**: Glosses are stored by lexeme/sense IDs only. See [ParatextData/Interlinear/InterlinearData.cs](ParatextData/Interlinear/InterlinearData.cs).

## Design Patterns & Architectural Choices

- **Identity & References**: Lexemes are identified by string IDs derived from `LexemeKey` (type, form, homograph). Senses use randomly generated 8-character IDs. Interlinear data references lexemes and senses by ID rather than copying gloss text. See [ParatextData/Linguistics/LexemeKey.cs](ParatextData/Linguistics/LexemeKey.cs) and [ParatextData/Interlinear/VerseData.cs](ParatextData/Interlinear/VerseData.cs).
- **Ownership & Containment**: `InterlinearData` → `VerseData` → `ClusterData` → `LexemeData`; in-memory interlinearization uses `InterlinearVerse` → `InterlinearLexemeCluster` → `InterlinearLexeme`. See [ParatextData/Interlinear/InterlinearData.cs](ParatextData/Interlinear/InterlinearData.cs) and [Paratext/Interlinear/InterlinearVerse.cs](Paratext/Interlinear/InterlinearVerse.cs).
- **Immutability**: Most model objects are mutable POCOs; `SimpleWordAnalysis` and `LexemeCluster` store readonly references but are not strictly immutable.
- **Versioning/History**: No explicit version fields; `VerseData.Hash` is used to track approvals and detect text changes. See [ParatextData/Interlinear/VerseData.cs](ParatextData/Interlinear/VerseData.cs).
- **Extensibility**: `LexiconV2` and `WordAnalyses` interfaces allow external lexicon providers (e.g., FLEx). The built-in XML lexicon is one implementation. See [Paratext.LexicalContractsV2/LexiconV2.cs](Paratext.LexicalContractsV2/LexiconV2.cs).

## Serialization & Persistence

- **Storage Format**: XML serialization is used for the built-in lexicon (Lexicon.xml), word analyses (WordAnalyses.xml), and interlinear data per book (Interlinear_{language}/Interlinear_{language}_{book}.xml). See [ParatextData/Linguistics/XmlLexicon.cs](ParatextData/Linguistics/XmlLexicon.cs), [ParatextData/Linguistics/WordAnalysesFile.cs](ParatextData/Linguistics/WordAnalysesFile.cs), and [ParatextData/Interlinear/InterlinearData.cs](ParatextData/Interlinear/InterlinearData.cs).
- **Import/Export**: A separate XML interchange model exists for wordform inventory/morpheme sequences for FLEx integration. See [ParatextData/Linguistics/Morph/WordFormInventoryInterchange.cs](ParatextData/Linguistics/Morph/WordFormInventoryInterchange.cs).
- **Schema/Format Version**: No explicit schema/version fields were found in the interlinear or lexicon XML models.

## Special Features or Constraints

- **Language-Specific Features**: Supports morpheme-level analyses with `Prefix`, `Suffix`, and `Infix` lexeme types; glosses are language-tagged. See [Paratext.LexicalContracts/LexemeType.cs](Paratext.LexicalContracts/LexemeType.cs) and [ParatextData/Linguistics/LexiconData.cs](ParatextData/Linguistics/LexiconData.cs).
- **Performance Considerations**: Uses dictionaries for lexicon and word-analysis lookups and caches interlinear data per book via `InterlinearDataFile`.
- **Migration/Compatibility**: `ArrayOfLexeme` exists for legacy deserialization, and interlinear merge logic repairs missing gloss IDs during merges. See [ParatextData/Linguistics/LexiconData.cs](ParatextData/Linguistics/LexiconData.cs) and [ParatextData/Interlinear/InterlinearData.cs](ParatextData/Interlinear/InterlinearData.cs).
- **Known Limitations**: The built-in XML lexicon does not store citation forms, definitions, semantic domains, or lexical relations; these are surfaced only by other lexicon implementations.

## Code Examples

```csharp
// 1. Create a basic interlinear analysis of a word
var lexicon = new LexiconData { ScrText = scrText };
var lexeme = lexicon.CreateLexeme(LexemeType.Word, "word1");
lexicon.AddLexeme(lexeme);
var sense = lexeme.AddSense();
sense.AddGloss("en", "gloss1");

WordAnalysis analysis = lexicon.CreateWordAnalysis("word1", new[] { lexeme });
var cluster = new LexemeCluster(analysis, new StringRange(0, 5), isGuess: false);
```

```csharp
// 2. Link a word in text to a lexicon entry (persisted in VerseData)
var lexemeData = new LexemeData { LexemeId = lexeme.Id, SenseId = sense.Id };
var clusterData = new ClusterData
{
    TextRange = new StringRange(0, 5),
    Lexemes = new List<LexemeData> { lexemeData }
};
var verseData = new VerseData { Clusters = new List<ClusterData> { clusterData } };
```

```csharp
// 3. Retrieve all glosses for a given text segment
var segment = verseData.Clusters.First(c => c.TextRange.Equals(new StringRange(0, 5)));
var glosses = segment.Lexemes
    .Select(ld => lexicon[ld.LexemeId])
    .Where(l => l != null)
    .SelectMany(l => l.Senses)
    .Where(s => s.Id == segment.Lexemes.First().SenseId)
    .SelectMany(s => s.Glosses)
    .Select(g => g.Text)
    .ToList();
```

## Model Diagram

```
InterlinearDataFile
  └─ InterlinearData
       └─ VerseData (by VerseRef)
            ├─ ClusterData (TextRange)
            │    └─ LexemeData (LexemeId, SenseId)
            └─ PunctuationData

LexiconData
  ├─ LexemeKey → XmlLexeme
  │    └─ XmlLexiconEntry
  │         └─ XmlLexiconSense
  │              └─ XmlLexiconGloss (LanguageText)
  └─ WordAnalyses (SimpleWordAnalysis → Lexeme[])

LexemeCluster (WordAnalysis + TextRange)
  └─ InterlinearLexemeCluster
       └─ InterlinearLexeme (GlossState, SenseId, GlossText)
```

---

## Analysis Notes

- **Terminology Choices**: The term “lexeme cluster” represents an analysis for a single text range and may be a word, phrase, or morphemic parse; “lexeme” also covers morphemes (prefix/suffix/infix).
- **Implicit vs Explicit**: Interlinear data stores only IDs; gloss text and other lexical metadata are implicitly resolved from the lexicon at render time.
- **Strengths**: Clean separation between interlinear selections and lexicon data enables multiple lexicon backends and avoids duplicating gloss text.
- **Weaknesses**: Built-in XML lexicon omits richer lexical metadata (definitions, semantic domains, citations, relations), limiting expressiveness unless an external lexicon is used.
