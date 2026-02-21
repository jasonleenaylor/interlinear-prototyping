"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useInterlinear } from "@/hooks/use-interlinear";
import { OccurrenceBox } from "@/components/occurrence-box";
import { LinkButton } from "@/components/link-button";
import { RowOrderSettings } from "@/components/row-order-settings";
import { useRowOrder } from "@/hooks/use-row-order";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Settings2, SlidersHorizontal, Link2, Copy } from "lucide-react";
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
const ARC_PEAK_PX = 32;     // how far above the group box tops the arc peaks

export function Interlinearizer() {
  const {
    occurrences,
    activeGroupIndex,
    linkedGroups,
    disjointLinks,
    segments,
    occurrenceGroupMap,
    segmentTranslations,
    updateLiteralTranslation,
    updateFreeTranslation,
    copyGlossesToLiteral,
    mergeSegments,
    splitSegmentAtOccurrence,
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
  // SVG arc paths for disjoint links
  const [arcPaths, setArcPaths] = useState<{ key: string; d: string; isActive: boolean }[]>([]);
  // Incremented by transitionend so the arc useEffect re-fires after the strip
  // slide animation completes, ensuring arc coordinates use final DOM positions.
  const [arcTick, setArcTick] = useState(0);
  const stripContainerRef = useRef<HTMLDivElement>(null);

  const sameBcv = useCallback(
    (
      a: { book: string; chapter: number; verse: number; fragment?: string },
      b: { book: string; chapter: number; verse: number; fragment?: string },
    ) => a.book === b.book && a.chapter === b.chapter && a.verse === b.verse,
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

  // Recompute arc paths whenever disjoint links, translate, or groups change
  useEffect(() => {
    if (disjointLinks.size === 0) {
      setArcPaths([]);
      return;
    }
    const container = stripContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    const paths: { key: string; d: string; isActive: boolean }[] = [];

    for (const key of disjointLinks) {
      const [leftOccStr, rightOccStr] = key.split(":");
      const leftOcc = parseInt(leftOccStr, 10);
      const rightOcc = parseInt(rightOccStr, 10);

      // Find which groups these occurrences belong to
      const leftGi = linkedGroups.findIndex(
        (g) => leftOcc >= g.startIndex && leftOcc < g.startIndex + g.occurrences.length,
      );
      const rightGi = linkedGroups.findIndex(
        (g) => rightOcc >= g.startIndex && rightOcc < g.startIndex + g.occurrences.length,
      );
      if (leftGi < 0 || rightGi < 0) continue;

      const leftEl = groupRefs.current.get(leftGi);
      const rightEl = groupRefs.current.get(rightGi);
      if (!leftEl || !rightEl) continue;

      const leftRect = leftEl.getBoundingClientRect();
      const rightRect = rightEl.getBoundingClientRect();

      // x: measured from containerRect.left (arcWrapper left edge)
      // y: measured from containerRect.top (arcWrapper top, above the pt padding)
      //    so group boxes sit at y ≈ ARC_HEIGHT_PX + strip padding
      const x1 = leftRect.right - containerRect.left;
      const x2 = rightRect.left - containerRect.left;
      const y1 = leftRect.top - containerRect.top + 8;
      const y2 = rightRect.top - containerRect.top + 8;
      const midY = Math.min(y1, y2) - ARC_PEAK_PX; // arc peak above box tops (negative y = above container, overflow-y visible lets it show)
      const cpX1 = x1 + (x2 - x1) * 0.25;
      const cpX2 = x1 + (x2 - x1) * 0.75;

      const d = `M ${x1} ${y1} C ${cpX1} ${midY}, ${cpX2} ${midY}, ${x2} ${y2}`;
      const isActive = leftGi === activeGroupIndex || rightGi === activeGroupIndex;
      paths.push({ key, d, isActive });
    }

    setArcPaths(paths);
  }, [disjointLinks, translateX, linkedGroups, activeGroupIndex, arcTick]);

  // After the strip slide transition ends, bump arcTick so the arc useEffect
  // re-fires with final DOM positions (avoiding stale mid-transition coords).
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const onTransitionEnd = () => setArcTick((t) => t + 1);
    strip.addEventListener("transitionend", onTransitionEnd);
    return () => strip.removeEventListener("transitionend", onTransitionEnd);
  }, []);

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

    const isPunctuationGroup = (gi: number) =>
      linkedGroups[gi].occurrences.every((o) => o.isPunctuation);

    for (let gi = 0; gi < linkedGroups.length; gi++) {
      items.push({ type: "group", groupIndex: gi });

      if (gi < linkedGroups.length - 1) {
        const group = linkedGroups[gi];
        const lastOccIndex = group.startIndex + group.occurrences.length - 1;
        // Skip punctuation boundaries for linking UI.
        // Punctuation stays visible as plain text groups between words.
        if (!isPunctuationGroup(gi) && !isPunctuationGroup(gi + 1)) {
          items.push({
            type: "link",
            occIndex: lastOccIndex,
            isLinked: occurrences[lastOccIndex].linkedWithNext,
          });
        }
      }
    }

    return items;
  }, [linkedGroups, occurrences]);

  /**
   * Every group index that is an endpoint of any disjoint link.
   * Stable across navigation — depends only on the links themselves, not activeGroupIndex.
   */
  const ghostGroupIndices = useMemo(() => {
    // Only RIGHT-endpoint groups are ghost chips — always, regardless of which
    // group is active.  Left-endpoint groups render as normal (faded) inactive
    // groups so the user can see and click on the analysis they belong to.
    const result = new Set<number>();
    for (const key of disjointLinks) {
      const rOcc = parseInt(key.split(":")[1], 10);
      const rGi = linkedGroups.findIndex(
        (g) => rOcc >= g.startIndex && rOcc < g.startIndex + g.occurrences.length,
      );
      if (rGi !== -1) result.add(rGi);
    }
    return result;
  }, [disjointLinks, linkedGroups]);

  /**
   * Map from group index → partner occurrences for every LEFT-endpoint group.
   * These are shown grayed-out inside the analysis box whether or not the
   * group is currently active, so the linked word is always visible.
   */
  const disjointOccsPerGroup = useMemo(() => {
    const map = new Map<number, Occurrence[]>();
    if (disjointLinks.size === 0) return map;
    for (const key of disjointLinks) {
      const [lStr, rStr] = key.split(":");
      const l = parseInt(lStr, 10);
      const r = parseInt(rStr, 10);
      // Left endpoint group: the one whose last occurrence index === l
      const lGi = linkedGroups.findIndex(
        (g) => g.startIndex + g.occurrences.length - 1 === l,
      );
      // Right endpoint group: the one whose first occurrence index === r
      const rGi = linkedGroups.findIndex((g) => g.startIndex === r);
      if (lGi !== -1 && rGi !== -1) {
        const existing = map.get(lGi) ?? [];
        map.set(lGi, [...existing, ...linkedGroups[rGi].occurrences]);
      }
    }
    return map;
  }, [disjointLinks, linkedGroups]);

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
          ref={stripContainerRef}
          className={cn(
            "[overflow-x:clip] overflow-y-visible relative flex-1 transition-opacity duration-200",
            isFading && "opacity-0",
          )}
          role="region"
          aria-label="Scripture interlinear view"
        >
          {/* Disjoint link arc overlay — SVG overflow-visible + overflow-y-visible on container lets arcs draw above the strip */}
          {arcPaths.length > 0 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
              style={{ zIndex: 10 }}
            >
              {arcPaths.map(({ key, d, isActive }) => (
                <path
                  key={key}
                  d={d}
                  fill="none"
                  stroke={isActive ? "rgb(14,165,233)" : "rgb(148,163,184)"}
                  strokeWidth={isActive ? 2 : 1.5}
                  strokeDasharray={isActive ? undefined : "4 3"}
                  opacity={isActive ? 0.9 : 0.5}
                />
              ))}
            </svg>
          )}
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
                const isPunctuationGroup = group.occurrences.every(
                  (o) => o.isPunctuation,
                );
                const distance = Math.abs(gi - activeGroupIndex);
                // 5% opacity reduction per occurrence distance, minimum 15%
                const opacity = Math.max(0.15, 1 - distance * 0.05);

                if (isPunctuationGroup) {
                  return (
                    <div
                      key={`group-${group.startIndex}`}
                      data-group-start={group.startIndex}
                      ref={(el) => {
                        if (el) {
                          groupRefs.current.set(gi, el);
                        } else {
                          groupRefs.current.delete(gi);
                        }
                      }}
                      className={cn(
                        "shrink-0 px-2 py-2 text-sm font-mono text-muted-foreground select-none",
                        !isActive && "cursor-pointer",
                        isActive && "rounded bg-sky-100 text-foreground",
                      )}
                      style={{ opacity: isActive ? 1 : opacity }}
                      onClick={!isActive ? () => clickGroup(gi) : undefined}
                    >
                      {group.occurrences.map((o) => o.text).join("")}
                    </div>
                  );
                }

                // Ghost: part of a disjoint link but not the active group — non-interactive gray chip
                if (ghostGroupIndices.has(gi)) {
                  return (
                    <div
                      key={`group-${group.startIndex}`}
                      data-group-start={group.startIndex}
                      data-testid="disjoint-ghost-chip"
                      ref={(el) => {
                        if (el) {
                          groupRefs.current.set(gi, el);
                        } else {
                          groupRefs.current.delete(gi);
                        }
                      }}
                      className="shrink-0 px-2 py-2 text-sm font-mono text-muted-foreground/50 select-none border border-dashed border-muted-foreground/25 rounded"
                      style={{ opacity }}
                    >
                      {group.occurrences.map((o) => o.text).join(" ")}
                    </div>
                  );
                }

                return (
                  <div
                    key={`group-${group.startIndex}`}
                    data-group-start={group.startIndex}
                    data-active={isActive ? "true" : undefined}
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
                      disjointOccurrences={disjointOccsPerGroup.get(gi)}
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

        {/* Contiguous text mode (no translation lines shown) */}
        {!textConfig.showLiteral && !textConfig.showFree && (
          <p className="text-sm font-mono leading-relaxed text-foreground">
            {segments.flatMap((seg, si) =>
              seg.occurrences.map((occ, oi) => {
                const groupIndex = occurrenceGroupMap.get(occ.id) ?? -1;
                const isInActiveGroup = groupIndex === activeGroupIndex;
                const approved = occApprovedById.get(occ.id) ?? false;
                const isPunct = occ.type === OccurrenceType.Punctuation;
                const nextOcc =
                  seg.occurrences[oi + 1] ?? segments[si + 1]?.occurrences[0];
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
                      !approved && !isInActiveGroup && "text-muted-foreground",
                    )}
                    onClick={() => groupIndex !== -1 && fadeToGroup(groupIndex)}
                    onDoubleClick={() =>
                      splitSegmentAtOccurrence(seg.id, occ.id)
                    }
                  >
                    {occ.surfaceText}
                    {!isLastToken && !isPunct && !nextIsPunct && " "}
                    {!isLastToken && isPunct && " "}
                  </span>
                );
              }),
            )}
          </p>
        )}

        {/* Segment layout mode (translation lines visible) */}
        {(textConfig.showLiteral || textConfig.showFree) &&
          segments.map((seg, si) => {
            const segIsMerged = !sameBcv(seg.startRef, seg.endRef);
            const nextSegIsMerged =
              si < segments.length - 1
                ? !sameBcv(segments[si + 1].startRef, segments[si + 1].endRef)
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
                          onDoubleClick={() =>
                            splitSegmentAtOccurrence(seg.id, occ.id)
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
                  <div className="mt-1 flex items-center gap-1">
                    <Textarea
                      className="text-xs min-h-0 h-8 py-1 resize-none font-mono"
                      placeholder="Literal…"
                      value={segmentTranslations[seg.id]?.literal ?? ""}
                      onChange={(e) =>
                        updateLiteralTranslation(seg.id, e.target.value)
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Copy glosses into literal translation"
                      onClick={() => copyGlossesToLiteral(seg.id)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
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
                      disabled={nextSegIsMerged}
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
