import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRouterClient } from "@orpc/server";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { taskPrompt } from "#/agent/runner";
import { jobContextPrompt } from "./prompt";
import {
	createContext,
	deleteContext,
	jobContextFolder,
	listContext,
	readContext,
	updateContext,
} from "./store";

const temporary = mkdtempSync(join(tmpdir(), "charon-context-test-"));
const previousRoot = process.env.CHARON_CONTEXT_ROOT;
const previousDb = process.env.CHARON_DB_PATH;
process.env.CHARON_CONTEXT_ROOT = join(temporary, "context");
process.env.CHARON_DB_PATH = join(temporary, "charon.db");
const { db } = await import("#/db");
const { jobs } = await import("#/job/server/schema");
const { tasks } = await import("#/task/server/schema");
const { contextRouter } = await import("./orpc");
const { taskRouter } = await import("#/task/server/orpc");
const api = createRouterClient({ context: contextRouter, task: taskRouter });
const content = {
	type: "text" as const,
	title: "Writing: conventions",
	description: "Tone #1",
	body: "Use British spelling.\n",
};
let jobId: number;

beforeAll(() => {
	migrate(db, { migrationsFolder: "drizzle" });
	jobId = db
		.insert(jobs)
		.values({ title: "Context test" })
		.returning()
		.get().id;
});
afterAll(() => {
	if (previousRoot === undefined) delete process.env.CHARON_CONTEXT_ROOT;
	else process.env.CHARON_CONTEXT_ROOT = previousRoot;
	if (previousDb === undefined) delete process.env.CHARON_DB_PATH;
	else process.env.CHARON_DB_PATH = previousDb;
	rmSync(temporary, { recursive: true, force: true });
});

