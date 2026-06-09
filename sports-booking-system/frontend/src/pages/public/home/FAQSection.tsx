import { useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import { faqItems } from "./homeData";
import { Reveal, SectionShell } from "./homeUtils";

export function FAQSection() {
  const [open, setOpen] = useState(0);
  return (
    <SectionShell eyebrow="FAQ" title="Câu hỏi thường gặp" description="Giải tỏa các băn khoăn quan trọng trước khi người dùng đặt sân hoặc trở thành đối tác." className="bg-[#f8fafc]">
      <Reveal className="mx-auto max-w-4xl divide-y divide-slate-200 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
        {faqItems.map((item, index) => (
          <button key={item.question} onClick={() => setOpen(open === index ? -1 : index)} className="w-full px-4 py-5 text-left">
            <span className="flex items-center justify-between gap-6">
              <span className="text-xl font-black">{item.question}</span>
              <ChevronDown className={clsx("h-5 w-5 transition", open === index && "rotate-180")} />
            </span>
            {open === index && <p className="mt-4 max-w-2xl leading-7 text-slate-600">{item.answer}</p>}
          </button>
        ))}
      </Reveal>
    </SectionShell>
  );
}
