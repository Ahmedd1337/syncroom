import { z } from "zod";
export const authSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(10, "Use at least 10 characters").max(128),
  full_name: z.string().max(80).optional(),
});
export const workspaceSchema = z.object({
  name: z.string().trim().min(2).max(60),
});
export const channelSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9][a-z0-9-]{1,39}$/,
      "Use 2–40 lowercase letters, numbers or hyphens",
    ),
  description: z.string().max(200),
});
export const messageSchema = z.string().trim().min(1).max(8000);
export const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  username: z
    .string()
    .regex(
      /^[a-z0-9_]{3,30}$/,
      "Use 3–30 lowercase letters, numbers or underscores",
    ),
  job_title: z.string().max(80),
  bio: z.string().max(300),
  status: z.enum(["Available", "Busy", "Away", "In a meeting"]),
});
export const taskSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().max(3000),
  status: z.enum(["backlog", "todo", "progress", "review", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assignee_id: z.string().nullable(),
  due_date: z.string().nullable(),
});
export const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export function validateFile(file: { size: number; type: string }) {
  if (!ALLOWED_TYPES.includes(file.type))
    throw new Error("Choose a JPG, PNG, WebP, PDF, TXT, DOCX or XLSX file.");
  if (file.size > MAX_FILE_SIZE)
    throw new Error("Files must be 10 MB or smaller.");
  if (!file.size) throw new Error("This file is empty.");
}
