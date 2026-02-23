"use client";

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

export function OccurrenceBox({
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
  // Gloss is stored on the first occurrence of the group
  const gloss = group.occurrences[0].gloss;

  return (
    <div
      className={cn(
        "flex flex-col border-2 rounded-lg shrink-0 transition-colors",
        allApproved
          ? "bg-white border-muted-foreground/20"
          : "bg-sky-50 border-sky-200",
        isActive && "border-sky-500 ring-2 ring-sky-300/50",
      )}
    >
      {/* Top row: surface text for each occurrence in its own inner box */}
      <div className="flex items-stretch px-0.5 pt-1 pb-0.5 overflow-visible">
        {group.occurrences.map((occ, i) => (
          <div key={occ.id} className="relative flex-1 min-w-0">
            <div
              className={cn(
                "mx-0.5 px-1.5 py-0.5 text-center font-mono text-base font-semibold text-foreground rounded border",
                allApproved
                  ? "border-muted-foreground/20 bg-white"
                  : "border-sky-300 bg-sky-100/50",
              )}
            >
              {occ.text}
            </div>
            {/* Unlink divider button between linked occurrences */}
            {i < group.occurrences.length - 1 && (
              <button
                onClick={() => onUnlink(group.startIndex + i)}
                className="absolute right-0 top-1/2 z-10 flex h-6 w-4 -translate-y-1/2 translate-x-1/2 items-center justify-center group/unlink"
                aria-label="Unlink occurrences"
                type="button"
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className="block w-px h-2 bg-muted-foreground/30" />
                  <Unlink2 className="size-3 text-muted-foreground/40 group-hover/unlink:text-red-500 transition-colors" />
                  <span className="block w-px h-2 bg-muted-foreground/30" />
                </div>
              </button>
            )}
          </div>
        ))}
        {/* Non-adjacent (disjoint) linked groups — muted with unlink button */}
        {disjointGroups?.map((dg) => (
          <div key={`dg-${dg.startIndex}`} className="flex items-stretch">
            {/* Unlink button between main group and this disjoint group */}
            <button
              onClick={() =>
                onUnlink(
                  group.startIndex + group.occurrences.length - 1,
                  dg.startIndex,
                )
              }
              className="relative flex h-full w-4 items-center justify-center group/unlink shrink-0"
              aria-label="Unlink disjoint group"
              type="button"
            >
              <div className="flex flex-col items-center gap-0.5">
                <span className="block w-px h-2 bg-muted-foreground/30" />
                <Unlink2 className="size-3 text-muted-foreground/40 group-hover/unlink:text-red-500 transition-colors" />
                <span className="block w-px h-2 bg-muted-foreground/30" />
              </div>
            </button>
            {dg.occurrences.map((occ) => (
              <div key={`dg-occ-${occ.id}`} className="relative shrink-0">
                <div
                  data-testid="disjoint-occ-token"
                  className="mx-0.5 px-1.5 py-0.5 text-center font-mono text-base font-semibold text-muted-foreground/60 rounded border border-dashed border-muted-foreground/25 bg-muted/20 select-none"
                >
                  {occ.text}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Analysis rows rendered in user-defined order */}
      {rowOrder.map((rowId) => {
        if (rowId === "gloss") {
          return (
            <div
              key="gloss"
              className="flex items-center border-t border-muted-foreground/15"
            >
              {/* Main group gloss */}
              <div className="flex-1 min-w-0 px-1 py-0.5">
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
              {/* Disjoint group glosses — read-only, muted */}
              {disjointGroups?.map((dg) => (
                <div
                  key={`dg-gloss-${dg.startIndex}`}
                  className="shrink-0 px-1 py-0.5 border-l border-dashed border-muted-foreground/25"
                >
                  <div className="h-6 flex items-center justify-center text-sm font-mono text-muted-foreground/50 select-none">
                    {dg.occurrences[0]?.gloss || "\u00A0"}
                  </div>
                </div>
              ))}
            </div>
          );
        }
        if (rowId === "morphemes") {
          return (
            <div
              key="morphemes"
              className="flex border-t border-muted-foreground/15 gap-0.5"
            >
              {group.occurrences.map((occ, i) => (
                <div
                  key={`morph-${occ.id}`}
                  className={cn(
                    "px-0.5 py-0.5 flex-1",
                    i < group.occurrences.length - 1 &&
                      "border-r border-dashed border-muted-foreground/30",
                  )}
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
              {/* Disjoint group morphemes — read-only, muted */}
              {disjointGroups?.flatMap((dg) =>
                dg.occurrences.map((occ, i) => (
                  <div
                    key={`dg-morph-${occ.id}`}
                    className={cn(
                      "px-0.5 py-0.5 shrink-0 border-l border-dashed border-muted-foreground/25",
                      i < dg.occurrences.length - 1 &&
                        "border-r border-dashed border-muted-foreground/30",
                    )}
                  >
                    <MorphemeEditor
                      morphemeText={occ.morphemeText}
                      isActive={false}
                      onChange={() => {}}
                    />
                  </div>
                )),
              )}
            </div>
          );
        }
        return null;
      })}

      {/* Action buttons - only shown on active occurrence */}
      {isActive && (
        <div className="flex items-center justify-between px-2 py-1.5 border-t border-muted-foreground/15">
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
}
