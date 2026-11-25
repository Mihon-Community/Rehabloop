-- Backend integration fixes for explicit service-role privileges, consent
-- revocation, and atomic protocol/session completion writes.
-- Additive migration only; do not apply outside the authorized Supabase workflow.

-- Data API grants and RLS are separate controls. Grant only the operations the
-- server-side repository needs; service_role continues to bypass RLS.
grant usage on schema public to service_role;

grant select on public.profiles,
  public.clinician_patient_links,
  public.consent_records,
  public.exercise_protocols,
  public.sessions,
  public.session_metrics,
  public.session_flags,
  public.ai_summaries
to service_role;

grant insert, update on public.exercise_protocols, public.sessions to service_role;
grant insert, update on public.session_metrics to service_role;
grant insert on public.session_flags, public.ai_summaries to service_role;

-- Patients can only revoke their own active consent. Column privileges keep
-- the immutable purpose/version/granted_at fields out of the update surface.
drop policy if exists "consent self revoke" on public.consent_records;
revoke update on public.consent_records from authenticated;
grant update (revoked_at) on public.consent_records to authenticated;

create policy "consent self revoke" on public.consent_records
  for update to authenticated
  using (patient_id = (select auth.uid()) and revoked_at is null)
  with check (patient_id = (select auth.uid()) and revoked_at is not null);

-- Replace the current protocol version and deactivate its predecessor in the
-- same Postgres transaction. A stale version returns no row and changes nothing.
create or replace function public.backend_update_protocol_version(
  p_protocol_id uuid,
  p_new_id uuid,
  p_expected_version integer,
  p_parameters jsonb,
  p_active boolean,
  p_approved_at timestamptz
)
returns setof public.exercise_protocols
language plpgsql
set search_path = public, pg_temp
as $$
declare
  current_protocol public.exercise_protocols%rowtype;
  new_protocol public.exercise_protocols%rowtype;
begin
  select * into current_protocol
  from public.exercise_protocols
  where id = p_protocol_id
  for update;

  if not found
     or not current_protocol.active
     or current_protocol.version <> p_expected_version then
    return;
  end if;

  insert into public.exercise_protocols (
    id, patient_id, clinician_id, protocol_name, version,
    parameters, approved_at, active
  ) values (
    p_new_id, current_protocol.patient_id, current_protocol.clinician_id,
    current_protocol.protocol_name, current_protocol.version + 1,
    p_parameters, p_approved_at, p_active
  ) returning * into new_protocol;

  update public.exercise_protocols
  set active = false
  where id = current_protocol.id;

  return next new_protocol;
end;
$$;

-- Final metrics, quality flags, and completed state commit or roll back together.
create or replace function public.backend_complete_session(
  p_session_id uuid,
  p_ended_at timestamptz,
  p_metrics jsonb,
  p_flags text[]
)
returns setof public.sessions
language plpgsql
set search_path = public, pg_temp
as $$
declare
  current_session public.sessions%rowtype;
  completed_session public.sessions%rowtype;
  metric record;
begin
  select * into current_session
  from public.sessions
  where id = p_session_id
  for update;

  if not found or current_session.status not in ('active', 'paused') then
    return;
  end if;

  for metric in
    select entry.key, entry.value
    from jsonb_each(coalesce(p_metrics, '{}'::jsonb)) as entry(key, value)
    where jsonb_typeof(entry.value) = 'number'
  loop
    insert into public.session_metrics (
      session_id, metric_key, numeric_value, text_value, unit
    ) values (
      p_session_id, metric.key, (metric.value #>> '{}')::double precision, null, null
    )
    on conflict (session_id, metric_key) do update
      set numeric_value = excluded.numeric_value,
          text_value = null,
          unit = null;
  end loop;

  insert into public.session_flags (session_id, flag_code, severity)
  select distinct p_session_id, flag_code, 'info'
  from unnest(coalesce(p_flags, '{}'::text[])) as flags(flag_code);

  update public.sessions
  set status = 'completed', ended_at = p_ended_at, raw_video_stored = false
  where id = p_session_id
  returning * into completed_session;

  return next completed_session;
end;
$$;

revoke all on function public.backend_update_protocol_version(
  uuid, uuid, integer, jsonb, boolean, timestamptz
) from public, anon, authenticated;
revoke all on function public.backend_complete_session(
  uuid, timestamptz, jsonb, text[]
) from public, anon, authenticated;
grant execute on function public.backend_update_protocol_version(
  uuid, uuid, integer, jsonb, boolean, timestamptz
) to service_role;
grant execute on function public.backend_complete_session(
  uuid, timestamptz, jsonb, text[]
) to service_role;
