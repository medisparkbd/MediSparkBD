import { fetchLiveExamCounts } from "@/lib/public-exams-server";
import { cachedJson } from "@/lib/api-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const counts = await fetchLiveExamCounts();
    return cachedJson({ counts }, "API_MEDIUM");
  } catch {
    return cachedJson(
      {
        counts: {
          "ssc-academic": 0,
          "hsc-academic": 0,
          "medical-admission": 0,
          "varsity-admission": 0,
        },
      },
      "API_MEDIUM"
    );
  }
}
