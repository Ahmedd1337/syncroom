-- Apply once to a fresh Supabase project.
create extension if not exists pgcrypto with schema extensions;
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 full_name text not null check (char_length(full_name) between 1 and 80),
 username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
 avatar_url text, job_title text not null default '' check (char_length(job_title)<=80),
 bio text not null default '' check (char_length(bio)<=300),
 status text not null default 'Available' check (status in ('Available','Busy','Away','In a meeting')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.workspaces (
 id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 2 and 60),
 slug text not null unique, logo_url text, created_by uuid not null references public.profiles,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.workspace_members (
 workspace_id uuid not null references public.workspaces on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 role text not null default 'member' check (role in ('owner','admin','member')),
 created_at timestamptz not null default now(), primary key (workspace_id,user_id)
);
create index members_user_idx on public.workspace_members(user_id);
create unique index one_owner_idx on public.workspace_members(workspace_id) where role='owner';
create table public.channels (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces on delete cascade,
 name text not null check(name ~ '^[a-z0-9][a-z0-9-]{1,39}$'), description text not null default '' check(char_length(description)<=200),
 visibility text not null default 'public' check (visibility='public'),
 created_by uuid not null references public.profiles, created_at timestamptz not null default now(), unique(workspace_id,name)
);
create table public.messages (
 id uuid primary key default gen_random_uuid(), channel_id uuid not null references public.channels on delete cascade,
 user_id uuid not null references public.profiles, body text not null check(char_length(body) between 1 and 8000),
 reply_to uuid references public.messages on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index messages_history_idx on public.messages(channel_id,created_at desc,id);
create index messages_reply_idx on public.messages(reply_to);
create index messages_search_idx on public.messages using gin(to_tsvector('english',body));
create table public.message_reactions (
 message_id uuid not null references public.messages on delete cascade, user_id uuid not null references public.profiles on delete cascade,
 emoji text not null check(emoji in ('👍','❤️','😂','🎉','👀','🚀')), primary key(message_id,user_id,emoji)
);
create table public.message_attachments (
 id uuid primary key default gen_random_uuid(), message_id uuid not null references public.messages on delete cascade,
 path text not null unique, name text not null check(char_length(name)<=255), mime_type text not null,
 size integer not null check(size between 1 and 10485760), created_at timestamptz not null default now()
);
create index attachments_message_idx on public.message_attachments(message_id);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces on delete cascade,
 title text not null check(char_length(title) between 2 and 160), description text not null default '' check(char_length(description)<=3000),
 status text not null default 'backlog' check(status in ('backlog','todo','progress','review','done')),
 priority text not null default 'medium' check(priority in ('low','medium','high','urgent')),
 assignee_id uuid references public.profiles on delete set null, created_by uuid not null references public.profiles,
 due_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index tasks_workspace_idx on public.tasks(workspace_id,status);
create index tasks_assignee_idx on public.tasks(assignee_id);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
 workspace_id uuid not null references public.workspaces on delete cascade, title text not null,
 message_id uuid references public.messages on delete cascade, read_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_inbox_idx on public.notifications(user_id,created_at desc);
create table public.workspace_invites (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces on delete cascade,
 token_hash text not null unique, created_by uuid not null references public.profiles,
 expires_at timestamptz not null default now()+interval '7 days', used_at timestamptz, created_at timestamptz not null default now()
);

create function public.is_member(wid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspace_members where workspace_id=wid and user_id=auth.uid());
$$;
create function public.is_admin(wid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspace_members where workspace_id=wid and user_id=auth.uid() and role in ('owner','admin'));
$$;
create function public.is_owner(wid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspace_members where workspace_id=wid and user_id=auth.uid() and role='owner');
$$;
create function public.channel_member(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.channels where id=cid and public.is_member(workspace_id));
$$;
create function public.message_member(mid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.messages where id=mid and public.channel_member(channel_id));
$$;
create function public.share_workspace(uid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspace_members a join public.workspace_members b using(workspace_id) where a.user_id=auth.uid() and b.user_id=uid)
 or exists(select 1 from public.messages m join public.channels c on c.id=m.channel_id where m.user_id=uid and public.is_member(c.workspace_id))
 or exists(select 1 from public.tasks t where t.created_by=uid and public.is_member(t.workspace_id));
$$;
create function public.cleanup_membership() returns trigger language plpgsql security definer set search_path='' as $$
 begin update public.tasks set assignee_id=null where workspace_id=old.workspace_id and assignee_id=old.user_id; return old; end;
$$;
create trigger member_removed after delete on public.workspace_members for each row execute function public.cleanup_membership();
create function public.handle_signup() returns trigger language plpgsql security definer set search_path='' as $$
 begin insert into public.profiles(id,full_name,username) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'full_name',''),'New member'),80),'u_'||left(md5(new.id::text),28)); return new; end;
$$;
create trigger on_signup after insert on auth.users for each row execute function public.handle_signup();
create function public.touch_updated() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
create trigger profile_updated before update on public.profiles for each row execute function public.touch_updated();
create trigger workspace_updated before update on public.workspaces for each row execute function public.touch_updated();
create trigger message_updated before update on public.messages for each row execute function public.touch_updated();
create trigger task_updated before update on public.tasks for each row execute function public.touch_updated();

