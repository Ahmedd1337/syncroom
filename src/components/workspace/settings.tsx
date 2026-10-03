"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs } from "radix-ui";
import { Copy, UserPlus, LogOut, Upload } from "lucide-react";
import { toast } from "sonner";
import { check, type WorkspaceStore } from "@/hooks/use-workspace";
import { browserClient } from "@/lib/supabase/client";
import { profileSchema, workspaceSchema, validateFile } from "@/lib/validation";
import { canManage } from "@/lib/utils";
import { Avatar, ThemeToggle } from "../shared";
import { Button } from "../ui/button";
import { Confirm } from "../ui/confirm";
export function SettingsPanel({
  store,
  demo,
}: {
  store: WorkspaceStore;
  demo: boolean;
}) {
  const { data, workspaceId, run } = store;
  const workspace = data.workspaces.find((w) => w.id === workspaceId)!;
  const members = data.members.filter((m) => m.workspace_id === workspaceId);
  const role = members.find((m) => m.user_id === data.profile.id)?.role;
  const admin = canManage(role);
  const [name, setName] = useState(workspace.name);
  const [invite, setInvite] = useState("");
  const [inviting, setInviting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: data.profile,
  });
  async function save(values: z.infer<typeof profileSchema>) {
    await run(async () => {
      if (demo)
        store.setData((d) => ({
          ...d,
          profile: { ...d.profile, ...values },
          members: d.members.map((m) =>
            m.user_id === data.profile.id
              ? { ...m, profile: { ...m.profile, ...values } }
              : m,
          ),
        }));
      else
        check(
          await browserClient()
            .from("profiles")
            .update(values)
            .eq("id", data.profile.id),
        );
    }, "Profile updated");
  }
  async function upload(file: File, target: "profile" | "workspace") {
    await run(async () => {
      validateFile(file);
      if (!file.type.startsWith("image/"))
        throw new Error("Choose a JPG, PNG or WebP image.");
      if (demo) {
        const url = URL.createObjectURL(file);
        if (target === "profile")
          store.setData((d) => ({
            ...d,
            profile: { ...d.profile, avatar_url: url },
          }));
        else
          store.setData((d) => ({
            ...d,
            workspaces: d.workspaces.map((w) =>
              w.id === workspaceId ? { ...w, logo_url: url } : w,
            ),
          }));
        return;
      }
      const path = `${workspaceId}/${data.profile.id}/${crypto.randomUUID()}`;
      check(
        await browserClient()
          .storage.from("workspace-files")
          .upload(path, file),
      );
      const result =
        target === "profile"
          ? await browserClient()
              .from("profiles")
              .update({ avatar_url: path })
              .eq("id", data.profile.id)
          : await browserClient()
              .from("workspaces")
              .update({ logo_url: path })
              .eq("id", workspaceId);
      if (result.error)
        await browserClient().storage.from("workspace-files").remove([path]);
      check(result);
    }, "Image updated");
  }
  return (
    <section className="page-content settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h1>Settings</h1>
          <p>Your profile, your preferences, your shared space.</p>
        </div>
      </div>
      <Tabs.Root defaultValue="profile">
        <Tabs.List className="settings-tabs" aria-label="Settings categories">
          {[
            "profile",
            "appearance",
            "workspace",
            "members",
            "notifications",
          ].map((tab) => (
            <Tabs.Trigger key={tab} value={tab}>
              {tab}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="profile" className="settings-body">
          <h2>Your profile</h2>
          <p className="muted">Help your teammates put a face to the name.</p>
          <div className="profile-avatar">
            <Avatar
              name={data.profile.full_name}
              url={data.profile.avatar_url}
            />
            <label className="btn btn-secondary btn-sm">
              <Upload size={14} /> Upload avatar
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  if (e.target.files?.[0])
                    void upload(e.target.files[0], "profile");
                }}
              />
            </label>
          </div>
          <form className="form-stack" onSubmit={handleSubmit(save)}>
            <div className="form-grid">
              <label>
                Full name
                <input {...register("full_name")} />
                <small className="field-error">
                  {errors.full_name?.message}
                </small>
              </label>
              <label>
                Username
                <input {...register("username")} />
                <small className="field-error">
                  {errors.username?.message}
                </small>
              </label>
              <label>
                Job title
                <input {...register("job_title")} />
                <small className="field-error">
                  {errors.job_title?.message}
                </small>
              </label>
              <label>
                Status
                <select {...register("status")}>
                  {["Available", "Busy", "Away", "In a meeting"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Bio
              <textarea
                {...register("bio")}
                placeholder="A little about you and your work."
              />
              <small className="field-error">{errors.bio?.message}</small>
            </label>
            <Button disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </Tabs.Content>
        <Tabs.Content value="appearance" className="settings-body">
          <h2>Set the mood.</h2>
          <p className="muted">
            Switch between light and dark. Your preference is saved on this
            device.
          </p>
          <div className="setting-row">
            <span>
              <b>Color theme</b>
              <small>A comfortable space, day or night.</small>
            </span>
            <ThemeToggle />
          </div>
        </Tabs.Content>
        <Tabs.Content value="workspace" className="settings-body">
          <h2>Workspace details</h2>
          <p className="muted">
            {admin
              ? "Manage the space your team shares."
              : "Only owners and admins can edit these details."}
          </p>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              await run(async () => {
                const values = workspaceSchema.parse({ name });
                if (demo)
                  store.setData((d) => ({
                    ...d,
                    workspaces: d.workspaces.map((w) =>
                      w.id === workspaceId ? { ...w, name: values.name } : w,
                    ),
                  }));
                else
                  check(
                    await browserClient()
                      .from("workspaces")
                      .update(values)
                      .eq("id", workspaceId),
                  );
              }, "Workspace updated");
            }}
          >
            <label>
              Workspace name
              <input
                disabled={!admin}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Workspace slug
              <input disabled value={workspace.slug} />
            </label>
            {admin && (
              <>
                <label className="btn btn-secondary">
                  <Upload size={15} /> Upload workspace logo
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      if (e.target.files?.[0])
                        void upload(e.target.files[0], "workspace");
                    }}
                  />
                </label>
                <Button>Save workspace</Button>
              </>
            )}
          </form>
          <div className="danger-zone">
            {role === "owner" ? (
              <p className="muted">
                Workspace owners cannot leave their workspace. Ownership
                transfer is not available yet.
              </p>
            ) : (
              <Confirm
                title="Leave this workspace?"
                onConfirm={() =>
                  void run(async () => {
                    if (demo) {
                      store.setData((d) => ({
                        ...d,
                        workspaces: d.workspaces.filter(
                          (w) => w.id !== workspaceId,
                        ),
                      }));
                      store.setWorkspaceId("");
                    } else {
                      check(
                        await browserClient()
                          .from("workspace_members")
                          .delete()
                          .match({
                            workspace_id: workspaceId,
                            user_id: data.profile.id,
                          }),
                      );
                      location.reload();
                    }
                  })
                }
              >
                <Button variant="destructive">
                  <LogOut size={15} /> Leave workspace
                </Button>
              </Confirm>
            )}
          </div>
        </Tabs.Content>
        <Tabs.Content
          value="members"
          className="settings-body members-settings"
        >
          <div className="panel-header">
            <h2>People in your workspace</h2>
            {admin && (
              <Button
                disabled={inviting}
                size="sm"
                onClick={async () => {
                  setInviting(true);
                  await run(async () => {
                    if (demo)
                      throw new Error(
                        "Create a live workspace to generate invitation links.",
                      );
                    const result = await browserClient().rpc("create_invite", {
                      wid: workspaceId,
                    });
                    check(result);
                    setInvite(`${location.origin}/invite?token=${result.data}`);
                  });
                  setInviting(false);
                }}
              >
                <UserPlus size={15} />{" "}
                {inviting ? "Creating…" : "Invite member"}
              </Button>
            )}
          </div>
          {invite && (
            <div className="invite-box">
              <p>Single-use link · expires in 7 days</p>
              <div className="row">
                <input readOnly value={invite} aria-label="Invitation link" />
                <Button
                  size="icon"
                  aria-label="Copy invitation"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(invite)
                      .then(() => toast.success("Invitation copied"))
                      .catch(() =>
                        toast.error("Select and copy the link manually."),
                      )
                  }
                >
                  <Copy size={16} />
                </Button>
              </div>
            </div>
          )}
          {members.map((m) => (
            <div className="member-row" key={m.user_id}>
              <Avatar name={m.profile.full_name} url={m.profile.avatar_url} />
              <span>
                <b>{m.profile.full_name}</b>
                <small>@{m.profile.username}</small>
              </span>
              {role === "owner" && m.role !== "owner" ? (
                <select
                  aria-label={`Role for ${m.profile.full_name}`}
                  value={m.role}
                  onChange={(e) => {
                    const next = e.target.value as "admin" | "member";
                    void run(async () => {
                      if (demo)
                        store.setData((d) => ({
                          ...d,
                          members: d.members.map((x) =>
                            x.user_id === m.user_id ? { ...x, role: next } : x,
                          ),
                        }));
                      else
                        check(
                          await browserClient()
                            .from("workspace_members")
                            .update({ role: next })
                            .match({
                              workspace_id: workspaceId,
                              user_id: m.user_id,
                            }),
                        );
                    }, "Role updated");
                  }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span className="role-badge">{m.role}</span>
              )}
              {admin &&
                m.role !== "owner" &&
                m.user_id !== data.profile.id &&
                (role === "owner" || m.role === "member") && (
                  <Confirm
                    title={`Remove ${m.profile.full_name} from this workspace?`}
                    onConfirm={() =>
                      void run(async () => {
                        if (demo)
                          store.setData((d) => ({
                            ...d,
                            members: d.members.filter(
                              (x) => x.user_id !== m.user_id,
                            ),
                          }));
                        else
                          check(
                            await browserClient()
                              .from("workspace_members")
                              .delete()
                              .match({
                                workspace_id: workspaceId,
                                user_id: m.user_id,
                              }),
                          );
                      }, "Member removed")
                    }
                  >
                    <Button variant="ghost" size="sm">
                      Remove
                    </Button>
                  </Confirm>
                )}
            </div>
          ))}
        </Tabs.Content>
        <Tabs.Content value="notifications" className="settings-body">
          <h2>Useful updates, less noise.</h2>
          <p className="muted">
            Your inbox includes mentions, replies to your messages, and tasks
            assigned to you. Read status syncs across your devices.
          </p>
          <div className="setting-row">
            <span>
              <b>In-app notifications</b>
              <small>Delivered to your workspace inbox.</small>
            </span>
            <span className="role-badge">Enabled</span>
          </div>
          <p className="muted">Email and push notifications are not enabled.</p>
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}
