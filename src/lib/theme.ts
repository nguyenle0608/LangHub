export const THEME_STORAGE_KEY = 'langhub-theme-mode'
export const THEME_MODES = ['system', 'light', 'dark'] as const

export type ThemeMode = (typeof THEME_MODES)[number]
export type EffectiveTheme = 'light' | 'dark'

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value)
}

export function normalizeThemeMode(value: unknown): ThemeMode {
  return isThemeMode(value) ? value : 'system'
}

export function resolveEffectiveTheme(mode: ThemeMode, systemPrefersDark: boolean): EffectiveTheme {
  if (mode === 'dark') return 'dark'
  if (mode === 'light') return 'light'
  return systemPrefersDark ? 'dark' : 'light'
}

export function themeInitScript(): string {
  return `(() => {
  try {
    const key = ${JSON.stringify(THEME_STORAGE_KEY)};
    const saved = localStorage.getItem(key);
    const mode = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effective = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
    document.documentElement.classList.toggle('dark', effective === 'dark');
    document.documentElement.dataset.themeMode = mode;
    document.documentElement.dataset.theme = effective;
    document.documentElement.style.colorScheme = effective;
  } catch (_) {}
})();`
}
