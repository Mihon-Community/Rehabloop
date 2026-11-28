import { useNavigate } from 'react-router-dom';
import { useDemo } from '../../app/demoStore';
import { useTheme } from '../../app/themeStore';
import { themes, type ThemeId } from '../../app/themes';
import { PageHeader } from '../../components/PageHeader';
import { signOut } from '../../lib/auth';
import { LogOut, SlidersHorizontal } from '@/components/icon';
import { SettingsStack, type StackPage } from '@/components/base';

/** Settings — a second, drill-down surface for the same demo preferences the
 * topbar already exposes (theme, demo role, camera mode) plus sign out. */
export function SettingsScreen() {
  const { role, setRole, cameraMode, setCameraMode } = useDemo();
  const { themeId, theme, setThemeId } = useTheme();
  const navigate = useNavigate();

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      /* demo mode has no session to clear */
    }
    setRole('patient');
    setCameraMode('review');
    navigate('/');
  }

  /* Every section carries a footer, because each control here is a prototype
     preference rather than a clinical setting — the row says what it does, the
     footer says what it does not do. */
  const pages: Record<string, StackPage> = {
    settings: {
      title: 'Settings',
      sections: [
        {
          title: 'Workspace',
          rows: [
            {
              id: 'appearance',
              label: 'Appearance',
              detail: theme.label,
              to: 'appearance',
            },
          ],
          footer:
            'Display preferences for this browser only. Nothing here changes protocols, sessions or stored measurements.',
        },
        {
          title: 'Demo role',
          rows: [
            {
              id: 'role-patient',
              label: 'Patient',
              detail: 'Signing in opens the patient home screen.',
              selected: role === 'patient',
              onSelect: () => setRole('patient'),
            },
            {
              id: 'role-clinician',
              label: 'Physiotherapist / clinician',
              detail: 'Signing in opens the clinician dashboard.',
              selected: role === 'clinician',
              onSelect: () => setRole('clinician'),
            },
          ],
          footer:
            'Display-only. The backend verifies role and assignment; the UI never authorises.',
        },
        {
          title: 'Sessions',
          rows: [
            {
              id: 'camera-mode',
              label: 'Camera mode',
              // Spelled out as well as shown by the switch, so the state is
              // never carried by the thumb position alone.
              detail:
                cameraMode === 'camera'
                  ? 'On — camera setup is offered before a session.'
                  : 'Off — saved reports only, no capture.',
              checked: cameraMode === 'camera',
              onSelect: () => setCameraMode(cameraMode === 'camera' ? 'review' : 'camera'),
            },
          ],
          footer: 'Camera access is still asked for, and optional, on the setup screen.',
        },
        {
          rows: [
            {
              id: 'sign-out',
              label: 'Sign out',
              tone: 'danger',
              trailing: <LogOut className="size-4" aria-hidden="true" />,
              onSelect: () => {
                void handleSignOut();
              },
            },
          ],
          footer:
            'Resets the demo role and camera mode, then returns to the landing page. In demo mode there may be no signed-in session to end.',
        },
      ],
    },
    appearance: {
      title: 'Appearance',
      sections: [
        {
          title: 'Theme',
          rows: themes.map((option) => ({
            id: option.id,
            label: option.label,
            detail: option.description,
            selected: option.id === themeId,
            onSelect: () => setThemeId(option.id as ThemeId),
          })),
          footer:
            'This mirrors the theme picker in the topbar — both control the same preference. Your choice is remembered in this browser.',
        },
      ],
    },
  };

  return (
    <div className="screen-stack">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Appearance, demo role and camera mode for this prototype, plus sign out."
        icon={<SlidersHorizontal className="size-5" aria-hidden="true" />}
      />
      <SettingsStack pages={pages} root="settings" />
    </div>
  );
}
