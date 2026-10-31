import { Line } from "react-chartjs-2";
import type { ChartOptions, Plugin } from "chart.js";
import { ChartDataTable } from "./ChartDataTable";
import { GRID_COLOR, axisTick, formatNumber, tooltipStyle } from "./chartSetup";

type Series = { label: string; values: number[]; color: string };

type Props = {
  /** Names the chart in its screen-reader table; the card's visible heading says the same. */
  title: string;
  labels: string[];
  series: Series[];
  /** What the labels are, e.g. "Kỳ": the table's first column header. */
  categoryLabel: string;
  formatValue?: (value: number) => string;
};

// The crosshair finds the X: a hairline at the hovered position, drawn under the lines.
const crosshair: Plugin<"line"> = {
  id: "crosshair",
  beforeDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements() ?? [];
    if (!active.length) return;
    const { ctx, chartArea } = chart;
    const x = active[0].element.x;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#cbd5e1";
    ctx.stroke();
    ctx.restore();
  }
};

/** Line chart over time; two or more series always get a legend, a single one is named by the card heading. */
export function LineChart({ title, labels, series, categoryLabel, formatValue = formatNumber }: Props) {
  const lonePoint = labels.length === 1;

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    // One readout lists every series at the hovered X; the pointer never has to land on a line.
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: series.length > 1,
        position: "top",
        align: "end",
        labels: { usePointStyle: true, pointStyle: "line", color: "#475569" }
      },
      tooltip: {
        ...tooltipStyle,
        usePointStyle: true,
        callbacks: {
          label: (item) => `${formatValue(Number(item.raw))} · ${item.dataset.label}`,
          labelPointStyle: () => ({ pointStyle: "line", rotation: 0 })
        }
      }
    },
    scales: {
      x: { grid: { display: false }, border: { color: GRID_COLOR }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
      y: { beginAtZero: true, grid: { color: GRID_COLOR }, border: { display: false }, ticks: { callback: (value, _index, ticks) => axisTick(value, ticks) } }
    }
  };

  const data = {
    labels,
    datasets: series.map((item) => ({
      label: item.label,
      data: item.values,
      borderColor: item.color,
      backgroundColor: item.color,
      borderWidth: 2,
      borderCapStyle: "round" as const,
      borderJoinStyle: "round" as const,
      cubicInterpolationMode: "monotone" as const,
      // Markers appear on hover (or for a lone point, which has no line); the hover marker is ringed in the
      // card color. The resting point border stays the series color: legend and tooltip keys are drawn with it.
      pointRadius: lonePoint ? 4 : 0,
      pointBorderColor: item.color,
      pointHoverRadius: 5,
      pointHoverBorderColor: "#ffffff",
      pointHoverBorderWidth: 2,
      pointHitRadius: 12
    }))
  };

  return (
    <div className="relative h-full w-full">
      <Line data={data} options={options} plugins={[crosshair]} aria-hidden="true" />
      <ChartDataTable
        caption={title}
        categoryLabel={categoryLabel}
        labels={labels}
        columns={series.map((item) => ({ header: item.label, values: item.values.map(formatValue) }))}
      />
    </div>
  );
}
