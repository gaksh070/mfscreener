/** Saved screens, localStorage-only per PRD F-05 (no accounts). Cap 25. */
const STORAGE_KEY = "mfscreener.saved-screens.v1";
const MAX_SAVED = 25;

export interface SavedScreen {
  id: string;
  name: string;
  query: string; // the encoded screen query string (see url-codec.ts)
  createdAt: string;
}

function isStorageAvailable(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const testKey = "__mfscreener_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function listSavedScreens(): SavedScreen[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedScreen[]) : [];
  } catch {
    return [];
  }
}

export function saveScreen(name: string, query: string): { ok: boolean; reason?: string } {
  if (!isStorageAvailable()) return { ok: false, reason: "localStorage unavailable" };
  const screens = listSavedScreens();
  if (screens.length >= MAX_SAVED) return { ok: false, reason: `Limit of ${MAX_SAVED} saved screens reached` };
  screens.push({ id: crypto.randomUUID(), name, query, createdAt: new Date().toISOString() });
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(screens));
  return { ok: true };
}

export function deleteScreen(id: string): void {
  if (!isStorageAvailable()) return;
  const screens = listSavedScreens().filter((s) => s.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(screens));
}

export function renameScreen(id: string, name: string): void {
  if (!isStorageAvailable()) return;
  const screens = listSavedScreens().map((s) => (s.id === id ? { ...s, name } : s));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(screens));
}
