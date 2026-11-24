import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

export function ProtocolDetailScreen() {
  return (
    <ScreenPlaceholder
      title="3. Protocol detail"
      purpose="Exercise name, clinician instructions, side, target range, stop instructions and protocol version. Confirm understanding before setup."
      dataSource="GET /api/v1/patients/me/protocols (assigned protocol)"
      states={['confirm understanding', 'clinician gate', 'version shown']}
    ></ScreenPlaceholder>
  );
}
