import { getPaymentCard } from "@/lib/payment-card";
import { cachedJson } from "@/lib/api-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getPaymentCard();
  return cachedJson(
    {
      bkash: config.bkashEnabled && config.bkashNumber
        ? { number: config.bkashNumber }
        : null,
      nagad: config.nagadEnabled && config.nagadNumber
        ? { number: config.nagadNumber }
        : null,
      instructions: config.instructions || null,
      note: config.note || null,
    },
    "API_MEDIUM",
  );
}
