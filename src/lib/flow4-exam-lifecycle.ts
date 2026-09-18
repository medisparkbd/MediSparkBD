// Re-export from the canonical enrolled-exam-lifecycle module.
// This file is kept for backward compatibility during migration.
export {
  type EnrolledExamPhase as Flow4Phase,
  getEnrolledExamPhase as getFlow4Phase,
  enrolledExamPhaseLabel as flow4PhaseLabel,
  isEnrolledExam as isFlow4Exam,
  isEnrolledPracticePhase as isFlow4PracticePhase,
  filterEnrolledExamIds as filterFlow4ExamIds,
} from "@/lib/enrolled-exam-lifecycle";
