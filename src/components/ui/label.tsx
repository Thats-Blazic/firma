import { cn } from "@/lib/utils";

export function Label({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label className={cn("mb-2 block text-sm font-semibold text-fg", className)} {...props}>
      {children}
      {required ? (
        <span className="ml-0.5 text-brand" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}
