// Utility: merge class names (simple implementation, no clsx dependency)
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
