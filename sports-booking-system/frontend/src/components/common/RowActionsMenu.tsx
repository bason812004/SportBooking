import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "../ui/Button";

export type RowActionItem = {
  key: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

export type RowActionSection = {
  title?: string;
  note?: string;
  items: RowActionItem[];
};

const MENU_GAP = 4;

// The menu is portalled with fixed positioning because Table wraps rows in an overflow-auto
// container, which would clip an absolutely positioned dropdown on the last rows.
export function RowActionsMenu({ sections }: { sections: RowActionSection[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visibleSections = sections.filter((section) => section.items.length > 0);

  // Measure the (hidden) menu, then open it below the trigger, or above when there is no room.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const fitsBelow = trigger.bottom + MENU_GAP + menu.height <= window.innerHeight;
    setPosition({
      top: fitsBelow ? trigger.bottom + MENU_GAP : Math.max(MENU_GAP, trigger.top - MENU_GAP - menu.height),
      left: Math.max(MENU_GAP, trigger.right - menu.width)
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (visibleSections.length === 0) return null;

  return (
    <>
      <span ref={triggerRef} className="inline-flex">
        <Button
          variant="secondary"
          size="sm"
          className="px-2"
          aria-label="Thao tác khác"
          title="Thao tác khác"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            setPosition(null);
            setOpen((current) => !current);
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </span>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-2xl"
            style={position ?? { top: 0, left: 0, visibility: "hidden" }}
          >
            {visibleSections.map((section, index) => (
              <div key={section.title ?? index} className={clsx(index > 0 && "mt-1 border-t border-slate-100 pt-1")}>
                {section.title && <p className="px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{section.title}</p>}
                {section.note && <p className="px-3 pb-1.5 text-xs text-amber-700">{section.note}</p>}
                {section.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(false);
                      item.onClick();
                    }}
                    className={clsx(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
                      item.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
