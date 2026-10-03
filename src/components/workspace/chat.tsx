"use client";
import { useEffect, useRef, useState } from "react";

import {
  Hash,
  Users,
  Send,
  Paperclip,
  Reply,
  X,
  MessageSquare,
  Settings2,
} from "lucide-react";
import { ChatMessage } from "./chat-message";
import { toast } from "sonner";
import { check, type WorkspaceStore } from "@/hooks/use-workspace";
import { browserClient } from "@/lib/supabase/client";
import { messageSchema, validateFile, channelSchema } from "@/lib/validation";
import type { Channel, Message, Attachment } from "@/lib/types";
import { canManage } from "@/lib/utils";
import { Avatar } from "../shared";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Confirm } from "../ui/confirm";
export function Chat({
  store,
  demo,
  channel,
}: {
  store: WorkspaceStore;
  demo: boolean;
  channel?: Channel;
}) {
  const { data, channelId, workspaceId, run } = store;
  const messages = data.messages.filter((m) => m.channel_id === channelId);
  const members = data.members.filter((m) => m.workspace_id === workspaceId);
  const admin = canManage(
    members.find((m) => m.user_id === data.profile.id)?.role,
  );
  const [body, setBody] = useState("");
  const [reply, setReply] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [editBody, setEditBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [channelSettings, setChannelSettings] = useState(false);
  const [newName, setNewName] = useState(channel?.name || "");
  const [newDescription, setNewDescription] = useState(
    channel?.description || "",
  );
  const [newMessages, setNewMessages] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const lastId = messages.at(-1)?.id;
  useEffect(() => {
    if (nearBottom.current)
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    else if (lastId) setTimeout(() => setNewMessages(true), 0);
  }, [lastId]);
  const mentionMatch = body.match(/@([a-z0-9_]*)$/);
  const suggestions = mentionMatch
    ? members
        .filter((m) => m.profile.username.startsWith(mentionMatch[1]))
        .slice(0, 5)
    : [];
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (sending || !channel) return;
    setSending(true);
    const ok = await run(async () => {
      const text = messageSchema.parse(
        body.trim() || (file ? `Shared ${file.name}` : ""),
      );
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      let attachment: Attachment | undefined;
      if (file) {
        validateFile(file);
        if (demo)
          attachment = {
            id: crypto.randomUUID(),
            message_id: id,
            path: URL.createObjectURL(file),
            name: file.name,
            mime_type: file.type,
            size: file.size,
          };
        else {
          const path = `${workspaceId}/${data.profile.id}/${crypto.randomUUID()}.${
            file.name
              .split(".")
              .pop()
              ?.replace(/[^a-z0-9]/gi, "") || "bin"
          }`;
          check(
            await browserClient()
              .storage.from("workspace-files")
              .upload(path, file, { contentType: file.type, upsert: false }),
          );
          attachment = {
            id: crypto.randomUUID(),
            message_id: id,
            path,
            name: file.name,
            mime_type: file.type,
            size: file.size,
          };
        }
      }
      const message: Message = {
        id,
        channel_id: channelId,
        user_id: data.profile.id,
        profile: data.profile,
        body: text,
        reply_to: reply?.id || null,
        created_at: now,
        updated_at: now,
        reactions: [],
        attachments: attachment ? [attachment] : [],
      };
      if (demo)
        store.setData((d) => ({ ...d, messages: [...d.messages, message] }));
      else {
        try {
          check(
            await browserClient()
              .from("messages")
              .insert({
                id,
                channel_id: channelId,
                user_id: data.profile.id,
                body: text,
                reply_to: reply?.id || null,
              }),
          );
        } catch (e) {
          if (attachment)
            await browserClient()
              .storage.from("workspace-files")
              .remove([attachment.path]);
          throw e;
        }
        if (attachment) {
          const result = await browserClient()
            .from("message_attachments")
            .insert(attachment);
          if (result.error) {
            await browserClient()
              .storage.from("workspace-files")
              .remove([attachment.path]);
            toast.error(
              "Message sent, but the attachment could not be linked. Please attach the file again.",
            );
          }
        }
      }
      nearBottom.current = true;
    });
    setSending(false);
    if (ok) {
      setBody("");
      setReply(null);
      setFile(null);
      composer.current?.focus();
    }
  }
  async function react(message: Message, emoji: string) {
    await run(async () => {
      const exists = message.reactions.some(
        (r) => r.user_id === data.profile.id && r.emoji === emoji,
      );
      if (demo)
        store.setData((d) => ({
          ...d,
          messages: d.messages.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  reactions: exists
                    ? m.reactions.filter(
                        (r) =>
                          !(r.user_id === data.profile.id && r.emoji === emoji),
                      )
                    : [
                        ...m.reactions,
                        { message_id: m.id, user_id: data.profile.id, emoji },
                      ],
                }
              : m,
          ),
        }));
      else if (exists)
        check(
          await browserClient()
            .from("message_reactions")
            .delete()
            .match({ message_id: message.id, user_id: data.profile.id, emoji }),
        );
      else
        check(
          await browserClient().from("message_reactions").insert({
            message_id: message.id,
            user_id: data.profile.id,
            emoji,
          }),
        );
    });
  }
  async function remove(message: Message) {
    await run(async () => {
      if (demo)
        store.setData((d) => ({
          ...d,
          messages: d.messages.filter((m) => m.id !== message.id),
        }));
      else {
        check(
          await browserClient().from("messages").delete().eq("id", message.id),
        );
        if (message.user_id === data.profile.id && message.attachments.length)
          await browserClient()
            .storage.from("workspace-files")
            .remove(message.attachments.map((a) => a.path));
      }
    }, "Message deleted");
  }
  if (!channel)
    return (
      <div className="empty-state full-empty">
        <MessageSquare size={36} />
        <h2>Every project starts with a conversation.</h2>
        <p>Create a channel from the sidebar to get started.</p>
      </div>
    );
  return (
    <div className="chat-layout">
      <div className="chat-column">
        <header className="channel-header">
          <span className="channel-symbol">
            <Hash size={25} />
          </span>
          <div>
            <h1>{channel.name}</h1>
            <p>{channel.description || "A space for your team to connect."}</p>
          </div>
          <div className="channel-header-actions">
            <button
              className="member-toggle"
              onClick={() => setShowMembers(!showMembers)}
              aria-label="Show channel members"
            >
              <Users size={17} />
              {members.length}
            </button>
            {admin && (
              <button
                className="icon-button"
                aria-label="Channel settings"
                onClick={() => setChannelSettings(true)}
              >
                <Settings2 size={18} />
              </button>
            )}
          </div>
        </header>
        <div
          className="message-scroll"
          ref={scroller}
          onScroll={() => {
            const el = scroller.current;
            if (el)
              nearBottom.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 120;
            if (nearBottom.current) setNewMessages(false);
          }}
        >
          {store.hasMore && (
            <Button variant="ghost" onClick={() => void store.more()}>
              Load earlier messages
            </Button>
          )}
          <div className="channel-welcome">
            <span>
              <Hash size={30} />
            </span>
            <h2>A little room for {channel.name}.</h2>
            <p>
              {channel.description ||
                "Share an idea, ask a question, or start something together."}
            </p>
          </div>
          <div className="date-divider">
            <span>
              {demo
                ? "Saturday, October 3"
                : messages.length
                  ? new Date(messages[0].created_at).toLocaleDateString(
                      undefined,
                      { month: "long", day: "numeric" },
                    )
                  : "Today"}
            </span>
          </div>
          {messages.map((m, index) => {
            const original = data.messages.find((x) => x.id === m.reply_to);
            const grouped =
              index > 0 &&
              messages[index - 1].user_id === m.user_id &&
              new Date(m.created_at).getTime() -
                new Date(messages[index - 1].created_at).getTime() <
                300000 &&
              !m.reply_to;
            return (
              <ChatMessage
                key={m.id}
                m={m}
                original={original}
                grouped={grouped}
                currentUserId={data.profile.id}
                admin={admin}
                react={react}
                remove={remove}
                onReply={(message) => {
                  setReply(message);
                  composer.current?.focus();
                }}
                onEdit={(message) => {
                  setEditing(message);
                  setEditBody(message.body);
                }}
              />
            );
          })}
          <div ref={bottom} />
        </div>
        {newMessages && (
          <button
            className="new-messages"
            onClick={() => {
              bottom.current?.scrollIntoView({ behavior: "smooth" });
              setNewMessages(false);
            }}
          >
            New messages ↓
          </button>
        )}
        <div className="composer-wrap">
          {reply && (
            <div className="composer-reference">
              <Reply size={15} />
              <span>
                Replying to <b>{reply.profile.full_name}</b> —{" "}
                {reply.body.slice(0, 75)}
              </span>
              <button
                className="icon-button"
                aria-label="Cancel reply"
                onClick={() => setReply(null)}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {file && (
            <div className="composer-reference">
              <Paperclip size={15} />
              {file.name}
              <button
                className="icon-button"
                aria-label="Remove attachment"
                onClick={() => setFile(null)}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <form className="composer" onSubmit={send}>
            {suggestions.length > 0 && (
              <div className="mention-menu" aria-label="Mention suggestions">
                {suggestions.map((m) => (
                  <button
                    type="button"
                    key={m.user_id}
                    onClick={() => {
                      setBody(
                        body.replace(/@[a-z0-9_]*$/, `@${m.profile.username} `),
                      );
                      composer.current?.focus();
                    }}
                  >
                    <Avatar small name={m.profile.full_name} />
                    {m.profile.full_name}
                    <span>@{m.profile.username}</span>
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={composer}
              aria-label={`Message ${channel.name}`}
              value={body}
              maxLength={8000}
              onChange={(e) => {
                setBody(e.target.value);
                store.announceTyping();
              }}
              placeholder={`Message #${channel.name}`}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send(e);
                }
              }}
            />
            <div className="composer-toolbar">
              <div className="row">
                <input
                  ref={fileInput}
                  type="file"
                  className="sr-only"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.docx,.xlsx"
                  aria-label="Attach file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      try {
                        validateFile(f);
                        setFile(f);
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Attach file"
                  onClick={() => fileInput.current?.click()}
                >
                  <Paperclip size={19} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Mention a teammate"
                  onClick={() => {
                    setBody(body + " @");
                    composer.current?.focus();
                  }}
                >
                  @
                </button>
                <span className="composer-divider" />
                <span className="composer-hint">
                  A thought, an update, a good question.
                </span>
              </div>
              <Button
                type="submit"
                size="icon"
                disabled={sending || (!body.trim() && !file)}
                aria-label="Send message"
              >
                <Send size={17} />
              </Button>
            </div>
          </form>
          <div className="composer-footer">
            <span aria-live="polite">
              {Object.keys(store.typing)
                .filter((id) => members.some((m) => m.user_id === id))
                .map(
                  (id) =>
                    members
                      .find((m) => m.user_id === id)
                      ?.profile.full_name.split(" ")[0],
                )
                .join(" and ")}
              {Object.keys(store.typing).length > 0 ? " is typing…" : ""}
            </span>
            <span>
              <b>Enter</b> to send · <b>Shift + Enter</b> for a new line
            </span>
          </div>
        </div>
      </div>
      {showMembers && (
        <aside className="members-panel">
          <div className="panel-header">
            <h2>Channel members</h2>
            <button
              className="icon-button"
              aria-label="Close members"
              onClick={() => setShowMembers(false)}
            >
              <X size={17} />
            </button>
          </div>
          <p className="muted">
            {
              store.online.filter((id) => members.some((m) => m.user_id === id))
                .length
            }{" "}
            online · {members.length} members
          </p>
          {members.map((m) => (
            <div className="member-row" key={m.user_id}>
              <Avatar
                name={m.profile.full_name}
                url={m.profile.avatar_url}
                online={store.online.includes(m.user_id)}
              />
              <span>
                <b>{m.profile.full_name}</b>
                <small>{m.profile.status}</small>
              </span>
            </div>
          ))}
        </aside>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit message"
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(async () => {
              const value = messageSchema.parse(editBody);
              if (demo)
                store.setData((d) => ({
                  ...d,
                  messages: d.messages.map((m) =>
                    m.id === editing?.id
                      ? {
                          ...m,
                          body: value,
                          updated_at: new Date().toISOString(),
                        }
                      : m,
                  ),
                }));
              else
                check(
                  await browserClient()
                    .from("messages")
                    .update({ body: value })
                    .eq("id", editing!.id),
                );
            });
            if (ok) setEditing(null);
          }}
        >
          <label>
            Message
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
            />
          </label>
          <Button>Save changes</Button>
        </form>
      </Dialog>
      <Dialog
        open={channelSettings}
        onOpenChange={setChannelSettings}
        title="Channel settings"
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(async () => {
              const values = channelSchema.parse({
                name: newName,
                description: newDescription,
              });
              if (demo)
                store.setData((d) => ({
                  ...d,
                  channels: d.channels.map((c) =>
                    c.id === channelId ? { ...c, ...values } : c,
                  ),
                }));
              else
                check(
                  await browserClient()
                    .from("channels")
                    .update(values)
                    .eq("id", channelId),
                );
            }, "Channel updated");
            if (ok) setChannelSettings(false);
          }}
        >
          <label>
            Name
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <label>
            Description
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </label>
          <Button>Save channel</Button>
        </form>
        <div className="danger-zone">
          <Confirm
            title="Delete channel and all its messages?"
            onConfirm={() =>
              void run(async () => {
                if (demo)
                  store.setData((d) => ({
                    ...d,
                    channels: d.channels.filter((c) => c.id !== channelId),
                    messages: d.messages.filter(
                      (m) => m.channel_id !== channelId,
                    ),
                  }));
                else
                  check(
                    await browserClient()
                      .from("channels")
                      .delete()
                      .eq("id", channelId),
                  );
                setChannelSettings(false);
              }, "Channel deleted")
            }
          >
            <Button variant="destructive">Delete channel</Button>
          </Confirm>
        </div>
      </Dialog>
    </div>
  );
}
