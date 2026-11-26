import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { SignInScreen } from '@/features/auth/SignInScreen';
import { SignUpScreen } from '@/features/auth/SignUpScreen';
import { LandingPage } from '@/features/landing/LandingPage';
import { ClinicianDashboardScreen } from '../features/protocols/ClinicianDashboardScreen';
import { ProtocolDetailScreen } from '../features/protocols/ProtocolDetailScreen';
import { RecoveryTwinScreen } from '../features/recovery-twin/RecoveryTwinScreen';
import { AuthScreen } from '../features/sessions/AuthScreen';
import { CameraSetupScreen } from '../features/sessions/CameraSetupScreen';
import { LiveSessionScreen } from '../features/sessions/LiveSessionScreen';
import { PatientHomeScreen } from '../features/sessions/PatientHomeScreen';
import { SessionResultScreen } from '../features/sessions/SessionResultScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';

/** Public journey: landing -> sign in / sign up -> existing app screens. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in" element={<SignInScreen />} />
      <Route path="/sign-up" element={<SignUpScreen />} />
      <Route path="/demo" element={<AuthScreen />} />

      <Route element={<AppShell />}>
        <Route path="/home" element={<PatientHomeScreen />} />
        <Route path="/protocols/:id" element={<ProtocolDetailScreen />} />
        <Route path="/setup" element={<CameraSetupScreen />} />
        <Route path="/sessions/:id/live" element={<LiveSessionScreen />} />
        <Route path="/sessions/:id/result" element={<SessionResultScreen />} />
        <Route path="/clinician" element={<ClinicianDashboardScreen />} />
        <Route path="/twin" element={<RecoveryTwinScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Route>

      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}
