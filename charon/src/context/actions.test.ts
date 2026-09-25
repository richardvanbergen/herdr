import { expect, test } from "bun:test";
import { getContextAction, contextActionInstruction } from "./actions";

test("only an exact first-line command activates a context action", () => {
	expect(
		getContextAction("/context append\nnotes.md: Keep this decision")?.label,
	).toBe("Append");
	expect(
		getContextAction("We discussed /context append yesterday"),
	).toBeUndefined();
	expect(
		getContextAction("Quoted history:\n/context remember"),
	).toBeUndefined();
	expect(getContextAction("/context append-everything")).toBeUndefined();
});
test("context actions require the reference and a filesystem-capable runner", () => {
	expect(() =>
		contextActionInstruction("/context remember\nA decision", false, "codex"),
	).toThrow("Enable Use job context");
	expect(() =>
		contextActionInstruction("/context append\nA decision", true, "openrouter"),
	).toThrow("file tools");
	expect(
		contextActionInstruction("Ordinary conversation", false, "openrouter"),
	).toBe("");
	for (const runner of ["hermes", "codex"])
		expect(
			contextActionInstruction("/context append\nA decision", true, runner),
		).toContain("Preserve its existing frontmatter and body");
});
