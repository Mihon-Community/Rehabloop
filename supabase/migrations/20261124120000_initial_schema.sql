-- RehabLoop initial schema. Blueprint Section 12 / Appendix A5.
-- Apply with the Supabase MCP or `supabase db push`. Synthetic data only.
-- RLS is enabled on EVERY exposed table. Test the role matrix before real use.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Trusted role helpers (SECURITY DEFINER avoids RLS recursion).
-- Roles come from application-managed profile data set by the service role,
-- NOT from user-editable auth metadata.
-- ---------------------------------------------------------------------------
create or replace function public.is_clinician()
returns boolean
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  return exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('clinician','admin')
  );
end;
$$;

create or replace function public.clinician_link_active(p_patient uuid)
returns boolean
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  return exists (
    select 1 from public.clinician_patient_links l
    where l.clinician_id = (select auth.uid())
      and l.patient_id = p_patient
      and l.status = 'active'
  );
end;
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ---------------------------------------------------------------------------
-- Core entities
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('patient','clinician','admin')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinician_patient_links (
  clinician_id uuid not null references public.profiles(id),
  patient_id uuid not null references public.profiles(id),
  status text not null check (status in ('pending','active','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (clinician_id, patient_id)
);

create table public.exercise_protocols (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  clinician_id uuid not null references public.profiles(id),
  protocol_name text not null,
  version integer not null default 1,
  parameters jsonb not null,
  approved_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(patient_id, protocol_name, version)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  protocol_id uuid not null references public.exercise_protocols(id),
  status text not null check (status in
    ('draft','ready','active','paused','completed','aborted','review_required')),
  model_version text,
  mapping_version text,
  analytics_version text,
  started_at timestamptz,
  ended_at timestamptz,
  raw_video_stored boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_metrics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  metric_key text not null,
  numeric_value double precision,
  text_value text,
  unit text,
  quality jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(session_id, metric_key)
);

create table public.rep_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  rep_index integer not null,
  start_ms bigint,
  end_ms bigint,
  min_angle_deg double precision,
  max_angle_deg double precision,
  valid boolean not null,
  quality jsonb not null default '{}'::jsonb,
  unique(session_id, rep_index)
);

create table public.session_flags (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  flag_code text not null,
  severity text not null check (severity in ('info','warning','review')),
  details text,
  created_at timestamptz not null default now()
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  consent_version text not null,
  purpose text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  provider text not null,
  model_id text not null,
  schema_version text not null,
  body jsonb not null,
  validated boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  object_type text not null,
  object_id text,
  created_at timestamptz not null default now()
);

-- Indexes for the access paths used by RLS policies.
create index clinician_patient_links_patient_idx on public.clinician_patient_links(patient_id);
create index sessions_patient_idx on public.sessions(patient_id);
create index sessions_protocol_idx on public.sessions(protocol_id);
create index exercise_protocols_patient_idx on public.exercise_protocols(patient_id);
create index audit_events_actor_idx on public.audit_events(actor_id);

-- Updated-at triggers.
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger clinician_patient_links_updated_at before update on public.clinician_patient_links
  for each row execute function public.set_updated_at();
create trigger exercise_protocols_updated_at before update on public.exercise_protocols
  for each row execute function public.set_updated_at();
create trigger sessions_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();

-- A new user gets a PATIENT profile by default. Clinician rights are granted
-- deliberately via the service role, never inferred from user-editable metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (new.id, 'patient', nullif(new.raw_user_meta_data->>'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Protocol version enforcement: every change creates a new version.
create or replace function public.enforce_protocol_version()
returns trigger language plpgsql as $$
declare max_version integer;
begin
  select coalesce(max(version), 0) into max_version
  from public.exercise_protocols
  where patient_id = new.patient_id and protocol_name = new.protocol_name;
  if new.version <= max_version then
    raise exception 'protocol version must be greater than %', max_version;
  end if;
  return new;
end;
$$;

create trigger exercise_protocols_version_check before insert on public.exercise_protocols
  for each row execute function public.enforce_protocol_version();

-- ---------------------------------------------------------------------------
-- RLS: enabled on every exposed table.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clinician_patient_links enable row level security;
alter table public.exercise_protocols enable row level security;
alter table public.sessions enable row level security;
alter table public.session_metrics enable row level security;
alter table public.rep_events enable row level security;
alter table public.session_flags enable row level security;
alter table public.consent_records enable row level security;
alter table public.ai_summaries enable row level security;
alter table public.audit_events enable row level security;

-- Profiles: own row, or a linked patient's row for assigned clinicians.
create policy "profile self read" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "clinician reads linked patients" on public.profiles for select to authenticated
  using (
    role = 'patient'
    and exists (
      select 1 from public.clinician_patient_links l
      where l.clinician_id = (select auth.uid())
        and l.patient_id = profiles.id
        and l.status = 'active'
    )
  );
create policy "self updates display name only" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Links: visible to either party; only trusted clinicians create them.
create policy "link read own or clinician" on public.clinician_patient_links for select to authenticated
  using (clinician_id = (select auth.uid()) or patient_id = (select auth.uid()));
create policy "clinician creates links" on public.clinician_patient_links for insert to authenticated
  with check (public.is_clinician() and clinician_id = (select auth.uid()));
create policy "clinician revokes links" on public.clinician_patient_links for update to authenticated
  using (public.is_clinician() and clinician_id = (select auth.uid()));

-- Protocols: patients read their own; clinicians read/version assigned ones only.
create policy "patient reads own protocols" on public.exercise_protocols for select to authenticated
  using (patient_id = (select auth.uid()));
create policy "clinician reads linked protocols" on public.exercise_protocols for select to authenticated
  using (public.clinician_link_active(patient_id));
create policy "clinician creates protocols" on public.exercise_protocols for insert to authenticated
  with check (
    public.is_clinician()
    and clinician_id = (select auth.uid())
    and public.clinician_link_active(patient_id)
    and approved_at is not null
  );
create policy "clinician versions protocols" on public.exercise_protocols for update to authenticated
  using (public.is_clinician() and clinician_id = (select auth.uid()) and public.clinician_link_active(patient_id));

-- Sessions: owner or assigned clinician.
create policy "patient reads own sessions" on public.sessions for select to authenticated
  using (patient_id = (select auth.uid()));
create policy "assigned clinician reads linked sessions" on public.sessions for select to authenticated
  using (public.clinician_link_active(patient_id));
create policy "patient creates own session" on public.sessions for insert to authenticated
  with check (patient_id = (select auth.uid()));
create policy "clinician creates demo session" on public.sessions for insert to authenticated
  with check (public.is_clinician() and public.clinician_link_active(patient_id));
create policy "owner or clinician updates session" on public.sessions for update to authenticated
  using (patient_id = (select auth.uid()) or public.clinician_link_active(patient_id));

-- Derived tables: read through the parent session; writes are service-role only.
create policy "metrics read via session" on public.session_metrics for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id
    and (s.patient_id = (select auth.uid()) or public.clinician_link_active(s.patient_id))));
create policy "rep events read via session" on public.rep_events for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id
    and (s.patient_id = (select auth.uid()) or public.clinician_link_active(s.patient_id))));
