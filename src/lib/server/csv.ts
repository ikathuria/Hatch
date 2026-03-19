const escapeCell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
};

export const toCsv = (rows: Record<string, unknown>[], headers: string[]) => {
  const headerRow = headers.map(escapeCell).join(",");
  const dataRows = rows.map((row) =>
    headers.map((header) => escapeCell(row[header])).join(",")
  );
  return [headerRow, ...dataRows].join("\n");
};
