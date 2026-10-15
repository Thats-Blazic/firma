import { RouteMark } from "@/components/icons";
import { cn } from "@/lib/utils";

/** ADRIATIC TRANS wordmark with a minimal route mark. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3.5", className)}>
      <RouteMark className="size-8 text-brand" />
      <span aria-hidden="true" className="h-7 w-px bg-white/20" />
      <span className="flex flex-col leading-none">
        <span className="text-[0.95rem] font-bold tracking-[0.3em] text-fg">ADRIATIC</span>
        <span className="mt-[0.4rem] text-[0.62rem] font-semibold tracking-[0.62em] text-muted">TRANS</span>
      </span>
    </span>
  );
}
