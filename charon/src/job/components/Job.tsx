import { memo, type Ref } from "react";
import { JobView } from "./JobView";
import { useSortable } from "@dnd-kit/react/sortable";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useInView } from "#/job/hooks/use-in-view";
import { jobQueryOptions } from "#/job/queries/job-query-options";
import { client } from "#/orpc/client";
import { TaskList } from "#/task/components/TaskList";
import { cn } from "#/lib/utils";
import { Card } from "#/components/ui/card";

import type { Job } from "#/job/server/schema";

export interface JobPreviewProps {
	job: Job;
	columnId?: number;
	fullPage?: boolean;
	flat?: boolean;
	dragHandleRef?: Ref<HTMLButtonElement>;
}

/** Each mounted job owns its own form and autosave queue. */
export function JobPreview({
	job,
	columnId,
	fullPage = false,
	flat = false,
	dragHandleRef,
}: JobPreviewProps) {
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: (input: {
			id: number;
			title: string;
			description: string | null;
		}) => client.job.update(input),
		scope: { id: `job-${job.id}` },
		onSuccess: (saved) => {
			queryClient.setQueryData(jobQueryOptions(job.id, true).queryKey, saved);
		},
	});
	const form = useForm({
		defaultValues: {
			title: job.title,
			description: job.description ?? "",
		},
		validators: {
			onChange: ({ value }) =>
				value.title.trim() ? undefined : "Title is required",
		},
		listeners: {
			onChangeDebounceMs: 600,
			onChange: ({ formApi }) => {
				if (formApi.state.isValid) void formApi.handleSubmit();
			},
		},
		onSubmit: ({ value }) => {
			mutation.mutate({
				id: job.id,
				title: value.title.trim(),
				description: value.description || null,
			});
		},
	});

	return (
		<JobView
			dragHandleRef={dragHandleRef}
			job={job}
			jobTitle={job.title}
			columnId={columnId}
			fullPage={fullPage}
			flat={flat}
			title={
				<form.Field name="title">
					{(field) => (
						<input
							aria-label="Job title"
							autoFocus={fullPage && job.title === "New job"}
							onFocus={(event) => {
								if (job.title === "New job") event.currentTarget.select();
							}}
							className={cn(
								"min-w-0 flex-1 rounded-none border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold leading-snug text-foreground outline-none focus:border-primary focus:bg-background",
								fullPage && "text-2xl tracking-tight",
							)}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					)}
				</form.Field>
			}
			description={
				<form.Field name="description">
					{(field) => (
						<textarea
							aria-label="Job description"
							className="w-full resize-y rounded-none border border-transparent bg-transparent px-1 py-0.5 text-sm leading-normal text-muted-foreground outline-none placeholder:text-muted-foreground/65 focus:border-primary focus:bg-background"
							placeholder="Add a description"
							rows={2}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					)}
				</form.Field>
			}
			tasks={<TaskList jobId={job.id} columnId={columnId} />}
			saveError={mutation.isError}
		/>
	);
}

function JobSkeleton() {
	return (
		<Card className="min-h-32 p-4" aria-label="Loading job">
			<div className="mb-4 h-4 w-3/4 animate-pulse bg-border" />
			<div className="mb-2 h-2.5 w-full animate-pulse bg-border" />
			<div className="h-2.5 w-2/3 animate-pulse bg-border" />
		</Card>
	);
}

function JobLoadError() {
	return <Card className="p-4 text-destructive">Unable to load job.</Card>;
}

export interface JobLoaderProps {
	jobId: number;
	columnId?: number;
	eager?: boolean;
	fullPage?: boolean;
	flat?: boolean;
	dragHandleRef?: Ref<HTMLButtonElement>;
}

/**
 * Job content is query-owned, not component-owned. The IntersectionObserver
 * only enables the query when this job is visible or near-visible.
 */
export const JobLoader = memo(function JobLoader({
	jobId,
	columnId,
	eager = false,
	fullPage = false,
	flat = false,
	dragHandleRef,
}: JobLoaderProps) {
	const { isInView, ref } = useInView<HTMLDivElement>();
	const query = useQuery(jobQueryOptions(jobId, eager || isInView));

	return (
		<div ref={ref}>
			{query.data ? (
				<JobPreview
					dragHandleRef={dragHandleRef}
					job={query.data}
					columnId={columnId}
					fullPage={fullPage}
					flat={flat}
				/>
			) : null}
			{query.isError ? <JobLoadError /> : null}
			{!query.data && !query.isError ? <JobSkeleton /> : null}
		</div>
	);
});

export interface SortableJobProps {
	jobId: number;
	columnId: number;
	dndId: string;
	group: string;
	index: number;
}

export function SortableJob({
	jobId,
	columnId,
	dndId,
	group,
	index,
}: SortableJobProps) {
	const { isDragSource, ref, handleRef } = useSortable({
		data: { jobId },
		group,
		id: dndId,
		index,
		transition: {
			duration: 140,
			easing: "ease-out",
		},
	});

	return (
		<div
			className={cn(
				isDragSource &&
					"opacity-40 [&_[data-slot=item]]:border-dashed [&_[data-slot=item]]:border-primary",
			)}
			ref={ref}
		>
			<JobLoader jobId={jobId} columnId={columnId} dragHandleRef={handleRef} />
		</div>
	);
}
