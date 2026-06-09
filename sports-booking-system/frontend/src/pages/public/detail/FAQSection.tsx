import { useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import { faq } from "./detailData";
import { DetailSection } from "./detailUtils";

export function FAQSection() {
  const [open, setOpen] = useState(0);
  return (
    <DetailSection title="FAQ">
      <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
        {faq.map((item, index) => (
          <button key={item.question} onClick={() => setOpen(index === open ? -1 : index)} className="w-full p-4 text-left">
            <span className="flex items-center justify-between font-black">{item.question}<ChevronDown className={clsx("h-5 w-5 transition", open === index && "rotate-180")} /></span>
            {open === index && <p className="mt-3 text-slate-600">{item.answer}</p>}
          </button>
        ))}
      </div>
    </DetailSection>
  );
}
