import { GripVertical } from "lucide-react";

/** A small immutable snapshot, not a second editor or query subscription. */
export interface JobDragPreviewData {
	title: string;
	description: string | null;
	taskCount: number | null;
	taskSummaries: string[];
}

export function JobDragPreview({ preview }: { preview: JobDragPreviewData }) {
	return (
		<div
			aria-hidden="true"
			data-slot="job-drag-preview"
			className="pointer-events-none min-w-0 border border-primary/40 bg-card p-4 text-foreground shadow-lg"
		>
			<div className="flex items-center gap-2">
				<GripVertical className="size-4 shrink-0 text-muted-foreground" />
				<span className="truncate text-sm font-semibold">{preview.title}</span>
			</div>
			{preview.description && (
				<p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
					{preview.description}
				</p>
			)}
			{preview.taskCount !== null && (
				<div className="mt-3 border-t border-border pt-2">
					<span className="text-[10px] uppercase tracking-wider text-muted-foreground">
						{preview.taskCount} {preview.taskCount === 1 ? "task" : "tasks"}
					</span>
					{preview.taskSummaries.map((text, index) => (
						<p
							key={index}
							className="mt-1 truncate text-xs text-muted-foreground"
						>
							{text}
						</p>
					))}
				</div>
			)}
		</div>
	);
}
