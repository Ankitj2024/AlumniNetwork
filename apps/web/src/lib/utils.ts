/**
 * Joins class names, skipping falsy ones. The shadcn / 21st.dev components in components/ui import
 * this as `cn`; the rest of the app uses the same helper as `cx` from components/ui.
 */
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
