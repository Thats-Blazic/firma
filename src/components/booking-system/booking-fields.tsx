"use client";

import { AlertCircle, Minus, Plus, type LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export function Stepper({
  id,
  label,
  value,
  min,
  max,
  onChange,
  Icon,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  Icon: LucideIcon;
  hint?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex h-12 items-center justify-between rounded-lg border border-line bg-field px-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Smanji: ${label}`}
          className="grid size-9 place-items-center rounded-md text-fg transition-colors hover:bg-white/[0.08] disabled:opacity-30"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span className="flex items-center gap-2 font-bold tabular-nums" id={id} role="status" aria-live="polite">
          <Icon className="size-4 text-muted" aria-hidden="true" />
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Povećaj: ${label}`}
          className="grid size-9 place-items-center rounded-md text-fg transition-colors hover:bg-white/[0.08] disabled:opacity-30"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

