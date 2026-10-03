"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Hash, MessageSquare, Users } from "lucide-react";
import { browserClient } from "@/lib/supabase/client";
import type { WorkspaceStore } from "@/hooks/use-workspace";
import type { Message } from "@/lib/types";
import { Avatar } from "../shared";
export function SearchPanel({
  store,
  demo,
  onChannel,
}: {
  store: WorkspaceStore;
  demo: boolean;
  onChannel: (id: string) => void;
}) {
  const { data, workspaceId } = store;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const q = query.trim().toLowerCase();
  const channels = useMemo(
    () => data.channels.filter((c) => c.workspace_id === workspaceId),
    [data.channels, workspaceId],
  );
  const foundChannels = q ? channels.filter((c) => c.name.includes(q)) : [];
  const members = q
    ? data.members.filter(
        (m) =>
          m.workspace_id === workspaceId &&
          `${m.profile.full_name} ${m.profile.username}`
            .toLowerCase()
            .includes(q),
      )
    : [];
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      if (q.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      if (demo) {
        setResults(
          data.messages
            .filter(
              (m) =>
                channels.some((c) => c.id === m.channel_id) &&
                m.body.toLowerCase().includes(q),
            )
            .slice(0, 30),
        );
        setLoading(false);
        return;
      }
      const ids = channels.map((c) => c.id);
      if (!ids.length) {
        setResults([]);
        setLoading(false);
        return;
      }
      const result = await browserClient()
        .from("messages")
        .select("*, profile:profiles!messages_user_id_fkey(*)")
        .in("channel_id", ids)
        .textSearch("body", q, { type: "websearch", config: "english" })
        .order("created_at", { ascending: false })
        .limit(30);
      if (active) {
        if (result.error) setError("Search could not complete. Try again.");
        else setResults((result.data || []) as Message[]);
        setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, demo, data.messages, channels]);
  return (
    <section className="page-content search-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PICK UP THE THREAD</span>
          <h1>Find it in your workspace.</h1>
          <p>Search conversations, channels, and the people behind them.</p>
        </div>
      </div>
      <label className="global-search">
        <Search size={21} />
        <input
          autoFocus
          value={query}
          maxLength={120}
          onChange={(e) => {
            setQuery(e.target.value);
            setLoading(e.target.value.trim().length >= 2);
          }}
          placeholder="Search messages, channels, or teammates…"
          aria-label="Workspace search"
        />
        {loading && <span>Searching…</span>}
      </label>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      {q.length < 2 ? (
        <div className="empty-state">
          <Search size={32} />
          <h3>A thought worth finding.</h3>
          <p>Type at least two characters to search this workspace.</p>
        </div>
      ) : (
        <div className="search-results">
          {foundChannels.length > 0 && (
            <section>
              <h2>
                <Hash size={17} /> Channels
              </h2>
              {foundChannels.map((c) => (
                <button
                  className="search-result"
                  key={c.id}
                  onClick={() => onChannel(c.id)}
                >
                  <Hash size={18} />
                  <span>
                    <b>{c.name}</b>
                    <small>{c.description}</small>
                  </span>
                </button>
              ))}
            </section>
          )}
          {members.length > 0 && (
            <section>
              <h2>
                <Users size={17} /> People
              </h2>
              {members.map((m) => (
                <div className="search-result" key={m.user_id}>
                  <Avatar small name={m.profile.full_name} />
                  <span>
                    <b>{m.profile.full_name}</b>
                    <small>
                      @{m.profile.username} · {m.profile.job_title || m.role}
                    </small>
                  </span>
                </div>
              ))}
            </section>
          )}
          {results.length > 0 && (
            <section>
              <h2>
                <MessageSquare size={17} /> Messages{" "}
                <small>Up to 30 results</small>
              </h2>
              {results.map((m) => (
                <button
                  className="search-result"
                  key={m.id}
                  onClick={() => onChannel(m.channel_id)}
                >
                  <Avatar small name={m.profile.full_name} />
                  <span>
                    <b>
                      {m.profile.full_name}{" "}
                      <small>
                        in #{channels.find((c) => c.id === m.channel_id)?.name}
                      </small>
                    </b>
                    <p>{m.body}</p>
                  </span>
                </button>
              ))}
            </section>
          )}
          {!loading &&
            !results.length &&
            !members.length &&
            !foundChannels.length && (
              <div className="empty-state">
                <Search size={30} />
                <h3>No matches yet.</h3>
                <p>
                  Try another name or a different word from the conversation.
                </p>
              </div>
            )}
        </div>
      )}
    </section>
  );
}
