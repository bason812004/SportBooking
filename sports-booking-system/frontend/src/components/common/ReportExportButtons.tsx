import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/Button";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReportExportButtons({
  filenameBase,
  onExport
}: {
  filenameBase: string;
  onExport: (format: "excel" | "pdf") => Promise<Blob>;
}) {
  const [pending, setPending] = useState<"excel" | "pdf" | null>(null);

  const handleExport = async (format: "excel" | "pdf") => {
    setPending(format);
    try {
      const blob = await onExport(format);
      downloadBlob(blob, `${filenameBase}.${format === "excel" ? "xlsx" : "pdf"}`);
    } catch (error: any) {
      toast.error(error.message || "Không thể xuất báo cáo");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="secondary" disabled={pending != null} onClick={() => handleExport("excel")}>
        <FileSpreadsheet className="h-4 w-4" />
        {pending === "excel" ? "Đang xuất..." : "Xuất Excel"}
      </Button>
      <Button variant="secondary" disabled={pending != null} onClick={() => handleExport("pdf")}>
        <FileText className="h-4 w-4" />
        {pending === "pdf" ? "Đang xuất..." : "Xuất PDF"}
      </Button>
    </div>
  );
}
