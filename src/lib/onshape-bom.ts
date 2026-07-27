export type OnshapeBomRow = {
  partNumber: string;
  name: string;
  description: string;
  quantity: number;
  revision: string;
  material: string;
  supplier: string;
  makeBuy: "MAKE" | "BUY";
  unitCost: number;
};

export type OnshapeBomParseResult = {
  headers: string[];
  rows: OnshapeBomRow[];
  skipped: number;
};

function splitDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function first(record: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = record[normalized(alias)];
    if (value) return value;
  }
  return "";
}

export function parseOnshapeBom(text: string): OnshapeBomParseResult {
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) return { headers: [], rows: [], skipped: 0 };
  const firstLine = clean.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/\t/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? "\t" : ",";
  const parsed = splitDelimited(clean, delimiter);
  const headers = parsed.shift() || [];
  let skipped = 0;
  const rows = parsed.flatMap((values) => {
    const record = Object.fromEntries(headers.map((header, index) => [normalized(header), values[index] || ""]));
    const partNumber = first(record, ["Part number", "Part #", "Part no", "Number", "Item"]);
    const description = first(record, ["Description", "Part description"]);
    const name = first(record, ["Name", "Part name", "Title"]) || description || partNumber;
    if (!partNumber || !name) {
      skipped += 1;
      return [];
    }
    const rawQuantity = Number(first(record, ["Quantity", "Qty", "QTY."]) || "1");
    const rawCost = Number(first(record, ["Unit cost", "Cost", "Price"]).replace(/[$,]/g, "") || "0");
    const makeBuyValue = first(record, ["Make / buy", "Make or buy", "Procurement", "Source"]).toUpperCase();
    return [{
      partNumber: partNumber.slice(0, 200),
      name: name.slice(0, 500),
      description: description.slice(0, 5000),
      quantity: Number.isFinite(rawQuantity) ? Math.max(1, Math.min(9999, Math.round(rawQuantity))) : 1,
      revision: (first(record, ["Revision", "Rev"]) || "A").slice(0, 100),
      material: first(record, ["Material"]).slice(0, 300),
      supplier: first(record, ["Supplier", "Vendor", "Manufacturer"]).slice(0, 300),
      makeBuy: makeBuyValue.includes("BUY") || makeBuyValue.includes("PURCHASE") ? "BUY" : "MAKE",
      unitCost: Number.isFinite(rawCost) ? Math.max(0, rawCost) : 0,
    } satisfies OnshapeBomRow];
  });
  return { headers, rows, skipped };
}
