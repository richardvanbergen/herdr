import { ContextEditorView } from "./ContextEditorView";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { client } from "#/orpc/client";
import type { ContextFile, TextContextInput } from "../types";
import { contextTypes } from "./context-types";

export function ContextEditor({
	jobId,
	file,
	onSaved,
	onClose,
	onReload,
	onDeleted,
}: {
	jobId: number;
	file?: ContextFile;
	onSaved: (file: ContextFile) => Promise<void>;
	onClose: () => void;
	onReload: () => void;
	onDeleted: () => Promise<void>;
}) {
	const [version, setVersion] = useState(file?.version ?? "");
	const save = useMutation({
		mutationFn: (content: TextContextInput) =>
			file
				? client.context.update({ jobId, path: file.path, version, content })
				: client.context.create({ jobId, content }),
		onSuccess: async (saved) => {
			setVersion(saved.version);
			await onSaved(saved);
		},
	});
	const remove = useMutation({
		mutationFn: () => {
			if (!file) throw new Error("Save the context before deleting it.");
			return client.context.delete({ jobId, path: file.path, version });
		},
		onSuccess: onDeleted,
	});
	const form = useForm({
		defaultValues: {
			type: "text" as const,
			title: file?.title ?? "",
			description: file?.description ?? "",
			body: file?.body ?? "",
		},
		validators: {
			onSubmit: ({ value }) =>
				value.title.trim() ? undefined : "Give this context a title.",
		},
		onSubmit: async ({ value }) => {
			await save.mutateAsync(value).catch(() => {});
		},
	});
	const error = save.error ?? remove.error;
	const BodyEditor = contextTypes.text.Editor;
	return (
		<ContextEditorView
			existing={!!file}
			pending={save.isPending || remove.isPending}
			saving={save.isPending}
			saved={save.isSuccess}
			error={error?.message}
			onSubmit={() => {
				void form.handleSubmit();
			}}
			onDelete={() => remove.mutate()}
			onClose={onClose}
			onReload={onReload}
		>
			<form.Field name="type">
				{(field) => (
					<div className="flex flex-col gap-2">
						<Label htmlFor="context-type">Type</Label>
						<select
							id="context-type"
							className="h-9 border border-input bg-background px-3 text-sm"
							value={field.state.value}
							onChange={() => field.handleChange("text")}
						>
							{Object.entries(contextTypes).map(([type, definition]) => (
								<option key={type} value={type}>
									{definition.label}
								</option>
							))}
						</select>
					</div>
				)}
			</form.Field>
			<form.Field name="title">
				{(field) => (
					<div className="flex flex-col gap-2">
						<Label htmlFor="context-title">Title</Label>
						<Input
							id="context-title"
							required
							maxLength={200}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					</div>
				)}
			</form.Field>
			<form.Field name="description">
				{(field) => (
					<div className="flex flex-col gap-2">
						<Label htmlFor="context-description">Short description</Label>
						<Input
							id="context-description"
							maxLength={2000}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					</div>
				)}
			</form.Field>
			<form.Field name="body">
				{(field) => (
					<div className="flex flex-col gap-2">
						<Label htmlFor="context-body">Content</Label>
						<BodyEditor
							id="context-body"
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					</div>
				)}
			</form.Field>{" "}
		</ContextEditorView>
	);
}
