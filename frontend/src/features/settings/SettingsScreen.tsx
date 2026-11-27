import { useNavigate } from 'react-router-dom';
import { useDemo } from '../../app/demoStore';
import { useTheme } from '../../app/themeStore';
import { themes, type ThemeId } from '../../app/themes';
import { PageHeader } from '../../components/PageHeader';
import { StackPanel, type StackPage } from '../../components/kokonutui/stack-panel';
import { signOut } from '../../lib/auth';

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
        },
        {
          title: 'Demo role',
          rows: [
            {
              id: 'role-patient',
              label: 'Patient',
              selected: role === 'patient',
              onSelect: () => setRole('patient'),
            },
            {
              id: 'role-clinician',
              label: 'Physiotherapist / clinician',
              selected: role === 'clinician',
              onSelect: () => setRole('clinician'),
            },
          ],
          footer: 'Display-only. The backend verifies role and assignment; the UI never authorises.',
        },
        {
          title: 'Sessions',
          rows: [
            {
              id: 'camera-mode',
              label: 'Camera mode',
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
              onSelect: () => {
                void handleSignOut();
              },
            },
          ],
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
          footer: 'This mirrors the theme picker in the topbar — both control the same preference.',
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
      />
      <StackPanel pages={pages} root="settings" />
    </div>
  );
}
