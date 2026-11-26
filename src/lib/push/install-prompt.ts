// Shared capture of the Android `beforeinstallprompt` event so several
// components (global notice, driver card) can trigger the native prompt.
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let captured: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
export function setInstallPrompt(e: InstallPromptEvent | null) { captured = e; listeners.forEach((l) => l()); }
export function getInstallPrompt() { return captured; }
export function onInstallPromptChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true;
}
export function isIosDevice(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
