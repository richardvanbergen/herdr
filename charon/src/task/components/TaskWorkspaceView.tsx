import type { ReactNode } from "react";
import { cn } from "#/lib/utils";
import { Button } from "#/components/ui/button";

export type TaskPanel = "output" | "discussion" | "activity" | "context";
export function TaskWorkspaceView({
	title,
	taskId,
	status,
	panel,
	onPanelChange,
	onDelete,
	deleting,
	deleteError,
	editor,
	output,
	discussion,
	activity,
	context,
}: {
	title: string;
	taskId: number;
	status: string;
	panel: TaskPanel;
	onPanelChange: (panel: TaskPanel) => void;
	onDelete: () => void;
	deleting: boolean;
	deleteError: boolean;
	editor: ReactNode;
	output: ReactNode;
	discussion: ReactNode;
	activity: ReactNode;
	context: ReactNode;
}) {
	return (
		<section className="flex min-h-0 min-w-0 flex-1 flex-col">
			<header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
				<div className="min-w-0">
					<div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
						<span className="text-primary">{status}</span>
						<span>Task / {taskId}</span>
					</div>
					<h1 className="truncate text-base font-semibold" title={title}>
						{title}
					</h1>
				</div>
				<Button
					variant="ghost"
					size="sm"
					disabled={deleting}
					onClick={onDelete}
					className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
				>
					Delete task
				</Button>
			</header>
			{deleteError && (
				<p role="alert" className="px-4 py-2 text-destructive">
					Could not delete task.
				</p>
			)}
			<nav
				aria-label="Task workspace views"
				className="flex shrink-0 border-b border-border px-4"
			>
				{(["output", "discussion", "activity", "context"] as const).map(
					(value) => (
						<button
							key={value}
							type="button"
							aria-current={panel === value ? "page" : undefined}
							onClick={() => onPanelChange(value)}
							className={cn(
								"border-b-2 border-transparent px-3 py-3 text-xs capitalize text-muted-foreground hover:text-foreground",
								panel === value && "border-primary text-foreground",
								panel === "output" &&
									value === "discussion" &&
									"lg:border-primary lg:text-foreground",
								value === "output" && "lg:hidden",
								value === "context" && "xl:hidden",
							)}
						>
							{value === "output" ? "Task & output" : value}
						</button>
					),
				)}
			</nav>
			<div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_280px]">
				<div
					className={cn(
						"min-h-0 min-w-0 flex-col gap-6 overflow-auto p-4 lg:flex lg:border-r lg:border-border",
						panel === "output" ? "flex" : "hidden",
					)}
				>
					{editor}
					{output}
				</div>
				<div
					className={cn(
						"min-h-0 min-w-0 flex-col overflow-hidden lg:flex",
						panel === "discussion" || panel === "activity" ? "flex" : "hidden",
						panel === "context" && "hidden lg:hidden xl:flex",
					)}
				>
					<div
						className={cn(
							"min-h-0 flex-1 flex-col",
							panel !== "activity" ? "flex" : "hidden",
						)}
					>
						{discussion}
					</div>
					<div
						className={cn(
							"min-h-0 flex-1 overflow-auto p-4",
							panel === "activity" ? "block" : "hidden",
						)}
					>
						{activity}
					</div>
				</div>
				<aside
					className={cn(
						"min-h-0 min-w-0 flex-col gap-5 overflow-auto bg-card p-4 xl:flex xl:border-l xl:border-border",
						panel === "context" ? "flex" : "hidden",
					)}
				>
					{context}
				</aside>
			</div>
		</section>
	);
}
