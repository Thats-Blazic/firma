import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/input";

/** Native <select> (best accessibility and mobile UX) styled like the other fields. */
export function Select({
  className,
  invalid,
  children,
  wrapperClassName,
  ...props
}: React.ComponentProps<"select"> & { invalid?: boolean; wrapperClassName?: string }) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        aria-invalid={invalid || undefined}
        className={fieldClass(invalid, cn("h-12 cursor-pointer appearance-none pr-10 [&>option]:bg-card", className))}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>
  );
}
