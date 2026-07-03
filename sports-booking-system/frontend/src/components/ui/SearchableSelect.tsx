import { useEffect, useRef, useState } from "react";

type Props = {
  label?: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function SearchableSelect({ label, options, value, onChange, placeholder = "Chọn...", disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";
  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <div ref={ref} className="relative grid gap-1.5 text-sm font-medium text-ink">
      {label && <span>{label}</span>}
      <button
        type="button"
        disabled={disabled}
        className={`flex h-10 items-center justify-between rounded-md border border-line bg-white px-3 text-left text-sm outline-none transition-colors focus:border-action ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        onClick={() => !disabled && setOpen(!open)}
      >
        <span className={value ? "text-ink" : "text-slate-400"}>
          {value ? selectedLabel : placeholder}
        </span>
        <svg className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-line bg-white shadow-lg">
          <div className="border-b p-2">
            <input
              ref={inputRef}
              type="text"
              className="h-8 w-full rounded border border-line px-2.5 text-sm outline-none focus:border-action"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-slate-400">Không tìm thấy</li>
            )}
            {filtered.map((option) => (
              <li
                key={option.value}
                className={`cursor-pointer px-3 py-2 text-sm transition-colors hover:bg-slate-100 ${option.value === value ? "bg-blue-50 font-semibold text-blue-700" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
