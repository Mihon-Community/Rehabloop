import { Route, Routes } from 'react-router-dom';
import { AuthScreen } from '../features/sessions/AuthScreen';
import { PatientHomeScreen } from '../features/sessions/PatientHomeScreen';
import { ProtocolDetailScreen } from '../features/protocols/ProtocolDetailScreen';
import { CameraSetupScreen } from '../features/sessions/CameraSetupScreen';
import { LiveSessionScreen } from '../features/sessions/LiveSessionScreen';
import { SessionResultScreen } from '../features/sessions/SessionResultScreen';
import { ClinicianDashboardScreen } from '../features/protocols/ClinicianDashboardScreen';
import { RecoveryTwinScreen } from '../features/recovery-twin/RecoveryTwinScreen';

/** Screen map for the app. Auth is a UI gate only, never authorization. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AuthScreen />} />
      <Route path="/home" element={<PatientHomeScreen />} />
      <Route path="/protocols/:id" element={<ProtocolDetailScreen />} />
      <Route path="/setup" element={<CameraSetupScreen />} />
      <Route path="/sessions/:id/live" element={<LiveSessionScreen />} />
      <Route path="/sessions/:id/result" element={<SessionResultScreen />} />
      <Route path="/clinician" element={<ClinicianDashboardScreen />} />
      <Route path="/twin" element={<RecoveryTwinScreen />} />
      <Route path="*" element={<AuthScreen />} />
    </Routes>
  );
}
