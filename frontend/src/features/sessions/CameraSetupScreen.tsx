import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

export function CameraSetupScreen() {
  return (
    <ScreenPlaceholder
      title="4. Camera setup"
      purpose="Live preview, framing guide, consent state and lighting/visibility checklist. Start only when checks pass; declining camera must not block review of saved data."
      dataSource="getUserMedia (secure context) + local consent state"
      states={['camera denied', 'vision service unavailable', 'framing checks', 'consent required']}
    ></ScreenPlaceholder>
  );
}
