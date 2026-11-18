/** Screen-reader twin of a chart: a canvas exposes nothing, so the same numbers are also given as a table. */
export function ChartDataTable({
  caption,
  categoryLabel,
  labels,
  columns
}: {
  caption: string;
  categoryLabel: string;
  labels: string[];
  columns: Array<{ header: string; values: string[] }>;
}) {
  // sr-only sits on a wrapper: a table ignores the 1px size and overflow clip, so a hidden table would still take
  // its full height below the chart and make the page scroll.
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{categoryLabel}</th>
            {columns.map((column) => (
              <th key={column.header} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, index) => (
            <tr key={`${label}-${index}`}>
              <th scope="row">{label}</th>
              {columns.map((column) => (
                <td key={column.header}>{column.values[index]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
