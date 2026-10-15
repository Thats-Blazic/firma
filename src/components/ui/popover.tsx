"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          "z-[70] max-w-[calc(100vw-1.5rem)] animate-pop-in rounded-xl border border-line bg-card p-3 text-fg shadow-[0_24px_70px_-20px_rgb(0_0_0/0.9)] outline-none",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
