"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { fieldClass } from "@/components/ui/input";
import { formatDateSr } from "@/lib/dates";
import { cn } from "@/lib/utils";

type DateFieldProps = {
  id: string;
  value?: Date;
  onChange: (date: Date | undefined) => void;
  onBlur?: () => void;
  /** Dates before this day are disabled. */
  minDate: Date;
  placeholder: string;
  invalid?: boolean;
  describedBy?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
};

export function DateField({
  id,
  value,
  onChange,
  onBlur,
  minDate,
  placeholder,
  invalid,
  describedBy,
  buttonRef,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onBlur?.();
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={buttonRef}
          id={id}
          type="button"
          aria-describedby={describedBy}
          aria-haspopup="dialog"
          className={fieldClass(invalid, "flex h-12 items-center gap-3 text-left")}
        >
          <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <span className={cn("flex-1 truncate", !value && "text-muted/70")}>
            {value ? formatDateSr(value) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent aria-label="Izbor datuma">
        <Calendar
          selected={value}
          defaultMonth={value ?? minDate}
          disabled={{ before: minDate }}
          onSelect={(date) => {
            onChange(date);
            if (date) setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
