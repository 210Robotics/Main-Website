export type DecisionMatrixGoal = "SCORE" | "HIGHER" | "LOWER";

export type DecisionMatrixCriterion = {
  name: string;
  weight: number;
  goal: DecisionMatrixGoal;
};

export type DecisionMatrixConcept = {
  name: string;
  values: number[];
};

function matrixGoal(value: string): DecisionMatrixGoal {
  const normalized = value.trim().toUpperCase();
  if (normalized === "HIGHER" || normalized === "LOWER") return normalized;
  return "SCORE";
}

export function parseDecisionMatrixDefinition(
  criteria: string,
  options: string,
) {
  const parsedCriteria = criteria
    .split(/\r?\n/)
    .map((line) => {
      const [name = "", rawWeight = "", rawGoal = "SCORE"] = line.split("|");
      const weight = Number(rawWeight.trim());
      return {
        name: name.trim(),
        weight: Number.isFinite(weight) ? Math.max(0, weight) : 0,
        goal: matrixGoal(rawGoal),
      } satisfies DecisionMatrixCriterion;
    })
    .filter((criterion) => criterion.name);
  const concepts = options
    .split(/\r?\n/)
    .map((line) => {
      const [name, rawScores = ""] = line.split("|");
      const values = rawScores
        .split(",")
        .map((item) => Number(item.trim()))
        .map((value) => (Number.isFinite(value) ? value : 0));
      return {
        name: name.trim(),
        values: parsedCriteria.map((_, index) => values[index] ?? 0),
      } satisfies DecisionMatrixConcept;
    })
    .filter((item) => item.name);
  return { criteria: parsedCriteria, concepts };
}

export function scoreDecisionMatrix(criteria: string, options: string) {
  const matrix = parseDecisionMatrixDefinition(criteria, options);
  const totalWeight =
    matrix.criteria.reduce((sum, criterion) => sum + criterion.weight, 0) || 1;
  const normalizedColumns = matrix.criteria.map((criterion, index) => {
    const values = matrix.concepts.map((concept) => concept.values[index] ?? 0);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    return values.map((value) => {
      if (criterion.goal === "SCORE")
        return Math.max(0, Math.min(10, value));
      if (maximum === minimum) return 10;
      const ratio =
        criterion.goal === "LOWER"
          ? (maximum - value) / (maximum - minimum)
          : (value - minimum) / (maximum - minimum);
      return Math.max(0, Math.min(10, ratio * 10));
    });
  });
  return matrix.concepts
    .map((concept, conceptIndex) => {
      const weighted =
        matrix.criteria.reduce(
          (sum, criterion, criterionIndex) =>
            sum +
            criterion.weight *
              (normalizedColumns[criterionIndex]?.[conceptIndex] ?? 0),
          0,
        ) / totalWeight;
      return {
        name: concept.name,
        score: Math.round(weighted * 100) / 100,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function findDuplicateGroups(
  items: { type: string; id: string; label: string }[],
) {
  const groups = new Map<string, { type: string; label: string; count: number }>();
  for (const item of items) {
    const normalized = item.label
      .toLowerCase()
      .replace(/\b(revision|rev)\s*[a-z0-9]+\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const key = `${item.type}:${normalized}`;
    const existing = groups.get(key);
    groups.set(
      key,
      existing
        ? { ...existing, count: existing.count + 1 }
        : { type: item.type, label: item.label, count: 1 },
    );
  }
  return [...groups.values()].filter((item) => item.count > 1);
}
