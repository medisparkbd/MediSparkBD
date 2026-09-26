import type { Metadata } from "next";
import RulesManager from "@/components/admin/RulesManager";

export const metadata: Metadata = {
  title: "Rules Management — MediSpark Admin",
  description: "Internal admin-only rules, policies, and operational guidelines.",
  robots: { index: false, follow: false },
};

export default function AdminRulesPage() {
  return <RulesManager />;
}
