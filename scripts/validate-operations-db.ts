import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
const sql = neon(databaseUrl);
const marker = `operations-qa-${Date.now()}`;
const ids = {
  plan: randomUUID(),
  entry: randomUUID(),
  sponsor: randomUUID(),
  meeting: randomUUID(),
  decision: randomUUID(),
  task: randomUUID(),
  comment: randomUUID(),
  glossary: randomUUID(),
  part: randomUUID(),
  step: randomUUID(),
  season: randomUUID(),
  engineeringProject: randomUUID(),
  subsystem: randomUUID(),
  notebookEntry: randomUUID(),
  notebookVersion: randomUUID(),
  notebookComment: randomUUID(),
  notebookCompilation: randomUUID(),
  inventory: randomUUID(),
  purchase: randomUUID(),
  designChange: randomUUID(),
  scouting: randomUUID(),
};

async function cleanup() {
  await sql`delete from engineering_notebook_compilations where id = ${ids.notebookCompilation}`;
  await sql`delete from engineering_notebook_comments where id = ${ids.notebookComment}`;
  await sql`delete from engineering_notebook_versions where id = ${ids.notebookVersion}`;
  await sql`delete from engineering_notebook_entries where id = ${ids.notebookEntry}`;
  await sql`delete from scouting_matches where id = ${ids.scouting}`;
  await sql`delete from purchase_requests where id = ${ids.purchase}`;
  await sql`delete from design_changes where id = ${ids.designChange}`;
  await sql`delete from inventory_items where id = ${ids.inventory}`;
  await sql`delete from task_comments where id = ${ids.comment}`;
  await sql`delete from member_tasks where id = ${ids.task}`;
  await sql`delete from meeting_notes where id = ${ids.meeting}`;
  await sql`delete from manufacturing_steps where id = ${ids.step}`;
  await sql`delete from engineering_parts where id = ${ids.part}`;
  await sql`delete from finance_entries where id = ${ids.entry}`;
  await sql`delete from finance_plans where id = ${ids.plan}`;
  await sql`delete from glossary_terms where id = ${ids.glossary}`;
  await sql`delete from engineering_subsystems where id = ${ids.subsystem}`;
  await sql`delete from engineering_projects where id = ${ids.engineeringProject}`;
  await sql`delete from engineering_seasons where id = ${ids.season}`;
}

