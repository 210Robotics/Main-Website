import ExcelJS from "exceljs";
import {
  financeEntryKinds,
  financeEntryStatuses,
} from "@/lib/operations";

export type TabularSheet = {
  name: string;
  rows: string[][];
};

export type ImportedDecisionCriterion = {
  name: string;
  weight: number;
  goal: "SCORE" | "HIGHER" | "LOWER";
};

export type ImportedDecisionConcept = {
  name: string;
  values: number[];
};

export type ImportedFinanceRow = {
  kind: (typeof financeEntryKinds)[number];
  category: string;
  description: string;
  vendor: string;
  quantity: number;
  unitCost: number;
  amount: number;
  status: (typeof financeEntryStatuses)[number];
  occurredAt: string;
  notes: string;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_SHEETS = 12;
const MAX_ROWS_PER_SHEET = 2_000;
const MAX_COLUMNS = 80;

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cleanCell(value: unknown) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, 20_000);
}

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
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cleanCell(value));
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cleanCell(value));
      if (row.some(Boolean)) rows.push(row.slice(0, MAX_COLUMNS));
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(cleanCell(value));
  if (row.some(Boolean)) rows.push(row.slice(0, MAX_COLUMNS));
  return rows.slice(0, MAX_ROWS_PER_SHEET);
}

export async function readTabularBuffer(input: {
  filename: string;
  buffer: Buffer;
}): Promise<TabularSheet[]> {
  const filename = input.filename.toLowerCase();
  const buffer = input.buffer;
  if (filename.endsWith(".csv") || filename.endsWith(".tsv")) {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const delimiter =
      filename.endsWith(".tsv") ||
      (firstLine.match(/\t/g)?.length ?? 0) >
        (firstLine.match(/,/g)?.length ?? 0)
        ? "\t"
        : ",";
    return [
      {
        name: filename.endsWith(".tsv") ? "TSV import" : "CSV import",
        rows: splitDelimited(text, delimiter),
      },
    ];
  }
  if (!filename.endsWith(".xlsx"))
    throw new Error("Upload an .xlsx, .csv, or .tsv file.");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook.worksheets.slice(0, MAX_SHEETS).map((worksheet) => {
    const rows: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      if (rows.length >= MAX_ROWS_PER_SHEET) return;
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        if (column <= MAX_COLUMNS) {
          values[column - 1] = cleanCell(cell.text || cell.value);
        }
      });
      if (values.some(Boolean)) rows.push(values);
    });
    return { name: worksheet.name, rows };
  });
}

export async function readTabularUpload(file: File): Promise<TabularSheet[]> {
  if (!(file instanceof File) || !file.size)
    throw new Error("Choose a spreadsheet to import.");
  if (file.size > MAX_UPLOAD_BYTES)
    throw new Error("The spreadsheet must be 8 MB or smaller.");
  return readTabularBuffer({
    filename: file.name,
    buffer: Buffer.from(await file.arrayBuffer()),
  });
}

