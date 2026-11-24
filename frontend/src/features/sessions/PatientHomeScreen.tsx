import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

export function PatientHomeScreen() {
  return (
    <ScreenPlaceholder
      title="2. Patient home"
      purpose="Assigned protocol, next-session guidance and recent session status. If no clinician-approved protocol exists, stay in read-only demo mode and suggest no exercise."
      dataSource="GET /api/v1/patients/me/protocols + patient progress"
      states={['protocol assigned', 'read-only demo mode', 'recent session status']}
    ></ScreenPlaceholder>
  );
}
