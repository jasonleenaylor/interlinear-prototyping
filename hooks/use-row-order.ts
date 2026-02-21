"use client";

import { useState, useCallback } from "react";

export type RowId = "gloss" | "morphemes";

const DEFAULT_ORDER: RowId[] = ["gloss", "morphemes"];
const STORAGE_KEY = "interlinear-row-order";

function loadOrder(): RowId[] {
  if (typeof window === "undefined") return DEFAULT_ORDER;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw) as RowId[];
    // Validate that it contains exactly the expected ids
    if (
      parsed.length === DEFAULT_ORDER.length &&
      DEFAULT_ORDER.every((id) => parsed.includes(id))
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_ORDER;
}

export function useRowOrder() {
  const [savedOrder, setSavedOrder] = useState<RowId[]>(loadOrder);
  const [draftOrder, setDraftOrder] = useState<RowId[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // The order the UI should currently render (draft while panel is open)
  const activeOrder = draftOrder ?? savedOrder;

  const open = useCallback(() => {
    setDraftOrder([...savedOrder]);
    setIsOpen(true);
  }, [savedOrder]);

  const moveDraft = useCallback((fromIndex: number, toIndex: number) => {
    setDraftOrder((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  }, []);

  const save = useCallback(() => {
    if (draftOrder) {
      setSavedOrder(draftOrder);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draftOrder));
    }
    setDraftOrder(null);
    setIsOpen(false);
  }, [draftOrder]);

  const cancel = useCallback(() => {
    setDraftOrder(null);
    setIsOpen(false);
  }, []);

  return { isOpen, activeOrder, draftOrder, open, moveDraft, save, cancel };
}
