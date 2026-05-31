import { redirect } from "next/navigation";

export default function OrdersDashboardPage() {
  redirect("/orders?tab=sales");
}
