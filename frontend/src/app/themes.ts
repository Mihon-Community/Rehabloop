export const THEME_STORAGE_KEY = 'rehabloop-theme';

export interface ThemeDefinition {
  id: string;
  label: string;
  description: string;
  /** surface, primary, accent — used only for the picker's colour preview. */
  preview: [string, string, string];
}

export const themes: ThemeDefinition[] = [
  {
    id: 'clinical-teal',
    label: 'Clinical Teal',
    description: 'Calm teal, cool white, soft slate',
    preview: ['#f6f9fa', '#0f766e', '#e6f4f1'],
  },
  {
    id: 'ocean-blue',
    label: 'Ocean Blue',
    description: 'Deep blue, sky accents, pale blue-gray',
    preview: ['#f3f7fc', '#1d4ed8', '#e3efff'],
  },
  {
    id: 'sage-green',
    label: 'Sage Green',
    description: 'Muted green, warm white, natural neutrals',
    preview: ['#f6f8f4', '#3f6f52', '#e5f0e3'],
  },
  {
    id: 'lavender-calm',
    label: 'Lavender Calm',
    description: 'Calming periwinkle, soft lilac, cool neutrals',
    preview: ['#f7f5fb', '#4f61b0', '#eee7fb'],
  },
  {
    id: 'warm-sand',
    label: 'Warm Sand',
    description: 'Warm terracotta, cream, soft charcoal',
    preview: ['#faf6f0', '#a85d3f', '#f6e8dc'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Dark navy, light text, bright teal',
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
