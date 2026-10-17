"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Modal on a native <dialog>: focus trap, Esc to close, inert background. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!open) return <dialog ref={ref} className="hidden" aria-hidden="true" />;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100vw-1.5rem)] overflow-visible rounded-2xl border border-line bg-card p-0 text-fg shadow-[0_40px_120px_-30px_rgb(0_0_0)] backdrop:bg-black/70 backdrop:backdrop-blur-sm",
        size === "sm" && "max-w-md",
        size === "md" && "max-w-xl",
        size === "lg" && "max-w-3xl",
        size === "xl" && "max-w-5xl",
      )}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-hair px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zatvori"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.08] hover:text-fg"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">{children}</div>
        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-t border-hair px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
