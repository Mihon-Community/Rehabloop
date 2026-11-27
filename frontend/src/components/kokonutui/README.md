# Notification Stack (Kokonut UI)

Installed from `https://kokonutui.com/r/notification-stack.json` with:

```bash
npx shadcn@latest add https://kokonutui.com/r/notification-stack.json --yes
```

The CLI did not recognise the `@url:` prefix as a remote URL, so the plain URL form was used.
The installed file is `src/components/kokonutui/notification-stack.tsx`. Its hard-coded
zinc/white colours were swapped for RehabLoop CSS variables so it follows all six themes.

## Basic usage

```tsx
import NotificationStack, { type StackNotification } from '@/components/kokonutui/notification-stack';

const notifications: StackNotification[] = [
  {
    id: '1',
    app: 'Demo',
    title: 'Example session record',
    body: 'Illustrative notification only — no real patient data.',
    time: 'now',
    // icon is optional; pass a ReactNode here
  },
];

export function Example() {
  return (
    <NotificationStack
      notifications={notifications}
      onDismiss={(id) => console.info('dismissed', id)}
    />
  );
}
```

Props:

- `notifications?: StackNotification[]` — newest first; the stack tracks dismissals internally.
- `onDismiss?: (id: string) => void` — called after a card is swiped, clicked away or deleted with the keyboard.
- `className?: string` — extra classes on the outer wrapper.

Interactions: hover/focus/“Show all” expands the stack; drag left or right (or press Delete on a
focused card) to dismiss; the close button works with mouse and keyboard. Reduced motion is
respected.

## Live example in this app

`src/components/layout/Topbar.tsx` wires the bell button to a popover containing the stack with
three clearly labelled demo notifications. `onDismiss` updates the badge count.

## Stack Panel

Installed from `https://kokonutui.com/r/stack-panel.json` with:

```bash
npx shadcn@latest add https://kokonutui.com/r/stack-panel.json --yes
```

The CLI did not recognise the `@url:` prefix as a remote URL, so the plain URL form was used
again. The installed file is `src/components/kokonutui/stack-panel.tsx` (its `motion` dependency
was already present from the Notification Stack install). Its hard-coded zinc/white/red colours
were swapped for RehabLoop CSS variables so it follows all six themes; the two purely decorative
depth effects (the dimming overlay behind a pushed page and its drop shadow) were left as literal
`rgb(0 0 0 / …)`/`bg-black`, the same way `--card-shadow` itself is defined per theme in
`src/index.css` — a shadow reads as black regardless of theme, it is not a themed surface colour.

## Basic usage

```tsx
import { StackPanel, type StackPage } from '@/components/kokonutui/stack-panel';

const pages: Record<string, StackPage> = {
  settings: {
    title: 'Settings',
    sections: [
      {
        rows: [
          { id: 'appearance', label: 'Appearance', detail: 'Clinical Teal', to: 'appearance' },
        ],
      },
    ],
  },
  appearance: {
    title: 'Appearance',
    sections: [
      {
        title: 'Theme',
        rows: [{ id: 'clinical-teal', label: 'Clinical Teal', selected: true }],
      },
    ],
  },
};

export function Example() {
  return <StackPanel pages={pages} root="settings" />;
}
```

Props:

- `pages: Record<string, StackPage>` — every page the panel can drill into, keyed by id. Each
  `StackPage` has a `title` and `sections: StackSection[]`.
- `root: string` — the page id the panel starts on.
- `className?: string` — extra classes on the outer panel.

A `StackSection` has an optional `title`, a `rows: StackRow[]`, and an optional `footer` (small
print under the section). A `StackRow` has a `label`, and optionally: `detail` (grey right-aligned
text, e.g. a current value), `to` (id of a page this row drills into), `trailing` (any extra
node — a badge, a custom control), `onSelect`, `selected` (shows a checkmark), `checked` (shows
and drives a toggle switch), and `tone: 'default' | 'danger'` (red label, for destructive rows
like sign out).

Interactions: tapping a row with `to` pushes its page in with an iOS-style spring, the row's
label flying up to become the new header title; the Back button, swiping the page right, or
Escape pops back. Reduced motion is respected.

## Live example in this app

`src/features/settings/SettingsScreen.tsx` is a new Settings screen (routed at `/settings`, linked
from the sidebar's "Preferences" group) that drills from a root page — Appearance, Demo role,
Camera mode, Sign out — into an Appearance sub-page listing all six themes as selectable rows
wired to `useTheme().setThemeId`. It exists alongside the topbar's `ThemePicker` dropdown as a
second surface for the same preference, which is fine for a demo.

## Scroll Index

Installed from `https://kokonutui.com/r/scroll-index.json` with:

```bash
npx shadcn@latest add https://kokonutui.com/r/scroll-index.json --yes
```

The CLI did not recognise the `@url:` prefix as a remote URL, so the plain URL form was used.
The installed file is `src/components/kokonutui/scroll-index.tsx`. Its hard-coded zinc/white
colours (including several `dark:` variants, which this app never uses since theming is done
entirely through the `[data-theme]` CSS variable system) were swapped for RehabLoop CSS
variables so it follows all six themes.

## Basic usage

```tsx
import ScrollIndex from '@/components/kokonutui/scroll-index';

export function Example() {
  return (
    // "window": the page itself scrolls and the rail sticks beside the content.
    // Use "self" (the default) to have ScrollIndex scroll its own boxed region instead.
    <ScrollIndex scroller="window" selector="h2">
      <main>
        <h2>First section</h2>
        <p>…</p>
        <h2>Second section</h2>
        <p>…</p>
      </main>
    </ScrollIndex>
  );
}
```

Props:

- `children?: ReactNode` — the content to index; defaults to a sample article if omitted.
- `selector?: string` — which headings get a tick on the rail. Defaults to `"h2, h3"`.
- `scroller?: 'self' | 'window'` — `'self'` (default) makes the component scroll its own
  boxed region with a floating nav rail; `'window'` makes the page itself scroll, with the
  rail sticking beside the content via CSS `sticky`. In `'window'` mode the component renders
  a `grid-cols-[minmax(0,1fr)_3rem]` wrapper around its children, so the rail sits in its own
  3rem-wide column.
- `className?: string` — extra classes on the outer wrapper.

Interactions: the rail shows a tick per matched heading, swells near the pointer, and flashes
the current section's name in a floating label. Click or drag the rail to jump between
sections; arrow keys move focus between ticks. Reduced motion is respected throughout.

## Live example in this app

`src/features/landing/LandingPage.tsx` wraps the public landing page's `<main>` (lines
115-432) in `<ScrollIndex scroller="window" selector="main h2">`, giving the long marketing
page — which already defines `.landing-section` scroll-margin-top anchors in `src/index.css`
for sections like "How it works" and "Safety and privacy" — a sticky section-index rail
alongside its content.
