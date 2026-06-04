export const DEMO_SESSION_KEY = "pallet-pal-demo-session";

export function canUseDemoMode() {
  return (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
  );
}

export function isDemoSessionActive() {
  return canUseDemoMode() && !!window.localStorage.getItem(DEMO_SESSION_KEY);
}
