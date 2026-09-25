export interface TextContextInput {
	type: "text";
	title: string;
	description: string;
	body: string;
}

export interface ContextFile extends TextContextInput {
	path: string;
	version: string;
}

export type ContextEntry = Omit<ContextFile, "body"> & { error?: string };
