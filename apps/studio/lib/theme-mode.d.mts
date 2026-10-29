export type ThemeMode = 'dark' | 'light';
export const themeModeStorageKey: 'sg-theme';
export const themeModes: readonly ThemeMode[];
export const defaultThemeMode: 'dark';
export const themeModeBootstrap: string;
export function normalizeThemeMode(value: unknown): ThemeMode;
export function readThemeMode(document?: Document): ThemeMode;
export function applyThemeMode(value: unknown, options?: { document?: Document; storage?: Pick<Storage, 'setItem'> }): ThemeMode;
