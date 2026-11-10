"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** Slide-over form/detail container used for create/edit/detail on every screen. */
export function FormSheet({
  open, onOpenChange, title, description, children, onSubmit, submitLabel = "Save", wide, hideSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit?: () => void;
  submitLabel?: string;
  wide?: boolean;
  hideSubmit?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={wide ? "sm:max-w-2xl" : "sm:max-w-md"}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit?.();
          }}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">{children}</div>
          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {hideSubmit ? "Close" : "Cancel"}
            </Button>
            {!hideSubmit && <Button type="submit">{submitLabel}</Button>}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
