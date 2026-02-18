# Interlinear Text Analysis Model Documentation

## Overview

- **Brief description**: This codebase implements an interlinear-like “aligner” workflow for biblical text analysis, linking tokenized verses to lexicon headwords/senses and to cross-language alignments. The core data model lives in a TypeORM-backed SQLite layer and is mirrored by API-facing TypeScript types used by the UI and services.
- **Primary programming language(s)**: TypeScript (core model/types), with supporting C/Python alignment engine (Eflomal) for automatic alignment.
- **Approximate number of model classes/types involved**: ~25–35 core model types (entities + API DTOs), plus auxiliary lexicon/asset types.

---

## Core Domain Concepts

### Text & Document Structure

- **Document/Text**: Represented as collections of verses (BCV identifiers) and tokens. The UI/API model uses `Verse` and `FullVerse` with token arrays. See [src/api/types/verses.ts](src/api/types/verses.ts#L1-L94) and [src/api/types/instances.ts](src/api/types/instances.ts#L1-L120).
- **Segment/Line**: A “segment” is effectively a verse (BCV). Verse objects (`Verse`, `FullVerse`) contain `tokens` and verse identifiers (`verseId` / `verseBcv`). See [src/api/types/verses.ts](src/api/types/verses.ts#L1-L62).
- **Word/Token**: Represented by `Token` (API) and `Instance` (database entity). Tokens/instances store text, lemma, gloss, and BCVWP identifiers. See [src/api/types/instances.ts](src/api/types/instances.ts#L1-L120) and [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L150-L520).
- **Morpheme**: No explicit morpheme class. Partial support via `partNum` and `instanceBcvwp` (word-part identifier) in `Token`/`Instance`, and via morphological fields in Macula TSV rows. See [src/api/types/instances.ts](src/api/types/instances.ts#L1-L120) and [data-manager/src/asset-types.ts](data-manager/src/asset-types.ts).

### Analysis & Annotation

- **Gloss**: Attached to tokens/instances as `gloss` / `glossText`. See [src/api/types/instances.ts](src/api/types/instances.ts#L1-L120) and [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L420-L520).
- **Interlinear Data**: The interlinear-like view is represented via `Token.interlinearText` and alignments linking source/target tokens. The system’s “aligner” terminology maps to alignment records that connect tokens across translations. See [src/api/types/instances.ts](src/api/types/instances.ts#L1-L120) and [src/api/types/alignments.ts](src/api/types/alignments.ts#L300-L340).
- **Annotation/Analysis**: Linguistic annotations include lemma, normalized text, POS/morph features via Macula TSV rows (e.g., `morph`, `pos`, `stem`), and status flags (`termStatusNum`, `excludeFlag`, `requiredFlag`). See [src/api/types/instances.ts](src/api/types/instances.ts#L1-L120) and [data-manager/src/asset-types.ts](data-manager/src/asset-types.ts).

### Lexicon

- **Lexical Entry/Lexeme**: The internal lexicon entry is `HeadWord` (entity) and `HeadWord` (API type), with `lemmaText`/`headword`. See [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L190-L280) and [src/api/types/headwords.ts](src/api/types/headwords.ts#L1-L40).
- **Word Form/Allomorph**: Not modeled explicitly. Variants appear via Macula TSV data (`normalized`, `lemma`, `morph`) and `Instance.normalizedText`/`lemmaText`. See [data-manager/src/asset-types.ts](data-manager/src/asset-types.ts) and [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L420-L520).
- **Sense**: `Sense` entity and `WordSense` API type store glosses, definitions, domains, and display IDs. See [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L240-L360) and [src/api/types/senses.ts](src/api/types/senses.ts#L1-L80).
- **Example/Citation**: Usage is represented by instance links and counts (`usageCtr`, `verseCtr`). There isn’t a dedicated “example” entity. See [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L190-L360).

### Relationships & References

- **Text-to-Lexicon Links**: Tokens/instances link to headwords and senses via `headwordId` and `senseIds` / join table. See [src/api/types/instances.ts](src/api/types/instances.ts#L1-L120) and [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L420-L600).
- **Morphological Decomposition**: Encoded via `instanceBcvwp` + `partNum` for word-part indexing, and via external Macula morphological attributes. See [src/api/types/instances.ts](src/api/types/instances.ts#L1-L120) and [data-manager/src/asset-types.ts](data-manager/src/asset-types.ts).
- **Lexical Relationships**: Lexical relations are available in UBS dictionary assets (e.g., synonyms, antonyms, cross-references). See [data-manager/src/asset-types.ts](data-manager/src/asset-types.ts).

---

## Key Data Structures

### Token (API)

- **Purpose**: In-memory/UI representation of a word token within a verse.
- **Key Properties**:
  - `id?: number`
  - `instanceBcvwp: string`
  - `translationId: number`
  - `text: string`
  - `gloss?: string`
  - `lemmaText?: string`
  - `senseIds: number[]`
  - `alignment?: Alignment`
  - `interlinearText?: string`
- **Relationships**: Links to `Alignment`, `HeadWord` (via `headwordId`), and `Sense` (via `senseIds`).
- **Cardinality**: Many tokens per verse; many-to-many with senses; many-to-many with alignments (through alignment sources/targets).
- **Notable Constraints**: `instanceBcvwp` required; `senseIds` always present (possibly empty).
  Source: [src/api/types/instances.ts](src/api/types/instances.ts#L1-L120)

### Instance (DB Entity)

- **Purpose**: Persistent token entity in SQLite with rich metadata.
- **Key Properties**:
  - `id?: number`
  - `translationId?: number`
  - `instanceBcvwp: string`
  - `instanceText: string`
  - `glossText?: string`
  - `normalizedText: string`
  - `lemmaText: string`
  - `bookNum/chapterNum/verseNum/wordNum/partNum`
  - `termStatusNum: number`
- **Relationships**: Many-to-one with `Translation` and `HeadWord`; many-to-many with `Sense`, `Alignment`, `Rendering`.
- **Cardinality**: One `Instance` per token; many instances per verse.
- **Notable Constraints**: `instanceBcvwp`, `instanceText`, `normalizedText` are required.
  Source: [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L420-L600)

### Verse (API)

- **Purpose**: A verse segment containing tokens.
- **Key Properties**: `verseId`, `citation`, `tokens`, `textDirection`, `languageCode`.
- **Relationships**: Contains many `Token`s.
- **Cardinality**: One-to-many with tokens.
- **Notable Constraints**: `verseId` required.
  Source: [src/api/types/verses.ts](src/api/types/verses.ts#L1-L36)

### Alignment (API/DB)

- **Purpose**: Captures aligner links between source and target tokens.
- **Key Properties**: `originNum`, `statusNum`, `notesText`, `sources`, `targets`.
- **Relationships**: Many-to-many between `Instance`s on source and target sides.
- **Cardinality**: Many-to-many (instances ↔ alignment).
- **Notable Constraints**: `originNum` and `statusNum` required.
  Sources: [src/api/types/alignments.ts](src/api/types/alignments.ts#L300-L340), [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L300-L410)

### HeadWord (API/DB)

- **Purpose**: Lexical headword entry (lemma).
- **Key Properties**: `lemmaText` / `headword`, `glossList`, `definitionText`, `domainText`, `commentText`, `usageCtr`, `verseCtr`, `required`.
- **Relationships**: One-to-many with `Sense`, `Instance`.
- **Cardinality**: One headword to many senses/instances.
- **Notable Constraints**: `lemmaText` required; `translationId` links to `Translation`.
  Sources: [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L190-L280), [src/api/types/headwords.ts](src/api/types/headwords.ts#L1-L40)

### Sense / WordSense

- **Purpose**: Semantic sense of a headword.
- **Key Properties**: `displayId`, `glossList`, `definitionText`, `domainText`, `commentText`, usage counts.
- **Relationships**: Many-to-one with `HeadWord`, many-to-many with `Instance`, one-to-many with `Rendering`.
- **Cardinality**: One headword to many senses.
- **Notable Constraints**: `displayId` required; `senseSortOrder` required.
  Sources: [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L240-L360), [src/api/types/senses.ts](src/api/types/senses.ts#L1-L80)

### Rendering / SenseRendering

- **Purpose**: Preferred renderings for a sense in a target translation.
- **Key Properties**: `renderingText`, `likePredicate`, `renderingOrder`, `matches`.
- **Relationships**: Many-to-one with `Sense` and `Translation`; many-to-many with `Instance`.
- **Cardinality**: One sense to many renderings.
- **Notable Constraints**: `renderingText` and `likePredicate` required in DB.
  Sources: [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L300-L390), [src/api/types/senses.ts](src/api/types/senses.ts#L1-L40)

### Translation (DB Entity)

- **Purpose**: Translation project context (source/target).
- **Key Properties**: `sideNum`, `displayName`, `languageId`, `projectId`.
- **Relationships**: One-to-many with `HeadWord`, `Instance`, `Rendering`.
- **Cardinality**: One translation to many tokens/headwords.
- **Notable Constraints**: `sideNum` and `displayName` required.
  Source: [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L150-L190)

### AlignmentFile (JSON)

- **Purpose**: Import/export format for alignments.
- **Key Properties**: `type`, `meta.creator`, `records[]` with source/target token IDs.
- **Relationships**: Serialized snapshot of alignment links.
- **Cardinality**: One file with many alignment records.
- **Notable Constraints**: `records` required for export/import.
  Source: [data-manager/src/alignmentExchanger.ts](data-manager/src/alignmentExchanger.ts#L18-L70)

### Macula TSV Rows (Assets)

- **Purpose**: External lexical/morphological data for tokens.
- **Key Properties**: `lemma`, `morph`, `pos`, `gloss`, `text`, `strong`, etc.
- **Relationships**: Used during import/build to populate instance metadata.
- **Cardinality**: One row per token in external data.
- **Notable Constraints**: TSV structure enforced by schema-like interfaces.
  Source: [data-manager/src/asset-types.ts](data-manager/src/asset-types.ts)

---

## Design Patterns & Architectural Choices

- **Identity & References**: Numeric IDs for entities (`id`), plus composite BCV-based identifiers (`instanceBcvwp`, `instanceBcvw`, `instanceBcv`). See [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L420-L520) and [src/api/types/instances.ts](src/api/types/instances.ts#L1-L120).
- **Ownership & Containment**: `Translation` → `HeadWord`/`Instance` → `Token`/`Sense`/`Rendering`; `Verse` contains tokens, and alignments connect tokens across translations.
- **Immutability**: Model objects are mutable (TypeORM entities and API DTOs).
- **Versioning/History**: No explicit versioning in the model; status fields (`statusNum`, `termStatusNum`) provide workflow state.
- **Extensibility**: Lexicon and morphology can be extended via external assets (UBS dictionary, Macula TSV), and new fields can be added to entities or TSV schemas.

---

## Serialization & Persistence

- **Storage Format**: SQLite database via TypeORM entities for runtime data; JSON for alignment export/import. See [data-manager/src/pbteRepository.ts](data-manager/src/pbteRepository.ts#L150-L600) and [data-manager/src/alignmentExchanger.ts](data-manager/src/alignmentExchanger.ts#L18-L120).
- **Import/Export**: Alignment JSON files (type `translation`). External lexicon and morphology from UBS dictionary JSON and Macula TSV. See [data-manager/src/alignmentExchanger.ts](data-manager/src/alignmentExchanger.ts#L18-L120) and [data-manager/src/asset-types.ts](data-manager/src/asset-types.ts).
- **Schema/Format Version**: Not explicitly versioned in the model; alignment file includes `meta.creator` but no explicit schema version.

---

## Special Features or Constraints

- **Language-Specific Features**: Rich Hebrew/Greek morphological data via Macula TSV fields (`morph`, `stem`, `pos`, etc.). See [data-manager/src/asset-types.ts](data-manager/src/asset-types.ts).
- **Performance Considerations**: Alignments are chunked during import/export; alignment generation runs in batches. See [data-manager/src/alignmentExchanger.ts](data-manager/src/alignmentExchanger.ts#L80-L160) and [data-manager/src/eflomalRunner.ts](data-manager/src/eflomalRunner.ts).
- **Migration/Compatibility**: Database schema templated in build scripts; changes likely handled by template regeneration rather than migrations.
- **Known Limitations**: No explicit morpheme or example/citation entity; morphological decomposition is implicit and reliant on external data.

---

## Code Examples

1. **Create a basic interlinear analysis of a word**

```ts
import { Token } from "src/api/types/instances";

const token: Token = {
  instanceBcvwp: "0100100101", // BCVWP
  translationId: 1,
  text: "λόγος",
  after: " ",
  gloss: "word",
  lemmaText: "λόγος",
  senseIds: [],
  interlinearText: "λόγος · word",
};
```

2. **Link a word in text to a lexicon entry**

```ts
import { Token } from "src/api/types/instances";

const linked: Token = {
  instanceBcvwp: "0100100101",
  translationId: 1,
  text: "λόγος",
  after: " ",
  headwordId: 42,
  senseIds: [101, 102],
};
```

3. **Retrieve all glosses for a given text segment**

```ts
import { FullVerse } from "src/api/types/instances";

const glossesForVerse = (verse: FullVerse): string[] =>
  verse.tokens.map((t) => t.gloss).filter((g): g is string => Boolean(g));
```

---

## Model Diagram

```
Translation
  ├─ HeadWord (lemma/lexeme)
  │    └─ Sense
  │         └─ Rendering
  └─ Instance (token)
       ├─ Sense (many-to-many)
       ├─ Rendering (many-to-many)
       └─ Alignment (many-to-many, as source/target)

Verse (API)
  └─ Token[]  (Token maps to Instance)
Alignment (API/DB)
  └─ source[] / target[] (token instance IDs)

Lexicon Assets (UBS Dictionary)
  └─ RootEntry → BaseForm → LEXMeaning → LEXSense
```

---

## Analysis Notes

- **Terminology Choices**: “Aligner” is the interlinear-like view; alignment records are the core linkage mechanism.
- **Implicit vs Explicit**: Morphemes are implicit (via `partNum` and external morphology data), not explicit entities.
- **Strengths**: Clean separation between persistent entities and UI-facing DTOs; strong BCV-based addressing; robust alignment import/export.
- **Weaknesses**: No explicit document/paragraph model or dedicated example/citation entity; morpheme modeling is indirect.
