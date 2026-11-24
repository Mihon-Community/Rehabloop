-- Backend authorization boundary fixes from the Section 12 read-only review.
-- The API uses the server-side service role for writes; authenticated clients
-- must not bypass its consent, protocol-version, or session-state checks.

drop policy if exists "clinician creates links" on public.clinician_patient_links;
drop policy if exists "clinician revokes links" on public.clinician_patient_links;
revoke insert, update on public.clinician_patient_links from authenticated;

drop policy if exists "patient creates own session" on public.sessions;
drop policy if exists "clinician creates demo session" on public.sessions;
drop policy if exists "owner or clinician updates session" on public.sessions;
revoke insert, update on public.sessions from authenticated;

drop policy if exists "clinician versions protocols" on public.exercise_protocols;
revoke update on public.exercise_protocols from authenticated;

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
