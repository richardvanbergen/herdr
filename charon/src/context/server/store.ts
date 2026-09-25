import { createHash, randomUUID } from "node:crypto";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { ORPCError } from "@orpc/server";
import type { ContextEntry, ContextFile, TextContextInput } from "../types";

export function contextRoot() {
	return resolve(
		process.env.CHARON_CONTEXT_ROOT ??
			join(dirname(process.env.CHARON_DB_PATH ?? "charon.db"), "context"),
	);
}

export function jobContextFolder(jobId: number) {
	if (!Number.isSafeInteger(jobId) || jobId <= 0)
		throw new ORPCError("BAD_REQUEST");
	const folder = join(contextRoot(), "jobs", String(jobId));
	mkdirSync(folder, { recursive: true });
	return realpathSync(folder);
}

function filePath(jobId: number, path: string) {
	const parts = path.split("/");
	if (
		!/\.(md|txt)$/i.test(path) ||
		parts.some(
			(part) =>
				!part ||
				part.startsWith(".") ||
				part.includes("\\") ||
				part.includes("\0"),
		)
	) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Choose a Markdown or text file inside this job context folder.",
		});
	}
	let target = jobContextFolder(jobId);
	for (const part of parts) {
		target = join(target, part);
		if (existsSync(target) && lstatSync(target).isSymbolicLink())
			throw new ORPCError("BAD_REQUEST", {
				message: "Linked files cannot be edited here.",
			});
	}
	return target;
}

const versionOf = (source: string) =>
	createHash("sha256").update(source).digest("hex");
const fallbackTitle = (path: string) =>
	(path.split("/").at(-1) ?? path)
		.replace(/\.(md|txt)$/i, "")
		.replace(/[-_]/g, " ");

function parse(source: string) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
	if (!match) return { metadata: {} as Record<string, unknown>, body: source };
	let metadata: unknown;
	try {
		metadata = Bun.YAML.parse(match[1]);
	} catch {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"Invalid YAML metadata. Fix the file on disk before editing it here.",
		});
	}
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
		throw new ORPCError("BAD_REQUEST", {
			message: "Context metadata must contain named fields.",
		});
	return {
		metadata: metadata as Record<string, unknown>,
		body: source.slice(match[0].length).replace(/^\r?\n/, ""),
	};
}

function readSource(jobId: number, path: string) {
	try {
		return readFileSync(filePath(jobId, path), "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT")
			throw new ORPCError("NOT_FOUND", {
				message: "Context file no longer exists.",
			});
		throw error;
	}
}

export function readContext(jobId: number, path: string): ContextFile {
	const source = readSource(jobId, path);
	const { metadata, body } = parse(source);
	if (metadata.type !== undefined && metadata.type !== "text")
		throw new ORPCError("BAD_REQUEST", {
			message: `This editor does not support context type ${String(metadata.type)} yet.`,
		});
	return {
		path,
		version: versionOf(source),
		type: "text",
		body,
		title:
			typeof metadata.title === "string" ? metadata.title : fallbackTitle(path),
		description:
			typeof metadata.description === "string" ? metadata.description : "",
	};
}

export function listContext(jobId: number): {
	folder: string;
	files: ContextEntry[];
} {
	const folder = jobContextFolder(jobId);
	const files: ContextEntry[] = [];
	function visit(directory: string, prefix = "") {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
			const path = prefix + entry.name;
			if (entry.isDirectory()) visit(join(directory, entry.name), `${path}/`);
			else if (entry.isFile() && /\.(md|txt)$/i.test(path)) {
				try {
					const { body: _body, ...metadata } = readContext(jobId, path);
					files.push(metadata);
				} catch (error) {
					files.push({
						path,
						title: fallbackTitle(path),
						description: "",
						type: "text",
						version: "",
						error:
							error instanceof Error ? error.message : "Could not read file",
					});
				}
			}
		}
	}
	visit(folder);
	return { folder, files: files.sort((a, b) => a.path.localeCompare(b.path)) };
}

function serialize(
	input: TextContextInput,
	metadata: Record<string, unknown> = {},
) {
	return `---\n${Bun.YAML.stringify({ ...metadata, type: input.type, title: input.title, description: input.description }).trimEnd()}\n---\n\n${input.body}`;
}

export function createContext(jobId: number, input: TextContextInput) {
	const slug =
		input.title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 70) || "context";
	const path = `${slug}-${randomUUID().slice(0, 8)}.md`;
	writeFileSync(filePath(jobId, path), serialize(input), { flag: "wx" });
	return readContext(jobId, path);
}

function checkVersion(source: string, expectedVersion: string) {
	if (versionOf(source) !== expectedVersion)
		throw new ORPCError("CONFLICT", {
			message:
				"This file changed since you opened it. Your draft is preserved; reload the file before saving.",
		});
}

// Synchronous compare/write serializes UI saves within the server process.
// External editors can still race this best-effort version check.
export function updateContext(
	jobId: number,
	path: string,
	expectedVersion: string,
	input: TextContextInput,
) {
	const source = readSource(jobId, path);
	checkVersion(source, expectedVersion);
	const { metadata } = parse(source);
	const target = filePath(jobId, path);
	const temporary = join(dirname(target), `.${randomUUID()}.tmp`);
	try {
		writeFileSync(temporary, serialize(input, metadata), { flag: "wx" });
		renameSync(temporary, target);
	} finally {
		if (existsSync(temporary)) unlinkSync(temporary);
	}
	return readContext(jobId, path);
}

export function deleteContext(
	jobId: number,
	path: string,
	expectedVersion: string,
) {
	checkVersion(readSource(jobId, path), expectedVersion);
	unlinkSync(filePath(jobId, path));
	return { success: true };
}
