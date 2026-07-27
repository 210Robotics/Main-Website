import type { AssistantCommand } from "@/lib/assistant-commands";
import {
  parseDecisionMatrixRows,
  type ImportedDecisionConcept,
  type ImportedDecisionCriterion,
} from "@/lib/spreadsheet-import";

export type ExtractedDecisionMatrix = {
  title: string;
  criteria: ImportedDecisionCriterion[];
  concepts: ImportedDecisionConcept[];
  recommendation: string;
};

export function extractBudgetPlanHint(instructions?: string) {
  const value = instructions?.trim();
  if (!value) return undefined;
  const patterns = [
    /\b(?:budget|finance)\s+plan\s*(?:named|called|:|=)\s*["']?([^"',.;\n]{2,100})/i,
    /\b(?:into|to|under|for)\s+(?:the\s+)?["']?([^"',.;\n]{2,100}?)["']?\s+(?:budget|finance)(?:\s+plan)?\b/i,
    /\b(?:budget|finance)\s+plan\s+["']?([^"',.;\n]{2,100})/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern)?.[1]?.trim();
    if (match) return match.replace(/\s+/g, " ");
  }
  return undefined;
}

function csvRow(line: string) {
  const delimiter = line.includes("\t") && !line.includes(",") ? "\t" : ",";
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function header(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function money(value: string | undefined) {
  if (!value?.trim()) return null;
  const negative = /^\s*\(.*\)\s*$/.test(value);
  const parsed = Number(value.replace(/[$,%()\s]/g, "").replaceAll(",", ""));
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function integer(value: string | undefined, fallback = 1) {
  const parsed = Number(value?.replace(/[^\d.-]/g, ""));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function matchingIndex(headers: string[], names: string[]) {
  return headers.findIndex((candidate) => names.includes(candidate));
}

function decodeHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function htmlTableRows(value: string) {
  return [...value.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(
    (tableMatch) =>
      [...tableMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(
        (rowMatch) => {
          const row: string[] = [];
          for (const cellMatch of rowMatch[1].matchAll(
            /<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi,
          )) {
            const colspan = Math.max(
              1,
              Math.min(
                50,
                Number(cellMatch[1].match(/\bcolspan=["']?(\d+)/i)?.[1]) || 1,
              ),
            );
            const cell = decodeHtml(cellMatch[2]);
            for (let index = 0; index < colspan; index += 1) row.push(cell);
          }
          return row;
        },
      ),
  );
}

function delimitedTables(value: string) {
  return value
    .split(/\n(?====\s*SHEET:)|\n{3,}/i)
    .map((section) =>
      section
        .split(/\r?\n/)
        .filter((line) => line.trim() && !/^===\s*SHEET:/i.test(line))
        .map(csvRow),
    )
    .filter(
      (rows) =>
        rows.length >= 3 &&
        rows.some((row) => row.filter((cell) => cell.trim()).length >= 3),
    );
}

function decisionTitle(sourceText: string, filename: string) {
  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return (
    lines.find(
      (line) =>
        /decision\s+matrix/i.test(line) &&
        !/^decision\s+matrix$/i.test(line),
    ) ||
    lines.find((line) => /decision\s+matrix/i.test(line)) ||
    filename.replace(/\.(docx|pdf|xlsx|csv|tsv)$/i, "").replace(/[-_]+/g, " ")
  ).slice(0, 180);
}

function decisionRecommendation(sourceText: string) {
  const labels: Array<[string, string]> = [
    ["Primary (?:lift )?concept selected", "Primary concept selected"],
    ["Selected (?:design|concept|option)", "Selected concept"],
    ["Runner-up / backup concept", "Runner-up / backup concept"],
    ["Key concerns? raised", "Key concerns raised"],
    ["Recommendation", "Recommendation"],
  ];
  return labels
    .flatMap(([pattern, label]) => {
      const match = sourceText.match(
        new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?${pattern}\\s*:\\s*([^\\n]+)`, "i"),
      );
      return match?.[1]?.trim() ? [`${label}: ${match[1].trim()}`] : [];
    })
    .join("\n")
    .slice(0, 4000);
}

function normalizedTableRows(rows: string[][]) {
  return rows.map((row) => row.map(header));
}

function hasStructuralDecisionCues(rows: string[][]) {
  const normalizedRows = normalizedTableRows(rows);
  const headerRows = normalizedRows.slice(0, 3);
  const headerText = headerRows.flat().join(" ");
  const firstColumn = normalizedRows.map((row) => row[0] || "");
  const longForm =
    /\b(?:concept|design|option|alternative)\b/.test(headerText) &&
    /\bcriteri(?:on|a)\b/.test(headerText) &&
    /\b(?:score|rating|weight)\b/.test(headerText);
  const criteriaFirst =
    headerRows.some((row) => /\bcriteri(?:on|a)\b/.test(row[0] || "")) &&
    /\bweight\b/.test(headerText) &&
    /\b(?:score|weighted|rating)\b/.test(headerText) &&
    headerRows.some((row) => row.filter(Boolean).length >= 4);
  const alternativesFirst =
    headerRows.some((row) =>
      /^(?:concept|design|option|alternative)$/.test(row[0] || ""),
    ) &&
    firstColumn.some((value) => /^(?:weight|weights|goal|direction)$/.test(value)) &&
    headerRows.some((row) => row.filter(Boolean).length >= 3);
  return longForm || criteriaFirst || alternativesFirst;
}

export function documentRouteSignals(input: {
  sourceText: string;
  contentHtml?: string;
  filename: string;
  instructions?: string;
}) {
  const combined = [
    input.filename,
    input.instructions || "",
    input.sourceText.slice(0, 80_000),
  ].join("\n");
  const tables = [
    ...htmlTableRows(input.contentHtml || ""),
    ...delimitedTables(input.sourceText),
  ];
  const decision =
    /\b(?:decision\s+matrix|concept\s+comparison|concept\s+selection|design\s+matrix|weighted\s+scor(?:e|ing)|trade[- ]?study|criteria\s+matrix)\b/i.test(
      combined,
    ) || tables.some(hasStructuralDecisionCues);
  const finance =
    /\b(?:budget|finance|financial|expense|income|revenue|unit\s+cost|unit\s+price|line\s+total|invoice|pricing|priced\s+materials?)\b/i.test(
      combined,
    ) ||
    tables.some((rows) => {
      const headerText = normalizedTableRows(rows).slice(0, 3).flat().join(" ");
      return (
        /\b(?:item|description|transaction|material|part)\b/.test(headerText) &&
        /\b(?:amount|total|unit cost|unit price|expense|income|vendor|supplier)\b/.test(
          headerText,
        )
      );
    });
  const task =
    /\b(?:action\s+items?|to[- ]?do|assigned\s+to|owner|deadline|due\s+(?:date|by|on)|needs?\s+to|follow[- ]?up|must\s+(?:complete|finish|update|create|review))\b/i.test(
      combined,
    );
  return { decision, finance, task };
}

/**
 * Finds decision matrices before the AI planner runs. This preserves DOCX
 * tables (including merged concept headers) and makes conventional spreadsheet
 * matrices reliable even when Gemini is unavailable or the document contains
 * substantial narrative around the table.
 */
export function extractDecisionMatrices(input: {
  sourceText: string;
  contentHtml?: string;
  filename: string;
}) {
  if (!documentRouteSignals(input).decision) return [];
  const tables = [
    ...htmlTableRows(input.contentHtml || ""),
    ...delimitedTables(input.sourceText),
  ];
  const title = decisionTitle(input.sourceText, input.filename);
  const recommendation = decisionRecommendation(input.sourceText);
  const matrices: ExtractedDecisionMatrix[] = [];
  const seen = new Set<string>();
  for (const rows of tables) {
    try {
      const parsed = parseDecisionMatrixRows(rows);
      const signature = JSON.stringify(parsed);
      if (seen.has(signature)) continue;
      seen.add(signature);
      matrices.push({ title, ...parsed, recommendation });
    } catch {
      // Other document tables are expected and continue through AI routing.
    }
  }
  return matrices.slice(0, 10);
}

/**
 * Deterministically extracts an itemized priced-material table. Gemini still
 * handles narrative and unusual layouts, while this path makes conventional
 * Excel/CSV price sheets reliable even when the user's prompt is minimal.
 */
export function extractPricedMaterialCommands(input: {
  sourceText: string;
  filename: string;
  instructions?: string;
  maximum?: number;
}): AssistantCommand[] {
  const request = `${input.filename} ${input.instructions || ""}`.toLowerCase();
  if (
    /\b(?:only|just)\b[\s\S]{0,30}\bbom\b/.test(request) ||
    /\bdo not\b[\s\S]{0,30}\b(?:finance|expense|budget)\b/.test(request)
  ) {
    return [];
  }

  const commands: AssistantCommand[] = [];
  let columns: {
    description: number;
    partNumber: number;
    quantity: number;
    unitCost: number;
    total: number;
    category: number;
    vendor: number;
  } | null = null;

  for (const rawLine of input.sourceText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^===\s*SHEET:/i.test(line)) {
      columns = null;
      continue;
    }
    const cells = csvRow(line);
    const normalized = cells.map(header);
    if (!columns) {
      const description = matchingIndex(normalized, [
        "description",
        "item",
        "item name",
        "name",
        "material",
        "material description",
        "part name",
      ]);
      const partNumber = matchingIndex(normalized, [
        "part",
        "part number",
        "part no",
        "part no ",
        "sku",
        "item number",
      ]);
      const unitCost = matchingIndex(normalized, [
        "unit cost",
        "unit price",
        "price",
        "cost",
        "price each",
        "cost each",
      ]);
      const total = matchingIndex(normalized, [
        "total",
        "amount",
        "line total",
        "extended cost",
        "extended price",
      ]);
      if ((description >= 0 || partNumber >= 0) && (unitCost >= 0 || total >= 0)) {
        columns = {
          description,
          partNumber,
          quantity: matchingIndex(normalized, ["quantity", "qty", "count"]),
          unitCost,
          total,
          category: matchingIndex(normalized, [
            "category",
            "type",
            "expense category",
          ]),
          vendor: matchingIndex(normalized, [
            "vendor",
            "supplier",
            "manufacturer",
            "source",
          ]),
        };
      }
      continue;
    }

    const partNumber =
      columns.partNumber >= 0 ? cells[columns.partNumber]?.trim() : "";
    const itemName =
      columns.description >= 0 ? cells[columns.description]?.trim() : "";
    const description = [partNumber, itemName].filter(Boolean).join(" — ");
    const quantity =
      columns.quantity >= 0 ? integer(cells[columns.quantity]) : 1;
    const lineTotal =
      columns.total >= 0 ? money(cells[columns.total]) : null;
    const unitCost =
      columns.unitCost >= 0 ? money(cells[columns.unitCost]) : null;
    const amount = lineTotal ?? (unitCost === null ? null : unitCost * quantity);
    if (!description || amount === null || amount < 0) continue;
    commands.push({
      kind: "BUDGET_ADD",
      entryKind: "EXPENSE",
      description,
      category:
        (columns.category >= 0 && cells[columns.category]?.trim()) ||
        "Materials & Parts",
      amount: Math.round(amount * 100) / 100,
      quantity,
      vendor:
        (columns.vendor >= 0 && cells[columns.vendor]?.trim()) || "",
    });
    if (commands.length >= (input.maximum ?? 150)) break;
  }
  return commands;
}
