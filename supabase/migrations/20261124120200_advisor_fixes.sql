-- Advisor fixes applied after the initial migration.
-- Security: pin search_path; move SECURITY DEFINER helpers out of the
-- PostgREST-exposed public schema; keep SECURITY INVOKER wrappers so the
-- existing RLS policy definitions stay valid.
-- Performance: cover advisor-flagged foreign keys with indexes.

alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.enforce_protocol_version() set search_path = public, pg_temp;

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_clinician()
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('clinician','admin'));
end;
$$;

create or replace function private.clinician_link_active(p_patient uuid)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return exists (select 1 from public.clinician_patient_links l
    where l.clinician_id = (select auth.uid()) and l.patient_id = p_patient and l.status = 'active');
end;
$$;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, role, display_name)
  values (new.id, 'patient', nullif(new.raw_user_meta_data->>'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.is_clinician() from public, anon;
revoke all on function private.clinician_link_active(uuid) from public, anon;
revoke all on function private.handle_new_user() from public, anon;
grant execute on function private.is_clinician() to authenticated;
grant execute on function private.clinician_link_active(uuid) to authenticated;

create or replace function public.is_clinician()
returns boolean language sql stable security invoker set search_path = public, pg_temp as $$
  select private.is_clinician();
$$;
create or replace function public.clinician_link_active(p_patient uuid)
returns boolean language sql stable security invoker set search_path = public, pg_temp as $$
  select private.clinician_link_active(p_patient);
$$;
revoke all on function public.is_clinician() from public, anon;
revoke all on function public.clinician_link_active(uuid) from public, anon;
grant execute on function public.is_clinician() to authenticated;
grant execute on function public.clinician_link_active(uuid) to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
drop function if exists public.handle_new_user();

create index if not exists ai_summaries_session_id_idx on public.ai_summaries(session_id);
create index if not exists consent_records_patient_id_idx on public.consent_records(patient_id);
create index if not exists exercise_protocols_clinician_id_idx on public.exercise_protocols(clinician_id);
create index if not exists session_flags_session_id_idx on public.session_flags(session_id);
