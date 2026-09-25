import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requireAnyPermission } from "@/lib/admin";
import { logAdminAction } from "@/lib/administration";
import {
  attachBankQuestion,
  deleteQuestion,
  duplicateQuestion,
  fetchQuestions,
  reorderQuestions,
  saveQuestion,
  saveQuestionsBulk,
} from "@/lib/exams-admin";

export const dynamic = "force-dynamic";

/** ?examId=... (or examId=bank for bank-only) & ?subject=... & ?version=bangla|english & ?set=A|B */
export async function GET(request: NextRequest) {
  const admin = await requireAnyPermission(request, ["manageExams", "managePublicExam"]);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const { normalizeSet, normalizeVersion } = await import("@/lib/exam-variants");
  const version = normalizeVersion(params.get("version"));
  const set = normalizeSet(params.get("set"));
  const questions = await fetchQuestions({
    examId: params.get("examId") ?? undefined,
    subject: params.get("subject") ?? undefined,
  });
  // Version/Set view: overlay the authored variant content on the permanent
  // slots so each language/set is managed separately (same IDs, same order).
  if (version && set && (params.get("examId") ?? "") !== "bank") {
    try {
      const { fetchVariantMap } = await import("@/lib/exam-variants");
      const { parseJsonColumn } = await import("@/lib/mysql");
      const { normalizeStoredAnswerIndex } = await import("@/lib/paste-mcq-parser");
      const examId = String(params.get("examId") ?? "");
      const variants = await fetchVariantMap(examId);
      const merged = questions.map((q, index) => {
        const v = variants.get(`${Number(q.id)}:${version}:${set}`);
        if (!v || q.id === null) return { ...q, order: index + 1, hasVariant: false };
        const opts = parseJsonColumn<unknown[]>(v.options);
        return {
          ...q,
          order: index + 1,
          hasVariant: true,
          question: v.question,
          options: Array.isArray(opts) ? opts.map(String) : q.options,
          // Preserve an explicit unknown (NULL) — never coerce it to 0/A here.
          correctIndex: normalizeStoredAnswerIndex(v.correct_index),
          explanation: v.explanation ?? null,
          marks: Number(v.marks) || q.marks,
          questionImage: v.question_image ?? null,
        };
      });
      return NextResponse.json(
        { questions: merged },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      // Fall through to base questions on error.
    }
  }
  return NextResponse.json(
    { questions },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const admin = await requireAnyPermission(request, ["manageExams", "managePublicExam"]);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  // Variant save (Language Version + Set A/B): { examId, version, set, ...question fields }
  // The permanent slot (exam_questions.id) stays the same — only the
  // version/set cell content is written. No auto-translation is performed.
  const { normalizeSet, normalizeVersion } = await import("@/lib/exam-variants");
  const bodyVersion = normalizeVersion((body as Record<string, unknown>).version);
  const bodySet = normalizeSet((body as Record<string, unknown>).set);
  if (bodyVersion && bodySet) {
    try {
      const { query } = await import("@/lib/mysql");
      const { saveVariant } = await import("@/lib/exam-variants");
      const { exec } = await import("@/lib/mysql");
      const asString = (v: unknown): string => (typeof v === "string" ? v : "");
      const str = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);
      const num = (v: unknown, fb = 0): number => {
        // Empty strings must fall back — Number("") is 0, which would
        // silently store answer A for a missing correctIndex.
        if (typeof v === "string" && v.trim() === "") return fb;
        const n = Number(v);
        return Number.isFinite(n) ? n : fb;
      };
      // Resolve the permanent slot id for (examId, 1-based order), creating
      // the base placeholder slot when the admin increased Total Questions
      // but the slot row does not exist yet. Variants never create new IDs.
      const resolveOrCreateSlot = async (examId: string, order: number): Promise<number> => {
        const found = await query<{ id: number }[]>(
          `SELECT id FROM exam_questions WHERE exam_id = ? AND sort_order = ? LIMIT 1`,
          [examId, order],
        );
        if (found[0]) return Number(found[0].id);
        let marksPerSlot = 1;
        try {
          const examRows = await query<{ marks_per_question: string | number | null }[]>(
            `SELECT marks_per_question FROM exams WHERE id = ? LIMIT 1`,
            [examId],
          );
          const raw = Number(examRows[0]?.marks_per_question ?? 1);
          if (Number.isFinite(raw) && raw > 0) marksPerSlot = raw;
        } catch {}
        const inserted = await exec(
          `INSERT INTO exam_questions (exam_id, bank_subject, question, question_image, options, correct_index, explanation, marks, sort_order, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [examId, "", "", null, JSON.stringify(["", "", "", ""]), null, null, marksPerSlot, order, 1],
        );
        const insertId = (inserted as unknown as { insertId?: number })?.insertId;
        if (insertId) return Number(insertId);
        const retry = await query<{ id: number }[]>(
          `SELECT id FROM exam_questions WHERE exam_id = ? AND sort_order = ? LIMIT 1`,
          [examId, order],
        );
        return Number(retry[0]?.id ?? 0);
      };
      // Bulk variant save: { examId, version, set, questions: [...] }
      if (Array.isArray((body as Record<string, unknown>).questions)) {
        const examId = String((body as Record<string, unknown>).examId ?? "").trim();
        const items = (body as Record<string, unknown>).questions as Record<string, unknown>[];
        if (!examId) return NextResponse.json({ error: "Missing exam id." }, { status: 400 });
        if (items.length === 0) return NextResponse.json({ error: "No questions to save." }, { status: 400 });
        if (items.length > 200) return NextResponse.json({ error: "Too many questions in one batch (max 200)." }, { status: 400 });
        const slotRows = await query<{ id: number; sort_order: number }[]>(
          `SELECT id, sort_order FROM exam_questions WHERE exam_id = ? ORDER BY sort_order ASC, id ASC`,
          [examId],
        );
        const byOrder = new Map(slotRows.map((r) => [Number(r.sort_order), Number(r.id)]));
        let saved = 0;
        for (let idx = 0; idx < items.length; idx += 1) {
          const item = items[idx] as Record<string, unknown>;
          const explicitId = num(item.id, 0);
          const order = num(item.order, idx + 1);
          let questionId = Number.isInteger(explicitId) && explicitId > 0
            ? explicitId
            : (byOrder.get(order) ?? 0);
          if (!questionId && Number.isInteger(order) && order > 0) {
            // eslint-disable-next-line no-await-in-loop
            questionId = await resolveOrCreateSlot(examId, order);
          }
          if (!questionId) continue;
          const qImage = str(item.questionImage) || str(item.question_image) || null;
          const text = str(item.question);
          if (text.trim().length < 3 && !qImage) continue;
          const options = Array.isArray(item.options) ? item.options.map((o) => String(o)) : [];
          if (options.length < 2 || options.some((o) => o.length === 0)) continue;
          const correctIndex = num(item.correctIndex, -1);
          if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) continue;
          // eslint-disable-next-line no-await-in-loop
          await saveVariant({
            questionId,
            version: bodyVersion,
            set: bodySet,
            question: text,
            options,
            correctIndex,
            explanation: str(item.explanation) || null,
            marks: num(item.marks, 1) || 1,
            questionImage: qImage,
          });
          saved += 1;
        }
        await logAdminAction(admin, "question.variant_bulk_save", `exam=${examId} ${bodyVersion}/${bodySet} count=${saved}`, request);
        return NextResponse.json({ ok: true, saved });
      }
      // Single variant save.
      const examId = asString((body as Record<string, unknown>).examId).trim();
      let questionId = num((body as Record<string, unknown>).id, 0);
      if ((!Number.isInteger(questionId) || questionId <= 0) && examId) {
        const order = num((body as Record<string, unknown>).order, 0);
        if (Number.isInteger(order) && order > 0) {
          questionId = await resolveOrCreateSlot(examId, order);
        }
      }
      if (!Number.isInteger(questionId) || questionId <= 0) {
        return NextResponse.json({ error: "Missing question id (save the slot first)." }, { status: 400 });
      }
      // The slot must belong to this exam (permanent ID guard).
      if (examId) {
        const owner = await query<{ exam_id: string | null }[]>(
          `SELECT exam_id FROM exam_questions WHERE id = ? LIMIT 1`,
          [questionId],
        );
        if (!owner[0] || owner[0].exam_id !== examId) {
          return NextResponse.json({ error: "Question does not belong to this exam." }, { status: 400 });
        }
      }
      const qImage = str((body as Record<string, unknown>).questionImage) || str((body as Record<string, unknown>).question_image) || null;
      const text = str((body as Record<string, unknown>).question);
      const options = Array.isArray((body as Record<string, unknown>).options)
        ? ((body as Record<string, unknown>).options as unknown[]).map((o) => String(o))
        : [];
      await saveVariant({
        questionId,
        version: bodyVersion,
        set: bodySet,
        question: text,
        options,
        correctIndex: num((body as Record<string, unknown>).correctIndex, -1),
        explanation: str((body as Record<string, unknown>).explanation) || null,
        marks: num((body as Record<string, unknown>).marks, 1) || 1,
        questionImage: qImage,
      });
      await logAdminAction(admin, "question.variant_save", `q=${questionId} ${bodyVersion}/${bodySet}`, request);
      return NextResponse.json({ ok: true, hasVariant: true, id: questionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save the version/set content.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
  // Duplicate a question within same exam: { duplicateId: number }
  if (body.duplicateId !== undefined) {
    const dupId = Number(body.duplicateId);
    if (!Number.isInteger(dupId) || dupId <= 0) {
      return NextResponse.json({ error: "Invalid duplicateId." }, { status: 400 });
    }
    try {
      const questions = await duplicateQuestion(dupId);
      await logAdminAction(admin, "question.duplicate", `id=${dupId}`, request);
      return NextResponse.json({ questions });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to duplicate question.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
  // Bulk save: { examId, questions: [...] } — saves only changed questions in one request (fast, 1 roundtrip)
  if (Array.isArray((body as Record<string, unknown>).questions)) {
    const examId = String((body as Record<string, unknown>).examId ?? "").trim();
    const items = (body as Record<string, unknown>).questions as Record<string, unknown>[];
    try {
      const result = await saveQuestionsBulk(examId, items);
      await logAdminAction(admin, "question.bulk_save", `exam=${examId} count=${items.length}`, request);
      return NextResponse.json({ ok: true, questions: result.questions, savedIds: result.savedIds });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save questions.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
  try {
    const result = await saveQuestion(body);
    await logAdminAction(admin, "question.save", String(body.subject ?? ""), request);
    // Return fresh exam questions so client can sync without a second fetch when possible
    return NextResponse.json({ ok: true, questions: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save the question.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const admin = await requireAnyPermission(request, ["manageExams", "managePublicExam"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { examId?: unknown; order?: unknown } | null;
  const examIdRaw = typeof body?.examId === "string" ? body.examId.trim() : "";
  const examId = examIdRaw === "bank" ? null : examIdRaw || null;
  // Allow null for bank reorder as well (examId may be null or omitted)
  if (!Array.isArray(body?.order)) {
    return NextResponse.json({ error: "Invalid order payload." }, { status: 400 });
  }
  const ids = (body.order as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return NextResponse.json({ error: "No valid ids." }, { status: 400 });
  try {
    const questions = await reorderQuestions(examId, ids);
    await logAdminAction(admin, "question.reorder", `exam=${examId ?? "bank"} count=${ids.length}`, request);
    return NextResponse.json({ questions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reorder.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** PATCH — attach a copy of a bank question to an exam: { id, examId }. */
export async function PATCH(request: NextRequest) {
  const admin = await requireAnyPermission(request, ["manageExams", "managePublicExam"]);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { id?: unknown; examId?: unknown } | null;
  const id = Number(body?.id);
  const examId = typeof body?.examId === "string" ? body.examId : "";
  if (!Number.isInteger(id) || !examId) {
    return NextResponse.json({ error: "Missing question id or exam id." }, { status: 400 });
  }
  try {
    const questions = await attachBankQuestion(id, examId);
    await logAdminAction(admin, "question.attach", `question=${id} exam=${examId}`, request);
    return NextResponse.json({ questions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to attach the question.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAnyPermission(request, ["manageExams", "managePublicExam"]);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Missing question id." }, { status: 400 });
  }
  await deleteQuestion(id);
  return NextResponse.json({ ok: true });
}
