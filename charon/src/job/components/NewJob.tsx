import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CreateItemView } from "#/components/CreateItemView";
import { client } from "#/orpc/client";
import { jobQueryOptions } from "../queries/job-query-options";
import { boardQueryOptions } from "#/board/queries/board-query-options";
import type { BoardView } from "#/board/board-types";

export function NewJob({ columnId }: { columnId: number }) {
	const cache = useQueryClient();
	const navigate = useNavigate();
	const create = useMutation({
		mutationFn: (value: { title: string; description: string }) =>
			client.board.addJob({
				columnId,
				title: value.title.trim(),
				description: value.description || null,
			}),
		onSuccess: async (job) => {
			await cache.cancelQueries({ queryKey: boardQueryOptions.queryKey });
			cache.setQueryData(jobQueryOptions(job.id, true).queryKey, job);
			cache.setQueryData<BoardView>(
				boardQueryOptions.queryKey,
				(board) =>
					board && {
						columns: board.columns.map((column) =>
							column.id === columnId
								? {
										...column,
										jobIds: [
											...column.jobIds.filter((id) => id !== job.id),
											job.id,
										],
									}
								: column,
						),
					},
			);
			await navigate({
				to: "/column/$columnId/job/$jobId",
				params: { columnId: String(columnId), jobId: String(job.id) },
				replace: true,
			});
			void cache.invalidateQueries({ queryKey: boardQueryOptions.queryKey });
		},
	});
	const form = useForm({
		defaultValues: { title: "", description: "" },
		onSubmit: async ({ value }) => {
			if (value.title.trim()) await create.mutateAsync(value);
		},
	});
	return (
		<form.Subscribe
			selector={(state) => [state.values.title, state.isSubmitting] as const}
		>
			{([title, submitting]) => (
				<CreateItemView
					title="New job"
					pending={submitting || create.isPending}
					valid={!!title.trim()}
					error={create.error?.message}
					onSave={() => {
						void form.handleSubmit().catch(() => {});
					}}
					onCancel={() => {
						void navigate({
							to: "/column/$columnId",
							params: { columnId: String(columnId) },
						});
					}}
				>
					<form.Field name="title">
						{(field) => (
							<label className="block space-y-2 text-sm">
								Title
								<input
									aria-label="Job title"
									autoFocus
									className="w-full border border-input bg-background p-3"
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									disabled={submitting}
								/>
							</label>
						)}
					</form.Field>
					<form.Field name="description">
						{(field) => (
							<label className="block space-y-2 text-sm">
								Description
								<textarea
									aria-label="Job description"
									className="min-h-32 w-full border border-input bg-background p-3"
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
