"use client";

import { useState } from "react";
import { Plus, Trash2, Trophy } from "lucide-react";
import { saveHubRecord } from "@/app/admin/control-center/actions";
import { ActionForm } from "@/components/action-form";
import {
  parseDecisionMatrixDefinition,
  scoreDecisionMatrix,
  type DecisionMatrixConcept,
  type DecisionMatrixCriterion,
  type DecisionMatrixGoal,
} from "@/lib/control-center";

type Choice = { id: string; label: string };

export type DecisionMatrixInitial = {
  id?: string;
  title?: string;
  criteria?: string;
  options?: string;
  recommendation?: string;
  seasonId?: string | null;
  projectId?: string | null;
  subsystemId?: string | null;
};

const defaultCriteria: DecisionMatrixCriterion[] = [
  { name: "Requirement fit", weight: 30, goal: "SCORE" },
  { name: "Risk", weight: 20, goal: "LOWER" },
  { name: "Cost", weight: 20, goal: "LOWER" },
  { name: "Weight", weight: 15, goal: "LOWER" },
  { name: "Complexity", weight: 15, goal: "LOWER" },
];

const defaultConcepts: DecisionMatrixConcept[] = [
  { name: "Concept A", values: [8, 5, 5, 5, 5] },
  { name: "Concept B", values: [7, 5, 5, 5, 5] },
];

function initialMatrix(initial?: DecisionMatrixInitial) {
  if (!initial?.criteria || !initial.options)
    return { criteria: defaultCriteria, concepts: defaultConcepts };
  const parsed = parseDecisionMatrixDefinition(initial.criteria, initial.options);
  return {
    criteria: parsed.criteria.length ? parsed.criteria : defaultCriteria,
    concepts: parsed.concepts.length ? parsed.concepts : defaultConcepts,
  };
}

