"use client";

import { useRef, useState } from "react";
import { Check, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RowId } from "@/hooks/use-row-order";

const ROW_LABELS: Record<RowId, string> = {
  gloss: "gloss",
  morphemes: "morphemes",
};

interface RowOrderSettingsProps {
  order: RowId[];
  onMove: (fromIndex: number, toIndex: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function RowOrderSettings({
  order,
  onMove,
  onSave,
  onCancel,
}: RowOrderSettingsProps) {
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from !== null && from !== toIndex) {
      onMove(from, toIndex);
    }
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  return (
    <div className="flex flex-col w-36 shrink-0 border rounded-lg bg-background shadow-md z-10 self-start">
      {/* Fixed header: surface text row (not draggable) */}
      <div className="px-3 py-2 border-b">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Row order
        </p>
        <div className="flex items-center gap-2 px-1 py-1.5 rounded text-xs text-muted-foreground bg-muted/50">
          <span className="size-3 shrink-0" /> {/* spacer for grip */}
          <span className="font-mono">surface text</span>
          <span className="ml-auto text-[10px] opacity-50">fixed</span>
        </div>
      </div>

      {/* Draggable rows */}
      <div className="px-3 py-2 flex flex-col gap-1">
        {order.map((id, i) => (
          <div
            key={id}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
            className={cn(
              "flex items-center gap-2 px-1 py-1.5 rounded text-xs cursor-grab active:cursor-grabbing transition-colors select-none",
              dragOverIndex === i
                ? "bg-sky-100 border border-sky-300"
                : "hover:bg-muted/60",
            )}
          >
            <GripVertical className="size-3 shrink-0 text-muted-foreground/50" />
            <span className="font-mono">{ROW_LABELS[id]}</span>
          </div>
        ))}
      </div>

      {/* Save / cancel */}
      <div className="flex items-center justify-between px-3 py-2 border-t">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          aria-label="Cancel"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onSave}
          aria-label="Save row order"
          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
        >
          <Check className="size-4" />
        </Button>
      </div>
    </div>
  );
}
