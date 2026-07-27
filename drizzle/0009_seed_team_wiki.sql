WITH page_seed(category_slug, slug, path, title, summary, body_html, visibility, sort_order) AS (
  VALUES
  ('engineering-notebook', 'design-cycle', 'engineering-notebook/design-cycle', 'Writing a complete design cycle', 'A repeatable structure for documenting requirements, concepts, decisions, builds, tests, and iteration.', $doc$
    <h2>Use the engineering process, not a build diary</h2>
    <p>Every significant mechanism or software system should tell a traceable story: what problem we identified, which options we considered, why we selected one, how we built it, what the data showed, and what changed next.</p>
    <h2>1. Define the problem</h2>
    <p>State the scoring or strategic need without jumping to a solution. Record constraints such as size, motor budget, cycle-time target, weight, interfaces, and rules. End with a measurable definition of success.</p>
    <blockquote>Example: Pick up a game object from the floor and place it in the target in under three seconds, using no more than two motors, with at least 85% success over ten trials.</blockquote>
    <h2>2. Brainstorm and compare</h2>
    <ul><li>Generate at least three genuinely different concepts.</li><li>Sketch or add early CAD for each concept.</li><li>Record advantages, risks, complexity, and external inspiration.</li><li>Use a weighted decision matrix when several criteria matter.</li></ul>
    <h2>3. Build and program</h2>
    <p>Document dimensions, materials, motor and sensor choices, assembly decisions, and software behavior in plain language. A reader who missed the meeting should still understand the reasoning.</p>
    <h2>4. Test with numbers</h2>
    <p>A test without a measurement is an opinion. Record the setup, controlled variables, individual trials, average, consistency, failures, and a conclusion tied directly to the data.</p>
    <h2>5. Start the next iteration</h2>
    <p>Keep failed concepts. Link the next sub-cycle to the result that triggered it, explain the new hypothesis, and define the next success target.</p>
  $doc$, 'PUBLIC', 10),
  ('engineering-notebook', 'entry-photo-standards', 'engineering-notebook/entry-photo-standards', 'Entry and photo standards', 'The minimum information every notebook entry and embedded image should contain.', $doc$
    <h2>Every entry must stand alone</h2>
    <ul><li>Date and named contributors</li><li>Goal for the session</li><li>Work completed and decisions made</li><li>Evidence: photos, CAD, code reference, measurements, or test data</li><li>Problems encountered and what was learned</li><li>Next action, owner, and target date</li></ul>
    <h2>Photo standards</h2>
    <ul><li>Place each photo next to the text it supports.</li><li>Label the mechanism, what the viewer should notice, and why it matters.</li><li>Capture before-and-after views for meaningful changes.</li><li>Include the test setup whenever quantitative results are recorded.</li><li>Use one clear milestone photo for every major completed mechanism.</li></ul>
    <h2>Writing standard</h2>
    <p>Write in first-person plural, prefer specific evidence over long summaries, cite outside inspiration, and document failures as carefully as successes. The notebook should show student reasoning rather than copied rule or product text.</p>
  $doc$, 'PUBLIC', 20),
  ('engineering-notebook', 'competition-checklist', 'engineering-notebook/competition-checklist', 'Pre-competition notebook checklist', 'A final quality check for structure, evidence, navigation, and interview readiness.', $doc$
    <h2>Run this review at least two days before competition</h2>
    <h3>Structure and completeness</h3>
    <ul><li>Table of contents and section links are accurate.</li><li>The latest robot state matches the notebook.</li><li>Every active design cycle includes the problem, concepts, selection, build, and testing completed so far.</li><li>Any gap longer than two weeks is explained.</li><li>Competition and performance logs are current.</li></ul>
    <h3>Evidence quality</h3>
    <ul><li>Every test has numbers, methodology, and a conclusion.</li><li>Every selection includes the reason it won.</li><li>Photos are labeled and adjacent to the supporting text.</li><li>External inspiration has a citation and access date.</li></ul>
    <h3>Interview readiness</h3>
    <ul><li>Interview members can explain at least one full design cycle.</li><li>The team has selected two or three strong sections to show judges.</li><li>Any award submission is easy to find.</li><li>The exported document has no broken images, orphaned headings, or blank pages.</li></ul>
  $doc$, 'MEMBERS_ONLY', 30),

  ('vex-u', 'season-roadmap', 'vex-u/season-roadmap', '2026–27 VEX U season roadmap', 'A simplified roadmap from Override analysis through prototyping, competition readiness, and season closeout.', $doc$
    <h2>Build toward evidence, not just deadlines</h2>
    <p>The roadmap is based on the current 210 Robotics VEX U timeline. Official VEX and RECF rules always control; review every manual update before locking a design decision.</p>
    <h3>May–July: understand and select</h3>
    <ul><li>Review Override scoring, constraints, inspection requirements, autonomous rules, and match strategy.</li><li>Define robot functions and produce two or three complete concepts.</li><li>Compare concepts using scoring potential, reliability, complexity, programming effort, driver control, autonomous potential, and cost.</li><li>Set up CAD, code, meeting notes, testing logs, and notebook structure.</li></ul>
    <h3>August–September: recruit and prototype</h3>
    <ul><li>Train new members in CAD, programming, fabrication, electrical work, and safety.</li><li>Prototype critical mechanisms independently before committing to a full robot.</li><li>Establish the code framework, drivetrain controls, sensors, and initial autonomous paths.</li></ul>
    <h3>October–November: alpha robot</h3>
    <ul><li>Complete a full robot that drives, intakes, scores, and can be inspected.</li><li>Run an alpha design review focused on reliability, speed, legality, driver experience, and programming difficulty.</li><li>Begin regular driver practice, autonomous testing, skills runs, and post-session documentation.</li></ul>
    <h3>December–March: competition robot</h3>
    <ul><li>Rebuild around measured failures and update CAD to match the physical robot.</li><li>Stabilize wiring and code, prepare critical spares, and verify rule compliance.</li><li>Prioritize repeatability, driver practice, autonomous consistency, scouting, and small evidence-backed improvements.</li></ul>
    <h3>April–May: archive and transition</h3>
    <p>Archive final CAD, code, notebook, performance data, inventory, results, lessons learned, and next-season recommendations.</p>
    <p><a href="https://docs.google.com/document/d/1s5rmMczHfRVIUa9EClyEq1g-hYPPE_T2Vqx01PV3MBU" target="_blank">Open the source VEX U timeline in Google Drive</a></p>
  $doc$, 'PUBLIC', 10),
  ('vex-u', 'override-game-analysis', 'vex-u/override-game-analysis', 'Override game analysis template', 'A shared structure for turning the game manual and match footage into robot requirements.', $doc$
    <h2>Answer the strategic questions first</h2>
    <ul><li><strong>Scoring:</strong> Which actions are worth the most points?</li><li><strong>Time:</strong> Which actions can be completed fastest and most reliably?</li><li><strong>Autonomous:</strong> Which early tasks create the largest advantage?</li><li><strong>Late match:</strong> Which objectives must be protected or reserved?</li><li><strong>Skills:</strong> Which route maximizes repeatable driver and programming scores?</li><li><strong>Risk:</strong> Which strategies are too complex for the current schedule and experience?</li></ul>
    <h2>Convert strategy into requirements</h2>
    <p>For every proposed robot function, define the target cycle time, required reach, capacity, accuracy, legal envelope, motor and sensor needs, interactions with the second robot, and the test that proves it works.</p>
    <h2>Keep the analysis current</h2>
    <p>Update assumptions after rule changes, every prototype review, driver testing, and competition footage review. Record the evidence that changed the strategy.</p>
    <p><a href="https://drive.google.com/file/d/1akr2Ugcbcdwa_EOrNSZXHYxD9vVIn7vv/view" target="_blank">Open the stored Override game manual</a></p>
  $doc$, 'PUBLIC', 20),
  ('vex-u', 'scouting-match-strategy', 'vex-u/scouting-match-strategy', 'Scouting and match strategy', 'How to collect useful opponent data and convert it into a short, actionable match plan.', $doc$
    <h2>Scout for decisions</h2>
    <p>Record robot role, primary scoring method, autonomous capability, cycle consistency, defensive behavior, reliability concerns, and strategic tendencies. If a field is unknown, say unknown rather than guessing.</p>
    <h2>Match card</h2>
    <ul><li>Opponent and alliance team numbers</li><li>Robot type and primary threat</li><li>Known autonomous behavior</li><li>Defensive history or zone preference</li><li>Recommended opening play</li><li>Late-match timing note</li></ul>
    <h2>After the match</h2>
    <p>Record the result, which assumption was right or wrong, one driver adjustment, one strategic adjustment, and any robot behavior that needs investigation. Feed the useful evidence back into the playbook and engineering notebook.</p>
  $doc$, 'MEMBERS_ONLY', 30),

  ('code-documentation', 'codebase-standards', 'code-documentation/codebase-standards', 'Robot code structure and standards', 'A shared baseline for readable, testable, and competition-ready robot software.', $doc$
    <h2>Repository structure</h2>
    <ul><li>Keep hardware configuration in one clear location.</li><li>Separate driver control, autonomous routines, mechanisms, sensors, and shared utilities.</li><li>Name commands and states after robot behavior rather than controller buttons.</li><li>Document every motor port, reversal, gear ratio, and sensor assumption.</li></ul>
    <h2>Change discipline</h2>
    <ul><li>Use version control for every meaningful change.</li><li>Write commit messages that explain behavior, not just files.</li><li>Do not deploy an undocumented competition-day change.</li><li>Require a second person to review safety-critical or autonomous logic.</li></ul>
    <h2>Definition of ready</h2>
    <p>A feature is ready when it has a clear purpose, known inputs and outputs, failure behavior, a repeatable test, and a short plain-language explanation that another programmer can maintain.</p>
  $doc$, 'PUBLIC', 10),
  ('code-documentation', 'autonomous-testing', 'code-documentation/autonomous-testing', 'Autonomous testing and error log', 'A repeatable template for measuring autonomous consistency and resolving failures.', $doc$
    <h2>Routine record</h2>
    <ul><li>Routine name and intended field configuration</li><li>Starting position and alignment reference</li><li>Target actions and expected score</li><li>Sensor dependencies and fallback behavior</li><li>Known conditions where the routine should not be selected</li></ul>
    <h2>Ten-trial benchmark</h2>
    <p>Run at least ten trials under the same setup. Record each result, failure point, completion time, relevant sensor values, battery state, and environmental notes. Calculate the success rate rather than describing the routine as “pretty reliable.”</p>
    <h2>Error log</h2>
    <p>For every failure, record the date, symptom, whether the cause appears mechanical, electrical, software, or setup-related, the hypothesis, the change attempted, and the verification result.</p>
  $doc$, 'MEMBERS_ONLY', 20),

  ('training', 'cad-onboarding', 'training/cad-onboarding', 'CAD onboarding', 'The first workflow new designers should learn before contributing to the competition robot.', $doc$
    <h2>Training goals</h2>
    <ul><li>Navigate the shared project and follow file naming and version rules.</li><li>Create constrained sketches and parametric features.</li><li>Build assemblies with correct hardware, motion, and interfaces.</li><li>Check robot envelope, interference, service access, and manufacturability.</li><li>Create a drawing or clear build reference from the model.</li></ul>
    <h2>First assignment</h2>
    <p>Model a small legal subsystem, assemble it with standard hardware, run an interference check, and present one design tradeoff. The review should focus on constraints and serviceability, not visual polish alone.</p>
    <h2>Before merging a design</h2>
    <p>Confirm units, dimensions, fasteners, material, mass estimate, moving clearances, wiring space, starting configuration, and the notebook entry that explains why this version exists.</p>
  $doc$, 'PUBLIC', 10),
  ('training', 'programming-onboarding', 'training/programming-onboarding', 'Programming onboarding', 'A practical path from repository setup to safe mechanism code and autonomous testing.', $doc$
    <h2>Training path</h2>
    <ol><li>Clone the repository and build the base project.</li><li>Read the hardware map and identify every configured device.</li><li>Run the robot safely with wheels or mechanisms supported.</li><li>Implement one small command or diagnostic.</li><li>Test, document the result, and submit the change for review.</li></ol>
    <h2>Core expectations</h2>
    <ul><li>Understand driver control, mechanism state, sensors, autonomous selection, and error reporting.</li><li>Never bypass safety limits without a documented test reason.</li><li>Keep tuning constants named and centralized.</li><li>Log assumptions and failure behavior in plain language.</li></ul>
  $doc$, 'PUBLIC', 20),
  ('training', 'build-safety', 'training/build-safety', 'Build and safety basics', 'Minimum shop, electrical, battery, and robot-handling standards for every member.', $doc$
    <h2>Before using a tool</h2>
    <ul><li>Complete the required makerspace or officer-led training.</li><li>Wear the required eye, hearing, and clothing protection.</li><li>Inspect the tool, workholding, and surrounding area.</li><li>Ask before improvising a process you have not been trained to perform.</li></ul>
    <h2>Robot safety</h2>
    <ul><li>Disable or remove power before mechanical or electrical work.</li><li>Support raised robots and mechanisms securely.</li><li>Keep hands clear during code deployment and mechanism testing.</li><li>Use a spotter for high-force or fast-moving tests.</li><li>Stop immediately when motion differs from the stated test plan.</li></ul>
    <h2>Battery and electrical</h2>
    <p>Inspect cables and batteries before use, protect terminals from metal tools, use the approved charger, isolate damaged batteries, and keep wiring labeled and strain-relieved.</p>
  $doc$, 'PUBLIC', 30),

  ('team-operations', 'new-member-start-here', 'team-operations/new-member-start-here', 'New member: start here', 'How to get oriented, choose a technical path, and make a documented first contribution.', $doc$
    <h2>Welcome to 210 Robotics</h2>
    <p>Our major programs share one mission: turn student ideas into reliable systems, documented engineering, and positive community impact.</p>
    <h2>Your first two weeks</h2>
    <ol><li>Complete portal onboarding and review the calendar.</li><li>Read the safety, documentation, and conduct basics.</li><li>Attend a general meeting and one technical training.</li><li>Choose an initial path: mechanical, CAD, electrical, programming, strategy, documentation, or outreach.</li><li>Join a small task with a named owner and clear definition of done.</li><li>Log your hours, contribution, and what you learned.</li></ol>
    <h2>How work is recorded</h2>
    <p>Use the portal for attendance, hours, and contributions. Use this wiki for durable knowledge. Use the engineering notebook for design evidence, decisions, testing, and iteration.</p>
  $doc$, 'PUBLIC', 10),
  ('team-operations', 'meeting-decision-notes', 'team-operations/meeting-decision-notes', 'Meeting and decision notes', 'A lightweight template for capturing decisions and follow-up without duplicating the Google Calendar.', $doc$
    <h2>Meeting note template</h2>
    <ul><li><strong>Purpose:</strong> What needed to be decided or completed?</li><li><strong>Attendance:</strong> Use the portal QR roster rather than typing a second list.</li><li><strong>Decisions:</strong> What changed, and why?</li><li><strong>Evidence:</strong> Link photos, CAD, code, test data, or relevant Drive files.</li><li><strong>Actions:</strong> Task, owner, and target date.</li><li><strong>Open questions:</strong> What still needs an answer?</li></ul>
    <h2>Decision record</h2>
    <p>For a decision that affects more than one session, create a short record with context, options considered, final choice, reason, tradeoffs, owner, and the condition that would cause the team to revisit it.</p>
  $doc$, 'MEMBERS_ONLY', 20),
  ('team-operations', 'competition-day', 'team-operations/competition-day', 'Competition day operations', 'A repeatable operating rhythm for inspection, queue, matches, repairs, scouting, judging, and closeout.', $doc$
    <h2>Before the first match</h2>
    <ul><li>Set the pit to the standard layout and verify every transported item.</li><li>Present both robots for inspection early and document any correction.</li><li>Confirm batteries, controls, autonomous selection, tools, spares, notebook, and match schedule.</li></ul>
    <h2>Before every match</h2>
    <ul><li>Review the scouting match card.</li><li>Run the electronics and battery check in the pit.</li><li>Confirm autonomous routines with both coaches.</li><li>Leave for queue together with enough time to solve a problem.</li></ul>
    <h2>After every match</h2>
    <p>Run a short debrief before repair work: result, one strong driver choice, one adjustment, unexpected robot behavior, strategy result, and late-match execution. Then begin battery rotation, inspection, repair triage, pit reset, scouting update, and the next match card.</p>
    <h2>End of day</h2>
    <p>Account for robots, batteries, tools, spares, computers, documentation, and media. Before leaving, assign the three most important post-event changes and place them in the competition notebook entry.</p>
    <p><a href="https://drive.google.com/file/d/1BAoy1GL9bz_Y8IhzTLY_lBSTkiRcnHW3/view" target="_blank">Open the detailed competition operations source in Google Drive</a></p>
  $doc$, 'MEMBERS_ONLY', 30),
  ('team-operations', 'drive-team-standards', 'team-operations/drive-team-standards', 'Drive team standards', 'Roles, preparation, communication, and continuous evaluation for the two-robot VEX U drive team.', $doc$
    <h2>Core roles</h2>
    <ul><li><strong>Drivers:</strong> operate efficiently, protect robot health, and execute practiced routes.</li><li><strong>Coaches:</strong> call concise plays, monitor field state, coordinate both robots, and handle referee communication.</li><li><strong>Field systems:</strong> own electronics checks, autonomous selection, diagnostics, and between-match technical triage.</li><li><strong>Tactical operations:</strong> own scouting, match cards, schedule awareness, judging readiness, and pit reset.</li></ul>
    <h2>Communication standard</h2>
    <p>Calls must be short, timed, and actionable. Drivers do not argue with referees. The team uses the same command structure in practice and competition so pressure does not change how decisions are made.</p>
    <h2>Selection and review</h2>
    <p>Every seat is earned through rules knowledge, practical drills, teamwork, and mock matches. The roster remains reviewable when a member misses required practice, breaks conduct standards, or repeatedly fails a trainable responsibility.</p>
    <p><a href="https://drive.google.com/file/d/1uVMFyrBYJ_lX58Unw8-FAR7gszfuCXW3/view" target="_blank">Open the detailed drive team source in Google Drive</a></p>
  $doc$, 'MEMBERS_ONLY', 40)
)
INSERT INTO doc_pages (
  category_id,
  slug,
  path,
  title,
  summary,
  body_json,
  body_html,
  search_text,
  visibility,
  status,
  sort_order,
  published_at
)
SELECT
  categories.id,
  page_seed.slug,
  page_seed.path,
  page_seed.title,
  page_seed.summary,
  '{}'::jsonb,
  page_seed.body_html,
  page_seed.title || ' ' || page_seed.summary,
  page_seed.visibility::doc_visibility,
  'PUBLISHED'::doc_status,
  page_seed.sort_order,
  now()
FROM page_seed
JOIN doc_categories AS categories ON categories.slug = page_seed.category_slug
ON CONFLICT (path) DO NOTHING;
