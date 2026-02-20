"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useInterlinear } from "@/hooks/use-interlinear";
import { OccurrenceBox } from "@/components/occurrence-box";
import { LinkButton } from "@/components/link-button";
import { RowOrderSettings } from "@/components/row-order-settings";
import { useRowOrder } from "@/hooks/use-row-order";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Settings2, SlidersHorizontal, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OccurrenceType } from "@/lib/interlinear-model";
import { useTextConfig } from "@/hooks/use-text-config";

/**
 * The main interlinearizer component.
 *
 * Layout strategy:
 * - A clip-overflow container holds a flex strip of all occurrence groups.
 * - We measure each group/link element and compute a translateX so the
 *   active group's left edge is always pinned at ACTIVE_LEFT_PX from
 *   the container's left edge. Content shifts; the active box stays put.
 */

const ACTIVE_LEFT_PX = 340; // fixed x-position of the active group's left edge

export function Interlinearizer() {
  const {
    occurrences,
    activeGroupIndex,
    linkedGroups,
    segments,
    occurrenceGroupMap,
    segmentTranslations,
    updateLiteralTranslation,
    updateFreeTranslation,
    mergeSegments,
    moveForward,
    moveBackward,
    toggleApprove,
    updateGloss,
    updateMorphemeText,
    toggleLink,
    goToGroup,
    canGoBack,
    canGoForward,
  } = useInterlinear();

  const textConfig = useTextConfig();

  const rowOrder = useRowOrder();
  const stripRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // ID → approved status; drives source text colour without re-running findIndex
  const occApprovedById = useMemo(
    () => new Map(occurrences.map((o) => [o.id, o.approved])),
    [occurrences],
  );

  const [translateX, setTranslateX] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const sameRef = useCallback(
    (
      a: { book: string; chapter: number; verse: number; fragment?: string },
      b: { book: string; chapter: number; verse: number; fragment?: string },
    ) =>
      a.book === b.book &&
      a.chapter === b.chapter &&
      a.verse === b.verse &&
      (a.fragment ?? "") === (b.fragment ?? ""),
    [],
  );

  // Recalculate translateX whenever the active group changes
  const recalcTranslate = useCallback(() => {
    const strip = stripRef.current;
    const activeEl = groupRefs.current.get(activeGroupIndex);
    if (!strip || !activeEl) return;

    const targetTranslate = ACTIVE_LEFT_PX - activeEl.offsetLeft;
    setTranslateX(targetTranslate);
  }, [activeGroupIndex]);

  /**
   * Click a non-active group to make it active.
   * Always pins the clicked group's LEFT edge at ACTIVE_LEFT_PX — this matches what
   * recalcTranslate computes once goToGroup triggers a re-render, so there is no
   * competing CSS transition override.
   */
  const clickGroup = useCallback(
    (gi: number) => {
      if (gi === activeGroupIndex) return;
      const el = groupRefs.current.get(gi);
      if (!el) return;
      // Always use left-edge alignment — this matches what recalcTranslate computes
      // after goToGroup triggers a re-render, so there is no competing override animation.
      setTranslateX(ACTIVE_LEFT_PX - el.offsetLeft);
      goToGroup(gi);
    },
    [activeGroupIndex, goToGroup],
  );

  /**
   * Navigate to a group with a fade animation — used by text-area word clicks.
   *
   * Sequence:
   *  1. setIsFading(true) → strip goes opacity-0, transition-none applied.
   *  2. 200 ms later (inside setTimeout): setTranslateX(correct) + goToGroup(gi)
   *     are batched by React 18 into ONE render where isFading is still true.
   *     transition-none is active → position snaps invisibly.
   *  3. Browser paints Frame N with correct translateX, strip still transparent.
   *  4. RAF fires (start of Frame N+1, after Frame N's paint):
   *     setIsFading(false) → strip fades in. translateX is unchanged in this
   *     render, so transition-transform has nothing to animate.
   *
   * Explicitly setting translateX (rather than relying on recalcTranslate) is
   * critical: recalcTranslate runs in useEffect which fires AFTER paint, too late
   * to guarantee the position is correct before the RAF fires.
   */
  const fadeToGroup = useCallback(
    (gi: number) => {
      if (gi === activeGroupIndex) return;
      setIsFading(true);
      setTimeout(() => {
        // Compute position directly from the DOM ref — same formula as recalcTranslate.
        // Batched with goToGroup in one React 18 render while isFading=true.
        const el = groupRefs.current.get(gi);
        if (el) setTranslateX(ACTIVE_LEFT_PX - el.offsetLeft);
        goToGroup(gi);
        // RAF fires after Frame N paints the new (invisible) position.
        // translateX won't change in this render → no slide animation.
        requestAnimationFrame(() => {
          setIsFading(false);
        });
      }, 200);
    },
    [activeGroupIndex, goToGroup],
  );

  useEffect(() => {
    recalcTranslate();
  }, [recalcTranslate, linkedGroups.length]);

  // Also recalculate after DOM paints (elements may resize after linking/unlinking)
  useEffect(() => {
    const id = requestAnimationFrame(recalcTranslate);
    return () => cancelAnimationFrame(id);
  }, [recalcTranslate, linkedGroups]);

  // Build render list: groups with link buttons between them
  const renderItems = useMemo(() => {
    const items: Array<
      | { type: "group"; groupIndex: number }
      | { type: "link"; occIndex: number; isLinked: boolean }
    > = [];

    for (let gi = 0; gi < linkedGroups.length; gi++) {
      items.push({ type: "group", groupIndex: gi });

      if (gi < linkedGroups.length - 1) {
        const group = linkedGroups[gi];
        const lastOccIndex = group.startIndex + group.occurrences.length - 1;
        items.push({
          type: "link",
          occIndex: lastOccIndex,
          isLinked: occurrences[lastOccIndex].linkedWithNext,
        });
      }
    }

    return items;
  }, [linkedGroups, occurrences]);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Legend */}
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded border border-sky-200 bg-sky-50" />
          Unapproved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded border border-muted-foreground/20 bg-white" />
          Approved
        </span>
      </div>

      {/* Settings button row */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={rowOrder.open}
          aria-label="Row order settings"
          className="text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="size-4" />
        </Button>
      </div>

      {/* Strip + optional settings panel side-by-side */}
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "overflow-hidden relative flex-1 transition-opacity duration-200",
            isFading && "opacity-0",
          )}
          role="region"
          aria-label="Scripture interlinear view"
        >
          {/* Translating strip */}
          <div
            ref={stripRef}
            className={cn(
              "flex items-start gap-0 w-max py-1",
              isFading
                ? "transition-none"
                : "transition-transform duration-300 ease-in-out",
            )}
            style={{ transform: `translateX(${translateX}px)` }}
          >
            {renderItems.map((item) => {
              if (item.type === "group") {
                const gi = item.groupIndex;
                const group = linkedGroups[gi];
                const isActive = gi === activeGroupIndex;
                const distance = Math.abs(gi - activeGroupIndex);
                // 5% opacity reduction per occurrence distance, minimum 15%
                const opacity = Math.max(0.15, 1 - distance * 0.05);

                return (
                  <div
                    key={`group-${group.startIndex}`}
                    ref={(el) => {
                      if (el) {
                        groupRefs.current.set(gi, el);
                      } else {
                        groupRefs.current.delete(gi);
                      }
                    }}
                    className={cn("shrink-0", !isActive && "cursor-pointer")}
                    style={{ opacity: isActive ? 1 : opacity }}
                    onClick={!isActive ? () => clickGroup(gi) : undefined}
                  >
                    <OccurrenceBox
                      group={group}
                      isActive={isActive}
                      rowOrder={rowOrder.activeOrder}
                      onApprove={toggleApprove}
                      onForward={moveForward}
                      onBackward={moveBackward}
                      onUpdateGloss={updateGloss}
                      onUpdateMorphemeText={updateMorphemeText}
                      onUnlink={toggleLink}
                      canGoBack={canGoBack}
                      canGoForward={canGoForward}
                    />
                  </div>
                );
              }

              // Link button
              return (
                <div
                  key={`link-${item.occIndex}`}
                  className="flex items-start shrink-0"
                >
                  <LinkButton
                    isLinked={item.isLinked}
                    onClick={() => toggleLink(item.occIndex)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings panel */}
        {rowOrder.isOpen && (
          <RowOrderSettings
            order={rowOrder.draftOrder!}
            onMove={rowOrder.moveDraft}
            onSave={rowOrder.save}
            onCancel={rowOrder.cancel}
          />
        )}
      </div>

      {/* Text area */}
      <div className="px-3 py-2 rounded-md bg-muted/50 border border-border">
        {/* Header: config button only, right-aligned */}
        <div className="flex items-center justify-end mb-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={textConfig.toggle}
            aria-label="Text display settings"
            className={cn(
              "text-muted-foreground hover:text-foreground",
              textConfig.isOpen && "text-foreground",
            )}
          >
            <SlidersHorizontal className="size-4" />
          </Button>
        </div>

        {/* Inline config panel */}
        {textConfig.isOpen && (
          <div className="mb-2 px-2 py-1.5 rounded border border-border bg-background flex flex-col gap-1.5 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={textConfig.showLiteral}
                onChange={textConfig.toggleLiteral}
              />
              Literal translation
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={textConfig.showFree}
                onChange={textConfig.toggleFree}
              />
              Free translation
            </label>
          </div>
        )}

        {/* Segment-by-segment text + optional translation inputs */}
        {segments.map((seg, si) => {
          const segIsMerged = !sameRef(seg.startRef, seg.endRef);
          const nextSegIsMerged =
            si < segments.length - 1
              ? !sameRef(segments[si + 1].startRef, segments[si + 1].endRef)
              : false;

          return (
            <div key={seg.id} className="mb-1 last:mb-0">
              {/* Token line */}
              <div className="flex items-start gap-1">
                <p className="flex-1 text-sm font-mono leading-relaxed text-foreground">
                  {seg.occurrences.map((occ, oi) => {
                    const groupIndex = occurrenceGroupMap.get(occ.id) ?? -1;
                    const isInActiveGroup = groupIndex === activeGroupIndex;
                    const approved = occApprovedById.get(occ.id) ?? false;
                    const isPunct = occ.type === OccurrenceType.Punctuation;
                    const nextOcc =
                      seg.occurrences[oi + 1] ??
                      segments[si + 1]?.occurrences[0];
                    const isLastToken =
                      si === segments.length - 1 &&
                      oi === seg.occurrences.length - 1;
                    const nextIsPunct =
                      nextOcc?.type === OccurrenceType.Punctuation;

                    return (
                      <span
                        key={occ.id}
                        className={cn(
                          "transition-colors",
                          !isInActiveGroup && "cursor-pointer",
                          isInActiveGroup && "bg-sky-200 rounded px-0.5",
                          approved && !isInActiveGroup && "text-emerald-700",
                          !approved &&
                            !isInActiveGroup &&
                            "text-muted-foreground",
                        )}
                        onClick={() =>
                          groupIndex !== -1 && fadeToGroup(groupIndex)
                        }
                      >
                        {occ.surfaceText}
                        {!isLastToken && !isPunct && !nextIsPunct && " "}
                        {!isLastToken && isPunct && " "}
                      </span>
                    );
                  })}
                </p>
              </div>
              {textConfig.showLiteral && (
                <Textarea
                  className="mt-1 text-xs min-h-0 h-8 py-1 resize-none font-mono"
                  placeholder="Literal…"
                  value={segmentTranslations[seg.id]?.literal ?? ""}
                  onChange={(e) =>
                    updateLiteralTranslation(seg.id, e.target.value)
                  }
                />
              )}
              {textConfig.showFree && (
                <Textarea
                  className="mt-1 text-xs min-h-0 h-8 py-1 resize-none font-mono"
                  placeholder="Free…"
                  value={segmentTranslations[seg.id]?.free ?? ""}
                  onChange={(e) =>
                    updateFreeTranslation(seg.id, e.target.value)
                  }
                />
              )}
              {/* Merge button between this segment and the next */}
              {si < segments.length - 1 && (
                <div className="flex justify-center my-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => mergeSegments(seg.id, segments[si + 1].id)}
                    aria-label="Merge with next segment"
                    disabled={segIsMerged || nextSegIsMerged}
                    className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20"
                  >
                    <Link2 className="size-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
