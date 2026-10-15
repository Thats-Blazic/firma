"use client";

import { DayPicker, type Matcher } from "react-day-picker";
import { srLatn } from "react-day-picker/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "react-day-picker/style.css";

type CalendarProps = {
  selected?: Date;
  onSelect: (date: Date | undefined) => void;
  disabled?: Matcher | Matcher[];
  defaultMonth?: Date;
};

/** Single-date picker with a Serbian (Latin) locale and a dark orange skin. */
export function Calendar({ selected, onSelect, disabled, defaultMonth }: CalendarProps) {
  return (
    <DayPicker
      mode="single"
      locale={srLatn}
      weekStartsOn={1}
      selected={selected}
      onSelect={onSelect}
      disabled={disabled}
      defaultMonth={defaultMonth ?? selected}
      showOutsideDays
      components={{
        Chevron: ({ orientation, className }) =>
          orientation === "left" ? (
            <ChevronLeft className={className} width={18} height={18} aria-hidden="true" />
          ) : (
            <ChevronRight className={className} width={18} height={18} aria-hidden="true" />
          ),
      }}
    />
  );
}
