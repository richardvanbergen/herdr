import { existsSync } from "node:fs";
import { join } from "node:path";
import { HermesCliRunner } from "./hermes-cli";
import { readJsonLines } from "./json-lines";
import type { AgentEvent, AgentRunner } from "./runner";

export class HermesRunner implements AgentRunner {
	async *run(prompt: string, signal?: AbortSignal): AsyncIterable<AgentEvent> {
		const socket =
			process.env.CHARON_HERMES_SOCKET ??
			join(process.cwd(), ".hermes-runner.sock");
		if (!process.env.CHARON_HERMES_SOCKET && !existsSync(socket)) {
			yield* new HermesCliRunner().run(prompt, signal);
			return;
		}
		const response = await fetch("http://localhost/run", {
			unix: socket,
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ prompt, workspace: process.cwd() }),
			signal,
		});
		if (!response.ok || !response.body)
			throw new Error(
				`Hermes bridge: ${(await response.text()) || response.statusText}`,
			);
		let completed = false;
		for await (const value of readJsonLines(response.body)) {
			const event = value as
				| AgentEvent
				| { type: "done" }
				| { type: "error"; message: string };
			if (event.type === "error") throw new Error(event.message);
			if (event.type === "done") {
				completed = true;
				break;
			}
			if (
				event.type === "status" ||
				event.type === "text" ||
				event.type === "tool"
			)
				yield event;
			else throw new Error("Invalid Hermes bridge event");
		}
		if (!completed)
			throw new Error("Hermes bridge disconnected before completion");
	}
}