create policy "flags read via session" on public.session_flags for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id
    and (s.patient_id = (select auth.uid()) or public.clinician_link_active(s.patient_id))));
create policy "summaries read via session" on public.ai_summaries for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id
    and (s.patient_id = (select auth.uid()) or public.clinician_link_active(s.patient_id))));

-- Consent: patient sees and grants own; clinician sees linked patients' records.
create policy "consent self read" on public.consent_records for select to authenticated
  using (patient_id = (select auth.uid()));
create policy "consent clinician read" on public.consent_records for select to authenticated
  using (public.clinician_link_active(patient_id));
create policy "consent self grant" on public.consent_records for insert to authenticated
  with check (patient_id = (select auth.uid()));
create policy "consent self revoke" on public.consent_records for update to authenticated
  using (patient_id = (select auth.uid()));

-- Audit events: readable by the actor or an assigned clinician; written by service role.
create policy "audit actor read" on public.audit_events for select to authenticated
  using (actor_id = (select auth.uid()) or public.is_clinician());

-- Privileges: authenticated clients get only what policies allow.
-- service_role bypasses RLS and is used by the backend only.
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles, public.clinician_patient_links,
  public.exercise_protocols, public.sessions, public.consent_records to authenticated;
grant select on public.session_metrics, public.rep_events, public.session_flags,
  public.ai_summaries, public.audit_events to authenticated;
revoke all on public.session_metrics, public.rep_events, public.session_flags,
  public.ai_summaries, public.audit_events from anon;
-- No raw video table exists by design (STORE_RAW_VIDEO=false).
