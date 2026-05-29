import { redirect } from "next/navigation";

export default function MyBidsPage() {
  redirect("/dashboard/auctions?tab=active-bids");
}
