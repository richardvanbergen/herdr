import { ToolActivity } from "#/agent/components/ToolActivity";
import { Button } from "#/components/ui/button";
import { Item, ItemContent } from "#/components/ui/item";

import type { TaskRun } from "../server/schema";
export function TaskRunHistoryView({
	runs,
	loading,
	refreshing,
	error,
	onRefresh,
}: {
	runs: TaskRun[];
	loading: boolean;
	refreshing: boolean;
	error?: string;
	onRefresh: () => void;
}) {
	return (
		<section aria-label="Run debugging" className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-sm font-semibold">Run debugging</h2>
				<Button
					variant="ghost"
					size="sm"
					disabled={refreshing}
					onClick={() => void onRefresh()}
				>
					Refresh runs
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">
				The 20 most recent runs. Inspect the submitted prompt and tool results
				to check which context was read.
			</p>
			{!!error ? (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			) : null}
			{loading ? (
				<p className="text-sm text-muted-foreground">Loading runs…</p>
			) : null}
			{runs?.length === 0 ? (
				<p className="text-sm text-muted-foreground">No runs yet.</p>
			) : null}
			{runs?.map((run) => (
				<Item key={run.id} className="items-stretch">
					<ItemContent>
						<details>
							<summary className="cursor-pointer text-sm font-medium">
								Run #{run.id} · {run.runner} · {run.status} ·{" "}
								{new Date(run.startedAt).toISOString()}
							</summary>
							<div className="mt-3 flex flex-col gap-3">
								{run.error ? (
									<p className="text-sm text-destructive">{run.error}</p>
								) : null}
								<details>
									<summary className="cursor-pointer text-sm">
										Submitted prompt
									</summary>
									<p className="my-2 text-xs text-muted-foreground">
										This is the exact prompt Charon sent. The runner may also
										load its own runtime and workspace instructions.
									</p>
									<pre className="max-h-96 overflow-auto border border-border p-3 text-xs whitespace-pre-wrap break-words">
										{run.prompt ??
											"Prompt capture was not available for this older run."}
									</pre>
								</details>
								<div className="flex flex-col gap-2">
									<h3 className="text-sm font-medium">Tool activity</h3>
									{!run.activity.some(({ event }) => event.type === "tool") ? (
										<p className="text-sm text-muted-foreground">
											{run.prompt === null
												? "Tool activity was not recorded for this older run."
												: "No tool activity recorded."}
										</p>
									) : null}
									{run.activity.map(({ at, event }, index) => (
										<div key={`${at}-${index}`} className="flex flex-col gap-1">
											<span className="text-xs text-muted-foreground">
												{new Date(at).toISOString()}
											</span>
											{event.type === "tool" ? (
												<ToolActivity event={event} />
											) : (
												<p className="text-xs text-muted-foreground">
													{event.message}
												</p>
											)}
										</div>
									))}
								</div>
								<details>
									<summary className="cursor-pointer text-sm">
										Saved output
									</summary>
									<pre className="mt-2 max-h-96 overflow-auto text-sm whitespace-pre-wrap break-words">
										{run.output || "No output saved."}
									</pre>
								</details>
							</div>
						</details>
					</ItemContent>
				</Item>
			))}
		</section>
	);
}
