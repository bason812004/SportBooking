import { liveActivity } from "./detailData";
import { DetailSection } from "./detailUtils";

export function LiveActivity() {
  return (
    <DetailSection title="Live activity">
      <div className="space-y-2">
        {liveActivity.map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-bold">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            {item}
          </div>
        ))}
      </div>
    </DetailSection>
  );
}
