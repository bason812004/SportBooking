import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../common/States";
import type { PartnerCourtBlock } from "../../features/partner/api/partnerApi";

export function BlockHistoryList({
  blocks,
  isLoading,
  isError,
  errorMessage,
  open,
  onToggleOpen,
  onCancel
}: {
  blocks: PartnerCourtBlock[] | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  open: boolean;
  onToggleOpen: () => void;
  onCancel: (blockId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white">
      <button type="button" className="flex w-full items-center justify-between p-4 text-left" onClick={onToggleOpen}>
        <span className="text-sm font-bold text-slate-500">Lịch sử lịch nghỉ ({blocks?.length ?? 0})</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open &&
        (isLoading ? (
          <div className="p-4"><LoadingState /></div>
        ) : isError ? (
          <div className="p-4"><ErrorState message={errorMessage ?? "Không thể tải lịch sử"} /></div>
        ) : !blocks?.length ? (
          <div className="border-t p-4"><EmptyState title="Chưa có lịch nghỉ/bảo trì nào." /></div>
        ) : (
          blocks.map((block) => (
            <div key={block.id} className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
              <div className="flex items-start gap-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${block.courtSurface ? "bg-teal-500" : "bg-slate-400"}`} />
                <div>
                  <p className="font-bold text-ink">
                    {new Date(block.blockDate).toLocaleDateString("vi-VN")} · {block.startTime.slice(11, 16)}-{block.endTime.slice(11, 16)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {block.courtSurface ? block.courtSurface.name : "Cả cụm sân"}
                    {block.reason ? ` · ${block.reason}` : ""}
                  </p>
                </div>
              </div>
              <Button variant="danger" onClick={() => onCancel(block.id)}>Hủy</Button>
            </div>
          ))
        ))}
    </div>
  );
}
