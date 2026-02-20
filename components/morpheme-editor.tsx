"use client"

import { useRef, useCallback } from "react"
import { cn } from "@/lib/utils"

interface MorphemeEditorProps {
  morphemeText: string
  isActive: boolean
  onChange: (newText: string) => void
}

/**
 * Splits morphemeText on spaces into editable boxes.
 * - Typing a space splits the current box at the cursor position into two boxes.
 * - Backspace at position 0 of a box joins it with the previous box.
 * - All boxes fill the row together using flex.
 */
export function MorphemeEditor({
  morphemeText,
  isActive,
  onChange,
}: MorphemeEditorProps) {
  const segments = morphemeText.split(/\s+/).filter(Boolean)
  if (segments.length === 0) segments.push("")

  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map())

  const setRef = useCallback(
    (index: number) => (el: HTMLInputElement | null) => {
      if (el) {
        inputRefs.current.set(index, el)
      } else {
        inputRefs.current.delete(index)
      }
    },
    []
  )

  const rebuildText = (segs: string[]) => {
    return segs.filter(Boolean).join(" ")
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    const input = e.currentTarget
    const pos = input.selectionStart ?? 0
    const val = input.value

    if (e.key === " ") {
      e.preventDefault()
      // Split at cursor position
      const left = val.slice(0, pos)
      const right = val.slice(pos)
      const newSegments = [...segments]
      newSegments.splice(index, 1, left, right)
      onChange(rebuildText(newSegments))

      // Focus the new right box at position 0
      requestAnimationFrame(() => {
        const nextInput = inputRefs.current.get(index + 1)
        if (nextInput) {
          nextInput.focus()
          nextInput.setSelectionRange(0, 0)
        }
      })
      return
    }

    if (e.key === "Backspace" && pos === 0 && index > 0) {
      e.preventDefault()
      // Join with previous box
      const prevVal = segments[index - 1]
      const cursorPos = prevVal.length
      const merged = prevVal + val
      const newSegments = [...segments]
      newSegments.splice(index - 1, 2, merged)
      onChange(rebuildText(newSegments))

      // Focus previous box at the join point
      requestAnimationFrame(() => {
        const prevInput = inputRefs.current.get(index - 1)
        if (prevInput) {
          prevInput.focus()
          prevInput.setSelectionRange(cursorPos, cursorPos)
        }
      })
      return
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    // Remove any spaces that snuck in (shouldn't happen since we intercept space)
    const val = e.target.value.replace(/\s/g, "")
    const newSegments = [...segments]
    newSegments[index] = val
    // If a segment becomes empty and it's not the only one, remove it
    const filtered = newSegments.filter(
      (s, i) => s.length > 0 || (newSegments.length === 1 && i === 0)
    )
    onChange(rebuildText(filtered.length > 0 ? filtered : [""]))
  }

  return (
    <div className="flex gap-0.5 min-h-[28px]">
      {segments.map((seg, i) => (
        <div
          key={`${i}-${segments.length}`}
          className={cn(
            "flex-1 min-w-0 rounded border text-center font-mono text-xs",
            isActive
              ? "border-sky-300 bg-white"
              : "border-muted-foreground/20 bg-muted/50"
          )}
        >
          {isActive ? (
            <input
              ref={setRef(i)}
              value={seg}
              onChange={(e) => handleChange(e, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className="w-full h-full px-1.5 py-1 text-center text-xs font-mono bg-transparent outline-none"
              spellCheck={false}
            />
          ) : (
            <div className="px-1.5 py-1 text-muted-foreground truncate">
              {seg || "\u00A0"}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
