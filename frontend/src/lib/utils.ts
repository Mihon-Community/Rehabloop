import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn/ui class helper — later overrides win. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