export function DecisionMatrixEditor({
  initial,
  seasons,
  projects,
  subsystems,
}: {
  initial?: DecisionMatrixInitial;
  seasons: Choice[];
  projects: Choice[];
  subsystems: Choice[];
}) {
  const [criteria, setCriteria] = useState(
    () => initialMatrix(initial).criteria,
  );
  const [concepts, setConcepts] = useState(
    () => initialMatrix(initial).concepts,
  );

  const criteriaText = criteria
    .map(
      (criterion) =>
        `${criterion.name.trim()} | ${criterion.weight} | ${criterion.goal}`,
    )
    .join("\n");
  const optionsText = concepts
    .map(
      (concept) =>
        `${concept.name.trim()} | ${criteria
          .map((_, index) => concept.values[index] ?? 0)
          .join(",")}`,
    )
    .join("\n");
  const results = scoreDecisionMatrix(criteriaText, optionsText);
  const winner = results[0];

  function updateCriterion(
    index: number,
    patch: Partial<DecisionMatrixCriterion>,
  ) {
    setCriteria((current) =>
      current.map((criterion, position) =>
        position === index ? { ...criterion, ...patch } : criterion,
      ),
    );
  }

  function addCriterion() {
    setCriteria((current) => [
      ...current,
      { name: `Criterion ${current.length + 1}`, weight: 10, goal: "SCORE" },
    ]);
    setConcepts((current) =>
      current.map((concept) => ({
        ...concept,
        values: [...concept.values, 0],
      })),
    );
  }

  function removeCriterion(index: number) {
    if (criteria.length <= 1) return;
    setCriteria((current) =>
      current.filter((_, position) => position !== index),
    );
    setConcepts((current) =>
      current.map((concept) => ({
        ...concept,
        values: concept.values.filter((_, position) => position !== index),
      })),
    );
  }

  function updateConceptName(index: number, name: string) {
    setConcepts((current) =>
      current.map((concept, position) =>
        position === index ? { ...concept, name } : concept,
      ),
    );
  }

  function updateConceptValue(
    conceptIndex: number,
    criterionIndex: number,
    value: string,
  ) {
    const parsed = Number(value);
    setConcepts((current) =>
      current.map((concept, position) => {
        if (position !== conceptIndex) return concept;
        const values = [...concept.values];
        values[criterionIndex] = Number.isFinite(parsed) ? parsed : 0;
        return { ...concept, values };
      }),
    );
  }

  function addConcept() {
    setConcepts((current) => [
      ...current,
      {
        name: `Concept ${String.fromCharCode(65 + current.length)}`,
        values: criteria.map(() => 0),
      },
    ]);
  }

  function removeConcept(index: number) {
    if (concepts.length <= 2) return;
    setConcepts((current) =>
      current.filter((_, position) => position !== index),
    );
  }

  return (
    <ActionForm
      action={saveHubRecord}
      successMessage={initial?.id ? "Decision matrix updated." : "Decision matrix created."}
      className="grid gap-5"
    >
      <input type="hidden" name="kind" value="DECISION_MATRIX" />
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="criteria" value={criteriaText} />
      <input type="hidden" name="options" value={optionsText} />

      <label className="field">
        <span>Decision or design question</span>
        <input
          className="input"
          name="title"
          defaultValue={initial?.title}
          placeholder="Which drivetrain concept should we build?"
          required
        />
      </label>

      <div className="grid gap-4 border border-[#343434] bg-[#0c0c0c] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Live weighted result</p>
            <div className="mt-2 flex items-center gap-3">
              <Trophy className="h-5 w-5 text-[#fd7803]" />
              <strong className="text-xl">
                {winner?.name || "Add scores to choose a design"}
              </strong>
            </div>
          </div>
          {winner && (
            <div className="text-right">
              <strong className="font-mono text-3xl text-[#fd7803]">
                {winner.score.toFixed(2)}
              </strong>
              <p className="text-xs text-[#777]">weighted score / 10</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {results.map((result, index) => (
            <span
              className={
                index === 0
                  ? "border border-[#fd7803] bg-[#24160b] px-3 py-2 text-xs text-white"
                  : "border border-[#333] px-3 py-2 text-xs text-[#aaa]"
              }
              key={`${result.name}-${index}`}
            >
              #{index + 1} {result.name}: {result.score.toFixed(2)}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border border-[#333]">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="bg-[#151515]">
            <tr>
              <th className="w-52 border-r border-[#333] p-3 align-top">
                <span className="font-mono text-[.65rem] uppercase tracking-wider text-[#888]">
                  Design option
                </span>
              </th>
              {criteria.map((criterion, index) => (
                <th
                  className="min-w-48 border-r border-[#333] p-3 align-top last:border-r-0"
                  key={`criterion-${index}`}
                >
                  <div className="grid gap-2">
                    <input
                      aria-label={`Criterion ${index + 1} name`}
                      className="input py-2 font-semibold"
                      value={criterion.name}
                      onChange={(event) =>
                        updateCriterion(index, { name: event.target.value })
                      }
                      required
                    />
                    <div className="grid grid-cols-[74px_1fr_34px] gap-2">
                      <input
                        aria-label={`Weight for ${criterion.name}`}
                        className="input py-2"
                        type="number"
                        min="0"
                        max="10000"
                        step="0.1"
                        value={criterion.weight}
                        onChange={(event) =>
                          updateCriterion(index, {
                            weight: Number(event.target.value) || 0,
                          })
                        }
                      />
                      <select
                        aria-label={`Scoring direction for ${criterion.name}`}
                        className="input py-2 text-xs"
                        value={criterion.goal}
                        onChange={(event) =>
                          updateCriterion(index, {
                            goal: event.target.value as DecisionMatrixGoal,
                          })
                        }
                      >
                        <option value="SCORE">Score: 10 best</option>
                        <option value="LOWER">Lower is better</option>
                        <option value="HIGHER">Higher is better</option>
                      </select>
                      <button
                        aria-label={`Remove ${criterion.name}`}
                        className="grid place-items-center border border-[#3a3a3a] text-red-300 disabled:opacity-30"
                        disabled={criteria.length <= 1}
                        onClick={() => removeCriterion(index)}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="text-[.65rem] font-normal text-[#777]">
                      Weight · scoring direction
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {concepts.map((concept, conceptIndex) => (
              <tr className="border-t border-[#333]" key={`concept-${conceptIndex}`}>
                <th className="border-r border-[#333] p-3">
                  <div className="flex gap-2">
                    <input
                      aria-label={`Design option ${conceptIndex + 1}`}
                      className="input py-3 font-semibold"
                      value={concept.name}
                      onChange={(event) =>
                        updateConceptName(conceptIndex, event.target.value)
                      }
                      required
                    />
                    <button
                      aria-label={`Remove ${concept.name}`}
                      className="grid w-10 shrink-0 place-items-center border border-[#3a3a3a] text-red-300 disabled:opacity-30"
                      disabled={concepts.length <= 2}
                      onClick={() => removeConcept(conceptIndex)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                {criteria.map((criterion, criterionIndex) => (
                  <td
                    className="border-r border-[#333] p-3 last:border-r-0"
                    key={`score-${conceptIndex}-${criterionIndex}`}
                  >
                    <input
                      aria-label={`${criterion.name} value for ${concept.name}`}
                      className="input py-3 font-mono"
                      type="number"
                      step="0.01"
                      min={criterion.goal === "SCORE" ? 0 : undefined}
                      max={criterion.goal === "SCORE" ? 10 : undefined}
                      value={concept.values[criterionIndex] ?? 0}
                      onChange={(event) =>
                        updateConceptValue(
                          conceptIndex,
                          criterionIndex,
                          event.target.value,
                        )
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <button className="button secondary" onClick={addConcept} type="button">
          <Plus className="h-4 w-4" /> Add design row
        </button>
        <button className="button secondary" onClick={addCriterion} type="button">
          <Plus className="h-4 w-4" /> Add criterion
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="field">
          <span>Season</span>
          <select
            className="input"
            name="seasonId"
            defaultValue={initial?.seasonId ?? ""}
          >
            <option value="">Organization-wide</option>
            {seasons.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Project</span>
          <select
            className="input"
            name="projectId"
            defaultValue={initial?.projectId ?? ""}
          >
            <option value="">All projects</option>
            {projects.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Subsystem</span>
          <select
            className="input"
            name="subsystemId"
            defaultValue={initial?.subsystemId ?? ""}
          >
            <option value="">All subsystems</option>
            {subsystems.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span>Recommendation and rationale</span>
        <textarea
          className="input min-h-24"
          name="recommendation"
          defaultValue={initial?.recommendation}
          placeholder="Explain why the winning design should move forward and record any caveats."
        />
      </label>
      <button className="button w-fit">
        {initial?.id ? "Save matrix changes" : "Create decision matrix"}
      </button>
    </ActionForm>
  );
}
