"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, MapPin, PenLine, X } from "lucide-react";
import { cn, normalizeText } from "@/lib/utils";
import { fieldClass } from "@/components/ui/input";

type ComboboxProps = {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: string[];
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  autoComplete?: string;
};

/**
 * Searchable select that also accepts free text (custom places).
 * Implements the WAI-ARIA combobox pattern with a listbox popup.
 */
export function Combobox({
  id,
  name,
  value,
  onChange,
  onBlur,
  options,
  placeholder,
  invalid,
  describedBy,
  inputRef,
  autoComplete = "off",
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const query = normalizeText(value);

  const filtered = useMemo(() => {
    if (!query) return options;
    return options.filter((o) => normalizeText(o).includes(query));
  }, [options, query]);

  const hasExactMatch = options.some((o) => normalizeText(o) === query);
  const showCustom = value.trim().length > 1 && !hasExactMatch;

  // Flat list of selectable rows: matches first, custom entry last.
  const rows = useMemo(() => {
    const list: { label: string; custom: boolean }[] = filtered.map((label) => ({ label, custom: false }));
    if (showCustom) list.push({ label: value.trim(), custom: true });
    return list;
  }, [filtered, showCustom, value]);

  const listId = `${id}-listbox`;
  const optionId = (i: number) => `${id}-option-${i}`;

  function select(label: string) {
    onChange(label);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setActive(0);
        } else {
          setActive((i) => (rows.length ? (i + 1) % rows.length : -1));
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) setOpen(true);
        setActive((i) => (rows.length ? (i <= 0 ? rows.length - 1 : i - 1) : -1));
        break;
      case "Enter":
        if (open && active >= 0 && rows[active]) {
          e.preventDefault();
          select(rows[active].label);
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onBlur={(e) => {
        if (!wrapperRef.current?.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
          onBlur?.();
        }
      }}
    >
      <MapPin
        className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={fieldClass(invalid, "h-12 pl-11 pr-16")}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
        {value ? (
          <button
            type="button"
            aria-label="Obriši unos"
            className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:text-fg"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setOpen(true);
              document.getElementById(id)?.focus();
            }}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Zatvori listu" : "Otvori listu"}
          className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:text-fg"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setOpen((o) => !o);
            document.getElementById(id)?.focus();
          }}
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence>
        {open && rows.length > 0 ? (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-40 mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-line bg-card p-1.5 shadow-[0_24px_70px_-20px_rgb(0_0_0/0.95)]"
          >
            {rows.map((row, i) => {
              const selected = !row.custom && normalizeText(row.label) === query;
              return (
                <li
                  key={`${row.custom ? "custom" : "opt"}-${row.label}`}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(row.label)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active === i ? "bg-brand/15 text-fg" : "text-fg/90",
                  )}
                >
                  {row.custom ? (
                    <PenLine className="size-4 shrink-0 text-brand" aria-hidden="true" />
                  ) : (
                    <MapPin className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  )}
                  <span className="flex-1 truncate">
                    {row.custom ? (
                      <>
                        Koristi: <span className="font-semibold">“{row.label}”</span>
                      </>
                    ) : (
                      row.label
                    )}
                  </span>
                  {selected ? <Check className="size-4 shrink-0 text-brand" aria-hidden="true" /> : null}
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
