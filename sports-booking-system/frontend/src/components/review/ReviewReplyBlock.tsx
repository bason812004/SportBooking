import type { ReactNode } from "react";
import { Store } from "lucide-react";
import { formatDateTime } from "../../lib/format";

/** The court owner's reply under a review, as customers see it on the court page. */
export function ReviewReplyBlock({ content, repliedAt, businessName, actions }: {
  content: string;
  repliedAt: string;
  businessName?: string | null;
  actions?: ReactNode;
}) {
  return (
    <div className="mt-3 rounded-xl border-l-4 border-teal-500 bg-teal-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800">
          <Store className="h-3.5 w-3.5" /> Phản hồi từ {businessName || "chủ sân"}
          <span className="font-normal text-slate-500">· {formatDateTime(repliedAt)}</span>
        </p>
        {actions && <div className="flex gap-3 text-xs font-bold">{actions}</div>}
      </div>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-slate-700">{content}</p>
    </div>
  );
}
