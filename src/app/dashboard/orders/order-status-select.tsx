"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { OrderStatus } from "@/lib/supabase/types";

const statuses: OrderStatus[] = ["pending", "paid", "shipped", "delivered"];

export default function OrderStatusSelect({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();

  async function handleChange(value: string | null) {
    if (!value) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .update({ status: value as OrderStatus })
      .eq("id", orderId);
    if (error) toast.error(error.message);
    else {
      toast.success("Order updated");
      router.refresh();
    }
  }

  return (
    <Select defaultValue={currentStatus} onValueChange={handleChange}>
      <SelectTrigger className="w-32 text-xs h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statuses.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
