import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const admin = await requireAnyPermission(request, ["manageExams", "managePublicExam"]);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        "Image-based question detection is disabled. Please use Paste Questions — paste MCQs as text and the system will automatically detect, separate, and map to Q01..QNN for Preview → Review/Edit → Save.",
    },
    { status: 410 },
  );
}
