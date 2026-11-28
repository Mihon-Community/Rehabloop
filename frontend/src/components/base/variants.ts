import { cn } from '@/lib/utils';

/**
 * The two-line replacement for the variant helper this project used to pull in
 * from `class-variance-authority`. A variant map is a plain object of class
 * strings; `pickVariants` joins the chosen ones with the base and whatever the
 * caller passed, and `cn` resolves any Tailwind conflicts between them.
 *
 * Kept deliberately small: these components need variant lookup and nothing
 * else cva offered (no compound variants, no slot composition).
 */
export type VariantMap = Record<string, Record<string, string>>;

/** The prop type a component exposes for a given variant map. */
export type VariantProps<M extends VariantMap> = {
  [K in keyof M]?: keyof M[K];
};

export function pickVariants<M extends VariantMap>(
  base: string,
  map: M,
  chosen: VariantProps<M>,
  defaults: { [K in keyof M]: keyof M[K] },
  className?: string,
): string {
  const parts = [base];
  for (const key of Object.keys(map) as (keyof M)[]) {
    const value = chosen[key] ?? defaults[key];
    const cls = map[key][value as string];
    if (cls) parts.push(cls);
  }
  return cn(...parts, className);
}
