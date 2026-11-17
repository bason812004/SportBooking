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
  return (
    <table className="sr-only">
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
  );
}
