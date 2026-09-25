import type { AgentEvent } from "./runner";

type ToolEvent = Extract<AgentEvent, { type: "tool" }>;
export class HermesEvents {
	completed = false;
	private streamed = false;
	private sequence = 0;
	private pending: ToolEvent[] = [];

	accept(value: unknown): AgentEvent[] {
		if (!value || typeof value !== "object")
			throw new Error("Invalid Hermes stream event");
		const event = value as Record<string, unknown>;
		if (event.type === "system")
			return [
				{
					type: "status",
					message: `Hermes is thinking${typeof event.model === "string" && event.model ? ` (${event.model})` : ""}…`,
				},
			];
		if (event.type === "text" && typeof event.text === "string") {
			this.streamed ||= !!event.text;
			return [{ type: "text", delta: event.text }];
		}
		if (event.type === "tool_use" && typeof event.name === "string") {
			const tool: ToolEvent = {
				type: "tool",
				id:
					typeof event.tool_call_id === "string"
						? event.tool_call_id
						: `hermes-${++this.sequence}`,
				name: event.name,
				status: "running",
				detail:
					event.input === undefined
						? undefined
						: JSON.stringify(event.input, null, 2),
			};
			this.pending.push(tool);
			return [tool];
		}
		if (event.type === "tool_result" && typeof event.name === "string") {
			const index = this.pending.findIndex((tool) =>
				typeof event.tool_call_id === "string"
					? tool.id === event.tool_call_id
					: tool.name === event.name,
			);
			const started = index < 0 ? undefined : this.pending.splice(index, 1)[0];
			return [
				{
					...started,
					type: "tool",
					id:
						started?.id ??
						(typeof event.tool_call_id === "string"
							? event.tool_call_id
							: `hermes-${++this.sequence}`),
					name: event.name,
					status: event.is_error ? "failed" : "completed",
					output:
						typeof event.output === "string"
							? event.output
							: JSON.stringify(event.output),
				},
			];
		}
		if (event.type === "result") {
			if (event.exit_code !== 0)
				throw new Error(
					typeof event.error === "string"
						? event.error
						: `Hermes run failed (exit ${String(event.exit_code)})`,
				);
			this.completed = true;
			// Some providers only return final text. Streaming providers have already emitted it.
			return !this.streamed && typeof event.text === "string" && event.text
				? [{ type: "text", delta: event.text }]
				: [];
		}
		return [];
	}
}
