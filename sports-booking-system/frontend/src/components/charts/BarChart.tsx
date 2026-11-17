import { Bar } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { ChartDataTable } from "./ChartDataTable";
import { GRID_COLOR, axisTick, formatNumber, tooltipStyle } from "./chartSetup";

type Props = {
  /** Names the chart in its screen-reader table; the card's visible heading says the same. */
  title: string;
  labels: string[];
  values: number[];
  /** The measure, e.g. "Lượt đặt": the tooltip's series name and the table's column header. */
  seriesLabel: string;
  /** What the labels are, e.g. "Ngày": the table's first column header. */
  categoryLabel: string;
  /** One color for every bar, or one per bar when the color itself means something (e.g. a demand level). */
  color: string | string[];
  horizontal?: boolean;
  /** Counts: whole-number ticks only. */
  integer?: boolean;
  max?: number;
  /** Shortens a category label on the axis only; the tooltip and table keep the full label. */
  tickLabel?: (label: string) => string;
  formatValue?: (value: number) => string;
  /** Replaces the whole tooltip line, for bars that need more than "value · series". */
  tooltipLabel?: (value: number, index: number) => string;
};

/** Single-series bar chart: one series needs no legend, since the card heading names it. */
export function BarChart({
  title,
  labels,
  values,
  seriesLabel,
  categoryLabel,
  color,
  horizontal = false,
  integer = false,
  max,
  tickLabel,
  formatValue = formatNumber,
  tooltipLabel
}: Props) {
  const categoryAxis = horizontal ? "y" : "x";
  const valueAxis = horizontal ? "x" : "y";

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: categoryAxis,
    // The whole band around a bar is its hover target, not only the painted pixels.
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipStyle,
        displayColors: false,
        callbacks: {
          label: (item) => {
            const value = Number(item.raw);
            return tooltipLabel ? tooltipLabel(value, item.dataIndex) : `${formatValue(value)} · ${seriesLabel}`;
          }
        }
      }
    },
    scales: {
      [categoryAxis]: {
        grid: { display: false },
        border: { color: GRID_COLOR },
        ticks: {
          maxRotation: 0,
          autoSkipPadding: 8,
          callback(value) {
            const label = this.getLabelForValue(Number(value));
            return tickLabel ? tickLabel(label) : label;
          }
        }
      },
      [valueAxis]: {
        beginAtZero: true,
        max,
        grid: { color: GRID_COLOR },
        border: { display: false },
        ticks: { precision: integer ? 0 : undefined, callback: (value, _index, ticks) => axisTick(value, ticks) }
      }
    }
  };

  const data = {
    labels,
    datasets: [
      {
        label: seriesLabel,
        data: values,
        backgroundColor: color,
        // Rounded data-end only: Chart.js leaves the corners on the baseline side square.
        borderRadius: 4,
        maxBarThickness: 24
      }
    ]
  };

  return (
    <div className="relative h-full w-full">
      <Bar data={data} options={options} aria-hidden="true" />
      <ChartDataTable
        caption={title}
        categoryLabel={categoryLabel}
        labels={labels}
        columns={[{ header: seriesLabel, values: values.map(formatValue) }]}
      />
    </div>
  );
}
