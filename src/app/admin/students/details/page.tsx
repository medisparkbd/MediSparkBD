import { redirect } from "next/navigation";

export const metadata = { title: "Student Details — MediSpark Admin" };

/** Student details are accessed via /admin/students/details/[uid]. */
export default function AdminStudentsDetailsPage() {
  redirect("/admin/students/all");
}