create function public.create_workspace(workspace_name text) returns uuid language plpgsql security definer set search_path='' as $$
 declare wid uuid; begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 insert into public.workspaces(name,slug,created_by) values(trim(workspace_name),trim(both '-' from regexp_replace(lower(trim(workspace_name)),'[^a-z0-9]+','-','g'))||'-'||substr(gen_random_uuid()::text,1,8),auth.uid()) returning id into wid;
 insert into public.workspace_members(workspace_id,user_id,role) values(wid,auth.uid(),'owner');
 insert into public.channels(workspace_id,name,description,created_by) values(wid,'general','A place for the whole team.',auth.uid());
 return wid; end;
$$;
create function public.create_invite(wid uuid) returns text language plpgsql security definer set search_path='' as $$
 declare token text; begin
 if not public.is_admin(wid) then raise exception 'Only workspace admins can invite members'; end if;
 token=encode(extensions.gen_random_bytes(24),'hex');
 insert into public.workspace_invites(workspace_id,token_hash,created_by) values(wid,encode(extensions.digest(token,'sha256'),'hex'),auth.uid());
 return token; end;
$$;
create function public.accept_invite(token text) returns uuid language plpgsql security definer set search_path='' as $$
 declare invitation public.workspace_invites; begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into invitation from public.workspace_invites where token_hash=encode(extensions.digest(token,'sha256'),'hex') and used_at is null and expires_at>now() for update;
 if invitation.id is null then raise exception 'Invitation is invalid, used or expired'; end if;
 insert into public.workspace_members(workspace_id,user_id) values(invitation.workspace_id,auth.uid()) on conflict do nothing;
 update public.workspace_invites set used_at=now() where id=invitation.id;
 return invitation.workspace_id; end;
$$;
create function public.validate_message() returns trigger language plpgsql security definer set search_path='' as $$
 begin if new.reply_to is not null and not exists(select 1 from public.messages where id=new.reply_to and channel_id=new.channel_id) then raise exception 'Reply must belong to the same channel'; end if; return new; end;
$$;
create trigger message_validate before insert on public.messages for each row execute function public.validate_message();
create function public.validate_task() returns trigger language plpgsql security definer set search_path='' as $$
 begin if new.assignee_id is not null and not exists(select 1 from public.workspace_members where workspace_id=new.workspace_id and user_id=new.assignee_id) then raise exception 'Assignee must belong to the workspace'; end if; return new; end;
$$;
create trigger task_validate before insert or update on public.tasks for each row execute function public.validate_task();
create function public.notify_message() returns trigger language plpgsql security definer set search_path='' as $$
 declare wid uuid; begin
 select workspace_id into wid from public.channels where id=new.channel_id;
 insert into public.notifications(user_id,workspace_id,title,message_id)
 select p.id,wid,case when p.id=r.user_id then 'You received a reply' else 'You were mentioned in a message' end,new.id
 from public.workspace_members wm join public.profiles p on p.id=wm.user_id
 left join public.messages r on r.id=new.reply_to
 where wm.workspace_id=wid and p.id<>new.user_id and (p.id=r.user_id or new.body ~ ('(^|[^a-zA-Z0-9_])@'||p.username||'([^a-zA-Z0-9_]|$)'));
 return new; end;
$$;
create trigger message_notify after insert on public.messages for each row execute function public.notify_message();
create function public.notify_task() returns trigger language plpgsql security definer set search_path='' as $$
 begin if new.assignee_id is not null and new.assignee_id<>auth.uid() and (tg_op='INSERT' or new.assignee_id is distinct from old.assignee_id) then
 insert into public.notifications(user_id,workspace_id,title) values(new.assignee_id,new.workspace_id,'Assigned to you: '||new.title); end if; return new; end;
