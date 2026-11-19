export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "ims-atlas-theme";

export function readStoredTheme(): ThemeMode {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "dark" ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
  localStorage.setItem(STORAGE_KEY, mode);
}
