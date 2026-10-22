import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Overlay({ onClose, children, widthClassName = "max-w-md" }: { onClose: () => void; children: ReactNode; widthClassName?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6" onMouseDown={onClose}>
      <div className={`relative w-full ${widthClassName} rounded-2xl bg-white p-5 shadow-xl`} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
