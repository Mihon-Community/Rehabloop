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
