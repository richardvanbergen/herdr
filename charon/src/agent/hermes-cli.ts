import { HermesEvents } from "./hermes-events";
import { readJsonLines } from "./json-lines";
import type { AgentEvent, AgentRunner } from "./runner";

/** Runs the installed Hermes profile; arbitrary prompts travel on stdin. */
export class HermesCliRunner implements AgentRunner {
	constructor(
		private readonly options: { executable?: string; cwd?: string } = {},
	) {}

	async *run(prompt: string, signal?: AbortSignal): AsyncIterable<AgentEvent> {
		signal?.throwIfAborted();
		const start = () =>
			Bun.spawn(
				[
					this.options.executable ?? process.env.HERMES_PATH ?? "hermes",
					"chat",
					"--query-file",
					"-",
					"--oneshot",
					"--format",
					"stream-json",
					"--source",
					"tool",
				],
				{
					cwd: this.options.cwd ?? process.cwd(),
					stdin: new TextEncoder().encode(prompt),
					stdout: "pipe",
					stderr: "pipe",
					detached: true,
				},
			);
		let child: ReturnType<typeof start>;
		try {
			child = start();
		} catch (error) {
			throw new Error(
				`Could not start Hermes: ${error instanceof Error ? error.message : String(error)}. Install Hermes or start the Charon Hermes bridge.`,
			);
		}
		let stderr = "";
		const diagnostics = (async () => {
			const reader = child.stderr.getReader();
			const decoder = new TextDecoder();
			try {
				while (true) {
					const { value, done } = await reader.read();
					stderr = (stderr + decoder.decode(value, { stream: !done })).slice(
						-8000,
					);
					if (done) break;
				}
			} finally {
				reader.releaseLock();
			}
		})();
		const kill = (signal: NodeJS.Signals) => {
			try {
				if (process.platform !== "win32") process.kill(-child.pid, signal);
				else child.kill(signal);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
			}
		};
		let killTimer: ReturnType<typeof setTimeout> | undefined;
		const stop = () => {
			if (child.exitCode !== null) return;
			kill("SIGTERM");
			killTimer ??= setTimeout(() => kill("SIGKILL"), 1500);
			killTimer.unref();
		};
		void child.exited.then(() => {
			if (killTimer) clearTimeout(killTimer);
		});
		signal?.addEventListener("abort", stop, { once: true });
		const events = new HermesEvents();
		try {
			yield { type: "status", message: "Starting Hermes…" };
			for await (const value of readJsonLines(child.stdout)) {
				for (const event of events.accept(value)) yield event;
			}
			const code = await child.exited;
			await diagnostics;
			signal?.throwIfAborted();
			if (code !== 0)
				throw new Error(stderr.trim() || `Hermes exited with code ${code}`);
			if (!events.completed)
				throw new Error("Hermes stream ended without a final result");
		} finally {
			signal?.removeEventListener("abort", stop);
			stop();
			await diagnostics.catch(() => {});
		}
	}
}
