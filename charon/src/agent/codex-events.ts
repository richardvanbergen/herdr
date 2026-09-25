import type { AgentEvent } from "./runner";

/** Preserve the tool evidence supplied by app-server, including failed reads. */
export function codexToolEvent(
	method: string,
	item: Record<string, any>,
): AgentEvent | undefined {
	const status: "running" | "completed" | "failed" =
		method === "item/started"
			? "running"
			: item.status === "failed" ||
					item.status === "declined" ||
					item.success === false ||
					(typeof item.exitCode === "number" && item.exitCode !== 0)
				? "failed"
				: "completed";
	const base = { type: "tool" as const, id: item.id as string, status };
	if (item.type === "commandExecution")
		return {
			...base,
			name: "Command",
			detail: item.command,
			cwd: item.cwd,
			output: item.aggregatedOutput ?? undefined,
			exitCode: item.exitCode ?? undefined,
		};
	if (item.type === "mcpToolCall")
		return {
			...base,
			name: `${item.server}: ${item.tool}`,
			detail: JSON.stringify(item.arguments, null, 2),
			output:
				item.error || item.result
					? JSON.stringify(item.error ?? item.result, null, 2)
					: undefined,
		};
	if (item.type === "dynamicToolCall")
		return {
			...base,
			name: item.tool,
			detail: JSON.stringify(item.arguments, null, 2),
			output: item.contentItems
				? JSON.stringify(item.contentItems, null, 2)
				: undefined,
		};
	if (item.type === "webSearch")
		return {
			...base,
			name: "Web search",
			detail: item.query ?? JSON.stringify(item.action),
		};
	if (item.type === "fileChange")
		return {
			...base,
			name: "File change",
			detail: JSON.stringify(item.changes, null, 2),
		};
}
