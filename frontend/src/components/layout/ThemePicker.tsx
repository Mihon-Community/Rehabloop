import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Check, ChevronDown, Palette } from 'lucide-react';
import { useTheme } from '@/app/themeStore';
import { themes, type ThemeDefinition, type ThemeId } from '@/app/themes';

function Swatch({ colors }: { colors: ThemeDefinition['preview'] }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
      {colors.map((color) => (
        <span
          key={color}
          className="size-3 rounded-full border border-[var(--border)]"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

/** Labelled menu: each theme has a name, description and colour preview. */
export function ThemePicker() {
  const { themeId, theme, setThemeId } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    const activeIndex = themes.findIndex((item) => item.id === themeId);
    itemsRef.current[Math.max(activeIndex, 0)]?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, themeId]);

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const current = itemsRef.current.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    let next = current;
    if (event.key === 'ArrowDown') next = (current + 1) % themes.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + themes.length) % themes.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = themes.length - 1;
    else return;
    event.preventDefault();
    itemsRef.current[next]?.focus();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="theme-menu"
        aria-label={`Color theme: ${theme.label}. Open theme picker`}
        onClick={() => setOpen((value) => !value)}
        className="icon-btn flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)]"
      >
        <Palette className="size-4 text-[var(--primary)]" aria-hidden="true" />
        <span className="hidden max-w-28 truncate sm:inline">{theme.label}</span>
        <Swatch colors={theme.preview} />
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id="theme-menu"
          role="menu"
          aria-label="Color themes"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 w-[290px] rounded-xl border border-[var(--border)] bg-[var(--popover)] p-1.5 shadow-xl"
        >
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Color theme
          </p>
          {themes.map((item, index) => {
            const active = item.id === themeId;
            return (
              <button
                key={item.id}
                ref={(element) => {
                  itemsRef.current[index] = element;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setThemeId(item.id as ThemeId);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--accent)] ${
                  active ? 'bg-[var(--accent)]' : ''
                }`}
              >
                <Swatch colors={item.preview} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--foreground)]">
                    {item.label}
                  </span>
                  <span className="block text-xs text-[var(--muted-foreground)]">
                    {item.description}
                  </span>
                </span>
                {active ? (
                  <Check className="size-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
