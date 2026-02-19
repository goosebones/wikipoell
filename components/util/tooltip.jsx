"use client";

import { useState } from "react";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/styles/components/ui/tooltip";
import { cn } from "@/styles/lib/utils";

export function GuntherTooltip({ content, children, className }) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={open}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn("cursor-pointer", className)}
            onClick={() => setOpen(!open)}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onTouchStart={() => setOpen(!open)}
            onKeyDown={(e) => {
              e.preventDefault();
              e.key === "Enter" && setOpen(!open);
            }}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent className={!content ? "hidden" : ""}>
          <span className="inline-block">{content}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
