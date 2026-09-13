import { fetchActiveDashboardCards } from "@/lib/dashboard-cards";
import { cachedJson } from "@/lib/api-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const cards = await fetchActiveDashboardCards();
  return cachedJson({ cards }, "API_MEDIUM");
}