function parseNumber(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text) || /^-/.test(text);
  const parsed = Number(text.replace(/[,$%()\s]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function decisionGoal(value: unknown): ImportedDecisionCriterion["goal"] {
  const text = normalized(value);
  if (
    text.includes("lower") ||
    text.includes("minimize") ||
    text.includes("minimum") ||
    text.includes("less")
  )
    return "LOWER";
  if (
    text.includes("higher") ||
    text.includes("maximize") ||
    text.includes("maximum") ||
    text.includes("more")
  )
    return "HIGHER";
  return "SCORE";
}

function validateDecisionImport(
  criteria: ImportedDecisionCriterion[],
  concepts: ImportedDecisionConcept[],
) {
  const cleanCriteria = criteria
    .filter((item) => item.name)
    .slice(0, 20)
    .map((item) => ({
      ...item,
      name: item.name.slice(0, 120),
      weight: Math.max(0, Math.min(10_000, item.weight || 0)),
    }));
  const cleanConcepts = concepts
    .filter((item) => item.name)
    .slice(0, 50)
    .map((item) => ({
      name: item.name.slice(0, 160),
      values: cleanCriteria.map((_, index) => item.values[index] ?? 0),
    }));
  if (!cleanCriteria.length)
    throw new Error("No decision criteria were found in the spreadsheet.");
  if (cleanConcepts.length < 2)
    throw new Error("A decision matrix needs at least two design options.");
  return { criteria: cleanCriteria, concepts: cleanConcepts };
}

export function parseDecisionMatrixRows(rows: string[][]) {
  const cleanRows = rows
    .map((row) => row.map(cleanCell))
    .filter((row) => row.some(Boolean));
  if (!cleanRows.length) throw new Error("The decision matrix is empty.");

  const firstTen = cleanRows.slice(0, 10);
  const criteriaHeaderIndex = firstTen.findIndex((row) =>
    ["criterion", "criteria", "variable"].includes(normalized(row[0])),
  );
  if (criteriaHeaderIndex >= 0) {
    const header = cleanRows[criteriaHeaderIndex];
    const following = cleanRows[criteriaHeaderIndex + 1] ?? [];
    const weightColumn = header.findIndex((cell) =>
      ["weight", "importance", "priority"].includes(normalized(cell)),
    );
    const scoreColumns: Array<{ name: string; index: number }> = [];
    for (let index = 1; index < header.length; index += 1) {
      if (index === weightColumn) continue;
      const subheader = normalized(following[index]);
      const isWeightedColumn =
        subheader.includes("weighted") || subheader.includes("total");
      const isScoreColumn =
        !subheader ||
        subheader.includes("score") ||
        subheader.includes("rating") ||
        subheader.includes("value");
      if (!isScoreColumn || isWeightedColumn) continue;
      const name = cleanCell(header[index]);
      if (name) scoreColumns.push({ name, index });
    }
    if (scoreColumns.length >= 2) {
      const criteria: ImportedDecisionCriterion[] = [];
      const concepts = scoreColumns.map((column) => ({
        name: column.name,
        values: [] as number[],
      }));
      for (const row of cleanRows.slice(criteriaHeaderIndex + 1)) {
        const name = cleanCell(row[0]);
        const key = normalized(name);
        if (
          !name ||
          key.includes("score15") ||
          ["total", "weightedscore", "result", "winner", "rank", "recommendation"].includes(
            key,
          )
        )
          continue;
        const values = scoreColumns.map(({ index }) => parseNumber(row[index]));
        if (values.some((value) => value === null)) continue;
        criteria.push({
          name,
          weight: Math.max(
            0,
            weightColumn >= 0 ? parseNumber(row[weightColumn]) ?? 1 : 1,
          ),
          goal: "SCORE",
        });
        values.forEach((value, index) => {
          concepts[index]?.values.push(value ?? 0);
        });
      }
      if (criteria.length) return validateDecisionImport(criteria, concepts);
    }
  }

  const longHeaderIndex = firstTen.findIndex((row) => {
    const headers = row.map(normalized);
    return (
      headers.some((item) =>
        ["concept", "design", "option", "alternative"].includes(item),
      ) &&
      headers.some((item) => ["criterion", "criteria", "variable"].includes(item)) &&
      headers.some((item) => ["score", "value", "rating"].includes(item))
    );
  });

  if (longHeaderIndex >= 0) {
    const headers = cleanRows[longHeaderIndex].map(normalized);
    const column = (aliases: string[]) =>
      headers.findIndex((header) => aliases.includes(header));
    const conceptColumn = column(["concept", "design", "option", "alternative"]);
    const criterionColumn = column(["criterion", "criteria", "variable"]);
    const valueColumn = column(["score", "value", "rating"]);
    const weightColumn = column(["weight", "importance", "priority"]);
    const goalColumn = column(["goal", "direction", "preference", "objective"]);
    const criteria = new Map<string, ImportedDecisionCriterion>();
    const concepts = new Map<string, Map<string, number>>();
    for (const row of cleanRows.slice(longHeaderIndex + 1)) {
      const concept = cleanCell(row[conceptColumn]);
      const criterion = cleanCell(row[criterionColumn]);
      const score = parseNumber(row[valueColumn]);
      if (!concept || !criterion || score === null) continue;
      const key = normalized(criterion);
      if (!criteria.has(key)) {
        criteria.set(key, {
          name: criterion,
          weight: Math.max(0, parseNumber(row[weightColumn]) ?? 1),
          goal: decisionGoal(row[goalColumn]),
        });
      }
      const conceptScores = concepts.get(concept) ?? new Map<string, number>();
      conceptScores.set(key, score);
      concepts.set(concept, conceptScores);
    }
    const criterionRows = [...criteria.entries()];
    return validateDecisionImport(
      criterionRows.map(([, criterion]) => criterion),
      [...concepts.entries()].map(([name, values]) => ({
        name,
        values: criterionRows.map(([key]) => values.get(key) ?? 0),
      })),
    );
  }

  const headerIndex = firstTen.findIndex((row) => {
    const first = normalized(row[0]);
    return (
      ["concept", "design", "option", "alternative", "designoption"].includes(
        first,
      ) && row.slice(1).filter(Boolean).length > 0
    );
  });
  const resolvedHeaderIndex =
    headerIndex >= 0
      ? headerIndex
      : firstTen.findIndex((row) => row.slice(1).filter(Boolean).length >= 2);
  if (resolvedHeaderIndex < 0)
    throw new Error(
      "Use a header row with Design or Concept in the first column.",
    );

  const header = cleanRows[resolvedHeaderIndex];
  const criterionColumns = header
    .map((name, index) => ({ name, index }))
    .filter((item) => item.index > 0 && item.name);
  let weights = criterionColumns.map(() => 1);
  let goals: ImportedDecisionCriterion["goal"][] = criterionColumns.map(
    () => "SCORE",
  );
  const concepts: ImportedDecisionConcept[] = [];
  for (const row of cleanRows.slice(resolvedHeaderIndex + 1)) {
    const label = cleanCell(row[0]);
    const key = normalized(label);
    if (!label) continue;
    if (["weight", "weights", "importance", "priority"].includes(key)) {
      weights = criterionColumns.map(
        ({ index }, criterionIndex) =>
          Math.max(0, parseNumber(row[index]) ?? weights[criterionIndex] ?? 1),
      );
      continue;
    }
    if (["goal", "direction", "preference", "objective"].includes(key)) {
      goals = criterionColumns.map(({ index }) => decisionGoal(row[index]));
      continue;
    }
    if (
      ["total", "weightedscore", "result", "winner", "rank", "recommendation"].includes(
        key,
      )
    )
      continue;
    const values = criterionColumns.map(
      ({ index }) => parseNumber(row[index]) ?? 0,
    );
    if (values.some((value) => Number.isFinite(value))) {
      concepts.push({ name: label, values });
    }
  }
  return validateDecisionImport(
    criterionColumns.map((item, index) => ({
      name: item.name,
      weight: weights[index] ?? 1,
      goal: goals[index] ?? "SCORE",
    })),
    concepts,
  );
}

const financeAliases = {
  description: [
    "description",
    "item",
    "itemname",
    "name",
    "transaction",
    "expense",
    "material",
    "part",
  ],
  amount: [
    "amount",
    "total",
    "totalcost",
    "extendedcost",
    "expenseamount",
    "incomeamount",
    "linetotal",
  ],
  unitCost: ["unitcost", "unitprice", "price", "costeach", "each"],
  quantity: ["quantity", "qty", "count", "units"],
  kind: ["kind", "type", "recordtype", "transactiontype"],
  category: ["category", "budgetcategory", "account", "department"],
  vendor: ["vendor", "supplier", "source", "payee", "company"],
  status: ["status", "paymentstatus", "state"],
  date: ["date", "occurredat", "transactiondate", "purchasedate", "paiddate"],
  notes: ["notes", "memo", "details", "comment"],
} as const;

function headerMap(row: string[]) {
  const headers = row.map(normalized);
  return Object.fromEntries(
    Object.entries(financeAliases).map(([field, aliases]) => [
      field,
      headers.findIndex((header) => (aliases as readonly string[]).includes(header)),
    ]),
  ) as Record<keyof typeof financeAliases, number>;
}

function normalizeKind(
  value: string,
  fallback: ImportedFinanceRow["kind"],
): ImportedFinanceRow["kind"] {
  const key = normalized(value);
  if (key.includes("income") || key.includes("revenue") || key.includes("funding"))
    return "INCOME";
  if (key.includes("bom") || key.includes("part") || key.includes("material"))
    return "BOM_ITEM";
  if (key.includes("budget") || key.includes("planned"))
    return "BUDGET_ITEM";
  if (key.includes("expense") || key.includes("purchase") || key.includes("cost"))
    return "EXPENSE";
  return fallback;
}

function normalizeStatus(
  value: string,
  fallback: ImportedFinanceRow["status"],
): ImportedFinanceRow["status"] {
  const key = normalized(value).toUpperCase();
  const match = financeEntryStatuses.find(
    (status) => normalized(status).toUpperCase() === key,
  );
  return match ?? fallback;
}

export function parseFinanceSheets(
  sheets: TabularSheet[],
  defaults: {
    kind: ImportedFinanceRow["kind"];
    status: ImportedFinanceRow["status"];
  },
) {
  const imported: ImportedFinanceRow[] = [];
  let skipped = 0;
  for (const sheet of sheets) {
    const cleanRows = sheet.rows
      .map((row) => row.map(cleanCell))
      .filter((row) => row.some(Boolean));
    const headerIndex = cleanRows.slice(0, 15).findIndex((row) => {
      const mapping = headerMap(row);
      return (
        mapping.description >= 0 &&
        (mapping.amount >= 0 ||
          mapping.unitCost >= 0 ||
          mapping.quantity >= 0 ||
          mapping.kind >= 0)
      );
    });
    if (headerIndex < 0) continue;
    const mapping = headerMap(cleanRows[headerIndex]);
    for (const row of cleanRows.slice(headerIndex + 1)) {
      if (imported.length >= 500) break;
      const read = (field: keyof typeof financeAliases) =>
        mapping[field] >= 0 ? cleanCell(row[mapping[field]]) : "";
      const description = read("description");
      if (!description) {
        skipped += 1;
        continue;
      }
      const quantity = Math.max(
        1,
        Math.min(9_999, Math.round(parseNumber(read("quantity")) ?? 1)),
      );
      const parsedAmount = parseNumber(read("amount"));
      const parsedUnitCost = parseNumber(read("unitCost"));
      const kind = normalizeKind(read("kind"), defaults.kind);
      const amount = Math.abs(
        parsedAmount ?? (parsedUnitCost ?? 0) * quantity,
      );
      const unitCost = Math.abs(
        parsedUnitCost ?? (quantity ? amount / quantity : amount),
      );
      imported.push({
        kind,
        category:
          read("category").slice(0, 120) ||
          (kind === "INCOME" ? "Other income" : "Other expense"),
        description: description.slice(0, 500),
        vendor: read("vendor").slice(0, 300),
        quantity,
        unitCost,
        amount,
        status: normalizeStatus(read("status"), defaults.status),
        occurredAt: read("date"),
        notes: [read("notes"), `Imported from ${sheet.name}.`]
          .filter(Boolean)
          .join(" ")
          .slice(0, 5_000),
      });
    }
  }
  if (!imported.length)
    throw new Error(
      "No finance rows were found. Include Item or Description plus Amount, Unit Cost, Quantity, or Type columns.",
    );
  return { rows: imported, skipped };
}
