/**
 * Demo Mode Utility
 *
 * Returns true when DATABASE_URL is not configured or when the database server
 * is unreachable (e.g. internet offline), indicating the app should serve
 * hardcoded demo data instead of querying a live database.
 *
 * Works in both development and production — designed for hackathon submissions
 * where judges clone the repo, run offline, or visit a deployed URL without database credentials.
 */

export function isDemoMode(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return !dbUrl || dbUrl === "your_database_url_here" || dbUrl.trim() === "";
}

/** Detects database connection failures (offline / unreachable DB pooler) */
export function isDbUnreachable(error: any): boolean {
  if (!error) return false;
  const msg = String(error?.message || error);
  return (
    msg.includes("Can't reach database server") ||
    msg.includes("P1001") ||
    msg.includes("P1002") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("fetch failed")
  );
}

/** Standard error message for write actions in demo mode */
export const DEMO_WRITE_ERROR = "Demo mode — connect a database to enable this feature.";
