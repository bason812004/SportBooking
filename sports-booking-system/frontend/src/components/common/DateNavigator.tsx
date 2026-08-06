import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

function addDaysIso(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function DateNavigator({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button type="button" variant="secondary" className="px-2.5" onClick={() => onChange(addDaysIso(value, -1))} aria-label="Ngày trước">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
      <Button type="button" variant="secondary" className="px-2.5" onClick={() => onChange(addDaysIso(value, 1))} aria-label="Ngày sau">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
