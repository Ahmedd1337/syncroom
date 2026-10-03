"use client";
import { MessageSquare, CheckCircle2, Users, Circle, Hash } from "lucide-react";
import type { WorkspaceStore } from "@/hooks/use-workspace";
import { Avatar } from "../shared";
export function Overview({
  store,
  onTasks,
  onChannel,
}: {
  store: WorkspaceStore;
  onTasks: () => void;
  onChannel: (id: string) => void;
}) {
  const { data, workspaceId, online } = store;
  const tasks = data.tasks.filter((t) => t.workspace_id === workspaceId);
  const members = data.members.filter((m) => m.workspace_id === workspaceId);
  return (
    <section className="page-content overview">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE CLARITY FOR YOUR DAY</span>
          <h1>
            Welcome back, {data.profile.full_name.split(" ")[0]}
            <span className="heading-dot">.</span>
          </h1>
          <p>Here’s what’s happening in your workspace.</p>
        </div>
      </div>
      <div className="overview-stats">
        {[
          { label: "Team members", value: members.length, icon: Users },
          {
            label: "Open tasks",
            value: tasks.filter((t) => t.status !== "done").length,
            icon: Circle,
          },
          {
            label: "Completed tasks",
            value: tasks.filter((t) => t.status === "done").length,
            icon: CheckCircle2,
          },
          {
            label: "Channels",
            value: data.channels.filter((c) => c.workspace_id === workspaceId)
              .length,
            icon: MessageSquare,
          },
        ].map((s) => (
          <div key={s.label}>
            <s.icon size={19} />
            <b>{s.value}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Your next steps</h2>
            <button onClick={onTasks}>View board</button>
          </div>
          {tasks
            .filter(
              (t) => t.assignee_id === data.profile.id && t.status !== "done",
            )
            .map((t) => (
              <button className="overview-task" key={t.id} onClick={onTasks}>
                <Circle size={17} />
                <span>
                  {t.title}
                  <small>
                    {t.due_date ? `Due ${t.due_date}` : "No due date"}
                  </small>
                </span>
                <span className={`priority ${t.priority}`}>{t.priority}</span>
              </button>
            ))}
          {!tasks.some(
            (t) => t.assignee_id === data.profile.id && t.status !== "done",
          ) && (
            <div className="empty-state">
              <CheckCircle2 />
              <p>No open tasks assigned to you.</p>
            </div>
          )}
          <div className="panel-header">
            <h2>Jump into a conversation</h2>
          </div>
          {data.channels
            .filter((c) => c.workspace_id === workspaceId)
            .map((c) => (
              <button
                key={c.id}
                className="overview-channel"
                onClick={() => onChannel(c.id)}
              >
                <Hash size={20} />
                <span>
                  <b>{c.name}</b>
                  <small>{c.description || "A space for your team."}</small>
                </span>
              </button>
            ))}
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Your people</h2>
            <span className="muted">{online.length} online</span>
          </div>
          {members.map((m) => (
            <div className="member-row" key={m.user_id}>
              <Avatar
                name={m.profile.full_name}
                url={m.profile.avatar_url}
                online={online.includes(m.user_id)}
              />
              <span>
                <b>{m.profile.full_name}</b>
                <small>{m.profile.job_title || m.role}</small>
              </span>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}
