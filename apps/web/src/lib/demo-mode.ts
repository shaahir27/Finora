/**
 * Demo Mode Utility
 *
 * Returns true when DATABASE_URL is not configured, indicating the app should
 * serve hardcoded demo data instead of querying a live database.
 *
 * Works in both development and production — designed for hackathon submissions
 * where judges clone the repo or visit a deployed URL without database credentials.
 */

export function isDemoMode(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return !dbUrl || dbUrl === "your_database_url_here" || dbUrl.trim() === "";
}

/** Standard error message for write actions in demo mode */
export const DEMO_WRITE_ERROR = "Demo mode — connect a database to enable this feature.";
