import { Link } from "@tanstack/react-router";
import { Item, ItemContent } from "#/components/ui/item";
import { Label } from "#/components/ui/label";
import { Switch } from "#/components/ui/switch";
import type { Task } from "#/task/server/schema";
export function ContextReferenceView({
	task,
	columnId,
	pending,
	error,
	onChange,
}: {
	task: Pick<Task, "id" | "jobId" | "useJobContext">;
	columnId: number;
	pending: boolean;
	error?: string;
	onChange: (enabled: boolean) => void;
}) {
	return (
		<Item>
			<ItemContent className="gap-2">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<Switch
							id={`job-context-${task.id}`}
							checked={task.useJobContext}
							disabled={pending}
							onCheckedChange={(checked) => onChange(checked)}
						/>
						<Label htmlFor={`job-context-${task.id}`}>Use job context</Label>
					</div>
					<Link
						className="text-sm text-primary hover:underline"
						to="/column/$columnId/job/$jobId"
						params={{ columnId: String(columnId), jobId: String(task.jobId) }}
						search={{ context: undefined }}
					>
						Manage job context
					</Link>
				</div>
				<p className="text-sm text-muted-foreground">
					{task.useJobContext
						? "Future replies and runs receive this job’s context folder."
						: "Job context is disconnected. Turn it on to restore the folder reference."}
				</p>
				{!!error ? (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				) : null}
			</ItemContent>
		</Item>
	);
}
