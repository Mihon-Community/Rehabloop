import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

export function RecoveryTwinScreen() {
  return (
    <ScreenPlaceholder
      title="8. Recovery Twin"
      purpose="3D avatar, joint/metric selection, timeline scrubber and two-session comparison with accessible labels in addition to colour."
      dataSource="Session angle trace from GET /api/v1/sessions/{id}"
      states={['no session selected', 'missing/low-quality frames', 'comparison mode']}
    >
      <p className="meta">
        Uses <code>three</code>, <code>@react-three/fiber</code> and <code>@react-three/drei</code>.
        The avatar visualises the measured projected angle only — it is not a true 3D biomechanical
        reconstruction. Low-quality frames must show a visible gap.
      </p>
    </ScreenPlaceholder>
  );
}
