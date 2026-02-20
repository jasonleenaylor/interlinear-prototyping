"use client";

import { type LinkedGroup } from "@/lib/interlinear-types";
import { MorphemeEditor } from "@/components/morpheme-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Check, Unlink2 } from "lucide-react";

interface OccurrenceBoxProps {
  group: LinkedGroup;
  isActive: boolean;
  onApprove: () => void;
  onForward: () => void;
  onBackward: () => void;
  onUpdateGloss: (groupStartIndex: number, gloss: string) => void;
  onUpdateMorphemeText: (occIndex: number, text: string) => void;
  onUnlink: (occIndex: number) => void;
  canGoBack: boolean;
  canGoForward: boolean;
}

export function OccurrenceBox({
  group,
  isActive,
  onApprove,
  onForward,
  onBackward,
  onUpdateGloss,
  onUpdateMorphemeText,
  onUnlink,
  canGoBack,
  canGoForward,
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
      <div className="flex items-stretch px-1.5 pt-1.5 pb-1 gap-0">
        {group.occurrences.map((occ, i) => (
          <div key={occ.id} className="flex items-stretch">
            <div
              className={cn(
                "px-3 py-1.5 text-center font-mono text-base font-semibold text-foreground rounded border",
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
                className="flex items-center justify-center w-6 shrink-0 group/unlink"
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
      </div>

      {/* Gloss input - single for the entire group */}
      <div className="px-2 py-1 border-t border-muted-foreground/15">
        {isActive ? (
          <Input
            value={gloss}
            onChange={(e) => onUpdateGloss(group.startIndex, e.target.value)}
            placeholder="gloss"
            className="h-7 text-sm font-mono bg-white border-muted-foreground/20 text-center"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onApprove();
              }
            }}
          />
        ) : (
          <div className="h-7 flex items-center justify-center text-sm font-mono text-muted-foreground">
            {gloss || "\u00A0"}
          </div>
        )}
      </div>

      {/* Morpheme editors - one per occurrence in the group */}
      <div className="flex border-t border-muted-foreground/15">
        {group.occurrences.map((occ, i) => (
          <div
            key={`morph-${occ.id}`}
            className={cn(
              "px-1.5 py-1.5 flex-1 min-w-0",
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
      </div>

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
