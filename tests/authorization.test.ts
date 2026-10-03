import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// The harness supplies Supabase-owned schemas. It does not simulate hosted Auth,
// Storage HTTP, or Realtime. Crypto shims exercise invitation flow, not entropy.
test("database policies isolate workspaces and enforce ownership", async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage; create schema realtime; create schema extensions;
 create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth,storage,realtime to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text); alter table storage.objects enable row level security; grant select,insert,delete on storage.objects to authenticated;
 create table realtime.messages(id uuid,topic text); alter table realtime.messages enable row level security; grant select,insert on realtime.messages to authenticated;
 create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic',true) $$;
 create function extensions.gen_random_bytes(n integer) returns bytea language sql as $$ select decode(repeat(md5(random()::text),2),'hex') $$;
 create function extensions.digest(t text,algo text) returns bytea language sql as $$ select decode(md5(t),'hex') $$;
 create publication supabase_realtime;`);
  const migration = (
    await readFile(
      new URL("../supabase/migrations/001_syncroom.sql", import.meta.url),
      "utf8",
    )
  ).replace(
    "create extension if not exists pgcrypto with schema extensions;",
    "",
  );
  await db.exec(migration);
  const owner = "00000000-0000-4000-8000-000000000001";
  const member = "00000000-0000-4000-8000-000000000002";
  const outsider = "00000000-0000-4000-8000-000000000003";
  await db.query(
    `insert into auth.users(id,raw_user_meta_data) values ($1,'{"full_name":"Owner"}'),($2,'{"full_name":"Member"}'),($3,'{"full_name":"Outsider"}')`,
    [owner, member, outsider],
  );
  async function asUser(id: string) {
    await db.exec("reset role");
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]);
    await db.exec("set role authenticated");
  }
  async function scalar(sql: string, args: unknown[] = []) {
    return (await db.query<Record<string, string>>(sql, args)).rows[0];
  }
  await asUser(owner);
  const wid = (
    await scalar(`select public.create_workspace('Alpha Team') as id`)
  ).id;
  const cid = (
    await scalar(`select id from public.channels where workspace_id=$1`, [wid])
  ).id;
  assert.equal(
    (await db.query("select * from public.workspaces")).rows.length,
    1,
  );
  const token = (
    await scalar("select public.create_invite($1) as token", [wid])
  ).token;
  await asUser(member);
  await db.query("select public.accept_invite($1)", [token]);
  assert.equal(
    (await db.query("select * from public.workspace_members")).rows.length,
    2,
  );
  await assert.rejects(
    db.query("select public.accept_invite($1)", [token]),
    /invalid, used or expired/,
  );
  assert.equal(
    (
      await db.query(
        `update public.workspace_members set role='admin' where user_id=$1 returning *`,
        [member],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        `update public.channels set name='hijacked' where id=$1 returning *`,
        [cid],
      )
    ).rows.length,
    0,
  );
  const mid = (
    await scalar(
      `insert into public.messages(channel_id,user_id,body) values ($1,$2,'Hello team') returning id`,
      [cid, member],
    )
  ).id;
  await assert.rejects(
    db.query(`update public.messages set user_id=$1 where id=$2`, [owner, mid]),
    /permission denied/,
  );
  await db.query(
    `insert into public.message_reactions(message_id,user_id,emoji) values($1,$2,'👍')`,
    [mid, member],
  );
  await assert.rejects(
    db.query(
      `insert into public.message_reactions(message_id,user_id,emoji) values($1,$2,'👍')`,
      [mid, member],
    ),
    /duplicate/,
  );
  await assert.rejects(
    db.query(
      `insert into public.tasks(workspace_id,title,created_by,assignee_id) values($1,'Secret assignment',$2,$3)`,
      [wid, member, outsider],
    ),
    /Assignee must belong/,
  );
  await asUser(outsider);
  assert.equal(
    (await db.query("select * from public.workspaces")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.messages")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.profiles")).rows.length,
    1,
  );
  await assert.rejects(
    db.query(
      `insert into public.messages(channel_id,user_id,body) values($1,$2,'Unauthorized')`,
      [cid, outsider],
    ),
    /row-level security/,
  );
  await assert.rejects(
    db.query(`select public.create_invite($1)`, [wid]),
    /Only workspace admins/,
  );
  const otherWid = (
    await scalar(`select public.create_workspace('Other Team') as id`)
  ).id;
  const otherCid = (
    await scalar("select id from public.channels where workspace_id=$1", [
      otherWid,
    ])
  ).id;
  await assert.rejects(
    db.query(
      `insert into public.messages(channel_id,user_id,body,reply_to) values($1,$2,'Cross workspace reply',$3)`,
      [otherCid, outsider, mid],
    ),
    /same channel/,
  );
  await asUser(owner);
  assert.equal(
    (
      await db.query(
        `update public.messages set body='Forged' where id=$1 returning *`,
        [mid],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        `delete from public.workspace_members where user_id=$1 returning *`,
        [owner],
      )
    ).rows.length,
    0,
  );
  await db.query(
    `update public.workspace_members set role='admin' where user_id=$1`,
    [member],
  );
  await asUser(member);
  assert.equal(
    (
      await db.query(
        `update public.channels set name='renamed' where id=$1 returning *`,
        [cid],
      )
    ).rows.length,
    1,
  );
  await assert.rejects(
    db.query(`update public.channels set workspace_id=$1 where id=$2`, [
      otherWid,
      cid,
    ]),
    /permission denied/,
  );
  await db.query(
    `insert into storage.objects(bucket_id,name,owner_id) values('workspace-files',$1,$2)`,
    [`${wid}/${member}/test.pdf`, member],
  );
  await assert.rejects(
    db.query(
      `insert into storage.objects(bucket_id,name,owner_id) values('workspace-files',$1,$2)`,
      [`${otherWid}/${member}/test.pdf`, member],
    ),
    /row-level security/,
  );
  await asUser(outsider);
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  await asUser(owner);
  await db.query(`update public.profiles set username='owner' where id=$1`, [
    owner,
  ]);
  await asUser(member);
  await db.query(
    `insert into public.messages(channel_id,user_id,body) values($1,$2,'Please review @owner')`,
    [cid, member],
  );
  assert.equal(
    (await db.query("select * from public.notifications")).rows.length,
    0,
  );
  await asUser(owner);
  assert.equal(
    (await db.query("select * from public.notifications")).rows.length,
    1,
  );
  await assert.rejects(
    db.query(
      `insert into public.notifications(user_id,workspace_id,title) values($1,$2,'Forged')`,
      [owner, wid],
    ),
    /permission denied/,
  );
  await db.query(
    `insert into public.tasks(workspace_id,title,created_by,assignee_id) values($1,'Assigned work',$2,$3)`,
    [wid, owner, member],
  );
  await asUser(member);
  assert.equal(
    (await db.query("select * from public.notifications")).rows.length,
    1,
  );
  await db.exec(
    `select set_config('realtime.topic','workspace:${otherWid}',false)`,
  );
  await assert.rejects(
    db.query(
      `insert into realtime.messages(id,topic) values(gen_random_uuid(),'test')`,
    ),
    /row-level security/,
  );
  await db.exec(`select set_config('realtime.topic','workspace:${wid}',false)`);
  await db.query(
    `insert into realtime.messages(id,topic) values(gen_random_uuid(),'test')`,
  );
  await asUser(owner);
  await db.query(`delete from public.workspace_members where user_id=$1`, [
    member,
  ]);
  assert.equal(
    (
      await scalar(
        `select count(*) as count from public.tasks where assignee_id=$1`,
        [member],
      )
    ).count,
    0,
  );
  assert.equal(
    (await db.query(`select * from public.profiles where id=$1`, [member])).rows
      .length,
    1,
  );
  await asUser(member);
  assert.equal(
    (await db.query("select * from public.messages")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  await db.close();
});
