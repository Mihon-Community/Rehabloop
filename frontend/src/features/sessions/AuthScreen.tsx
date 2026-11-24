import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

export function AuthScreen() {
  return (
    <ScreenPlaceholder
      title="1. Authentication"
      purpose="Patient / clinician sign-in and a role-aware landing page. UI role is never an authorization control; the backend verifies identity and patient assignment."
      dataSource="Supabase Auth (anon key, RLS) + GET /api/v1/me"
      states={['sign in', 'role-aware landing', 'camera denied — non-camera review mode']}
    ></ScreenPlaceholder>
  );
}
