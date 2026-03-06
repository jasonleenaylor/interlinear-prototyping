/**
 * Sample interlinear data — Spanish (RVR-style) Genesis chapter 1.
 *
 * - Full Spanish text for all 31 verses (occurrences tokenized).
 * - English glosses and morpheme-level analyses provided for verse 1 only.
 * - Remaining verses have occurrences but no analyses/assignments,
 *   simulating a partially-annotated interlinearization.
 *
 * Demonstrates:
 *   - Interlinearization → AnalyzedBook → Segment → Occurrence hierarchy
 *   - Analysis with AnalysisType.Gloss  (word-level gloss)
 *   - Analysis with AnalysisType.Morph  (morpheme breakdown)
 *   - AnalysisAssignment with groupId   (phrase grouping: "en el" → "in the")
 *   - Punctuation occurrences
 */

import {
  type Interlinearization,
  type AnalyzedBook,
  type Segment,
  type Occurrence,
  type Analysis,
  type AnalysisAssignment,
  type MorphemeBundle,
  OccurrenceType,
  AnalysisType,
  Confidence,
  AssignmentStatus,
} from "./interlinear-model";

// ---------------------------------------------------------------------------
// Helper — tokenise a Spanish string into Occurrence objects
// ---------------------------------------------------------------------------

let globalOccId = 0;

