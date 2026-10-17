"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Map as MapIcon,
  MapPin,
  Menu,
  Settings as SettingsIcon,
  Ticket,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/admin/actions/auth";
import { ToastProvider } from "@/components/admin/ui";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Pregled", Icon: LayoutDashboard, manager: false, exact: true },
  { href: "/admin/bookings", label: "Rezervacije", Icon: Ticket, manager: false },
  { href: "/admin/trips", label: "Polasci", Icon: ListChecks, manager: true },
  { href: "/admin/calendar", label: "Kalendar", Icon: CalendarDays, manager: true },
  { href: "/admin/destinations", label: "Destinacije", Icon: MapPin, manager: true },
  { href: "/admin/routes", label: "Relacije i cene", Icon: MapIcon, manager: true },
  { href: "/admin/settings", label: "Podešavanja", Icon: SettingsIcon, manager: true },
] as const;

export function AdminShell({
  email,
  role,
  isManager,
  children,
}: {
  email: string;
  role: string;
  isManager: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((i) => isManager || !i.manager);

  const nav = (
    <nav aria-label="Administracija" className="flex flex-col gap-1">
      {items.map(({ href, label, Icon, ...rest }) => {
        const exact = "exact" in rest && rest.exact;
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3.5 text-sm font-semibold transition-colors",
              active ? "bg-brand/12 text-brand shadow-[inset_2px_0_0_var(--color-brand)]" : "text-muted hover:bg-white/[0.05] hover:text-fg",
            )}
          >
            <Icon className="size-[1.1rem]" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className="border-t border-hair pt-4">
      <p className="truncate text-sm font-semibold" title={email}>
        {email}
      </p>
      <p className="mt-0.5 text-xs uppercase tracking-wider text-muted">{role}</p>
      <form action={logoutAction} className="mt-3">
        <button
          type="submit"
          className="flex h-10 w-full items-center gap-2.5 rounded-lg border border-line px-3.5 text-sm font-semibold text-muted transition-colors hover:border-white/30 hover:text-fg"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Odjava
        </button>
      </form>
      <Link href="/" className="mt-3 block text-xs text-muted underline underline-offset-4 hover:text-fg">
        Pogledaj sajt
      </Link>
    </div>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[16.5rem_1fr]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen flex-col justify-between border-r border-hair bg-surface px-4 py-6 lg:flex">
          <div>
            <Link href="/admin" className="mb-8 block px-2" aria-label="Pregled">
              <Wordmark />
            </Link>
            {nav}
          </div>
          {account}
        </aside>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-hair bg-bg/90 px-4 backdrop-blur-xl lg:hidden">
          <Link href="/admin" aria-label="Pregled">
            <Wordmark />
          </Link>
          <button
            type="button"
            aria-label={open ? "Zatvori meni" : "Otvori meni"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid size-10 place-items-center rounded-lg border border-line"
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </header>
        {open ? (
          <div className="fixed inset-x-0 top-14 z-30 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-hair bg-surface px-4 py-4 lg:hidden">
            {nav}
            <div className="mt-4">{account}</div>
          </div>
        ) : null}

        <main id="admin-main" className="min-w-0 px-4 py-7 sm:px-8 sm:py-10 lg:px-10">
          <div className="mx-auto max-w-[78rem]">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
