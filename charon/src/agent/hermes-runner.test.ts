import { afterAll, expect, test } from "bun:test";
import { once } from "node:events";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHermesBridge } from "./hermes-bridge";
import { HermesCliRunner } from "./hermes-cli";
import { HermesEvents } from "./hermes-events";
import { HermesRunner } from "./hermes-runner";
import { readJsonLines } from "./json-lines";
import type { AgentEvent } from "./runner";

const directory = mkdtempSync(join(tmpdir(), "charon-hermes-test-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
let fixtureId = 0;
function executable(source: string) {
	const path = join(directory, `hermes-${++fixtureId}`);
	writeFileSync(path, `#!/usr/bin/env bun\n${source}`);
	chmodSync(path, 0o700);
	return path;
}
async function collect(stream: AsyncIterable<AgentEvent>) {
	const events: AgentEvent[] = [];
	for await (const event of stream) events.push(event);
	return events;
}

test("Hermes matches parallel tool results by ID and preserves errors and inputs", () => {
	const stream = new HermesEvents();
	stream.accept({
		type: "tool_use",
		tool_call_id: "a",
		name: "read_file",
		input: { path: "first.md" },
	});
	stream.accept({
		type: "tool_use",
		tool_call_id: "b",
		name: "read_file",
		input: { path: "second.md" },
	});
	expect(
		stream.accept({
			type: "tool_result",
			tool_call_id: "b",
			name: "read_file",
			output: "Hephaestus",
			is_error: false,
		})[0],
	).toMatchObject({
		id: "b",
		status: "completed",
		detail: JSON.stringify({ path: "second.md" }, null, 2),
		output: "Hephaestus",
	});
	expect(
		stream.accept({
			type: "tool_result",
			tool_call_id: "a",
			name: "read_file",
			output: "Missing file",
			is_error: true,
		})[0],
	).toMatchObject({ id: "a", status: "failed", output: "Missing file" });
});

test("text deltas preserve whitespace and the final result is not duplicated", () => {
	const stream = new HermesEvents();
	expect(stream.accept({ type: "text", text: "word" })).toEqual([
		{ type: "text", delta: "word" },
	]);
	expect(stream.accept({ type: "text", text: " " })).toEqual([
		{ type: "text", delta: " " },
	]);
	expect(
		stream.accept({ type: "result", exit_code: 0, text: "word " }),
	).toEqual([]);
	expect(stream.completed).toBe(true);
	expect(
		new HermesEvents().accept({
			type: "result",
			exit_code: 0,
			text: "Non-streaming provider",
		}),
	).toEqual([{ type: "text", delta: "Non-streaming provider" }]);
	expect(() =>
		new HermesEvents().accept({
			type: "result",
			exit_code: 1,
			error: "Provider unavailable",
		}),
	).toThrow("Provider unavailable");
});

test("CLI sends literal prompts through stdin and streams the result", async () => {
	const prompt = 'quotes " and $(not-a-command) and `literal`\nHephaestus';
	const binary = executable(
		`const prompt=await Bun.stdin.text(); console.log(JSON.stringify({type:'system',model:'configured-model'}));console.log(JSON.stringify({type:'text',text:prompt}));console.log(JSON.stringify({type:'result',exit_code:0,text:prompt}));`,
	);
	const events = await collect(
		new HermesCliRunner({ executable: binary, cwd: directory }).run(prompt),
	);
	expect(events.filter((event) => event.type === "text")).toEqual([
		{ type: "text", delta: prompt },
	]);
});

test("CLI surfaces missing executables, unsuccessful exits and truncated streams", async () => {
	await expect(
		collect(
			new HermesCliRunner({ executable: join(directory, "missing") }).run(
				"test",
			),
		),
	).rejects.toThrow("Could not start Hermes");
	const failed = executable(
		`await Bun.stdin.text();console.error('Authentication unavailable');process.exit(1)`,
	);
	await expect(
		collect(new HermesCliRunner({ executable: failed }).run("test")),
	).rejects.toThrow("Authentication unavailable");
	const truncated = executable(
		`await Bun.stdin.text();console.log(JSON.stringify({type:'text',text:'partial'}))`,
	);
	await expect(
		collect(new HermesCliRunner({ executable: truncated }).run("test")),
	).rejects.toThrow("without a final result");
});

test("CLI cancellation stops the child instead of reporting completion", async () => {
	const binary = executable(
		`await Bun.stdin.text();console.log(JSON.stringify({type:'system'}));await Bun.sleep(30000)`,
	);
	const controller = new AbortController();
	const stream = new HermesCliRunner({ executable: binary })
		.run("test", controller.signal)
		[Symbol.asyncIterator]();
	await stream.next();
	await stream.next();
	controller.abort(new Error("Cancelled test run"));
	await expect(stream.next()).rejects.toThrow("Cancelled test run");
});

test("JSON lines handle split UTF-8 and a final line without newline", async () => {
	const data = new TextEncoder().encode('{"text":"⚒"}\n{"type":"done"}');
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const byte of data) controller.enqueue(new Uint8Array([byte]));
			controller.close();
		},
	});
	const values = [];
	for await (const value of readJsonLines(stream)) values.push(value);
	expect(values).toEqual([{ text: "⚒" }, { type: "done" }]);
});

test("socket bridge shares the host workspace and preserves streamed tool evidence", async () => {
	const socket = join(directory, "bridge.sock");
	let submitted = "";
	const server = createHermesBridge({
		workspace: directory,
		clientWorkspace: process.cwd(),
		runner: {
			async *run(prompt) {
				submitted = prompt;
				yield {
					type: "tool",
					id: "read",
					name: "read_file",
					status: "completed",
					output: "Use Hephaestus",
				};
				yield { type: "text", delta: "A poem" };
			},
		},
	});
	server.listen(socket);
	await once(server, "listening");
	const previous = process.env.CHARON_HERMES_SOCKET;
	process.env.CHARON_HERMES_SOCKET = socket;
	try {
		const events = await collect(
			new HermesRunner().run("Job context folder: /workspace/context/jobs/1"),
		);
		expect(submitted).toContain(`refer to ${directory}/ on this host`);
		expect(submitted).toContain(
			"Job context folder: /workspace/context/jobs/1",
		);
		expect(events).toContainEqual({
			type: "tool",
			id: "read",
			name: "read_file",
			status: "completed",
			output: "Use Hephaestus",
		});
		expect(events.at(-1)).toEqual({ type: "text", delta: "A poem" });
		const invalid = await fetch("http://localhost/run", {
			unix: socket,
			method: "POST",
			body: JSON.stringify({ prompt: "test", workspace: "/another-project" }),
		});
		expect(invalid.status).toBe(400);
	} finally {
		if (previous === undefined) delete process.env.CHARON_HERMES_SOCKET;
		else process.env.CHARON_HERMES_SOCKET = previous;
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
