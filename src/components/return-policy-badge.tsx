import { cn } from "@/lib/utils";

const POLICY_LABEL: Record<string, string> = {
  all_sales_final: "All Sales Final",
  doa_guarantee:   "DOA Guarantee",
  case_by_case:    "Contact Me First",
};

const POLICY_COLOR: Record<string, string> = {
  all_sales_final: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  doa_guarantee:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  case_by_case:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const POLICY_ICON: Record<string, string> = {
  all_sales_final: "🚫",
  doa_guarantee:   "🌱",
  case_by_case:    "💬",
};

export function ReturnPolicyBadge({
  type,
  notes,
}: {
  type: string;
  notes?: string | null;
}) {
  const label = POLICY_LABEL[type];
  const color = POLICY_COLOR[type];
  const icon  = POLICY_ICON[type];
  if (!label) return null;

  return (
    <div className="space-y-1">
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", color)}>
        {icon} {label}
      </span>
      {notes && (
        <p className="text-xs text-muted-foreground leading-relaxed">{notes}</p>
      )}
    </div>
  );
}
