import { Badge } from "#/components/ui/badge";
import { cn } from "#/lib/utils";
const labels = {
	draft: "Draft",
	queued: "Agent queued",
	working: "Agent working",
	blocked: "Needs you",
	review: "Ready for review",
	done: "Done",
};
export function WorkflowStatus({
	status,
	ready,
}: {
	status: keyof typeof labels;
	ready: boolean;
}) {
	return (
		<Badge
			variant="outline"
			className={cn(
				"rounded-none text-xs",
				status === "blocked" || status === "review"
					? "border-amber-500/50 text-amber-500"
					: status === "done"
						? "border-emerald-500/50 text-emerald-500"
						: "text-muted-foreground",
			)}
		>
			{status === "working" && !ready
				? "Pausing after current work"
				: !ready && status !== "done"
					? "Paused"
					: labels[status]}
		</Badge>
	);
}

export type WorkflowState = keyof typeof labels;
