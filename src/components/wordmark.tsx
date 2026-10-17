import Image from "next/image";
import { cn } from "@/lib/utils";

/** ADRIRORA TRAVEL wordmark next to the compass logo (public/logo.png). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3.5", className)}>
      <Image src="/logo.png" alt="" width={409} height={512} sizes="32px" className="h-10 w-auto shrink-0" />
      <span aria-hidden="true" className="h-7 w-px bg-white/20" />
      <span className="flex flex-col leading-none">
        <span className="text-[0.95rem] font-bold tracking-[0.3em] text-fg">ADRIRORA</span>
        <span className="mt-[0.4rem] text-[0.62rem] font-semibold tracking-[0.62em] text-muted">TRAVEL</span>
      </span>
    </span>
  );
}
