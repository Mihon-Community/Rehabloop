-- Backend authorization boundary fixes from the Section 12 read-only review.
-- The API uses the server-side service role for writes; authenticated clients
-- must not bypass its consent, protocol-version, or session-state checks.

drop policy if exists "clinician creates links" on public.clinician_patient_links;
drop policy if exists "clinician revokes links" on public.clinician_patient_links;

drop policy if exists "patient creates own session" on public.sessions;
drop policy if exists "clinician creates demo session" on public.sessions;
drop policy if exists "owner or clinician updates session" on public.sessions;

drop policy if exists "clinician creates protocols" on public.exercise_protocols;
drop policy if exists "clinician versions protocols" on public.exercise_protocols;

-- Supabase's existing default ACLs grant broad Data API privileges to all
-- three API roles. Remove those grants from the app tables, then add only the
-- operations the signed-in frontend still uses. RLS continues to scope rows.
revoke all on table public.profiles,
  public.clinician_patient_links,
  public.exercise_protocols,
  public.sessions,
  public.session_metrics,
  public.rep_events,
  public.session_flags,
  public.consent_records,
  public.ai_summaries,
  public.audit_events
 from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;

grant usage on schema public to authenticated;
grant select on table public.profiles,
  public.clinician_patient_links,
  public.exercise_protocols,
  public.sessions,
  public.session_metrics,
  public.rep_events,
  public.session_flags,
  public.consent_records,
  public.ai_summaries,
  public.audit_events
to authenticated;
grant insert on table public.consent_records to authenticated;
grant update (display_name) on table public.profiles to authenticated;

-- Future tables, routines, and sequences created by the migration owner must
-- opt into Data API access explicitly instead of inheriting broad grants.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

drop policy if exists "audit actor read" on public.audit_events;
create policy "audit actor or admin read" on public.audit_events for select to authenticated
  using (
    actor_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- Existing historical rows are not rewritten. New or changed rows can never
-- claim that raw video was retained.
alter table public.sessions
  add constraint sessions_raw_video_not_stored check (raw_video_stored = false) not valid;

create index if not exists session_metrics_session_id_idx
  on public.session_metrics(session_id);
create index if not exists rep_events_session_id_idx
  on public.rep_events(session_id);
