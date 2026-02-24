"use client";

import { memo } from "react";
import { type LinkedGroup, type Occurrence } from "@/lib/interlinear-types";
import { MorphemeEditor } from "@/components/morpheme-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Check, Unlink2 } from "lucide-react";
import type { RowId } from "@/hooks/use-row-order";

interface OccurrenceBoxProps {
  group: LinkedGroup;
  isActive: boolean;
  rowOrder: RowId[];
  onApprove: () => void;
  onForward: () => void;
  onBackward: () => void;
  onUpdateGloss: (groupStartIndex: number, gloss: string) => void;
  onUpdateMorphemeText: (occIndex: number, text: string) => void;
  onUnlink: (occIndex: number, rightOccIndex?: number) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Non-adjacent groups linked to this group — shown muted with full analysis. */
  disjointGroups?: { startIndex: number; occurrences: Occurrence[] }[];
}

export const OccurrenceBox = memo(function OccurrenceBox({
  group,
  isActive,
  rowOrder,
  onApprove,
  onForward,
  onBackward,
  onUpdateGloss,
  onUpdateMorphemeText,
  onUnlink,
  canGoBack,
  canGoForward,
  disjointGroups,
}: OccurrenceBoxProps) {
  const allApproved = group.occurrences.every((o) => o.approved);
  // Gloss is a single value for the whole linked set, stored on the first occurrence.
  const gloss = group.occurrences[0].gloss;

  const nMain = group.occurrences.length;
  const disjointList = disjointGroups ?? [];

  // ── Shared CSS Grid column layout ────────────────────────────────────────
  // Both the surface row and the morpheme row use this same template via
  // CSS subgrid, which guarantees each word chip and its morpheme cell below
  // are always in the same column (fixes B-04).
  //
  // Column structure (1-based):
  //   Main occurrences:  [1fr] [1rem divider] [1fr] [1rem divider] … [1fr]
  //   Per disjoint group: [1.25rem separator] [1fr] [1rem divider] … [1fr]
  //
  // Helper: 1-based column index for each slot.
  const mainOccCol = (i: number) => 1 + i * 2; // 1, 3, 5, …
  const mainDivCol = (i: number) => 2 + i * 2; // 2, 4, … (between i and i+1)
  const afterMainCols = nMain === 0 ? 0 : 2 * nMain - 1;

  // Starting column of disjoint group d's separator slot.
  const dgSepCol = (d: number): number => {
    let col = afterMainCols + 1;
    for (let i = 0; i < d; i++) {
      const M = disjointList[i].occurrences.length;
      // separator (1) + M occ cols + (M-1) inner-divider cols = 2M cols total
      col += 1 + (M === 0 ? 0 : 2 * M - 1);
    }
    return col;
  };
  const dgOccCol = (d: number, o: number) => dgSepCol(d) + 1 + o * 2;

  const gridTemplateColumns = (() => {
    const parts: string[] = [];
    for (let i = 0; i < nMain; i++) {
      if (i > 0) parts.push("1rem"); // inner divider between adjacent occs
      parts.push("minmax(0, 1fr)");
    }
    for (const dg of disjointList) {
      parts.push("1.25rem"); // separator — hosts the unlink button
      for (let j = 0; j < dg.occurrences.length; j++) {
        if (j > 0) parts.push("1rem"); // inner divider within disjoint group
        parts.push("minmax(0, 1fr)");
      }
    }
    return parts.join(" ");
  })();

  return (
    // The outer box IS the grid container. Every direct child either spans
    // all columns (gridColumn "1 / -1") or participates via subgrid.
    <div
      className={cn(
        "grid border-2 rounded-lg shrink-0 transition-colors",
        allApproved
          ? "bg-white border-muted-foreground/20"
          : "bg-sky-50 border-sky-200",
        isActive && "border-sky-500 ring-2 ring-sky-300/50",
      )}
      style={{ gridTemplateColumns }}
    >
      {/* ── Surface row ──────────────────────────────────────────────────── */}
      {/* subgrid inherits the outer column template so chip widths match    */}
      {/* the morpheme cells directly below them (fixes B-04).               */}
      <div
        className="grid items-start pt-1 pb-0.5"
        style={{ gridColumn: "1 / -1", gridTemplateColumns: "subgrid" }}
      >
        {/* Main occurrence chips */}
        {group.occurrences.map((occ, i) => (
          <div
            key={occ.id}
            style={{ gridColumn: mainOccCol(i) }}
            className="px-0.5"
          >
            <div
              className={cn(
                "px-1.5 py-0.5 text-center font-mono text-base font-semibold text-foreground rounded border",
                allApproved
                  ? "border-muted-foreground/20 bg-white"
                  : "border-sky-300 bg-sky-100/50",
              )}
            >
              {occ.text}
            </div>
          </div>
        ))}

        {/* Unlink buttons between adjacent main occurrences */}
        {group.occurrences.slice(0, -1).map((occ, i) => (
          <button
            key={`div-${occ.id}`}
            style={{ gridColumn: mainDivCol(i) }}
            onClick={() => onUnlink(group.startIndex + i)}
            className="flex items-center justify-center group/unlink"
            aria-label="Unlink occurrences"
            type="button"
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="block w-px h-2 bg-muted-foreground/30" />
              <Unlink2 className="size-3 text-muted-foreground/40 group-hover/unlink:text-red-500 transition-colors" />
              <span className="block w-px h-2 bg-muted-foreground/30" />
            </div>
          </button>
        ))}

        {/* Disjoint group separators (unlink button) */}
        {disjointList.map((dg, di) => (
          <button
            key={`dg-sep-${dg.startIndex}`}
            style={{ gridColumn: dgSepCol(di) }}
            onClick={() =>
              onUnlink(group.startIndex + nMain - 1, dg.startIndex)
            }
            className="flex items-center justify-center group/unlink"
            aria-label="Unlink disjoint group"
            type="button"
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="block w-px h-2 bg-muted-foreground/30" />
              <Unlink2 className="size-3 text-muted-foreground/40 group-hover/unlink:text-red-500 transition-colors" />
              <span className="block w-px h-2 bg-muted-foreground/30" />
            </div>
          </button>
        ))}

        {/* Disjoint occurrence chips */}
        {disjointList.flatMap((dg, di) =>
          dg.occurrences.map((occ, oi) => (
            <div
              key={`dg-occ-${occ.id}`}
              style={{ gridColumn: dgOccCol(di, oi) }}
              className="px-0.5"
            >
              <div
                data-testid="disjoint-occ-token"
                className="px-1.5 py-0.5 text-center font-mono text-base font-semibold text-muted-foreground/60 rounded border border-dashed border-muted-foreground/25 bg-muted/20 select-none"
              >
                {occ.text}
              </div>
            </div>
          )),
        )}
      </div>

      {/* ── Analysis rows (user-defined order) ───────────────────────────── */}
      {rowOrder.map((rowId) => {
        if (rowId === "gloss") {
          // Full-width single row — no per-column gloss cells — fixes B-02.
          return (
            <div
              key="gloss"
              style={{ gridColumn: "1 / -1" }}
              className="border-t border-muted-foreground/15 px-1 py-0.5"
            >
              {isActive ? (
                <Input
                  value={gloss}
                  onChange={(e) =>
                    onUpdateGloss(group.startIndex, e.target.value)
                  }
                  placeholder="gloss"
                  size={1}
                  className="w-full h-6 text-sm font-mono bg-white border-muted-foreground/20 text-center"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onApprove();
                    }
                  }}
                />
              ) : (
                <div className="h-6 flex items-center justify-center text-sm font-mono text-muted-foreground">
                  {gloss || "\u00A0"}
                </div>
              )}
            </div>
          );
        }

        if (rowId === "morphemes") {
          // subgrid: cells land in the same columns as the surface chips
          // above them, guaranteeing width alignment (fixes B-04).
          // Disjoint cells receive real isActive + onChange (fixes B-03).
          return (
            <div
              key="morphemes"
              className="grid border-t border-muted-foreground/15"
              style={{ gridColumn: "1 / -1", gridTemplateColumns: "subgrid" }}
            >
              {/* Main morpheme cells */}
              {group.occurrences.map((occ, i) => (
                <div
                  key={`morph-${occ.id}`}
                  style={{ gridColumn: mainOccCol(i) }}
                  className="px-0.5 py-0.5"
                >
                  <MorphemeEditor
                    morphemeText={occ.morphemeText}
                    isActive={isActive}
                    onChange={(newText) =>
                      onUpdateMorphemeText(group.startIndex + i, newText)
                    }
                  />
                </div>
              ))}

              {/* Visual dividers between main morpheme cells */}
              {group.occurrences.slice(0, -1).map((occ, i) => (
                <div
                  key={`morph-div-${occ.id}`}
                  style={{ gridColumn: mainDivCol(i) }}
                  className="flex items-stretch justify-center py-0.5"
                >
                  <span className="w-px bg-muted-foreground/25" />
                </div>
              ))}

              {/* Disjoint separator columns — visual dashed divider */}
              {disjointList.map((dg, di) => (
                <div
                  key={`dg-morph-sep-${dg.startIndex}`}
                  style={{ gridColumn: dgSepCol(di) }}
                  className="border-r border-dashed border-muted-foreground/25"
                />
              ))}

              {/* Disjoint morpheme cells — fully editable when active */}
              {disjointList.flatMap((dg, di) =>
                dg.occurrences.map((occ, oi) => (
                  <div
                    key={`dg-morph-${occ.id}`}
                    style={{ gridColumn: dgOccCol(di, oi) }}
                    className="px-0.5 py-0.5"
                  >
                    <MorphemeEditor
                      morphemeText={occ.morphemeText}
                      isActive={isActive}
                      onChange={(newText) =>
                        onUpdateMorphemeText(dg.startIndex + oi, newText)
                      }
                    />
                  </div>
                )),
              )}
            </div>
          );
        }

        return null;
      })}

      {/* ── Action buttons (active only) ──────────────────────────────────── */}
      {isActive && (
        <div
          style={{ gridColumn: "1 / -1" }}
          className="flex items-center justify-between px-2 py-1.5 border-t border-muted-foreground/15"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onBackward}
            disabled={!canGoBack}
            aria-label="Previous occurrence"
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onApprove}
            aria-label={
              allApproved ? "Unapprove occurrence" : "Approve occurrence"
            }
            className={cn(
              allApproved
                ? "text-red-500 hover:text-red-600 hover:bg-red-50"
                : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50",
            )}
          >
            <Check className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onForward}
            disabled={!canGoForward}
            aria-label="Next occurrence"
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
});
