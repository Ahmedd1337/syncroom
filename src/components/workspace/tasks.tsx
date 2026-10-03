"use client";
import { useState } from "react";
import {
  Plus,
  SlidersHorizontal,
  Calendar,
  Circle,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { check, type WorkspaceStore } from "@/hooks/use-workspace";
import { browserClient } from "@/lib/supabase/client";
import { taskSchema } from "@/lib/validation";
import { STATUSES, type Task } from "@/lib/types";
import { canManage } from "@/lib/utils";
import { Avatar } from "../shared";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Confirm } from "../ui/confirm";
type Draft = Pick<
  Task,
  "title" | "description" | "status" | "priority" | "assignee_id" | "due_date"
>;
const empty: Draft = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  assignee_id: null,
  due_date: null,
};
export function TaskBoard({
  store,
  demo,
}: {
  store: WorkspaceStore;
  demo: boolean;
}) {
  const { data, workspaceId, run } = store;
  const members = data.members.filter((m) => m.workspace_id === workspaceId);
  const [filter, setFilter] = useState("all");
  const [priority, setPriority] = useState("all");
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);
  const [saving, setSaving] = useState(false);
  const tasks = data.tasks.filter(
    (t) =>
      t.workspace_id === workspaceId &&
      (filter === "all" || t.assignee_id === data.profile.id) &&
      (priority === "all" || t.priority === priority),
  );
  const admin = canManage(
    members.find((m) => m.user_id === data.profile.id)?.role,
  );
  function add(status: Task["status"] = "todo") {
    setDraft({ ...empty, status });
    setEditing(null);
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await run(
      async () => {
        const values = taskSchema.parse(draft);
        if (demo) {
          store.setData((d) => ({
            ...d,
            tasks: editing
              ? d.tasks.map((t) =>
                  t.id === editing.id ? { ...t, ...values } : t,
                )
              : [
                  ...d.tasks,
                  {
                    ...values,
                    id: crypto.randomUUID(),
                    workspace_id: workspaceId,
                    created_by: data.profile.id,
                    created_at: new Date().toISOString(),
                  },
                ],
          }));
        } else if (editing)
          check(
            await browserClient()
              .from("tasks")
              .update(values)
              .eq("id", editing.id),
          );
        else
          check(
            await browserClient()
              .from("tasks")
              .insert({
                ...values,
                workspace_id: workspaceId,
                created_by: data.profile.id,
              }),
          );
      },
      editing ? "Task updated" : "Task created",
    );
    setSaving(false);
    if (ok) setOpen(false);
  }
  return (
    <section className="tasks-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">IDEAS INTO PROGRESS</span>
          <h1>
            The work, in motion<span className="heading-dot">.</span>
          </h1>
          <p>A shared view of what’s next, what’s moving, and what’s done.</p>
        </div>
        <Button onClick={() => add()}>
          <Plus size={17} /> New task
        </Button>
      </div>
      <div className="board-toolbar">
        <div className="segmented">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            All tasks{" "}
            <span>
              {data.tasks.filter((t) => t.workspace_id === workspaceId).length}
            </span>
          </button>
          <button
            className={filter === "mine" ? "active" : ""}
            onClick={() => setFilter("mine")}
          >
            Assigned to me
          </button>
        </div>
        <label className="filter-select">
          <SlidersHorizontal size={15} />
          <select
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="all">All priorities</option>
            {["urgent", "high", "medium", "low"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="kanban">
        {STATUSES.map((status) => (
          <section className="kanban-column" key={status.id}>
            <header>
              <span
                className="status-dot"
                style={{ background: status.color }}
              />
              <h2>{status.label}</h2>
              <span className="column-count">
                {tasks.filter((t) => t.status === status.id).length}
              </span>
              <button
                className="icon-button"
                aria-label={`Add task to ${status.label}`}
                onClick={() => add(status.id)}
              >
                <Plus size={15} />
              </button>
            </header>
            <div className="column-cards">
              {tasks
                .filter((t) => t.status === status.id)
                .map((task) => {
                  const assignee = members.find(
                    (m) => m.user_id === task.assignee_id,
                  )?.profile;
                  return (
                    <button
                      className="task-card"
                      key={task.id}
                      onClick={() => {
                        setDraft({
                          title: task.title,
                          description: task.description,
                          status: task.status,
                          priority: task.priority,
                          assignee_id: task.assignee_id,
                          due_date: task.due_date,
                        });
                        setEditing(task);
                        setOpen(true);
                      }}
                    >
                      <div className="task-card-top">
                        <span>SR-{data.tasks.indexOf(task) + 1}</span>
                        {task.status === "done" ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <Circle size={14} />
                        )}
                      </div>
                      <h3>{task.title}</h3>
                      {task.description && <p>{task.description}</p>}
                      <div className="task-card-bottom">
                        <span className={`priority ${task.priority}`}>
                          {task.priority}
                        </span>
                        {assignee && (
                          <Avatar
                            small
                            name={assignee.full_name}
                            url={assignee.avatar_url}
                          />
                        )}
                      </div>
                      {task.due_date && (
                        <div className="task-due">
                          <Calendar size={12} />
                          {new Date(
                            task.due_date + "T12:00:00",
                          ).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      )}
                    </button>
                  );
                })}
              <button className="add-task" onClick={() => add(status.id)}>
                <Plus size={14} /> Add task
              </button>
            </div>
          </section>
        ))}
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Task details" : "Create a task"}
        description="A clear next step makes all the difference."
      >
        <form className="form-stack" onSubmit={save}>
          <label>
            Title
            <input
              required
              minLength={2}
              maxLength={160}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="What needs to happen?"
            />
          </label>
          <label>
            Description
            <textarea
              value={draft.description}
              maxLength={3000}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="Add context, requirements, or a definition of done."
            />
          </label>
          <div className="form-grid">
            <label>
              Status
              <select
                value={draft.status}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    status: e.target.value as Draft["status"],
                  })
                }
              >
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select
                value={draft.priority}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    priority: e.target.value as Draft["priority"],
                  })
                }
              >
                {["low", "medium", "high", "urgent"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assignee
              <select
                value={draft.assignee_id || ""}
                onChange={(e) =>
                  setDraft({ ...draft, assignee_id: e.target.value || null })
                }
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Due date
              <input
                type="date"
                value={draft.due_date || ""}
                onChange={(e) =>
                  setDraft({ ...draft, due_date: e.target.value || null })
                }
              />
            </label>
          </div>
          {editing && (
            <p className="muted">
              Created {new Date(editing.created_at).toLocaleDateString()} by{" "}
              {members.find((m) => m.user_id === editing.created_by)?.profile
                .full_name || "a former member"}
            </p>
          )}
          <Button disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create task"}
          </Button>
        </form>
        {editing && (admin || editing.created_by === data.profile.id) && (
          <div className="danger-zone">
            <Confirm
              title="Delete this task?"
              onConfirm={() =>
                void run(async () => {
                  if (demo)
                    store.setData((d) => ({
                      ...d,
                      tasks: d.tasks.filter((t) => t.id !== editing.id),
                    }));
                  else
                    check(
                      await browserClient()
                        .from("tasks")
                        .delete()
                        .eq("id", editing.id),
                    );
                  setOpen(false);
                }, "Task deleted")
              }
            >
              <Button variant="destructive">
                <Trash2 size={15} /> Delete task
              </Button>
            </Confirm>
          </div>
        )}
      </Dialog>
    </section>
  );
}
