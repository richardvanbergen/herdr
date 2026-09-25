import { GripVertical } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "#/lib/utils";
import { Item, ItemContent } from "#/components/ui/item";

export function JobView({
	job,
	jobTitle,
	columnId,
	fullPage,
	flat,
	title,
	description,
	tasks,
	saveError,
	dragHandleRef,
}: {
	job: { id: number };
	jobTitle: string;
	columnId?: number;
	fullPage: boolean;
	flat: boolean;
	title: ReactNode;
	description: ReactNode;
	tasks: ReactNode;
	saveError: boolean;
	dragHandleRef?: Ref<HTMLButtonElement>;
}) {
	return (
		<Item
			className={cn(
				"items-stretch",
				flat && "border-x-0 border-t-0",
				fullPage && "border-0 bg-transparent p-0 hover:bg-transparent",
			)}
		>
			<ItemContent>
				<div className="flex min-w-0 items-center gap-2">
					{dragHandleRef && (
						<button
							ref={dragHandleRef}
							type="button"
							aria-label={`Drag job ${jobTitle}`}
							title="Drag to move job"
							className="flex size-8 shrink-0 touch-none items-center justify-center text-muted-foreground/70 hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-primary cursor-grab active:cursor-grabbing"
						>
							<GripVertical className="size-4" aria-hidden="true" />
						</button>
					)}
					{title}
					{columnId !== undefined && !fullPage ? (
						<Link
							className="shrink-0 rounded-none px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-primary focus-visible:outline focus-visible:outline-primary"
							to="/column/$columnId/job/$jobId"
							params={{ columnId: String(columnId), jobId: String(job.id) }}
							aria-label={`Open job ${jobTitle}`}
						>
							↗
						</Link>
					) : null}
				</div>
				{description}
				{saveError ? (
					<span className="text-xs text-destructive" role="status">
						Save failed. Edit to retry.
					</span>
				) : null}
				{tasks}
			</ItemContent>
		</Item>
	);
}