function tokenize(text: string, ws = "es"): Occurrence[] {
  const tokens: string[] = [];
  let current = "";

  for (const ch of text) {
    const isPunct = /[^\p{L}\p{N}\s'-]/u.test(ch);
    const isSpace = /\s/.test(ch);

    if (isSpace) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    if (isPunct) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      tokens.push(ch);
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  return tokens.map((t) => {
    const id = `occ-${++globalOccId}`;
    const isPunct = /^[^\p{L}\p{N}]$/u.test(t);
    return {
      id,
      surfaceText: t,
      writingSystem: ws,
      type: isPunct ? OccurrenceType.Punctuation : OccurrenceType.Word,
    } satisfies Occurrence;
  });
}

// ---------------------------------------------------------------------------
// Verse texts — Reina-Valera-style Spanish
// ---------------------------------------------------------------------------

const verseTexts: string[] = [
  /* v1  */ "En el principio creó Dios los cielos y la tierra.",
  /* v2  */ "Y la tierra estaba desordenada y vacía, y las tinieblas estaban sobre la faz del abismo, y el Espíritu de Dios se movía sobre la faz de las aguas.",
  /* v3  */ "Y dijo Dios: Sea la luz; y fue la luz.",
  /* v4  */ "Y vio Dios que la luz era buena; y separó Dios la luz de las tinieblas.",
  /* v5  */ "Y llamó Dios a la luz Día, y a las tinieblas llamó Noche. Y fue la tarde y la mañana un día.",
  /* v6  */ "Luego dijo Dios: Haya expansión en medio de las aguas, y separe las aguas de las aguas.",
  /* v7  */ "E hizo Dios la expansión, y separó las aguas que estaban debajo de la expansión, de las aguas que estaban sobre la expansión. Y fue así.",
  /* v8  */ "Y llamó Dios a la expansión Cielos. Y fue la tarde y la mañana el día segundo.",
  /* v9  */ "Dijo también Dios: Júntense las aguas que están debajo de los cielos en un lugar, y descúbrase lo seco. Y fue así.",
  /* v10 */ "Y llamó Dios a lo seco Tierra, y a la reunión de las aguas llamó Mares. Y vio Dios que era bueno.",
  /* v11 */ "Después dijo Dios: Produzca la tierra hierba verde, hierba que dé semilla; árbol de fruto que dé fruto según su género, que su semilla esté en él, sobre la tierra. Y fue así.",
  /* v12 */ "Produjo, pues, la tierra hierba verde, hierba que da semilla según su naturaleza, y árbol que da fruto, cuya semilla está en él, según su género. Y vio Dios que era bueno.",
  /* v13 */ "Y fue la tarde y la mañana el día tercero.",
  /* v14 */ "Dijo luego Dios: Haya lumbreras en la expansión de los cielos para separar el día de la noche; y sirvan de señales para las estaciones, para días y años.",
  /* v15 */ "Y sean por lumbreras en la expansión de los cielos para alumbrar sobre la tierra. Y fue así.",
  /* v16 */ "E hizo Dios las dos grandes lumbreras; la lumbrera mayor para que señorease en el día, y la lumbrera menor para que señorease en la noche; hizo también las estrellas.",
  /* v17 */ "Y las puso Dios en la expansión de los cielos para alumbrar sobre la tierra.",
  /* v18 */ "Y para señorear en el día y en la noche, y para separar la luz de las tinieblas. Y vio Dios que era bueno.",
  /* v19 */ "Y fue la tarde y la mañana el día cuarto.",
  /* v20 */ "Dijo Dios: Produzcan las aguas seres vivientes, y aves que vuelen sobre la tierra, en la abierta expansión de los cielos.",
  /* v21 */ "Y creó Dios los grandes monstruos marinos, y todo ser viviente que se mueve, que las aguas produjeron según su género, y toda ave alada según su género. Y vio Dios que era bueno.",
  /* v22 */ "Y Dios los bendijo, diciendo: Fructificad y multiplicaos, y llenad las aguas en los mares, y multiplíquense las aves en la tierra.",
  /* v23 */ "Y fue la tarde y la mañana el día quinto.",
  /* v24 */ "Luego dijo Dios: Produzca la tierra seres vivientes según su género, bestias y serpientes y animales de la tierra según su género. Y fue así.",
  /* v25 */ "E hizo Dios animales de la tierra según su género, y ganado según su género, y todo animal que se arrastra sobre la tierra según su género. Y vio Dios que era bueno.",
  /* v26 */ "Entonces dijo Dios: Hagamos al hombre a nuestra imagen, conforme a nuestra semejanza; y señoree en los peces del mar, en las aves de los cielos, en las bestias, en toda la tierra, y en todo animal que se arrastra sobre la tierra.",
  /* v27 */ "Y creó Dios al hombre a su imagen, a imagen de Dios lo creó; varón y hembra los creó.",
  /* v28 */ "Y los bendijo Dios, y les dijo: Fructificad y multiplicaos; llenad la tierra, y sojuzgadla, y señoread en los peces del mar, en las aves de los cielos, y en todas las bestias que se mueven sobre la tierra.",
  /* v29 */ "Y dijo Dios: He aquí que os he dado toda planta que da semilla, que está sobre toda la faz de la tierra, y todo árbol en que hay fruto y que da semilla; os serán para comer.",
  /* v30 */ "Y a toda bestia de la tierra, y a todas las aves de los cielos, y a todo lo que se arrastra sobre la tierra, en que hay vida, toda planta verde les será para comer. Y fue así.",
  /* v31 */ "Y vio Dios todo lo que había hecho, y he aquí que era bueno en gran manera. Y fue la tarde y la mañana el día sexto.",
];

// ---------------------------------------------------------------------------
// Build segments for all 31 verses
// ---------------------------------------------------------------------------

function buildSegments(): Segment[] {
  return verseTexts.map((text, i) => {
    const verseNum = i + 1;
    const segId = `seg-gen-1-${verseNum}`;
    return {
      id: segId,
      startRef: { book: "GEN", chapter: 1, verse: verseNum },
      endRef: { book: "GEN", chapter: 1, verse: verseNum },
      baselineText: text,
      occurrences: tokenize(text),
    };
  });
}

// ---------------------------------------------------------------------------
// Analyses for verse 1 — English glosses + morpheme breakdowns
// ---------------------------------------------------------------------------
// Verse 1 text: "En el principio creó Dios los cielos y la tierra."
//
// Occurrences (by index within segment):
//  0: En          4: Dios        8: la
//  1: el          5: los         9: tierra
//  2: principio   6: cielos     10: .
//  3: creó        7: y
//
// Phrase group example: "En el" → grouped gloss "In the"
// ---------------------------------------------------------------------------

/** Reusable analyses keyed by a local name. */
const analyses: Record<string, Analysis> = {
  // -- Phrase: "En el" → "In the" (grouped gloss) --------------------------
  enEl: {
    id: "an-en-el",
    analysisType: AnalysisType.Gloss,
    confidence: Confidence.High,
    producer: "manual",
    sourceUser: "sample",
    glossText: { en: "In the" },
    pos: "PREP+ART",
  },

  // -- "principio" → "beginning" -------------------------------------------
  principio: {
    id: "an-principio",
    analysisType: AnalysisType.Gloss,
    confidence: Confidence.High,
    producer: "manual",
    sourceUser: "sample",
    glossText: { en: "beginning" },
    pos: "N",
  },

  // -- "creó" → morph: "cre-" (create) + "-ó" (3SG.PST) -------------------
  creo: {
    id: "an-creo",
    analysisType: AnalysisType.Morph,
    confidence: Confidence.High,
    producer: "manual",
    sourceUser: "sample",
    glossText: { en: "created" },
    pos: "V",
    morphemeBundles: [
      {
        id: "mb-creo-1",
        form: "cre",
        writingSystem: "es",
      },
      {
        id: "mb-creo-2",
        form: "ó",
        writingSystem: "es",
      },
    ] satisfies MorphemeBundle[],
  },

  // -- "Dios" → "God" ------------------------------------------------------
  dios: {
    id: "an-dios",
    analysisType: AnalysisType.Gloss,
    confidence: Confidence.High,
    producer: "manual",
    sourceUser: "sample",
    glossText: { en: "God" },
    pos: "N.PROP",
  },

  // -- "los" → "the" (masc pl article) -------------------------------------
  los: {
    id: "an-los",
    analysisType: AnalysisType.Gloss,
    confidence: Confidence.High,
    producer: "manual",
    sourceUser: "sample",
    glossText: { en: "the" },
    pos: "ART",
  },

  // -- "cielos" → morph: "ciel-" (heaven/sky) + "-os" (M.PL) --------------
  cielos: {
    id: "an-cielos",
    analysisType: AnalysisType.Morph,
    confidence: Confidence.High,
    producer: "manual",
    sourceUser: "sample",
    glossText: { en: "heavens" },
    pos: "N",
    morphemeBundles: [
      {
        id: "mb-cielos-1",
        form: "ciel",
        writingSystem: "es",
      },
      {
        id: "mb-cielos-2",
        form: "os",
        writingSystem: "es",
      },
    ] satisfies MorphemeBundle[],
  },

  // -- "y" → "and" ---------------------------------------------------------
  y: {
    id: "an-y",
    analysisType: AnalysisType.Gloss,
    confidence: Confidence.High,
    producer: "manual",
    sourceUser: "sample",
    glossText: { en: "and" },
    pos: "CONJ",
  },

  // -- "la" → "the" (fem sg article) ---------------------------------------
  la: {
    id: "an-la",
    analysisType: AnalysisType.Gloss,
    confidence: Confidence.High,
    producer: "manual",
    sourceUser: "sample",
    glossText: { en: "the" },
    pos: "ART",
  },

  // -- "tierra" → morph: "tierr-" (earth/land) + "-a" (F.SG) --------------
  tierra: {
    id: "an-tierra",
    analysisType: AnalysisType.Morph,
    confidence: Confidence.High,
    producer: "manual",
    sourceUser: "sample",
    glossText: { en: "earth" },
    pos: "N",
    morphemeBundles: [
      {
        id: "mb-tierra-1",
        form: "tierr",
        writingSystem: "es",
      },
      {
        id: "mb-tierra-2",
        form: "a",
        writingSystem: "es",
      },
    ] satisfies MorphemeBundle[],
  },

  // -- punctuation "." → (no gloss) ----------------------------------------
  period: {
    id: "an-period",
    analysisType: AnalysisType.Punctuation,
    confidence: Confidence.High,
    producer: "manual",
    sourceUser: "sample",
  },
};

// ---------------------------------------------------------------------------
// Wire assignments into verse 1 occurrences
// ---------------------------------------------------------------------------

function attachVerse1Assignments(segments: Segment[]): void {
  const v1 = segments[0]; // GEN 1:1
  const occs = v1.occurrences;

  // Helper to create an assignment
  const assign = (
    occ: Occurrence,
    analysis: Analysis,
    groupId?: string,
  ): void => {
    occ.assignment = {
      id: `asgn-${occ.id}`,
      occurrenceId: occ.id,
      analysisId: analysis.id,
      status: AssignmentStatus.Approved,
      groupId,
    } satisfies AnalysisAssignment;
  };

  // "En" + "el" → phrase group sharing "In the" analysis
  assign(occs[0], analyses.enEl, "group-en-el");
  assign(occs[1], analyses.enEl, "group-en-el");

  // "principio"
  assign(occs[2], analyses.principio);

  // "creó" (morph analysis with bundles)
  assign(occs[3], analyses.creo);

  // "Dios"
  assign(occs[4], analyses.dios);

  // "los"
  assign(occs[5], analyses.los);

  // "cielos" (morph analysis with bundles)
  assign(occs[6], analyses.cielos);

  // "y"
  assign(occs[7], analyses.y);

  // "la"
  assign(occs[8], analyses.la);

  // "tierra" (morph analysis with bundles)
  assign(occs[9], analyses.tierra);

  // "."
  assign(occs[10], analyses.period);
}

// ---------------------------------------------------------------------------
// Assemble the full Interlinearization
// ---------------------------------------------------------------------------

function buildSampleInterlinearization(): Interlinearization {
  // Reset counter so IDs are deterministic
  globalOccId = 0;

  const segments = buildSegments();
  attachVerse1Assignments(segments);

  const book: AnalyzedBook = {
    id: "book-gen",
    bookRef: "GEN",
    textVersion: "sample-v1",
    segments,
  };

  return {
    id: "interlinearization-es-gen",
    sourceWritingSystem: "es",
    analysisLanguages: ["en"],
    books: [book],
  };
}

/**
 * Pre-built sample data: Spanish Genesis 1 with English glosses for verse 1.
 */
export const sampleInterlinearization: Interlinearization =
  buildSampleInterlinearization();

/**
 * All Analysis objects used in the sample, keyed by local name.
 * Useful for tests or UI look-ups that need to resolve analysisId → Analysis.
 */
export const sampleAnalyses: Record<string, Analysis> = analyses;
