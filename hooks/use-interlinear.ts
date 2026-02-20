"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { type Occurrence, buildLinkedGroups } from "@/lib/interlinear-types";
import { sampleInterlinearization, sampleAnalyses } from "@/lib/sample-data";
import { adaptToUiOccurrences } from "@/lib/adapt-sample-data";

/** Build initial UI occurrences from the canonical sample data (all verses). */
function buildInitialOccurrences(): Occurrence[] {
  return adaptToUiOccurrences(sampleInterlinearization, sampleAnalyses, {
    allSegments: true,
  });
}

/** Seed translation state from canonical segment data. */
function buildInitialTranslations(): Record<
  string,
  { literal: string; free: string }
> {
  const book = sampleInterlinearization.books[0];
  if (!book) return {};
  const result: Record<string, { literal: string; free: string }> = {};
  for (const seg of book.segments) {
    result[seg.id] = {
      literal: seg.literalTranslation?.["en"] ?? "",
      free: seg.freeTranslation?.["en"] ?? "",
    };
  }
  return result;
}

export function useInterlinear() {
  const [occurrences, setOccurrences] = useState<Occurrence[]>(
    buildInitialOccurrences,
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const [segmentTranslations, setSegmentTranslations] = useState<
    Record<string, { literal: string; free: string }>
  >(buildInitialTranslations);

  // Memoized so dependent values (occurrenceGroupMap) only rebuild when occurrences change
  const linkedGroups = useMemo(
    () => buildLinkedGroups(occurrences),
    [occurrences],
  );

  // Keep a ref to linkedGroups to avoid stale closures
  const linkedGroupsRef = useRef(linkedGroups);
  useEffect(() => {
    linkedGroupsRef.current = linkedGroups;
  }, [linkedGroups]);

  // Find which group the active index belongs to
  const activeGroupIndex = linkedGroups.findIndex(
    (g) =>
      activeIndex >= g.startIndex &&
      activeIndex < g.startIndex + g.occurrences.length,
  );

  // Canonical segments — stable reference (source data never changes at runtime)
  const segments = useMemo(
    () => sampleInterlinearization.books[0]?.segments ?? [],
    [],
  );

  // O(1) lookup: canonical occurrence ID → group index.
  // Used by the source text click handlers — eliminates positional findIndex drift.
  const occurrenceGroupMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let gi = 0; gi < linkedGroups.length; gi++) {
      for (const occ of linkedGroups[gi].occurrences) {
        map.set(occ.id, gi);
      }
    }
    return map;
  }, [linkedGroups]);

  const moveForward = useCallback(() => {
    setActiveIndex((prev) => {
      const groups = linkedGroupsRef.current;
      const currentGroupIdx = groups.findIndex(
        (g) =>
          prev >= g.startIndex && prev < g.startIndex + g.occurrences.length,
      );
      if (currentGroupIdx < groups.length - 1) {
        return groups[currentGroupIdx + 1].startIndex;
      }
      return prev;
    });
  }, []);

  const moveBackward = useCallback(() => {
    setActiveIndex((prev) => {
      const groups = linkedGroupsRef.current;
      const currentGroupIdx = groups.findIndex(
        (g) =>
          prev >= g.startIndex && prev < g.startIndex + g.occurrences.length,
      );
      if (currentGroupIdx > 0) {
        return groups[currentGroupIdx - 1].startIndex;
      }
      return prev;
    });
  }, []);

  const toggleApprove = useCallback(() => {
    const group = linkedGroupsRef.current[activeGroupIndex];
    if (!group) return;

    const allApproved = group.occurrences.every((o) => o.approved);
    const newStatus = !allApproved;

    setOccurrences((prev) => {
      const next = [...prev];
      for (
        let i = group.startIndex;
        i < group.startIndex + group.occurrences.length;
        i++
      ) {
        next[i] = { ...next[i], approved: newStatus };
      }
      return next;
    });

    // Auto-advance only when approving, not when unapproving
    if (newStatus) {
      moveForward();
    }
  }, [activeGroupIndex, moveForward]);

  const updateGloss = useCallback((groupStartIndex: number, gloss: string) => {
    // For a linked group, we store the gloss on the first occurrence
    setOccurrences((prev) => {
      const next = [...prev];
      next[groupStartIndex] = { ...next[groupStartIndex], gloss };
      return next;
    });
  }, []);

  const updateMorphemeText = useCallback(
    (occIndex: number, morphemeText: string) => {
      setOccurrences((prev) => {
        const next = [...prev];
        next[occIndex] = { ...next[occIndex], morphemeText };
        return next;
      });
    },
    [],
  );

  const toggleLink = useCallback(
    (occIndex: number) => {
      setOccurrences((prev) => {
        const next = [...prev];

        // If already linked here, just unlink (simple toggle)
        if (next[occIndex].linkedWithNext) {
          next[occIndex] = { ...next[occIndex], linkedWithNext: false };
          return next;
        }

        // The link sits between occIndex and occIndex+1.
        // Determine which side faces the active group so we know
        // which neighbour to merge into the active group.
        const groups = linkedGroupsRef.current;
        const activeGroup = groups[activeGroupIndex];
        if (!activeGroup) {
          // Fallback: simple adjacent link
          next[occIndex] = { ...next[occIndex], linkedWithNext: true };
          return next;
        }

        const activeEnd =
          activeGroup.startIndex + activeGroup.occurrences.length - 1;

        // Adjacent link — just set the flag
        if (occIndex === activeEnd || occIndex + 1 === activeGroup.startIndex) {
          next[occIndex] = { ...next[occIndex], linkedWithNext: true };
          return next;
        }

        // Non-contiguous: link the neighbour on the active-group side
        // into the active group by bridging all occurrences in between.
        if (occIndex > activeEnd) {
          // Link is to the right of the active group.
          // Bridge from activeEnd through occIndex.
          for (let i = activeEnd; i <= occIndex; i++) {
            next[i] = { ...next[i], linkedWithNext: true };
          }
        } else if (occIndex + 1 < activeGroup.startIndex) {
          // Link is to the left of the active group.
          // Bridge from occIndex through activeGroup.startIndex - 1.
          for (let i = occIndex; i < activeGroup.startIndex; i++) {
            next[i] = { ...next[i], linkedWithNext: true };
          }
        } else {
          // Inside the active group — simple toggle
          next[occIndex] = { ...next[occIndex], linkedWithNext: true };
        }

        return next;
      });
    },
    [activeGroupIndex],
  );

  const updateLiteralTranslation = useCallback(
    (segmentId: string, text: string) => {
      setSegmentTranslations((prev) => ({
        ...prev,
        [segmentId]: { ...prev[segmentId], literal: text },
      }));
    },
    [],
  );

  const updateFreeTranslation = useCallback(
    (segmentId: string, text: string) => {
      setSegmentTranslations((prev) => ({
        ...prev,
        [segmentId]: { ...prev[segmentId], free: text },
      }));
    },
    [],
  );

  const canGoBack = activeGroupIndex > 0;
  const canGoForward = activeGroupIndex < linkedGroups.length - 1;

  /** Jump directly to a group by its group index. */
  const goToGroup = useCallback((groupIndex: number) => {
    const groups = linkedGroupsRef.current;
    const target = groups[groupIndex];
    if (target) setActiveIndex(target.startIndex);
  }, []);

  return {
    occurrences,
    activeIndex,
    activeGroupIndex,
    linkedGroups,
    segments,
    occurrenceGroupMap,
    segmentTranslations,
    updateLiteralTranslation,
    updateFreeTranslation,
    moveForward,
    moveBackward,
    toggleApprove,
    updateGloss,
    updateMorphemeText,
    toggleLink,
    goToGroup,
    canGoBack,
    canGoForward,
  };
}
