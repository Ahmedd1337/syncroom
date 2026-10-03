import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authSchema,
  channelSchema,
  messageSchema,
  profileSchema,
  taskSchema,
  validateFile,
  MAX_FILE_SIZE,
} from "../src/lib/validation";
import { canManage, safeNext, slugify } from "../src/lib/utils";
test("rejects malformed account and channel input", () => {
  assert.equal(
    authSchema.safeParse({ email: "bad", password: "short" }).success,
    false,
  );
  assert.equal(
    channelSchema.safeParse({ name: "General Room", description: "" }).success,
    false,
  );
  assert.equal(
    channelSchema.safeParse({
      name: "product-design",
      description: "Review designs",
    }).success,
    true,
  );
  assert.equal(messageSchema.safeParse("   ").success, false);
  assert.equal(messageSchema.safeParse("a".repeat(8001)).success, false);
});
test("validates uploads independently of file extension", () => {
  assert.throws(() => validateFile({ type: "text/html", size: 100 }));
  assert.throws(() =>
    validateFile({ type: "image/png", size: MAX_FILE_SIZE + 1 }),
  );
  assert.throws(() => validateFile({ type: "application/pdf", size: 0 }));
  assert.doesNotThrow(() =>
    validateFile({ type: "image/png", size: MAX_FILE_SIZE }),
  );
});
test("profile mentions and task enums have constrained values", () => {
  assert.equal(
    profileSchema.safeParse({
      full_name: "Alex Morgan",
      username: "Alex!",
      job_title: "",
      bio: "",
      status: "Available",
    }).success,
    false,
  );
  assert.equal(
    taskSchema.safeParse({
      title: "Ship release",
      description: "",
      status: "invented",
      priority: "high",
      assignee_id: null,
      due_date: null,
    }).success,
    false,
  );
});
test("redirect destinations stay within the application", () => {
  for (const input of [
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/\n/example.com",
    "/\t/example.com",
    null,
  ])
    assert.equal(safeNext(input), "/app");
  assert.equal(safeNext("/invite?token=abc"), "/invite?token=abc");
});
test("UI management roles match the database role model", () => {
  assert.equal(canManage("owner"), true);
  assert.equal(canManage("admin"), true);
  assert.equal(canManage("member"), false);
  assert.equal(canManage(undefined), false);
  assert.equal(slugify(" Studio North! "), "studio-north");
});
