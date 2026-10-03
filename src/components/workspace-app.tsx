"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Hash,
  Home,
  LayoutGrid,
  Search,
  Bell,
  Settings,
  Plus,
  ChevronDown,
  Menu,
  Users,
  LogOut,
  RotateCcw,
  X,
  ArrowUpRight,
} from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import { useWorkspace, check } from "@/hooks/use-workspace";
import { browserClient } from "@/lib/supabase/client";
import type { Snapshot } from "@/lib/types";
import { workspaceSchema, channelSchema } from "@/lib/validation";
import { Brand, Avatar, ThemeToggle } from "./shared";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Chat } from "./workspace/chat";
import { TaskBoard } from "./workspace/tasks";
import { SettingsPanel } from "./workspace/settings";
import { SearchPanel } from "./workspace/search";
import { Overview } from "./workspace/overview";
type View = "chat" | "home" | "tasks" | "search" | "notifications" | "settings";
export function WorkspaceApp({
  initial,
  demo = false,
}: {
  initial: Snapshot;
  demo?: boolean;
}) {
  const router = useRouter();
  const store = useWorkspace(initial, demo);
  const { data, workspaceId, setWorkspaceId, channelId, setChannelId, run } =
    store;
  const [view, setView] = useState<View>("chat");
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState<"workspace" | "channel" | "join" | null>(
    null,
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const workspace = data.workspaces.find((w) => w.id === workspaceId);
  const channels = data.channels.filter((c) => c.workspace_id === workspaceId);
  const channel = channels.find((c) => c.id === channelId);
  const unread = data.notifications.filter((n) => !n.read_at).length;
  function navigate(next: View) {
    setView(next);
    setMobile(false);
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await run(
      async () => {
        if (modal === "channel") {
          const values = channelSchema.parse({ name, description });
          if (demo) {
            const item = {
              ...values,
              id: crypto.randomUUID(),
              workspace_id: workspaceId,
              created_by: data.profile.id,
            };
            store.setData((d) => ({ ...d, channels: [...d.channels, item] }));
            setChannelId(item.id);
          } else {
            const result = await browserClient()
              .from("channels")
              .insert({
                ...values,
                workspace_id: workspaceId,
                created_by: data.profile.id,
              })
              .select()
              .single();
            check(result);
            setChannelId(result.data.id);
          }
        } else if (modal === "workspace") {
          const values = workspaceSchema.parse({ name });
          if (demo) {
            const id = crypto.randomUUID();
            store.setData((d) => ({
              ...d,
              workspaces: [
                ...d.workspaces,
                {
                  id,
                  name: values.name,
                  slug: "demo",
                  logo_url: null,
                  created_by: data.profile.id,
                },
              ],
              members: [
                ...d.members,
                {
                  workspace_id: id,
                  user_id: data.profile.id,
                  role: "owner",
                  profile: data.profile,
                },
              ],
            }));
            setWorkspaceId(id);
          } else {
            const result = await browserClient().rpc("create_workspace", {
              workspace_name: values.name,
            });
            check(result);
            setWorkspaceId(result.data);
          }
        } else {
          if (demo)
            throw new Error(
              "Invitations connect real accounts. Sign up to join a live workspace.",
            );
          const token = name.includes("token=")
            ? new URL(name).searchParams.get("token")
            : name;
          const result = await browserClient().rpc("accept_invite", { token });
          check(result);
          setWorkspaceId(result.data);
        }
      },
      modal === "join" ? "You joined the workspace" : "Created successfully",
    );
    setSaving(false);
    if (ok) {
      setModal(null);
      setName("");
      setDescription("");
      setView("chat");
    }
  }
  function openModal(type: typeof modal) {
    setName("");
    setDescription("");
    setModal(type);
  }
  const sidebar = (
    <>
      <Link href="/" className="sidebar-brand">
        <Brand />
      </Link>
      <div className="workspace-switch">
        {workspace?.logo_url ? (
          <Avatar name={workspace.name} url={workspace.logo_url} small />
        ) : (
          <span className="workspace-logo">
            {workspace?.name.slice(0, 1) || "S"}
          </span>
        )}

        <select
          aria-label="Workspace"
          value={workspaceId}
          onChange={(e) => {
            setWorkspaceId(e.target.value);
            setChannelId("");
          }}
        >
          {data.workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
          {!workspace && <option value="">Your workspace</option>}
        </select>
        <ChevronDown size={14} />
      </div>
      <button className="sidebar-search" onClick={() => navigate("search")}>
        <Search size={16} />
        <span>Search anything</span>
      </button>
      <nav className="main-nav">
        {(
          [
            { id: "home", label: "Overview", icon: Home },
            { id: "notifications", label: "Inbox", icon: Bell },
            { id: "tasks", label: "Tasks", icon: LayoutGrid },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            className={view === item.id ? "selected" : ""}
            onClick={() => navigate(item.id)}
          >
            <item.icon size={18} />
            {item.label}
            {item.id === "notifications" && unread > 0 && (
              <span className="nav-badge">{unread}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="nav-section-title">
        WORKSPACE CHANNELS
        <button
          className="icon-button"
          aria-label="Create channel"
          disabled={!workspace}
          onClick={() => openModal("channel")}
        >
          <Plus size={16} />
        </button>
      </div>
      <nav className="channel-nav">
        {channels.map((c) => (
          <button
            className={view === "chat" && c.id === channelId ? "selected" : ""}
            key={c.id}
            onClick={() => {
              setChannelId(c.id);
              navigate("chat");
            }}
          >
            <Hash size={18} />
            {c.name}
          </button>
        ))}
        {channels.length === 0 && (
          <p className="sidebar-hint">Your conversations start here.</p>
        )}
      </nav>
      <button
        className="add-channel"
        disabled={!workspace}
        onClick={() => openModal("channel")}
      >
        <Plus size={16} /> Add a channel
      </button>
      <div className="sidebar-bottom">
        <div className="workspace-actions">
          <button onClick={() => openModal("workspace")}>
            <Plus size={15} /> New workspace
          </button>
          <button onClick={() => openModal("join")}>
            <Users size={15} /> Join workspace
          </button>
        </div>
        <button
          className={`settings-link ${view === "settings" ? "selected" : ""}`}
          onClick={() => navigate("settings")}
        >
          <Settings size={18} /> Settings
        </button>
        <div className="user-footer">
          <Avatar
            name={data.profile.full_name}
            url={data.profile.avatar_url}
            online
          />
          <button onClick={() => navigate("settings")}>
            <strong>{data.profile.full_name}</strong>
            <span>{data.profile.status}</span>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </>
  );
  return (
    <div className="app-root">
      {demo && (
        <div className="demo-banner">
          <span>
            <b>DEMO WORKSPACE</b> Explore freely. Changes last for this visit.
          </span>
          <div>
            <button onClick={store.resetDemo}>
              <RotateCcw size={13} /> Reset
            </button>
            <Link href="/auth/signup">
              Create your workspace <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      )}
      <div className="app-layout">
        <aside className="sidebar">{sidebar}</aside>
        <Primitive.Root open={mobile} onOpenChange={setMobile}>
          <Primitive.Portal>
            <Primitive.Overlay className="dialog-overlay" />
            <Primitive.Content className="mobile-sidebar">
              <Primitive.Title className="sr-only">
                Workspace navigation
              </Primitive.Title>
              <Primitive.Description className="sr-only">
                Switch between channels and workspace tools.
              </Primitive.Description>
              <Primitive.Close
                className="mobile-close icon-button"
                aria-label="Close navigation"
              >
                <X size={18} />
              </Primitive.Close>
              {sidebar}
            </Primitive.Content>
          </Primitive.Portal>
        </Primitive.Root>
        <main className="workspace-main">
          <header className="topbar">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              {workspace?.name || "Welcome"}
              <span>/</span>
              <b>
                {view === "chat"
                  ? "Channels"
                  : view === "home"
                    ? "Overview"
                    : view === "notifications"
                      ? "Inbox"
                      : view.charAt(0).toUpperCase() + view.slice(1)}
              </b>
            </div>
            <div className="topbar-actions">
              <span className="workspace-private">
                Your team’s shared space
              </span>
              <button
                className="icon-button"
                aria-label="Search workspace"
                onClick={() => navigate("search")}
              >
                <Search size={18} />
              </button>
              <button
                className="icon-button notification-button"
                aria-label={`${unread} unread notifications`}
                onClick={() => navigate("notifications")}
              >
                <Bell size={18} />
                {unread > 0 && <i />}
              </button>
              {!demo && (
                <button
                  className="icon-button"
                  aria-label="Log out"
                  onClick={() =>
                    void run(async () => {
                      check(await browserClient().auth.signOut());
                      router.replace("/auth/login");
                      router.refresh();
                    })
                  }
                >
                  <LogOut size={17} />
                </button>
              )}
            </div>
          </header>
          {store.error && (
            <div className="error-banner" role="alert">
              {store.error}
              <button onClick={() => void store.refresh()}>Retry</button>
            </div>
          )}
          {!workspace ? (
            <div className="onboarding">
              <div className="onboarding-mark">
                <Brand compact />
              </div>
              <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
              <h1>A space to work together.</h1>
              <p>
                Create a workspace for your team, or join one with an
                invitation.
              </p>
              <div className="row">
                <Button onClick={() => openModal("workspace")}>
                  Create a workspace
                </Button>
                <Button variant="secondary" onClick={() => openModal("join")}>
                  Join a workspace
                </Button>
              </div>
            </div>
          ) : store.loading ? (
            <div className="workspace-loading">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : view === "chat" ? (
            <Chat key={channelId} store={store} demo={demo} channel={channel} />
          ) : view === "tasks" ? (
            <TaskBoard store={store} demo={demo} />
          ) : view === "settings" ? (
            <SettingsPanel store={store} demo={demo} />
          ) : view === "search" ? (
            <SearchPanel
              store={store}
              demo={demo}
              onChannel={(id) => {
                setChannelId(id);
                setView("chat");
              }}
            />
          ) : view === "home" ? (
            <Overview
              store={store}
              onTasks={() => setView("tasks")}
              onChannel={(id) => {
                setChannelId(id);
                setView("chat");
              }}
            />
          ) : (
            <section className="page-content">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">STAY IN THE LOOP</span>
                  <h1>Your inbox</h1>
                  <p>Updates that need your attention.</p>
                </div>
                <Button
                  variant="secondary"
                  disabled={!unread}
                  onClick={() =>
                    void run(async () => {
                      if (demo)
                        store.setData((d) => ({
                          ...d,
                          notifications: d.notifications.map((n) => ({
                            ...n,
                            read_at: new Date().toISOString(),
                          })),
                        }));
                      else
                        check(
                          await browserClient()
                            .from("notifications")
                            .update({ read_at: new Date().toISOString() })
                            .eq("workspace_id", workspaceId)
                            .is("read_at", null),
                        );
                    })
                  }
                >
                  Mark all as read
                </Button>
              </div>
              {data.notifications.length ? (
                data.notifications.map((n) => (
                  <button
                    key={n.id}
                    className={`notification-row ${!n.read_at ? "unread" : ""}`}
                    onClick={() =>
                      void run(async () => {
                        if (demo)
                          store.setData((d) => ({
                            ...d,
                            notifications: d.notifications.map((x) =>
                              x.id === n.id
                                ? { ...x, read_at: new Date().toISOString() }
                                : x,
                            ),
                          }));
                        else
                          check(
                            await browserClient()
                              .from("notifications")
                              .update({ read_at: new Date().toISOString() })
                              .eq("id", n.id),
                          );
                        if (n.message_id) {
                          let cid = data.messages.find(
                            (m) => m.id === n.message_id,
                          )?.channel_id;
                          if (!cid && !demo) {
                            const r = await browserClient()
                              .from("messages")
                              .select("channel_id")
                              .eq("id", n.message_id)
                              .single();
                            check(r);
                            cid = r.data?.channel_id;
                          }
                          if (cid) {
                            setChannelId(cid);
                            setView("chat");
                          }
                        } else setView("tasks");
                      })
                    }
                  >
                    <span className="notice-icon">
                      <Bell size={18} />
                    </span>
                    <span>
                      <strong>{n.title}</strong>
                      <small>
                        {new Date(n.created_at).toLocaleDateString()}
                      </small>
                    </span>
                    {!n.read_at && <i />}
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  <Bell size={30} />
                  <h3>You’re all caught up</h3>
                  <p>
                    Mentions, replies, and task assignments will appear here.
                  </p>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
      <Dialog
        open={modal !== null}
        onOpenChange={(o) => !o && setModal(null)}
        title={
          modal === "channel"
            ? "Create a channel"
            : modal === "join"
              ? "Join a workspace"
              : "Create your workspace"
        }
        description={
          modal === "join"
            ? "Paste the invitation link or token you received."
            : "Give your team a place to start."
        }
      >
        <form className="form-stack" onSubmit={create}>
          <label>
            {modal === "join"
              ? "Invitation link or token"
              : modal === "channel"
                ? "Channel name"
                : "Workspace name"}
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                modal === "channel"
                  ? "e.g. product-design"
                  : modal === "workspace"
                    ? "e.g. Studio North"
                    : "Paste invitation"
              }
            />
          </label>
          {modal === "channel" && (
            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What’s this channel for?"
              />
            </label>
          )}
          <Button disabled={saving}>
            {saving
              ? "Saving…"
              : modal === "join"
                ? "Join workspace"
                : "Create"}
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
