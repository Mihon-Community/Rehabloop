import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names and resolves conflicting Tailwind utilities — later
 *  overrides win, so `cn(base, className)` lets a caller override the base. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
