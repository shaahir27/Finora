import { PushSettingsToggle } from "@/components/PushSettingsToggle";

export default function SettingsPage() {
  // Hardcoded for demo - in reality this comes from auth context/session
  const adminId = "admin-123";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Admin Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your preferences and notification settings.</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Notifications</h2>
        <PushSettingsToggle userId={adminId} />
      </div>
    </div>
  );
}
