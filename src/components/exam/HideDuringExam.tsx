"use client";

import { useExamLock } from "./ExamLockContext";

export default function HideDuringExam({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLocked } = useExamLock();
  if (isLocked) return null;
  return <>{children}</>;
}
