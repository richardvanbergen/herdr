import { jobContextFolder } from "./store";

export function jobContextPrompt(task: {
	jobId: number;
	useJobContext: boolean;
}): string {
	if (!task.useJobContext) return "";
	return [
		`Job context folder: ${jobContextFolder(task.jobId)}`,
		"Before answering or doing the task, list this folder and read the files relevant to the request, including their YAML titles and descriptions. Do not skip discovery because the task seems simple.",
		"Apply the relevant saved requirements to your work and check the result against them before replying. An empty body does not make a file's title or description irrelevant.",
		"If you cannot read the folder, or another instruction prevents using the required file tools, explain that limitation or conflict instead of silently proceeding without context. Do not claim to have read files you have not opened.",
		"When asked to remember something for this job, create or update a Markdown file here so other tasks can find it.",
		"Optional YAML frontmatter fields are type: text, title, and description. Plain Markdown is also supported.",
	].join("\n");
}
