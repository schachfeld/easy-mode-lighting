// Home Assistant returns from account sign-in to glow-lighting://auth/callback.
// The session handles that link itself, so it never becomes a route.
export function redirectSystemPath({ path }: { path: string }) {
  try {
    return path.includes("auth/callback") ? null : path;
  } catch {
    return "/";
  }
}
