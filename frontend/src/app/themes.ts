export const THEME_STORAGE_KEY = 'rehabloop-theme';

export interface ThemeDefinition {
  id: string;
  label: string;
  description: string;
  /** surface, primary, accent — used only for the picker's colour preview. */
  preview: [string, string, string];
}

/* Each theme is named for the clinical setting it suits, because that is how
   staff pick one: the palette matters less than whether it reads under ward
   lighting, at a bedside at night or in a bright physio gym. Ids are stable —
   they are persisted per browser, so labels may change but ids may not. */
export const themes: ThemeDefinition[] = [
  {
    id: 'clinical-teal',
    label: 'Clinical Teal',
    description: 'Theatre teal on cool white — the default clinical surface',
    preview: ['#f6f9fa', '#0f766e', '#e6f4f1'],
  },
  {
    id: 'ocean-blue',
    label: 'Hospital Blue',
    description: 'Deep medical blue, sky accents, pale blue-grey charts',
    preview: ['#f3f7fc', '#1d4ed8', '#e3efff'],
  },
  {
    id: 'midnight',
    label: 'Night Shift',
    description: 'Dark navy and bright teal for low-light bedside use',
    preview: ['#0b1622', '#2dd4bf', '#173a3d'],
  },
];

export const DEFAULT_THEME_ID = themes[0].id;
export type ThemeId = (typeof themes)[number]['id'];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return typeof value === 'string' && themes.some((theme) => theme.id === value);
}

export function themeById(id: ThemeId): ThemeDefinition {
  return themes.find((theme) => theme.id === id) ?? themes[0];
}

export function pageTitle(pathname: string): string {
  if (pathname.startsWith('/protocols/')) return 'Protocol';
  if (pathname.endsWith('/live')) return 'Live session';
  if (pathname.endsWith('/result')) return 'Result';
  const titles: Record<string, string> = {
    '/': 'Overview',
    '/home': 'Patient home',
    '/setup': 'Camera setup',
    '/clinician': 'Clinician',
    '/twin': 'Recovery Twin',
  };
  return titles[pathname] ?? 'Overview';
}
