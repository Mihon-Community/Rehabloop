import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

export function ClinicianDashboardScreen() {
  return (
    <ScreenPlaceholder
      title="7. Clinician dashboard"
      purpose="Patient list, protocol editor, sessions, trend charts and review notes. Protocol changes create a new version; no automatic treatment-plan updates."
      dataSource="GET /api/v1/me + patient progress + PATCH /api/v1/protocols/{id}"
      states={['no assigned patients', 'protocol editor', 'session review', 'revoked access']}
    ></ScreenPlaceholder>
  );
}
