import { useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import { policies } from "./detailData";
import { DetailSection } from "./detailUtils";

export function PolicySection() {
  const [open, setOpen] = useState(0);
  return (
    <DetailSection title="Chính sách" description="Minh bạch điều kiện hủy, hoàn tiền, thanh toán và nội quy.">
      <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
        {policies.map((item, index) => (
          <button key={item.title} onClick={() => setOpen(open === index ? -1 : index)} className="w-full p-4 text-left">
            <span className="flex items-center justify-between font-black">
              {item.title}
              <ChevronDown className={clsx("h-5 w-5 transition", open === index && "rotate-180")} />
            </span>
            {open === index && <p className="mt-3 text-slate-600">{item.content}</p>}
          </button>
        ))}
      </div>
    </DetailSection>
  );
}
