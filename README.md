# Interlinear Research

This repository contains lightweight Python scripts for research on existing interlinear data across projects. The first data file to analyze already exists in the repo root and is **large**, so none of the scripts read it automatically.

## Data
- Large source file (already present in repo root):
  - `report-results-show-all-project-that-have-at-least-one-interlinear-folder..json`

## Scripts
### `scripts/analyze_interlinear.py`
Entry point for analysis. Requires an explicit `--input` path and never reads the large file by default.

**Example**
```
python scripts/analyze_interlinear.py --input "report-results-show-all-project-that-have-at-least-one-interlinear-folder..json" --output results/summary.json
```

### `scripts/describe_results.py`
Summarizes analysis outputs for quick inspection.

**Example**
```
python scripts/describe_results.py --input results/summary.json
```

## Results
- Store generated outputs in `results/`.
- Keep any research notes in `notes/`.

## Notes
- The large source file should only be read when explicitly passed via CLI.
- Update this README as new scripts and results are added.