async function main() {
  try {
    const [member] = await sql`
    select id from members where status = 'ACTIVE' order by created_at limit 1
  `;
    if (!member?.id)
      throw new Error("No active member is available for relational QA.");
    const memberId = String(member.id);

    await sql`
    insert into engineering_seasons (id, name, competition, game_name, game_manual_version, status, starts_at, ends_at, is_default, created_by_member_id)
    values (${ids.season}, ${marker}, 'VEX U', 'Override', '1.0', 'ACTIVE', now(), now() + interval '10 months', false, ${memberId})
  `;
    await sql`
    insert into engineering_projects (id, season_id, code, name, description, status, created_by_member_id)
    values (${ids.engineeringProject}, ${ids.season}, 'QA', ${marker}, 'Temporary shared engineering project', 'ACTIVE', ${memberId})
  `;
    await sql`
    insert into engineering_subsystems (id, project_id, code, name, description, status, created_by_member_id)
    values (${ids.subsystem}, ${ids.engineeringProject}, 'QA', 'QA subsystem', 'Temporary shared subsystem', 'ACTIVE', ${memberId})
  `;

    await sql`
    insert into finance_plans (id, season_id, engineering_project_id, name, fiscal_year, project, status, minimum_budget_cents, maximum_budget_cents, notes, created_by_member_id)
    values (${ids.plan}, ${ids.season}, ${ids.engineeringProject}, ${marker}, 2026, 'QA', 'DRAFT', 10000, 50000, 'Temporary release verification', ${memberId})
  `;
    await sql`
    insert into finance_entries (id, plan_id, kind, category, description, vendor, quantity, unit_cost_cents, amount_cents, status, occurred_at, notes, created_by_member_id)
    values (${ids.entry}, ${ids.plan}, 'EXPENSE', 'QA', ${marker}, 'QA vendor', 2, 1250, 2500, 'PLANNED', now(), 'Temporary release verification', ${memberId})
  `;
    await sql`
    insert into finance_sponsor_commitments (id, plan_id, sponsor_name, tier, amount_cents, status, created_by_member_id)
    values (${ids.sponsor}, ${ids.plan}, ${marker}, 'QA', 10000, 'PLEDGED', ${memberId})
  `;
    await sql`update finance_entries set status = 'PAID', updated_at = now() where id = ${ids.entry}`;

    await sql`
    insert into meeting_notes (id, title, held_at, location, facilitator, agenda, discussion, summary, next_meeting, status, created_by_member_id)
    values (${ids.meeting}, ${marker}, now(), 'QA', 'QA', 'QA agenda', 'QA discussion', 'QA summary', 'QA follow-up', 'DRAFT', ${memberId})
  `;
    await sql`
    insert into meeting_decisions (id, meeting_id, decision, rationale, impact, created_by_member_id)
    values (${ids.decision}, ${ids.meeting}, 'QA decision', 'QA rationale', 'QA impact', ${memberId})
  `;
    await sql`
    insert into member_tasks (id, meeting_id, assigned_to_member_id, created_by_member_id, title, description, project, priority, status, due_at)
    values (${ids.task}, ${ids.meeting}, ${memberId}, ${memberId}, ${marker}, 'QA acceptance criteria', 'QA', 'HIGH', 'TODO', now() + interval '1 day')
  `;
    await sql`
    insert into task_comments (id, task_id, member_id, body, is_deliverable)
    values (${ids.comment}, ${ids.task}, ${memberId}, 'QA progress update', true)
  `;
    await sql`
    update member_tasks
    set status = 'IN_REVIEW', completion_requested_at = now(), completion_requested_by_member_id = ${memberId}, updated_at = now()
    where id = ${ids.task}
  `;
    await sql`
    update member_tasks
    set status = 'IN_PROGRESS', completion_requested_at = null, completion_requested_by_member_id = null, approval_note = 'Add final verification evidence', updated_at = now()
    where id = ${ids.task} and status = 'IN_REVIEW'
  `;
    await sql`
    update member_tasks
    set status = 'DONE', completion_requested_at = now(), completion_requested_by_member_id = ${memberId}, approved_at = now(), approved_by_member_id = ${memberId}, completed_at = now(), approval_note = 'Approved after evidence review', updated_at = now()
    where id = ${ids.task} and status = 'IN_PROGRESS'
  `;

    await sql`
    insert into glossary_terms (id, term, acronym, category, definition, usage, owner_role, related_terms, published, created_by_member_id)
    values (${ids.glossary}, ${marker}, 'QA', 'Verification', 'Temporary release verification term', 'QA only', 'Admin', '["Operations"]'::jsonb, false, ${memberId})
  `;
    await sql`update glossary_terms set published = true, updated_at = now() where id = ${ids.glossary}`;

    await sql`
    insert into engineering_parts (id, season_id, engineering_project_id, subsystem_id, project, part_number, name, subsystem, revision, quantity, make_buy, material, manufacturing_method, unit_cost_cents, cad_status, cam_status, cae_status, drawing_status, verification_status, lifecycle_status, assigned_to_member_id, notes, created_by_member_id)
    values (${ids.part}, ${ids.season}, ${ids.engineeringProject}, ${ids.subsystem}, ${marker}, ${marker}, 'QA part', 'QA', 'A', 2, 'MAKE', '6061-T6', 'CNC mill', 2500, 'APPROVED', 'READY_FOR_REVIEW', 'NOT_REQUIRED', 'APPROVED', 'IN_REVIEW', 'IN_MANUFACTURING', ${memberId}, 'Temporary release verification', ${memberId})
  `;
    await sql`
    insert into manufacturing_steps (id, part_id, sequence, process, machine, setup, instructions, inspection_criteria, status, assigned_to_member_id)
    values (${ids.step}, ${ids.part}, 10, 'QA operation', 'QA machine', 'QA setup', 'QA instructions', 'QA inspection', 'IN_PROGRESS', ${memberId})
  `;
    await sql`update manufacturing_steps set status = 'COMPLETE', completed_at = now(), updated_at = now() where id = ${ids.step}`;

    await sql`
    insert into engineering_notebook_entries (id, season_id, project_id, subsystem_id, title, entry_type, status, entry_date, content_html, objective, decisions, results, next_steps, tags, current_version, created_by_member_id, updated_by_member_id)
    values (${ids.notebookEntry}, ${ids.season}, ${ids.engineeringProject}, ${ids.subsystem}, ${marker}, 'TESTING', 'PUBLISHED', now(), '<h2>QA test</h2><p>Verified.</p>', 'Validate lifecycle', 'Continue', 'Passed', 'Compile PDF', '["qa","verification"]'::jsonb, 1, ${memberId}, ${memberId})
  `;
    await sql`
    insert into engineering_notebook_versions (id, entry_id, version_number, snapshot, change_summary, created_by_member_id)
    values (${ids.notebookVersion}, ${ids.notebookEntry}, 1, ${JSON.stringify({ title: marker, status: "PUBLISHED" })}::jsonb, 'Initial QA revision', ${memberId})
  `;
    await sql`
    insert into engineering_notebook_comments (id, entry_id, member_id, kind, body, status)
    values (${ids.notebookComment}, ${ids.notebookEntry}, ${memberId}, 'PLAN', 'Add verification image', 'OPEN')
  `;
    await sql`
    insert into engineering_notebook_compilations (id, season_id, project_id, filters, entry_count, filename, compiled_by_member_id)
    values (${ids.notebookCompilation}, ${ids.season}, ${ids.engineeringProject}, '{"includeTesting":true}'::jsonb, 1, 'qa-notebook.pdf', ${memberId})
  `;
    await sql`
    insert into inventory_items (id, season_id, project_id, subsystem_id, part_id, sku, name, category, location, quantity_on_hand, quantity_reserved, reorder_point, unit_cost_cents, supplier, created_by_member_id)
    values (${ids.inventory}, ${ids.season}, ${ids.engineeringProject}, ${ids.subsystem}, ${ids.part}, ${marker}, 'QA stock', 'Robot parts', 'QA shelf', 8, 2, 3, 2500, 'QA vendor', ${memberId})
  `;
    await sql`
    insert into purchase_requests (id, season_id, project_id, subsystem_id, inventory_item_id, finance_plan_id, finance_entry_id, item, category, vendor, quantity, estimated_unit_cost_cents, priority, status, requested_by_member_id, approved_by_member_id, approved_at, ordered_at, received_at, notes)
    values (${ids.purchase}, ${ids.season}, ${ids.engineeringProject}, ${ids.subsystem}, ${ids.inventory}, ${ids.plan}, ${ids.entry}, 'QA stock', 'Robot parts', 'QA vendor', 2, 2500, 'HIGH', 'RECEIVED', ${memberId}, ${memberId}, now(), now(), now(), 'Verified receipt lifecycle')
  `;
    await sql`
    insert into design_changes (id, season_id, project_id, subsystem_id, part_id, change_number, title, reason, description, impact, cost_impact_cents, schedule_impact_days, risk, status, revision_from, revision_to, verification_plan, verification_results, requested_by_member_id, approved_by_member_id, approved_at, implemented_at)
    values (${ids.designChange}, ${ids.season}, ${ids.engineeringProject}, ${ids.subsystem}, ${ids.part}, ${marker}, 'QA change', 'Verify control flow', 'Temporary design change', 'No production impact', 100, 0, 'LOW', 'IMPLEMENTED', 'A', 'B', 'Run QA', 'Passed', ${memberId}, ${memberId}, now(), now())
  `;
    await sql`
    insert into scouting_matches (id, season_id, event_name, match_number, observed_team, score, opponent_score, autonomous_score, autonomous_won, autonomous_win_point, auto_pins_scored, auto_goals_with_two_pins, auto_robots_midfield, alliance_pins_scored, yellow_pins_owned, robots_midfield, successful_cycles, reliability_rating, submitted_by_member_id)
    values (${ids.scouting}, ${ids.season}, ${marker}, 'Q1', '210Z', 84, 62, 20, true, true, 12, 4, 1, 10, 2, 2, 6, 5, ${memberId})
  `;

    const [check] = await sql`
    select
      (select count(*)::int from finance_entries where id = ${ids.entry} and status = 'PAID') as finance_ok,
      (select count(*)::int from finance_sponsor_commitments where id = ${ids.sponsor}) as sponsor_ok,
      (select count(*)::int from meeting_decisions where id = ${ids.decision}) as decision_ok,
      (select count(*)::int from member_tasks where id = ${ids.task} and status = 'DONE' and completion_requested_at is not null and approved_at is not null and approved_by_member_id = ${memberId}) as task_ok,
      (select count(*)::int from task_comments where id = ${ids.comment} and is_deliverable = true) as comment_ok,
      (select count(*)::int from glossary_terms where id = ${ids.glossary} and published = true) as glossary_ok,
      (select count(*)::int from engineering_parts where id = ${ids.part} and verification_status = 'IN_REVIEW') as part_ok,
      (select count(*)::int from manufacturing_steps where id = ${ids.step} and status = 'COMPLETE') as step_ok,
      (select count(*)::int from engineering_notebook_entries where id = ${ids.notebookEntry} and current_version = 1) as notebook_ok,
      (select count(*)::int from engineering_notebook_versions where id = ${ids.notebookVersion}) as version_ok,
      (select count(*)::int from engineering_notebook_comments where id = ${ids.notebookComment} and kind = 'PLAN') as comment_plan_ok,
      (select count(*)::int from inventory_items where id = ${ids.inventory} and quantity_on_hand - quantity_reserved = 6) as inventory_ok,
      (select count(*)::int from purchase_requests where id = ${ids.purchase} and status = 'RECEIVED') as purchase_ok,
      (select count(*)::int from design_changes where id = ${ids.designChange} and status = 'IMPLEMENTED') as change_ok,
      (select count(*)::int from scouting_matches where id = ${ids.scouting} and autonomous_win_point = true) as scouting_ok,
      (select count(*)::int from unnest(enum_range(null::access_role)) as role(value) where value::text in ('OPERATIONS_LEAD','ENGINEERING_MEMBER','ENGINEERING_LEAD','NOTEBOOK_EDITOR','SCOUTING_LEAD','LOGISTICS_LEAD','FINANCE_LEAD','OUTREACH_LEAD','CONTENT_LEAD')) as scoped_roles_ok
  `;
    if (
      !check ||
      Object.entries(check).some(
        ([key, value]) => Number(value) !== (key === "scoped_roles_ok" ? 9 : 1),
      )
    )
      throw new Error(
        `Operations CRUD verification failed: ${JSON.stringify(check)}`,
      );
    console.log(JSON.stringify({ marker, status: "pass", checks: check }));
  } finally {
    await cleanup();
    const [remaining] = await sql`
    select
      (select count(*)::int from finance_plans where id = ${ids.plan}) +
      (select count(*)::int from meeting_notes where id = ${ids.meeting}) +
      (select count(*)::int from glossary_terms where id = ${ids.glossary}) +
      (select count(*)::int from engineering_parts where id = ${ids.part}) +
      (select count(*)::int from engineering_seasons where id = ${ids.season}) as remaining
  `;
    if (Number(remaining?.remaining ?? 1) !== 0)
      throw new Error("Operations QA cleanup did not complete.");
  }
}

void main();
