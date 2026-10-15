import { cn } from "@/lib/utils";

export const fieldBase =
  "w-full rounded-lg border bg-field px-4 text-[0.95rem] text-fg placeholder:text-muted/60 transition-[border-color,background-color,box-shadow] duration-200 hover:border-white/25 focus-visible:border-brand focus-visible:bg-[#242424] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-60";

export function fieldClass(invalid?: boolean, extra?: string) {
  return cn(fieldBase, invalid ? "border-danger/70" : "border-line", extra);
}

export function Input({
  className,
  invalid,
  ...props
}: React.ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={fieldClass(invalid, cn("h-12", className))}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: React.ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={fieldClass(invalid, cn("min-h-28 resize-y py-3", className))}
      {...props}
    />
  );
}
