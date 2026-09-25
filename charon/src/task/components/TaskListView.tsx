import { Link } from "@tanstack/react-router";
import { Item } from "#/components/ui/item";
import { ItemList } from "#/components/ItemList";
import type { Task } from "#/task/server/schema";

function TaskRow({ task, columnId }: { task: Task; columnId?: number }) {
	const content = (
		<span className="block min-w-0">
			<span className="block truncate text-sm text-muted-foreground">
				{task.text}
			</span>
			{task.output ? (
				<span className="mt-1 block truncate text-xs text-primary">
					{task.output}
				</span>
			) : null}
		</span>
	);

	return (
		<li className="min-w-0">
			<Item className="border-x-0 border-t-0 p-3">
				{columnId === undefined ? (
					content
				) : (
					<Link
						className="min-w-0 flex-1 focus-visible:outline focus-visible:outline-primary"
						to="/column/$columnId/job/$jobId/task/$taskId"
						params={{
							columnId: String(columnId),
							jobId: String(task.jobId),
							taskId: String(task.id),
						}}
						aria-label={`Open task ${task.text}`}
					>
						{content}
					</Link>
				)}
			</Item>
		</li>
	);
}

export function TaskListView({
	tasks,
	columnId,
	loadError,
	adding,
	addError,
	onAdd,
}: {
	tasks: Task[];
	columnId?: number;
	loadError: boolean;
	adding: boolean;
	addError: boolean;
	onAdd: () => void;
}) {
	return (
		<div className="mt-2 border-t border-border">
			{loadError ? (
				<span className="text-xs text-destructive" role="status">
					Could not load tasks.
				</span>
			) : null}
			{tasks?.length ? (
				<ItemList>
					<ul className="m-0 list-none p-0">
						{tasks.map((task) => (
							<TaskRow key={task.id} task={task} columnId={columnId} />
						))}
					</ul>
				</ItemList>
			) : null}
			{columnId !== undefined ? (
				<button
					type="button"
					className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
					disabled={adding}
					onClick={() => onAdd()}
				>
					+ Add task
				</button>
			) : null}
			{addError ? (
				<span className="text-xs text-destructive" role="status">
					Could not add task. Edit to retry.
				</span>
			) : null}
		</div>
	);
}
