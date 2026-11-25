-- SYNTHETIC DEMO SEED ONLY.
-- Every row below is fake. NEVER insert real patient data, identifiable video
-- or health information. Run only in the competition/demo Supabase project.
-- Role escalation to 'clinician' is done here by the trusted seed (service role),
-- not by user-editable auth metadata.

insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'synthetic-patient@example.invalid', '', now(), now(), now(), 'authenticated', 'authenticated',
   '{"display_name":"Synthetic Patient"}'::jsonb),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'synthetic-clinician@example.invalid', '', now(), now(), now(), 'authenticated', 'authenticated',
   '{"display_name":"Synthetic Clinician"}'::jsonb)
on conflict (id) do nothing;

-- New users get a patient profile via the trigger; promote the synthetic clinician.
update public.profiles set role = 'clinician', display_name = 'Synthetic Clinician'
where id = '00000000-0000-0000-0000-000000000002';

insert into public.clinician_patient_links (clinician_id, patient_id, status)
values ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001', 'active')
on conflict do nothing;

-- Example clinician-approved protocol (synthetic, version 1). Parameters are
-- demonstration values, not medical thresholds.
insert into public.exercise_protocols
  (id, patient_id, clinician_id, protocol_name, version, parameters, approved_at, active)
values (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Seated knee extension — demonstration protocol', 1,
  '{"side":"right","target_reps":8,"target_range_deg":[110,125],
    "rest_range_deg":[70,80],"camera":"side","hold_ms":400}'::jsonb,
  now(), true
) on conflict do nothing;

-- Consent record for the synthetic patient.
insert into public.consent_records (id, patient_id, consent_version, purpose)
values ('44444444-4444-4444-8444-444444444444',
        '00000000-0000-0000-0000-000000000001',
        'camera-processing-v1', 'camera_processing')
on conflict do nothing;
