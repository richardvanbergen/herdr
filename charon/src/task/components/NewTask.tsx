import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CreateItemView } from "#/components/CreateItemView";
import { client } from "#/orpc/client";
import { taskQueryOptions } from "../queries/task-query-options";
import type { Task } from "../server/schema";

export function NewTask({
	columnId,
	jobId,
}: {
	columnId: number;
	jobId: number;
}) {
	const cache = useQueryClient();
	const navigate = useNavigate();
	const queryKey = taskQueryOptions(jobId).queryKey;
	const create = useMutation({
		mutationFn: (text: string) =>
			client.task.create({ jobId, text: text.trim() }),
		onSuccess: async (task) => {
			await cache.cancelQueries({ queryKey });
			cache.setQueryData<Task[]>(queryKey, (tasks) => [
				...(tasks ?? []).filter((item) => item.id !== task.id),
				task,
			]);
			await navigate({
				to: "/column/$columnId/job/$jobId/task/$taskId",
				params: {
					columnId: String(columnId),
					jobId: String(jobId),
					taskId: String(task.id),
				},
				replace: true,
			});
			void cache.invalidateQueries({ queryKey });
		},
	});
	const form = useForm({
		defaultValues: { text: "" },
		onSubmit: async ({ value }) => {
			if (value.text.trim()) await create.mutateAsync(value.text);
		},
	});
	return (
		<form.Subscribe
			selector={(state) => [state.values.text, state.isSubmitting] as const}
		>
			{([text, submitting]) => (
				<CreateItemView
					title="New task"
					pending={submitting || create.isPending}
					valid={!!text.trim()}
					error={create.error?.message}
					onSave={() => {
						void form.handleSubmit().catch(() => {});
					}}
					onCancel={() => {
						void navigate({
							to: "/column/$columnId/job/$jobId",
							params: { columnId: String(columnId), jobId: String(jobId) },
						});
					}}
				>
					<form.Field name="text">
						{(field) => (
							<label className="block space-y-2 text-sm">
								Instructions
								<textarea
									aria-label="Task text"
									autoFocus
									className="min-h-40 w-full border border-input bg-background p-3"
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									disabled={submitting}
								/>
							</label>
						)}
					</form.Field>
				</CreateItemView>
			)}
		</form.Subscribe>
	);
}
