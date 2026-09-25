export const runnerIds = ["codex", "openrouter", "hermes"] as const;
export type RunnerId = (typeof runnerIds)[number];
export const runnerOptions = [
	{ id: "codex", label: "Codex" },
	{ id: "openrouter", label: "OpenRouter" },
	{ id: "hermes", label: "Hermes" },
] satisfies { id: RunnerId; label: string }[];
