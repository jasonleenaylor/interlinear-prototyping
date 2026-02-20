"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useInterlinear } from "@/hooks/use-interlinear";
import { OccurrenceBox } from "@/components/occurrence-box";
import { LinkButton } from "@/components/link-button";
import { cn } from "@/lib/utils";

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
    moveForward,
    moveBackward,
    toggleApprove,
    updateGloss,
    updateMorphemeText,
    toggleLink,
    canGoBack,
    canGoForward,
  } = useInterlinear();

  const stripRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const [translateX, setTranslateX] = useState(0);

  // Recalculate translateX whenever the active group changes
  const recalcTranslate = useCallback(() => {
    const strip = stripRef.current;
    const activeEl = groupRefs.current.get(activeGroupIndex);
    if (!strip || !activeEl) return;

    const targetTranslate = ACTIVE_LEFT_PX - activeEl.offsetLeft;
    setTranslateX(targetTranslate);
  }, [activeGroupIndex]);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Interlinearizer
          </h2>
          <p className="text-sm text-muted-foreground">
            Occurrence {activeGroupIndex + 1} of {linkedGroups.length}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded border border-sky-200 bg-sky-50" />
            Unapproved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded border border-muted-foreground/20 bg-white" />
            Approved
          </span>
        </div>
      </div>

      {/* Fixed-frame scrolling container */}
      <div
        className="overflow-hidden relative"
        role="region"
        aria-label="Scripture interlinear view"
      >
        {/* Translating strip */}
        <div
          ref={stripRef}
          className="flex items-start gap-0 w-max py-1 transition-transform duration-300 ease-in-out"
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
                  className="shrink-0"
                  style={{ opacity: isActive ? 1 : opacity }}
                >
                  <OccurrenceBox
                    group={group}
                    isActive={isActive}
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

      {/* Full text preview */}
      <div className="px-3 py-2 rounded-md bg-muted/50 border border-border">
        <p className="text-xs text-muted-foreground mb-1 font-medium">
          Source Text
        </p>
        <p className="text-sm font-mono leading-relaxed text-foreground">
          {occurrences.map((occ, i) => {
            const isInActiveGroup =
              i >= linkedGroups[activeGroupIndex]?.startIndex &&
              i <
                linkedGroups[activeGroupIndex]?.startIndex +
                  linkedGroups[activeGroupIndex]?.occurrences.length;

            return (
              <span
                key={occ.id}
                className={cn(
                  "transition-colors",
                  isInActiveGroup && "bg-sky-200 rounded px-0.5",
                  occ.approved && !isInActiveGroup && "text-emerald-700",
                  !occ.approved && !isInActiveGroup && "text-muted-foreground",
                )}
              >
                {occ.text}
                {!occ.isPunctuation &&
                  i < occurrences.length - 1 &&
                  !occurrences[i + 1]?.isPunctuation &&
                  " "}
                {occ.isPunctuation && i < occurrences.length - 1 && " "}
              </span>
            );
          })}
        </p>
      </div>
    </div>
  );
}
