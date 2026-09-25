import { taskQueryOptions } from "#/task/queries/task-query-options";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { useRef } from "react";
import { client, orpc } from "#/orpc/client";
import { jobQueryOptions } from "#/job/queries/job-query-options";
import { runnerOptions, type RunnerId } from "#/agent/runner-options";
import { Button } from "#/components/ui/button";
import { WorkflowView } from "./WorkflowView";

export function JobWorkflow({
	jobId,
	taskId,
}: {
	jobId: number;
	taskId?: number;
}) {
	const cache = useQueryClient();
	const options = orpc.workflow.get.queryOptions({ input: { jobId } });
	const query = useQuery({ ...options, refetchInterval: 5000 });
	const refresh = async () => {
		await Promise.all([
			cache.invalidateQueries({ queryKey: taskQueryOptions(jobId).queryKey }),
			cache.invalidateQueries({ queryKey: options.queryKey }),
			cache.invalidateQueries({
				queryKey: jobQueryOptions(jobId, true).queryKey,
			}),
		]);
	};
	const ready = useMutation({
		mutationFn: (value: boolean) =>
			client.workflow.ready({ jobId, ready: value }),
		onSuccess: refresh,
	});
	const complete = useMutation({
		mutationFn: () => client.workflow.complete({ jobId }),
		onSuccess: refresh,
	});
	const settings = useMutation({
		mutationFn: (value: { doneWhen: string; runner: RunnerId }) =>
			client.workflow.settings({ jobId, ...value }),
		onSuccess: refresh,
	});
	const taskUpdate = useMutation({
		mutationFn: (input: {
			id: number;
			assignee: "human" | "agent";
			state: "todo" | "done";
		}) => client.workflow.task(input),
		onSuccess: refresh,
	});
	const replyId = useRef(crypto.randomUUID());
	const send = useMutation({
		mutationFn: (content: string) =>
			client.workflow.reply({
				jobId,
				content,
				taskId,
				requestId: replyId.current,
			}),
		onSuccess: async () => {
			replyId.current = crypto.randomUUID();
			composer.reset();
			await refresh();
		},
	});
	const form = useForm({
		defaultValues: {
			doneWhen: query.data?.workflow.doneWhen ?? "",
			runner: query.data?.workflow.runner ?? ("codex" as RunnerId),
		},
		onSubmit: async ({ value }) => {
			await settings.mutateAsync(value);
		},
	});
	const composer = useForm({
		defaultValues: { content: "" },
		onSubmit: async ({ value }) => {
			if (value.content.trim()) await send.mutateAsync(value.content);
		},
	});
	if (!query.data)
		return (
			<p role="status" className="text-sm text-muted-foreground">
				{query.isError ? "Could not load workflow." : "Loading workflow…"}
			</p>
		);
	const task = query.data.tasks.find((t) => t.id === taskId);
	const error = [ready, complete, settings, send, taskUpdate].find(
		(m) => m.error,
	)?.error;
	return (
		<WorkflowView
			ready={query.data.workflow.ready}
			status={query.data.workflow.status}
			busy={ready.isPending || complete.isPending}
			onReady={(value) => ready.mutate(value)}
			onComplete={() => complete.mutate()}
			messages={query.data.messages}
			error={error instanceof Error ? error.message : undefined}
			settings={
				<form
					className="space-y-3"
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
				>
					<form.Field name="doneWhen">
						{(field) => (
							<label className="block space-y-2 text-sm">
								What done looks like
								<textarea
									className="min-h-20 w-full border border-input bg-background p-3"
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									placeholder="Describe the result, or ask Hermes to propose it below."
								/>
							</label>
						)}
					</form.Field>
					<div className="flex flex-wrap items-center gap-3">
						<form.Field name="runner">
							{(field) => (
								<label className="text-sm">
									Task runner{" "}
									<select
										className="border border-input bg-background p-2"
										value={field.state.value}
										onChange={(event) =>
											field.handleChange(event.target.value as RunnerId)
										}
									>
										{runnerOptions.map((option) => (
											<option key={option.id} value={option.id}>
												{option.label}
											</option>
										))}
									</select>
								</label>
							)}
						</form.Field>
						<Button
							type="submit"
							variant="outline"
							disabled={settings.isPending}
						>
							Save settings
						</Button>
					</div>
				</form>
			}
			taskControls={
				task && (
					<div className="flex items-center gap-3 text-sm">
						<label>
							Assigned to{" "}
							<select
								className="border border-input bg-background p-2"
								value={task.assignee}
								disabled={taskUpdate.isPending}
								onChange={(event) =>
									taskUpdate.mutate({
										id: task.id,
										state: task.state,
										assignee: event.target.value as "human" | "agent",
									})
								}
							>
								<option value="agent">Agent</option>
								<option value="human">You</option>
							</select>
						</label>
						<Button
							variant="outline"
							disabled={taskUpdate.isPending}
							onClick={() =>
								taskUpdate.mutate({
									id: task.id,
									assignee: task.assignee,
									state: task.state === "done" ? "todo" : "done",
								})
							}
						>
							{task.state === "done" ? "Reopen task" : "Task done"}
						</Button>
					</div>
				)
			}
			composer={
				<form
					className="space-y-2"
					onSubmit={(event) => {
						event.preventDefault();
						void composer.handleSubmit();
					}}
				>
					<composer.Field name="content">
						{(field) => (
							<textarea
								aria-label="Reply to Hermes"
								className="min-h-24 w-full border border-input bg-background p-3 text-sm"
								placeholder="That sounds good, add a task to…"
								value={field.state.value}
								onChange={(event) => {
									replyId.current = crypto.randomUUID();
									field.handleChange(event.target.value);
								}}
								disabled={send.isPending}
							/>
						)}
					</composer.Field>
					<Button type="submit" disabled={send.isPending}>
						{send.isPending ? "Saving…" : "Reply"}
					</Button>
				</form>
			}
		/>
	);
}
