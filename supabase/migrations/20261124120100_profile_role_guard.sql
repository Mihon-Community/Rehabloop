-- Follow-up guard: profile.role is trusted application-managed data.
-- RLS alone cannot restrict which columns an authenticated user may update,
-- so block role changes coming through the Data API as 'authenticated'.
-- The service role and direct migration/seed SQL remain allowed.

create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and coalesce(current_setting('request.jwt.claim.role', true), '') = 'authenticated' then
    raise exception 'profile role can only be changed by the service role';
  end if;
  return new;
end;
$$;

create trigger profiles_role_protected before update on public.profiles
  for each row execute function public.protect_profile_role();
