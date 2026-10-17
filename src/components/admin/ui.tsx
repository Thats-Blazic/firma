"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/admin/result";
import {
  STATUS_LABELS,
  TRIP_STATUS_LABELS,
  type BookingStatus,
  type TripStatus,
} from "@/lib/reservations/types";

// ---------------------------------------------------------------------------
//  Toasts
// ---------------------------------------------------------------------------
type Toast = { id: number; kind: "success" | "error" | "info"; text: string };
type ToastApi = {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++counter.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (t) => push("success", t),
      error: (t) => push("error", t),
      info: (t) => push("info", t),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm animate-pop-in items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-[0_20px_60px_-20px_rgb(0_0_0/0.9)]",
              t.kind === "success" && "border-whatsapp/40",
              t.kind === "error" && "border-danger/50",
              t.kind === "info" && "border-line",
            )}
          >
            {t.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-whatsapp" aria-hidden="true" />
            ) : t.kind === "error" ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            )}
            <span className="flex-1 leading-snug">{t.text}</span>
            <button
              type="button"
              aria-label="Zatvori obaveštenje"
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              className="text-muted hover:text-fg"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/** Runs a server action with a pending flag and success / error toasts. */
export function useRunner() {
  const toast = useToast();
  const [pending, start] = useTransition();

  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; onSuccess?: (data: T) => void } = {}) => {
      start(async () => {
        try {
          const result = await fn();
          if (result.ok) {
            const text = opts.success ?? result.message;
            if (text) toast.success(text);
            opts.onSuccess?.(result.data);
          } else {
            toast.error(result.error);
          }
        } catch {
          toast.error("Došlo je do greške. Proverite vezu i pokušajte ponovo.");
        }
      });
    },
    [toast],
  );

  return { run, pending };
}

export { Modal };

/** Required before any destructive action. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  tone = "danger",
  reasonLabel,
  pending,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: "danger" | "default";
  /** When set, an optional reason is collected and passed to `onConfirm`. */
  reasonLabel?: string;
  pending?: boolean;
  onConfirm: (reason: string) => void;
  children?: React.ReactNode;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Odustani
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => onConfirm(reason.trim())}
            className={tone === "danger" ? "bg-danger text-[#1a0505] hover:bg-danger/90" : undefined}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-muted">
        <div>{description}</div>
        {children}
        {reasonLabel ? (
          <div>
            <Label htmlFor="confirm-reason">{reasonLabel}</Label>
            <Textarea id="confirm-reason" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
//  Small presentational pieces
// ---------------------------------------------------------------------------
const BOOKING_TONE: Record<BookingStatus, string> = {
  pending: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  confirmed: "border-whatsapp/40 bg-whatsapp/10 text-whatsapp",
  cancelled: "border-danger/40 bg-danger/10 text-danger",
  completed: "border-sky-400/40 bg-sky-400/10 text-sky-300",
};
const TRIP_TONE: Record<TripStatus, string> = {
  scheduled: "border-whatsapp/40 bg-whatsapp/10 text-whatsapp",
  full: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  cancelled: "border-danger/40 bg-danger/10 text-danger",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wider", BOOKING_TONE[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wider", TRIP_TONE[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {TRIP_STATUS_LABELS[status]}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("surface-raised rounded-2xl p-5 sm:p-6", className)} {...props}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      {icon ? <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-white/[0.04] text-muted">{icon}</div> : null}
      <p className="font-semibold">{title}</p>
      {description ? <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  id: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50",
          checked ? "border-brand bg-brand" : "border-line bg-field",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-0.5 size-4.5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[1.3rem] bg-[#0b0b0b]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden="true" />;
}