describe("job context files", () => {
	test("API creates real files, edits metadata/body, lists without bodies, and deletes", async () => {
		const saved = await api.context.create({ jobId, content });
		expect(
			readFileSync(join(jobContextFolder(jobId), saved.path), "utf8"),
		).toContain("Use British spelling.");
		expect(await api.context.read({ jobId, path: saved.path })).toMatchObject(
			content,
		);
		expect((await api.context.list({ jobId })).files[0]).not.toHaveProperty(
			"body",
		);
		const updated = await api.context.update({
			jobId,
			path: saved.path,
			version: saved.version,
			content: { ...content, body: "Updated" },
		});
		expect(updated.body).toBe("Updated");
		expect(updated.path).toBe(saved.path);
		await api.context.delete({
			jobId,
			path: saved.path,
			version: updated.version,
		});
		expect(listContext(jobId).files).toHaveLength(0);
	});

	test("ordinary Markdown and nested agent files appear without a catalog", () => {
		const folder = jobContextFolder(jobId);
		mkdirSync(join(folder, "decisions"));
		writeFileSync(
			join(folder, "decisions", "agent-note.md"),
			"A saved decision",
		);
		expect(readContext(jobId, "decisions/agent-note.md")).toMatchObject({
			type: "text",
			title: "agent note",
			body: "A saved decision",
		});
		writeFileSync(
			join(folder, "decisions", "agent-note.md"),
			"A revised decision",
		);
		expect(readContext(jobId, "decisions/agent-note.md").body).toBe(
			"A revised decision",
		);
		expect(
			listContext(jobId).files.some(
				(file) => file.path === "decisions/agent-note.md",
			),
		).toBe(true);
		expect(listContext(jobId + 100).files).toHaveLength(0);
	});

	test("stale UI updates and deletes preserve an agent edit", () => {
		const saved = createContext(jobId, content);
		writeFileSync(join(jobContextFolder(jobId), saved.path), "Agent edit");
		expect(() =>
			updateContext(jobId, saved.path, saved.version, content),
		).toThrow("changed since you opened");
		expect(() => deleteContext(jobId, saved.path, saved.version)).toThrow(
			"changed since you opened",
		);
		expect(readContext(jobId, saved.path).body).toBe("Agent edit");
	});

	test("preserves extra metadata; malformed metadata does not hide other files", () => {
		const folder = jobContextFolder(jobId);
		writeFileSync(
			join(folder, "extra.md"),
			"---\ntype: text\nauthor: human\n---\n\nOriginal",
		);
		const file = readContext(jobId, "extra.md");
		updateContext(jobId, file.path, file.version, content);
		expect(readFileSync(join(folder, "extra.md"), "utf8")).toContain(
			"author: human",
		);
		writeFileSync(join(folder, "broken.md"), "---\ntitle: [\n---\nBody");
		expect(
			listContext(jobId).files.find((item) => item.path === "broken.md")?.error,
		).toContain("Invalid YAML");
		expect(
			listContext(jobId).files.find((item) => item.path === "extra.md")?.error,
		).toBeUndefined();
	});

	test("rejects invalid jobs, traversal, and symlinks through the UI API", async () => {
		await expect(
			api.context.create({ jobId: 999999, content }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(() => readContext(jobId, "../../outside.md")).toThrow();
		const outside = join(temporary, "outside.md");
		writeFileSync(outside, "Keep");
		symlinkSync(outside, join(jobContextFolder(jobId), "linked.md"));
		expect(() => readContext(jobId, "linked.md")).toThrow("Linked files");
		expect(readFileSync(outside, "utf8")).toBe("Keep");
	});

	test("tasks share the path, default on, and persist reference removal/restoration", async () => {
		const first = await api.task.create({ jobId, text: "First task" });
		const sibling = await api.task.create({ jobId, text: "Sibling task" });
		expect(first.useJobContext).toBe(true);
		expect(jobContextPrompt(first)).toBe(jobContextPrompt(sibling));
		const prompt = taskPrompt({
			job: { title: "Test", description: null },
			task: first.text,
			contextInstructions: jobContextPrompt(first),
		});
		expect(prompt).toContain(jobContextFolder(jobId));
		expect(prompt).not.toContain(content.body);
		const removed = await api.task.setJobContext({
			id: first.id,
			enabled: false,
		});
		expect(jobContextPrompt(removed)).toBe("");
		expect(
			(await api.task.list({ jobId })).find((task) => task.id === first.id)
				?.useJobContext,
		).toBe(false);
		const restored = await api.task.setJobContext({
			id: first.id,
			enabled: true,
		});
		expect(jobContextPrompt(restored)).toContain(jobContextFolder(jobId));
		expect(db.select().from(tasks).all().length).toBe(2);
	});
	test("run debugging preserves submitted prompt and tool output across later file edits", async () => {
		const { executeTaskRun } = await import("#/task/server/execute-task");
		const task = await api.task.create({ jobId, text: "Write a poem" });
		const saved = createContext(jobId, {
			...content,
			body: "Feature Hephaestus.",
		});
		let submitted = "";
		const stream = executeTaskRun(
			{ id: task.id, text: task.text, runner: "codex" },
			{
				async *run(prompt) {
					submitted = prompt;
					yield {
						type: "tool",
						id: "read",
						name: "Command",
						status: "completed",
						detail: `cat ${saved.path}`,
						output: readContext(jobId, saved.path).body,
						exitCode: 0,
					};
					writeFileSync(
						join(jobContextFolder(jobId), saved.path),
						"A later edit",
					);
					yield { type: "text", delta: "Hephaestus tends the forge." };
				},
			},
		);
		const events = [];
		for await (const event of stream) events.push(event);
		const run = (await api.task.runs({ id: task.id }))[0];
		expect(run.prompt).toBe(submitted);
		expect(run.prompt).toContain(
			"Before answering or doing the task, list this folder",
		);
		expect(run.prompt).not.toContain("Feature Hephaestus.");
		expect(run.activity[0].event).toMatchObject({
			output: "Feature Hephaestus.",
			exitCode: 0,
		});
		expect(run.status).toBe("completed");
		expect(run.output).toBe("Hephaestus tends the forge.");
		expect(events.at(-1)?.type).toBe("completed");
	});

	test("interrupted runs retain evidence and do not remain marked running", async () => {
		const { executeTaskRun } = await import("#/task/server/execute-task");
		const task = await api.task.create({ jobId, text: "Interrupted task" });
		const stream = executeTaskRun(
			{ id: task.id, text: task.text, runner: "codex" },
			{
				async *run() {
					yield {
						type: "tool",
						id: "read",
						name: "Command",
						status: "failed",
						output: "Read failed",
						exitCode: 1,
					};
					yield { type: "text", delta: "Unfinished" };
				},
			},
		);
		await stream.next();
		await stream.next();
		await stream.next();
		await stream.return(undefined);
		const run = (await api.task.runs({ id: task.id }))[0];
		expect(run.status).toBe("failed");
		expect(run.error).toBe("Run interrupted");
		expect(run.prompt).toContain("Interrupted task");
		expect(run.activity[0].event).toMatchObject({
			output: "Read failed",
			exitCode: 1,
		});
	});
});
