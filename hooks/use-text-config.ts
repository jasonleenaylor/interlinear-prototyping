"use client";

import { useState, useEffect } from "react";

interface TextConfig {
  showLiteral: boolean;
  showFree: boolean;
}

const KEY = "interlinear-text-config";
const DEFAULT: TextConfig = { showLiteral: false, showFree: false };

export function useTextConfig() {
  const [config, setConfig] = useState<TextConfig>(DEFAULT);
  const [isOpen, setIsOpen] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) setConfig(JSON.parse(stored) as TextConfig);
    } catch {
      // ignore malformed storage
    }
  }, []);

  const persist = (next: TextConfig): TextConfig => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    return next;
  };

  return {
    showLiteral: config.showLiteral,
    showFree: config.showFree,
    isOpen,
    toggle: () => setIsOpen((o) => !o),
    close: () => setIsOpen(false),
    toggleLiteral: () =>
      setConfig((prev) => persist({ ...prev, showLiteral: !prev.showLiteral })),
    toggleFree: () =>
      setConfig((prev) => persist({ ...prev, showFree: !prev.showFree })),
  };
}
