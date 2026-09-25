import type { ReactNode, Ref } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "#/lib/utils";
import { ItemList } from "#/components/ItemList";
import type { BoardColumn } from "#/board/board-types";

export function ColumnView({
	column,
	fullPage,
	adding,
	error,
	onAdd,
	children,
	dropRef,
	isDropTarget,
}: {
	column: BoardColumn;
	fullPage: boolean;
	adding: boolean;
	error: boolean;
	onAdd: () => void;
	children: ReactNode;
	dropRef?: Ref<HTMLElement>;
	isDropTarget?: boolean;
}) {
	return (
		<section
			ref={dropRef}
			data-column-id={column.id}
			className={cn(
				"flex min-h-64 min-w-0 flex-col overflow-hidden bg-background",
				fullPage && "w-full",
				isDropTarget && "ring-1 ring-inset ring-primary bg-primary/5",
			)}
		>
			{!fullPage ? (
				<header className="flex items-center justify-between p-4">
					<h2 className="m-0 text-sm font-semibold">{column.name}</h2>
					<div className="flex items-center gap-2">
						<span className="rounded-none bg-accent px-2 py-0.5 text-xs text-muted-foreground">
							{column.jobIds.length}
						</span>
						<Link
							className="rounded-none px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-primary focus-visible:outline focus-visible:outline-primary"
							to="/column/$columnId"
							params={{ columnId: String(column.id) }}
							aria-label={`Open ${column.name}`}
						>
							↗
						</Link>
					</div>
				</header>
			) : null}
			<ItemList
				className={cn("min-h-0 flex-1 gap-2 p-4 pt-0", fullPage && "gap-0 p-0")}
			>
				{column.jobIds.length === 0 ? (
					<div
						className={cn(
							"py-8 text-center text-sm text-muted-foreground",
							fullPage && "py-12",
						)}
					>
						<p className="font-medium text-primary">All clear here</p>
						<p className="mt-1">
							{column.name === "Backlog"
								? "Nothing in the queue yet."
								: "No jobs here yet."}
						</p>
					</div>
				) : null}
				{children}
			</ItemList>
			<div
				className={cn("border-t border-border p-3", fullPage && "px-0 py-3")}
			>
				<button
					type="button"
					className="w-full rounded-none border border-border bg-background px-3 py-2 text-left text-sm text-muted-foreground hover:border-primary hover:text-foreground"
					disabled={adding}
					onClick={() => onAdd()}
				>
					+ Add job
				</button>
				{error ? (
					<span className="text-xs text-destructive" role="status">
						Could not add job. Edit to retry.
					</span>
				) : null}
			</div>
		</section>
	);
}
