// The filter panel for phones and tablets: a "Filters" button (shown below
// desktop width, with how many are ticked) that slides the panel in from the
// left. Ticking choices updates the grid behind it and leaves the sheet open,
// so several can be picked in a row; the button at the bottom closes it.
// Props: active (how many choices are ticked), count (garments matching),
// children (the filter panel).
"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function FilterSheet({
  active,
  count,
  children,
}: {
  active: number;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="mt-6 lg:hidden"
        >
          Filters{active > 0 && ` · ${active}`}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="gap-0"
      >
        <SheetTitle className="eyebrow px-6 pt-6">Filters</SheetTitle>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        <SheetFooter className="border-t border-muted">
          <SheetClose asChild>
            <Button>Show {count.toLocaleString("en")} garments</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
