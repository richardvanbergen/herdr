import type { AgentEvent } from "#/agent/runner";
import type { RunnerId } from "#/agent/registry";

export type RunActivity = {
	at: number;
	event: Exclude<AgentEvent, { type: "text" }>;
};
export type TaskRunInput = { id: number; text: string; runner: RunnerId };
export type TaskStreamEvent =
	| { type: "started"; runId: number }
	| AgentEvent
	| { type: "completed"; output: string }
	| { type: "failed"; message: string };
