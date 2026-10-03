"use client";
import Image from "next/image";
import { Reply, Smile, Pencil, Trash2, FileText } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useAsset } from "@/hooks/use-asset";
import type { Message, Attachment } from "@/lib/types";
import { Avatar } from "../shared";
import { Confirm } from "../ui/confirm";
const EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🚀"];
export function ChatMessage({
  m,
  original,
  grouped,
  currentUserId,
  admin,
  react,
  remove,
  onReply,
  onEdit,
}: {
  m: Message;
  original?: Message;
  grouped: boolean;
  currentUserId: string;
  admin: boolean;
  react: (message: Message, emoji: string) => Promise<void>;
  remove: (message: Message) => Promise<void>;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
}) {
  return (
    <article
      className={`message ${grouped ? "grouped" : ""}`}
      key={m.id}
      id={`message-${m.id}`}
    >
      <div className="message-avatar">
        {!grouped && (
          <Avatar name={m.profile.full_name} url={m.profile.avatar_url} />
        )}
      </div>
      <div className="message-content">
        {!grouped && (
          <div className="message-byline">
            <b>{m.profile.full_name}</b>
            {m.user_id === currentUserId && (
              <span className="you-label">you</span>
            )}
            <time dateTime={m.created_at}>
              {new Date(m.created_at).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>
          </div>
        )}
        {m.reply_to && (
          <div className="reply-reference">
            <Reply size={13} />
            <b>{original?.profile.full_name || "Earlier message"}</b>
            <span>
              {original?.body.slice(0, 100) ||
                "Reply to a message outside this history"}
            </span>
          </div>
        )}
        <div className="message-body">
          <MessageText text={m.body} />
          {m.updated_at !== m.created_at && (
            <small className="muted"> (edited)</small>
          )}
        </div>
        {m.attachments.map((a) => (
          <FileAttachment key={a.id} attachment={a} />
        ))}
        {m.reactions.length > 0 && (
          <div className="reactions">
            {[...new Set(m.reactions.map((r) => r.emoji))].map((emoji) => (
              <button
                key={emoji}
                aria-label={`React ${emoji}`}
                aria-pressed={m.reactions.some(
                  (r) => r.emoji === emoji && r.user_id === currentUserId,
                )}
                onClick={() => void react(m, emoji)}
              >
                {emoji} {m.reactions.filter((r) => r.emoji === emoji).length}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="message-tools">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className="icon-button"
            aria-label="Add reaction"
          >
            <Smile size={16} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="emoji-menu" sideOffset={5}>
              {EMOJIS.map((emoji) => (
                <DropdownMenu.Item
                  key={emoji}
                  onSelect={() => void react(m, emoji)}
                >
                  {emoji}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <button
          className="icon-button"
          aria-label="Reply to message"
          onClick={() => onReply(m)}
        >
          <Reply size={16} />
        </button>
        {m.user_id === currentUserId && (
          <button
            className="icon-button"
            aria-label="Edit message"
            onClick={() => onEdit(m)}
          >
            <Pencil size={15} />
          </button>
        )}
        {(m.user_id === currentUserId || admin) && (
          <Confirm
            title="Delete this message?"
            onConfirm={() => void remove(m)}
          >
            <button className="icon-button" aria-label="Delete message">
              <Trash2 size={15} />
            </button>
          </Confirm>
        )}
      </div>
    </article>
  );
}
function MessageText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s]+|@[a-z0-9_]+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : part.startsWith("@") ? (
          <span key={i} className="mention">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
function FileAttachment({ attachment: a }: { attachment: Attachment }) {
  const { url, error } = useAsset(a.path);
  return (
    <div className="attachment">
      {a.mime_type.startsWith("image/") && url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Image src={url} alt={a.name} width={660} height={440} unoptimized />
        </a>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="attachment-label"
      >
        <FileText size={20} />
        <span>
          <b>{a.name}</b>
          <small>
            {error
              ? "File unavailable"
              : `${Math.ceil(a.size / 1024)} KB · ${url ? "Open file" : "Loading…"}`}
          </small>
        </span>
      </a>
    </div>
  );
}
