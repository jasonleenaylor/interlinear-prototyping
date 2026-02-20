"use client"

import { Button } from "@/components/ui/button"
import { Link2, Unlink2 } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface LinkButtonProps {
  isLinked: boolean
  onClick: () => void
}

export function LinkButton({ isLinked, onClick }: LinkButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          className={cn(
            "shrink-0 size-6 mx-0.5 self-start mt-2",
            isLinked
              ? "text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100"
              : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted"
          )}
          aria-label={isLinked ? "Unlink occurrences" : "Link occurrences"}
        >
          {isLinked ? (
            <Link2 className="size-3.5" />
          ) : (
            <Unlink2 className="size-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isLinked ? "Unlink occurrences" : "Link occurrences"}
      </TooltipContent>
    </Tooltip>
  )
}
