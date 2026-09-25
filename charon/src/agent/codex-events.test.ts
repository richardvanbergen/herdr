import { expect, test } from "bun:test";
import { codexToolEvent } from "./codex-events";

test("command results preserve the actual context read and its exit status", () => {
	expect(
		codexToolEvent("item/completed", {
			id: "read",
			type: "commandExecution",
			status: "completed",
			command: "cat context/poem.md",
			cwd: "/workspace",
			aggregatedOutput: "description: Include Hephaestus",
			exitCode: 0,
		}),
	).toMatchObject({
		type: "tool",
		status: "completed",
		detail: "cat context/poem.md",
		output: "description: Include Hephaestus",
		exitCode: 0,
		cwd: "/workspace",
	});
	expect(
		codexToolEvent("item/completed", {
			id: "failed-read",
			type: "commandExecution",
			status: "completed",
			command: "cat missing.md",
			aggregatedOutput: "No such file",
			exitCode: 1,
		}),
	).toMatchObject({ status: "failed", output: "No such file", exitCode: 1 });
	expect(
		codexToolEvent("item/completed", {
			id: "denied",
			type: "fileChange",
			status: "declined",
			changes: [],
		}),
	).toMatchObject({ status: "failed" });
});

test("MCP results and errors are kept for debugging", () => {
	expect(
		codexToolEvent("item/completed", {
			id: "mcp",
			type: "mcpToolCall",
			server: "files",
			tool: "read",
			status: "failed",
			arguments: { path: "note.md" },
			error: { message: "File missing" },
		}),
	).toMatchObject({
		status: "failed",
		detail: JSON.stringify({ path: "note.md" }, null, 2),
		output: JSON.stringify({ message: "File missing" }, null, 2),
	});
});
