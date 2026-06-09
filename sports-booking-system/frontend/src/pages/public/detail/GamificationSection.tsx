import { topPlayers } from "./detailData";
import { DetailSection } from "./detailUtils";

export function GamificationSection() {
  return (
    <DetailSection title="Gamification" description="Top Player và Top Team tháng này tại sân.">
      <div className="grid gap-3 md:grid-cols-2">
        {topPlayers.map((item) => (
          <div key={item.name} className="flex items-center gap-4 rounded-[1.5rem] bg-amber-50 p-5">
            <item.icon className="h-8 w-8 text-amber-700" />
            <div>
              <p className="text-xl font-black">{item.name}</p>
              <p className="text-slate-600">{item.score}</p>
            </div>
          </div>
        ))}
      </div>
    </DetailSection>
  );
}
