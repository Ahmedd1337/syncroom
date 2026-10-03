"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { browserClient } from "@/lib/supabase/client";
import { demoSnapshot } from "@/lib/demo";
import type { Snapshot, Message } from "@/lib/types";
const MESSAGE_SELECT =
  "*, profile:profiles!messages_user_id_fkey(*), reactions:message_reactions(*), attachments:message_attachments(*)";
export function useWorkspace(initial: Snapshot, demo: boolean) {
  const [data, setData] = useState(initial);
  const [workspaceId, setWorkspaceId] = useState(
    initial.workspaces[0]?.id || "",
  );
  const [channelId, setChannelId] = useState(demo ? "demo-product-design" : "");
  const [loading, setLoading] = useState(!demo && !!workspaceId);
  const [error, setError] = useState("");
  const [online, setOnline] = useState<string[]>(demo ? ["demo-alex"] : []);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [hasMore, setHasMore] = useState(false);
  const realtime = useRef<ReturnType<
    ReturnType<typeof browserClient>["channel"]
  > | null>(null);
  const lastTyping = useRef(0);
  const request = useRef(0);
  const historyLimit = useRef(50);
  const refresh = useCallback(async () => {
    if (demo || !workspaceId) return;
    const seq = ++request.current;
    try {
      const client = browserClient();
      const results = await Promise.all([
        client.from("workspaces").select("*"),
        client
          .from("workspace_members")
          .select("*, profile:profiles!workspace_members_user_id_fkey(*)")
          .eq("workspace_id", workspaceId),
        client
          .from("channels")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("name"),
        client
          .from("tasks")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false }),
        client
          .from("notifications")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(100),
        client
          .from("profiles")
          .select("*")
          .eq("id", initial.profile.id)
          .single(),
      ]);
      for (const r of results) if (r.error) throw r.error;
      if (seq !== request.current) return;
      const channels = results[2].data as Snapshot["channels"];
      const active = channels.some((c) => c.id === channelId)
        ? channelId
        : channels[0]?.id || "";
      let messages: Message[] = [];
      if (active) {
        const r = await client
          .from("messages")
          .select(MESSAGE_SELECT)
          .eq("channel_id", active)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(historyLimit.current);
        if (r.error) throw r.error;
        messages = (r.data || []) as Message[];
      }
      if (seq !== request.current) return;
      setChannelId(active);
      setHasMore(messages.length === historyLimit.current);
      setData({
        workspaces: results[0].data || [],
        members: results[1].data as Snapshot["members"],
        channels,
        tasks: results[3].data || [],
        notifications: results[4].data || [],
        profile: results[5].data,
        messages: messages.reverse(),
      });
      setError("");
      if (!results[0].data?.some((w) => w.id === workspaceId))
        setWorkspaceId(results[0].data?.[0]?.id || "");
    } catch (e) {
      if (seq === request.current)
        setError(
          e instanceof Error
            ? e.message
            : "Unable to load this workspace. Try again.",
        );
    } finally {
      if (seq === request.current) setLoading(false);
    }
  }, [demo, workspaceId, channelId, initial.profile.id]);
  useEffect(() => {
    if (demo) return;
    const pending = request;
    historyLimit.current = 50;
    const timer = setTimeout(() => {
      setLoading(true);
      void refresh();
    }, 0);
    return () => {
      clearTimeout(timer);
      pending.current++;
    };
  }, [demo, refresh]);
  useEffect(() => {
    if (demo || !workspaceId) return;
    const client = browserClient();
    let active = true;
    let reload: ReturnType<typeof setTimeout>;
    const changed = () => {
      clearTimeout(reload);
      reload = setTimeout(() => void refresh(), 200);
    };
    const db = client.channel(`changes:${workspaceId}:${channelId}`);
    if (channelId)
      db.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        changed,
      );
    db.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tasks",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      changed,
    )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${initial.profile.id}`,
        },
        changed,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channels",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        changed,
      );
    for (const table of ["messages", "tasks", "channels"])
      db.on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table },
        changed,
      );
    for (const table of [
      "message_reactions",
      "message_attachments",
      "workspace_members",
      "profiles",
      "workspaces",
    ])
      db.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        changed,
      );
    db.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
        setError("Live updates disconnected. Retry to reconnect.");
    });
    const room = client.channel(`workspace:${workspaceId}`, {
      config: { private: true, presence: { key: initial.profile.id } },
    });
    realtime.current = room;
    room
      .on("presence", { event: "sync" }, () =>
        setOnline(Object.keys(room.presenceState())),
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (
          payload.channel_id === channelId &&
          payload.user_id !== initial.profile.id
        )
          setTyping((t) => ({ ...t, [String(payload.user_id)]: Date.now() }));
      });
    void client.realtime.setAuth().then(() => {
      if (active)
        room.subscribe(async (status) => {
          if (status === "SUBSCRIBED")
            await room.track({ user_id: initial.profile.id });
        });
    });
    const expiry = setInterval(
      () =>
        setTyping((t) =>
          Object.fromEntries(
            Object.entries(t).filter(([, time]) => Date.now() - time < 3500),
          ),
        ),
      1000,
    );
    const reconcile = setInterval(changed, 30000);
    window.addEventListener("focus", changed);
    return () => {
      active = false;
      clearInterval(reconcile);
      window.removeEventListener("focus", changed);
      clearTimeout(reload);
      clearInterval(expiry);
      void client.removeChannel(db);
      void client.removeChannel(room);
      realtime.current = null;
    };
  }, [demo, workspaceId, channelId, initial.profile.id, refresh]);
  function announceTyping() {
    if (Date.now() - lastTyping.current < 1200) return;
    lastTyping.current = Date.now();
    void realtime.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { channel_id: channelId, user_id: data.profile.id },
    });
  }
  async function run(
    action: () => Promise<void>,
    success?: string,
    reload = true,
  ) {
    try {
      await action();
      if (!demo && reload) await refresh();
      if (success) toast.success(success);
      return true;
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "The change could not be saved. Please try again.",
      );
      return false;
    }
  }
  async function more() {
    const first = data.messages[0];
    const seq = request.current;
    if (demo || !first) return;
    await run(
      async () => {
        const r = await browserClient()
          .from("messages")
          .select(MESSAGE_SELECT)
          .eq("channel_id", channelId)
          .or(
            `created_at.lt.${first.created_at},and(created_at.eq.${first.created_at},id.lt.${first.id})`,
          )
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(50);
        if (r.error) throw r.error;
        if (seq !== request.current) return;
        setHasMore(r.data.length === 50);
        historyLimit.current += r.data.length;
        setData((d) => ({
          ...d,
          messages: [...(r.data as Message[]).reverse(), ...d.messages],
        }));
      },
      undefined,
      false,
    );
  }
  function resetDemo() {
    setData(demoSnapshot());
    setWorkspaceId("demo-studio");
    setChannelId("demo-product-design");
    toast.success("Demo reset");
  }
  return {
    data,
    setData,
    workspaceId,
    setWorkspaceId,
    channelId,
    setChannelId,
    loading,
    error,
    online,
    typing,
    hasMore,
    more,
    refresh,
    run,
    announceTyping,
    resetDemo,
  };
}
export type WorkspaceStore = ReturnType<typeof useWorkspace>;
export function check(result: { error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
}
