# Interlinear Research

This repository contains:

1. **Research scripts** — Python tools for analysing existing interlinear data across projects.
2. **Unified interlinear model** — A canonical TypeScript model and design proposal that merges concepts from LCM, Paratext 9, and the BT Extension.
3. **Prototype app** — A Next.js / shadcn/ui interlinearizer for exploring the model visually.

---

## Unified Model

| Artefact | Path | Purpose |
|----------|------|---------|
| Canonical TypeScript model | `results/interlinear-model.ts` | Source of truth — all interfaces, enums, and JSDoc. |
| Design proposal | `interlinear-model-analyses/unified-model-proposal.md` | Property tables, source-system mappings, diagram, migration risks. |
| Supporting analyses | `interlinear-model-analyses/lcm-interlinear-model.md`, `paratext9-interlinear-model.md`, `BT-Extension.md` | Per-system deep dives that informed the unified model. |

### Key model concepts

- **Interlinearization → AnalyzedBook → Segment → Occurrence** — the document hierarchy.
- **Analysis** — a linguistic annotation (gloss, morpheme breakdown, etc.) that lives independently of occurrences.
- **AnalysisAssignment** — links an Occurrence to an Analysis; carries `status` and optional `groupId` for phrase grouping (see proposal § 1.6).
- **InterlinearAlignment** — optional word/morph alignment between source and target writing systems.

---

## Prototype App

A v0-bootstrapped Next.js 16 / React 19 app using **shadcn/ui** components.  
It renders an interlinear glossing strip where users can edit glosses, split morphemes, and link adjacent occurrences.

### Prerequisites

- **Node.js ≥ 20.9.0** (Next.js 16 hard-requires this).  
  If you use `nvm`: `nvm use 22`
- **pnpm** (recommended — the repo has a `pnpm-lock.yaml`).  
  If you use npm instead, add `--legacy-peer-deps` since v0-generated dependency ranges can conflict:
  ```bash
  npm install --legacy-peer-deps
  ```

### Quick start

```bash
pnpm install
pnpm dev
```

Or with npm:
```bash
npm install --legacy-peer-deps
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Prototype structure

| Path | Description |
|------|-------------|
| `lib/interlinear-model.ts` | **App copy** of the canonical model — keep in sync (see header comment). |
| `lib/interlinear-types.ts` | Original v0 flat types (to be replaced by an adapter over the canonical model). |
| `lib/sample-data.ts` | Spanish Genesis 1 sample `Interlinearization` with English glosses for verse 1. |
| `hooks/use-interlinear.ts` | React state management for occurrence editing. |
| `components/` | `interlinearizer.tsx`, `occurrence-box.tsx`, `morpheme-editor.tsx`, `link-button.tsx` |
| `app/` | Next.js app router pages. |

### Keeping `lib/interlinear-model.ts` in sync

The file under `lib/` is a **copy** of `results/interlinear-model.ts`.  
A prominent header comment explains the sync convention:

- **Canonical source of truth** → `results/interlinear-model.ts`
- After any edit to the canonical file, copy it verbatim into `lib/interlinear-model.ts`, preserving the header.
- Never add app-specific code to the canonical file; put adapters or view-models in separate `lib/` files.

---

## Research Scripts


### `scripts/analyze_interlinear.py`
Entry point for analysis. Requires an explicit `--input` path and never reads the large file by default.

```bash
python scripts/analyze_interlinear.py \
  --input "report-results-show-all-project-that-have-at-least-one-interlinear-folder.json" \
  --output results/summary.json
```

### `scripts/describe_results.py`
Summarizes analysis outputs for quick inspection.

```bash
python scripts/describe_results.py --input results/summary.json
```

## Results & Notes
- Generated outputs go in `results/`.
- Research notes go in `notes/`.

## Notes
- The large source file should only be read when explicitly passed via CLI.
- Update this README as new scripts and results are added.
