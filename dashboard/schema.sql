-- Run once in your Supabase project's SQL editor.
create table public.company_workspaces (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null,
 version integer not null default 1 check (version > 0),
 updated_at timestamptz not null default now(),
 constraint company_data_object check (jsonb_typeof(data) = 'object'),
 constraint company_size_limit check (octet_length(data::text) <= 5000000)
);
alter table public.company_workspaces enable row level security;
revoke all on public.company_workspaces from anon;
grant select, insert, update, delete on public.company_workspaces to authenticated;
create policy "Owners read their workspace" on public.company_workspaces for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners create their workspace" on public.company_workspaces for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Owners update their workspace" on public.company_workspaces for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete their workspace" on public.company_workspaces for delete to authenticated using ((select auth.uid()) = owner_id);
create function public.touch_company_workspace() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
create trigger touch_company_workspace before update on public.company_workspaces for each row execute function public.touch_company_workspace();
