import { Streamdown } from "streamdown";
import { ToolActivity } from "#/agent/components/ToolActivity";
import type { AgentEvent } from "#/agent/runner";

export type LiveRun = {
	phase: "running" | "completed" | "failed";
	status: string;
	output: string;
	tools: Extract<AgentEvent, { type: "tool" }>[];
	error?: string;
};
export function TaskOutputView({
	output,
	live,
}: {
	output: string | null;
	live: LiveRun | null;
}) {
	const text = live ? live.output : output;
	return (
		<section aria-label="Task output" className="min-w-0">
			<h2 className="mb-3 text-xs font-medium">Output</h2>
			<div className="min-w-0 border border-border bg-white/[.02] p-4 text-sm leading-6 text-foreground/80">
				{live && (
					<p role="status" className="mb-3 text-xs text-primary">
						{live.status}
					</p>
				)}
				{live?.error && (
					<p role="alert" className="mb-3 text-destructive">
						{live.error}
					</p>
				)}
				{text ? (
					<Streamdown mode={live?.phase === "running" ? "streaming" : "static"}>
						{text}
					</Streamdown>
				) : (
					<p className="text-muted-foreground">
						{live?.phase === "running"
							? "Waiting for output…"
							: "Run this task to see its output."}
					</p>
				)}
			</div>
		</section>
	);
}
export function LiveToolActivity({ live }: { live: LiveRun | null }) {
	if (!live) return null;
	return (
		<section aria-label="Live tool activity" className="mb-5 space-y-2">
			<h2 className="text-xs font-medium">Current run · {live.status}</h2>
			{live.tools.map((tool) => (
				<ToolActivity key={tool.id} event={tool} />
			))}
		</section>
	);
}
