import { once } from "node:events";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { HermesCliRunner } from "./hermes-cli";
import type { AgentRunner } from "./runner";

/** Local socket only: run the host's Hermes profile against the shared workspace. */
export function createHermesBridge(options: {
	workspace: string;
	clientWorkspace?: string;
	runner?: AgentRunner;
}) {
	const workspace = resolve(options.workspace);
	const runner = options.runner ?? new HermesCliRunner({ cwd: workspace });
	return createServer(async (request, response) => {
		if (request.method === "GET" && request.url === "/health") {
			response.end("ok");
			return;
		}
		if (request.method !== "POST" || request.url !== "/run") {
			response.writeHead(404).end();
			return;
		}
		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(new Error("Hermes run timed out")),
			10 * 60 * 1000,
		);
		response.on("close", () => {
			if (!response.writableEnded) controller.abort();
		});
		const send = async (event: unknown) => {
			controller.signal.throwIfAborted();
			if (!response.write(`${JSON.stringify(event)}\n`))
				await once(response, "drain", { signal: controller.signal });
		};
		try {
			let body = "";
			request.setEncoding("utf8");
			for await (const chunk of request) {
				body += chunk.toString();
				if (body.length > 2_000_000)
					throw new Error("Prompt exceeds bridge request limit");
			}
			const data = JSON.parse(body) as {
				prompt?: unknown;
				workspace?: unknown;
			};
			if (typeof data.prompt !== "string" || !data.prompt.trim())
				throw new Error("Prompt is required");
			const clientWorkspace = options.clientWorkspace ?? "/workspace";
			if (data.workspace !== clientWorkspace && data.workspace !== workspace)
				throw new Error("Workspace does not match this Hermes bridge");
			response.writeHead(200, {
				"Content-Type": "application/x-ndjson",
				"Cache-Control": "no-store",
			});
			// Keep the original application prompt intact; explicitly explain its container paths.
			const mapping =
				data.workspace === workspace
					? ""
					: `Execution environment: paths beginning with ${clientWorkspace}/ in this request refer to ${workspace}/ on this host. Use the host paths when reading or writing files.\n\n`;
			await send({
				type: "status",
				message: `Hermes workspace: ${workspace}${mapping ? ` (${clientWorkspace} in Charon)` : ""}`,
			});
			for await (const event of runner.run(
				mapping + data.prompt,
				controller.signal,
			))
				await send(event);
			await send({ type: "done" });
			response.end();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Hermes bridge failed";
			if (!response.headersSent) response.writeHead(400).end(message);
			else if (!response.destroyed)
				response.end(`${JSON.stringify({ type: "error", message })}\n`);
		} finally {
			clearTimeout(timeout);
		}
	});
}
