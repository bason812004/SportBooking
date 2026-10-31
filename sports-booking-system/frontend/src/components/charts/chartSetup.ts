import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";

// Register only what the app's charts use, so the rest of Chart.js is tree-shaken away.
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

// Charts use the app's typeface and text ink; only the marks carry color.
ChartJS.defaults.font.family = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
ChartJS.defaults.font.size = 12;
ChartJS.defaults.color = "#64748b";

/** Solid hairline one step off the white card, so the grid stays recessive. */
export const GRID_COLOR = "#e2e8f0";

/** White tooltip in the app's ink: the category title is muted, the value line is the strong element. */
export const tooltipStyle = {
  backgroundColor: "#ffffff",
  borderColor: GRID_COLOR,
  borderWidth: 1,
  titleColor: "#64748b",
  titleFont: { weight: "normal" as const },
  bodyColor: "#0f172a",
  bodyFont: { weight: 600 },
  padding: 10,
  cornerRadius: 8
};

const plainNumber = new Intl.NumberFormat("vi-VN");
const compactNumber = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Value-axis ticks: plain numbers (1.200), or compact once the axis reaches 10.000 (5 Tr, 30 Tr). The choice is
 * made for the whole axis, so one axis never mixes "800" with "1,2 N".
 */
export function axisTick(value: number | string, ticks: Array<{ value: number }>) {
  const max = Math.max(...ticks.map((tick) => Math.abs(tick.value)));
  return (max >= 10_000 ? compactNumber : plainNumber).format(Number(value));
}

export function formatNumber(value: number) {
  return plainNumber.format(value);
}
