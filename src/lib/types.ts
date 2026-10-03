export type Profile = {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  job_title: string;
  bio: string;
  status: "Available" | "Busy" | "Away" | "In a meeting";
};
export type Workspace = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_by: string;
};
export type Member = {
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  profile: Profile;
};
export type Channel = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  created_by: string;
};
export type Reaction = { message_id: string; user_id: string; emoji: string };
export type Attachment = {
  id: string;
  message_id: string;
  path: string;
  name: string;
  mime_type: string;
  size: number;
};
export type Message = {
  id: string;
  channel_id: string;
  user_id: string;
  body: string;
  reply_to: string | null;
  created_at: string;
  updated_at: string;
  profile: Profile;
  reactions: Reaction[];
  attachments: Attachment[];
};
export type TaskStatus = "backlog" | "todo" | "progress" | "review" | "done";
export type Task = {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high" | "urgent";
  assignee_id: string | null;
  created_by: string;
  due_date: string | null;
  created_at: string;
};
export type Notice = {
  id: string;
  user_id: string;
  workspace_id: string;
  title: string;
  message_id: string | null;
  read_at: string | null;
  created_at: string;
};
export type Snapshot = {
  workspaces: Workspace[];
  members: Member[];
  channels: Channel[];
  messages: Message[];
  tasks: Task[];
  notifications: Notice[];
  profile: Profile;
};
export const STATUSES: { id: TaskStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "#8b93a4" },
  { id: "todo", label: "To do", color: "#8b93a4" },
  { id: "progress", label: "In progress", color: "#e2aa42" },
  { id: "review", label: "In review", color: "#a78bfa" },
  { id: "done", label: "Done", color: "#44b99a" },
];
