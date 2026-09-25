import { Tool, ToolContent, ToolHeader } from "#/components/ai-elements/tool";
import type { AgentEvent } from "../runner";

export function ToolActivity({
	event,
}: {
	event: Extract<AgentEvent, { type: "tool" }>;
}) {
	return (
		<Tool>
			<ToolHeader name={event.name} status={event.status} />
			<ToolContent className="max-h-96 overflow-auto break-words">
				{event.cwd ? (
					<p className="mb-2">Working directory: {event.cwd}</p>
				) : null}
				{event.detail ? (
					<div>
						<p className="mb-1 font-semibold">Input</p>
						<pre className="whitespace-pre-wrap break-words">
							{event.detail}
						</pre>
					</div>
				) : null}
				{event.output !== undefined ? (
					<div className="mt-3">
						<p className="mb-1 font-semibold">Returned output</p>
						<pre className="whitespace-pre-wrap break-words">
							{event.output || "(Empty output)"}
						</pre>
					</div>
				) : null}
				{event.exitCode !== undefined ? (
					<p className="mt-3">Exit code: {event.exitCode}</p>
				) : null}
			</ToolContent>
		</Tool>
	);
}
