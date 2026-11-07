"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * A dialog: a centred card (a bottom sheet on phones) or a drawer on the right.
 * Escape and a click outside close it, focus stays inside while it is open, and focus returns to what opened it.
 */
export function Modal({ open, onClose, title, side = "center", children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "center" | "right";
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose; // the parent re-renders on every poll; the effect below must not restart (it would steal focus)

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const first = panel.current?.querySelector<HTMLElement>("input,select,textarea") ?? panel.current;
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const a = items[0]!;
      const z = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const drawer = side === "right";
  // Rendered at the top of the page, so no parent's spacing, clipping or stacking can touch it.
  return createPortal(
    <div className={`fixed inset-0 z-50 flex ${drawer ? "justify-end" : "items-end justify-center sm:items-center sm:p-6"}`}>
      <div className="absolute inset-0 bg-ink/45 motion-safe:animate-fade-in" onClick={() => close.current()} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-paper shadow-lift outline-none ${
          drawer
            ? "h-full max-h-none max-w-md rounded-none sm:rounded-l-3xl motion-safe:animate-drawer-in"
            : "rounded-t-3xl sm:max-w-xl sm:rounded-3xl motion-safe:animate-sheet-in"
        }`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-7 sm:pt-6">
          <h2 className="break-words text-xl font-bold leading-tight tracking-tight sm:text-2xl">{title}</h2>
          <button
            className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-lg leading-none text-muted transition-colors [@media(hover:hover)]:hover:bg-mist [@media(hover:hover)]:hover:text-ink"
            aria-label="Close"
            onClick={() => close.current()}
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-7">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