$$;
create trigger task_notify after insert or update on public.tasks for each row execute function public.notify_task();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_attachments enable row level security;
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.workspace_invites enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.share_workspace(id));
create policy profiles_edit on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy workspaces_read on public.workspaces for select to authenticated using(public.is_member(id));
create policy workspaces_edit on public.workspaces for update to authenticated using(public.is_admin(id)) with check(public.is_admin(id));
create policy members_read on public.workspace_members for select to authenticated using(public.is_member(workspace_id));
create policy members_role on public.workspace_members for update to authenticated using(public.is_owner(workspace_id) and role<>'owner') with check(public.is_owner(workspace_id) and role<>'owner');
create policy members_remove on public.workspace_members for delete to authenticated using(role<>'owner' and (user_id=auth.uid() or public.is_owner(workspace_id) or (public.is_admin(workspace_id) and role='member')));
create policy channels_read on public.channels for select to authenticated using(public.is_member(workspace_id));
create policy channels_create on public.channels for insert to authenticated with check(public.is_member(workspace_id) and created_by=auth.uid());
create policy channels_edit on public.channels for update to authenticated using(public.is_admin(workspace_id)) with check(public.is_admin(workspace_id));
create policy channels_delete on public.channels for delete to authenticated using(public.is_admin(workspace_id));
create policy messages_read on public.messages for select to authenticated using(public.channel_member(channel_id));
create policy messages_create on public.messages for insert to authenticated with check(public.channel_member(channel_id) and user_id=auth.uid());
create policy messages_edit on public.messages for update to authenticated using(user_id=auth.uid() and public.channel_member(channel_id)) with check(user_id=auth.uid() and public.channel_member(channel_id));
create policy messages_delete on public.messages for delete to authenticated using(public.channel_member(channel_id) and (user_id=auth.uid() or exists(select 1 from public.channels where id=channel_id and public.is_admin(workspace_id))));
create policy reactions_read on public.message_reactions for select to authenticated using(public.message_member(message_id));
create policy reactions_create on public.message_reactions for insert to authenticated with check(user_id=auth.uid() and public.message_member(message_id));
create policy reactions_delete on public.message_reactions for delete to authenticated using(user_id=auth.uid() and public.message_member(message_id));
create policy attachments_read on public.message_attachments for select to authenticated using(public.message_member(message_id));
create policy attachments_create on public.message_attachments for insert to authenticated with check(exists(select 1 from public.messages m join public.channels c on c.id=m.channel_id where m.id=message_id and m.user_id=auth.uid() and public.is_member(c.workspace_id) and split_part(path,'/',1)=c.workspace_id::text and split_part(path,'/',2)=auth.uid()::text) and exists(select 1 from storage.objects o where o.bucket_id='workspace-files' and o.name=path and o.owner_id=auth.uid()::text));
create policy tasks_read on public.tasks for select to authenticated using(public.is_member(workspace_id));
create policy tasks_create on public.tasks for insert to authenticated with check(public.is_member(workspace_id) and created_by=auth.uid());
create policy tasks_edit on public.tasks for update to authenticated using(public.is_member(workspace_id)) with check(public.is_member(workspace_id));
create policy tasks_delete on public.tasks for delete to authenticated using(public.is_member(workspace_id) and (created_by=auth.uid() or public.is_admin(workspace_id)));
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid() and public.is_member(workspace_id));
create policy notifications_edit on public.notifications for update to authenticated using(user_id=auth.uid() and public.is_member(workspace_id)) with check(user_id=auth.uid());

-- Column grants prevent moving records between workspaces or impersonating authors.
revoke all on public.profiles,public.workspaces,public.workspace_members,public.channels,public.messages,public.message_reactions,public.message_attachments,public.tasks,public.notifications,public.workspace_invites from anon,authenticated;
grant select on public.profiles,public.workspaces,public.workspace_members,public.channels,public.messages,public.message_reactions,public.message_attachments,public.tasks,public.notifications to authenticated;
grant update(full_name,username,avatar_url,job_title,bio,status) on public.profiles to authenticated;
grant update(name,logo_url) on public.workspaces to authenticated;
grant update(role),delete on public.workspace_members to authenticated;
grant insert,delete on public.channels,public.messages,public.message_reactions,public.tasks to authenticated;
grant insert on public.message_attachments to authenticated;
grant update(name,description) on public.channels to authenticated;
grant update(body) on public.messages to authenticated;
grant update(title,description,status,priority,assignee_id,due_date) on public.tasks to authenticated;
grant update(read_at) on public.notifications to authenticated;
revoke execute on all functions in schema public from public,anon;
grant execute on function public.is_member(uuid),public.is_admin(uuid),public.is_owner(uuid),public.channel_member(uuid),public.message_member(uuid),public.share_workspace(uuid),public.create_workspace(text),public.create_invite(uuid),public.accept_invite(text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('workspace-files','workspace-files',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
create policy files_read on storage.objects for select to authenticated using(bucket_id='workspace-files' and exists(select 1 from public.workspace_members where workspace_id::text=split_part(name,'/',1) and user_id=auth.uid()));
create policy files_upload on storage.objects for insert to authenticated with check(bucket_id='workspace-files' and split_part(name,'/',2)=auth.uid()::text and exists(select 1 from public.workspace_members where workspace_id::text=split_part(name,'/',1) and user_id=auth.uid()));
create policy files_delete on storage.objects for delete to authenticated using(bucket_id='workspace-files' and owner_id=auth.uid()::text and exists(select 1 from public.workspace_members where workspace_id::text=split_part(name,'/',1) and user_id=auth.uid()));

-- Private presence/broadcast topics are scoped to an authenticated workspace member.
create policy realtime_read on realtime.messages for select to authenticated using(exists(select 1 from public.workspace_members where user_id=auth.uid() and realtime.topic()='workspace:'||workspace_id::text));
create policy realtime_write on realtime.messages for insert to authenticated with check(exists(select 1 from public.workspace_members where user_id=auth.uid() and realtime.topic()='workspace:'||workspace_id::text));
alter publication supabase_realtime add table public.messages,public.message_reactions,public.message_attachments,public.tasks,public.notifications,public.channels,public.workspace_members,public.profiles,public.workspaces;
