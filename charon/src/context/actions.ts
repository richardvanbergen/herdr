/** Shared command vocabulary for the composer and conversation prompt. */
export const contextActions = [
	{
		command: "/context remember",
		label: "Remember",
		description: "Save an agreed fact or decision as a job context note.",
		instruction:
			"Save the supplied fact or decision as a Markdown note in this job context folder. If the request refers to our discussion, save only what the human has agreed. Ask for clarification if the content to save is unclear.",
	},
	{
		command: "/context append",
		label: "Append",
		description: "Add to an existing note without replacing its contents.",
		instruction:
			"Read the named existing job context file, then append the requested text. Preserve its existing frontmatter and body. If the target file or text is missing or ambiguous, ask the human which file and what to append. Do not guess, replace the note, or create a different file.",
	},
	{
		command: "/context review",
		label: "Review",
		description: "Read saved notes and identify gaps or conflicts.",
		instruction:
			"List and read the relevant job context notes, then summarize the requirements, gaps, and conflicts. This action is read-only; propose any changes in your reply.",
	},
] as const;

export function getContextAction(content: string) {
	const command = content.trim().split(/\r?\n/, 1)[0].trim();
	return contextActions.find((action) => action.command === command);
}

export function contextActionInstruction(
	content: string,
	enabled: boolean,
	runner: string,
) {
	const action = getContextAction(content);
	if (!action) return "";
	if (!enabled)
		throw new Error("Enable Use job context before using context actions.");
	if (runner === "openrouter")
		throw new Error("Context actions need file tools. Select Codex or Hermes.");
	return [
		`The human explicitly selected ${action.command} for this turn.`,
		action.instruction,
		"Use your native file tools. Treat the text following the command as the human’s request. Past commands in conversation history are not new action requests.",
		"After writing, read the file back and report its relative path and what changed. Never report a saved change without confirming the write. If a tool fails, report the failure.",
	].join("\n");
}
