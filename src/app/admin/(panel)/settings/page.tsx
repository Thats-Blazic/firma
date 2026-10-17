import type { Metadata } from "next";
import { SettingsManager } from "@/components/admin/settings-manager";
import { loadSettings, requireAdminPage } from "@/lib/admin/auth";
import { loadFleet } from "@/lib/admin/data";

export const metadata: Metadata = { title: "Podešavanja" };

export default async function SettingsPage() {
  const { supabase, isManager } = await requireAdminPage();
  const [settings, fleet] = await Promise.all([loadSettings(supabase), loadFleet(supabase)]);

  const notifications = {
    whatsapp: Boolean(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  };

  return <SettingsManager settings={settings} fleet={fleet} notifications={notifications} canManage={isManager} />;
}
