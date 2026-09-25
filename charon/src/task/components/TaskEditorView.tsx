import type { ReactNode } from "react";
import { runnerOptions, type RunnerId } from "#/agent/runner-options";

export function TaskEditorView({
	taskId,
	field,
	runner,
	onRunnerChange,
	onRun,
	isRunning,
	canRun,
	saveError,
}: {
	taskId: number;
	field: ReactNode;
	runner: RunnerId;
	onRunnerChange: (runner: RunnerId) => void;
	onRun: () => void;
	isRunning: boolean;
	canRun: boolean;
	saveError: boolean;
}) {
	return (
		<section aria-label="Task instructions" className="flex flex-col gap-3">
			<h2 className="text-xs font-medium">Instructions</h2>
			{field}
			<div className="flex flex-wrap items-center justify-end gap-2 pt-2">
				<label
					className="text-sm text-muted-foreground"
					htmlFor={`task-runner-${taskId}`}
				>
					Runner
				</label>
				<select
					id={`task-runner-${taskId}`}
					value={runner}
					onChange={(event) => onRunnerChange(event.target.value as RunnerId)}
					className="border border-border bg-background px-2 py-1.5 text-sm text-foreground"
				>
					{runnerOptions.map(({ id, label }) => (
						<option key={id} value={id}>
							{label}
						</option>
					))}
				</select>
				<button
					type="button"
					disabled={isRunning || !canRun}
					onClick={onRun}
					className="border border-primary px-3 py-1.5 text-sm text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isRunning ? "Running…" : "▶ Run task"}
				</button>
			</div>
			{saveError ? (
				<span className="text-xs text-destructive" role="status">
					Task save failed.
				</span>
			) : null}
		</section>
	);
}
