import { getPaymentCard } from "@/lib/enrollments-admin";
import { cachedJson } from "@/lib/api-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const card = await getPaymentCard();
  return cachedJson(card, "API_MEDIUM");
}
