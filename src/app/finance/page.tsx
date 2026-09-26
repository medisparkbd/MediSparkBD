import type { Metadata } from "next";
import FinanceClient from "./FinanceClient";

export const metadata: Metadata = {
  title: "Finance & Cost Transparency | MediSpark BD",
  description:
    "MediSpark BD financial transparency: automated course income, physical business costs, and net balance.",
};

export default function FinancePage() {
  return <FinanceClient />;
}
