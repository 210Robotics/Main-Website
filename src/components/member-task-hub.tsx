import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { TaskAttachmentUpload } from "@/components/task-attachment-upload";
import { addTaskUpdate, updateMyTaskStatus } from "@/app/portal/task-actions";
import { displayStatus, memberTaskStatuses } from "@/lib/operations";

type Task = {
  id: string;
  title: string;
  description: string;
  project: string;
  priority: string;
  status: string;
  dueAt: Date | null;
  createdAt: Date;
  completionRequestedAt: Date | null;
  approvedAt: Date | null;
  approvalNote: string;
};
type Comment = {
  id: string;
  taskId: string;
  memberId: string;
  body: string;
  isDeliverable: boolean;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: Date;
};

export function MemberTaskHub({
  tasks,
  comments,
  names,
}: {
  tasks: Task[];
  comments: Comment[];
  names: Record<string, string>;
}) {
  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow">Your work queue</p>
        <h2 className="mt-2 text-3xl font-bold">Tasks and deliverables</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#999]">
          Update progress, ask questions, and attach completed work directly to
          each assignment. Admins see your updates immediately.
        </p>
      </div>
      {tasks.map((task) => (
        <details className="card p-6 open:border-[#fd7803]/50" key={task.id}>
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="tag">{displayStatus(task.status)}</span>
                  <span className="tag">{displayStatus(task.priority)}</span>
                  <span className="tag">{task.project}</span>
                </div>
                <h3 className="mt-3 text-xl font-bold">{task.title}</h3>
                <p className="mt-2 text-sm text-[#999]">
                  {task.dueAt
                    ? `Due ${task.dueAt.toLocaleString()}`
                    : "No deadline"}
                </p>
              </div>
              {task.status !== "DONE" &&
                task.dueAt &&
                task.dueAt < new Date() && (
                  <span className="tag border-red-500/50 text-red-300">
                    Overdue
                  </span>
                )}
            </div>
          </summary>
          <div className="mt-6 grid gap-7 border-t border-[#333] pt-6 xl:grid-cols-[.8fr_1.2fr]">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-[#777]">
                Assignment
              </h4>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#bbb]">
                {task.description ||
                  "No additional instructions were provided."}
              </p>
              {task.approvalNote && (
                <div className="mt-5 rounded-sm border border-[#fd7803]/35 bg-[#fd7803]/8 p-4 text-sm leading-6 text-[#d6b08e]">
                  <strong className="block text-white">Reviewer note</strong>
                  {task.approvalNote}
                </div>
              )}
              {task.status === "DONE" ? (
                <div className="mt-6 rounded-sm border border-emerald-500/35 bg-emerald-500/8 p-4 text-sm text-emerald-200">
                  Completion approved
                  {task.approvedAt
                    ? ` on ${task.approvedAt.toLocaleDateString()}`
                    : ""}
                  .
                </div>
              ) : (
                <ActionForm
                  action={updateMyTaskStatus}
                  successMessage="Progress updated."
                  className="mt-6 grid gap-4"
                >
                  <input type="hidden" name="taskId" value={task.id} />
                  <label className="field">
                    <span>Progress</span>
                    <select
                      className="input"
                      name="status"
                      defaultValue={task.status}
                    >
                      {memberTaskStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status === "IN_REVIEW"
                            ? "Submit as complete for approval"
                            : displayStatus(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {task.status === "IN_REVIEW" && (
                    <p className="text-xs leading-5 text-[#d6b08e]">
                      Submitted
                      {task.completionRequestedAt
                        ? ` ${task.completionRequestedAt.toLocaleString()}`
                        : ""}
                      . A task manager must approve it before it is marked done.
                    </p>
                  )}
                  <button className="button w-fit">
                    Save progress / submit
                  </button>
                </ActionForm>
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-[#777]">
                Updates and deliverables
              </h4>
              <div className="mt-3 grid gap-3">
                {comments
                  .filter((comment) => comment.taskId === task.id)
                  .map((comment) => (
                    <article
                      className="rounded-xl border border-[#333] bg-black/30 p-4"
                      key={comment.id}
                    >
                      <div className="flex flex-wrap justify-between gap-3">
                        <strong className="text-sm">
                          {names[comment.memberId] ?? "Team member"}
                        </strong>
                        <span className="text-xs text-[#777]">
                          {comment.createdAt.toLocaleString()}
                        </span>
                      </div>
                      {comment.body && (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#aaa]">
                          {comment.body}
                        </p>
                      )}
                      {comment.attachmentUrl && (
                        <Link
                          className="mt-3 inline-block text-sm font-semibold text-[#fd7803]"
                          href={comment.attachmentUrl}
                          target="_blank"
                        >
                          {comment.isDeliverable
                            ? "Deliverable: "
                            : "Attachment: "}
                          {comment.attachmentName ?? "Open file"}
                        </Link>
                      )}
                    </article>
                  ))}
                {!comments.some((comment) => comment.taskId === task.id) && (
                  <p className="py-3 text-sm text-[#777]">No updates yet.</p>
                )}
              </div>
              <ActionForm
                action={addTaskUpdate}
                successMessage="Update posted."
                className="mt-5 grid gap-4 border-t border-[#333] pt-5"
              >
                <input type="hidden" name="taskId" value={task.id} />
                <label className="field">
                  <span>Comment or handoff note</span>
                  <textarea
                    className="input min-h-24"
                    name="body"
                    placeholder="What changed, what is blocked, or what should be reviewed?"
                  />
                </label>
                <TaskAttachmentUpload taskId={task.id} />
                <label className="flex items-center gap-3 text-sm text-[#bbb]">
                  <input type="checkbox" name="isDeliverable" /> Mark attachment
                  as a deliverable
                </label>
                <button className="button w-fit">Post update</button>
              </ActionForm>
            </div>
          </div>
        </details>
      ))}
      {!tasks.length && (
        <div className="card p-10 text-center">
          <h3 className="text-xl font-bold">Your queue is clear.</h3>
          <p className="mt-3 text-sm text-[#888]">
            New assignments will appear here and on your dashboard.
          </p>
        </div>
      )}
    </div>
  );
}
