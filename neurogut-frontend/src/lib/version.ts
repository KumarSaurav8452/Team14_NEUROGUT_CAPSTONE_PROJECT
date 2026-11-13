// Remembered website version (set by the sidebar toggle), used to pick the landing page after login.
export const VERSION_KEY = "neurogut_version";

export function homeRoute(): string {
  try {
    return localStorage.getItem(VERSION_KEY) === "v2" ? "/v2" : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
