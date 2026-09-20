import { useSortable } from "@dnd-kit/react/sortable";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useInView } from "#/job/hooks/use-in-view";
import { jobQueryOptions } from "#/job/queries/job-query-options";
import { client } from "#/orpc/client";
import { TaskList } from "#/task/components/TaskList";
import { Link } from "@tanstack/react-router";
import { cn } from "#/lib/utils";
import { Card } from "#/components/ui/card";
import { Item, ItemContent } from "#/components/ui/item";

import type { Job } from "#/job/server/schema";

export interface JobPreviewProps {
	job: Job;
	columnId?: number;
	fullPage?: boolean;
	flat?: boolean;
}

/** Each mounted job owns its own form and autosave queue. */
export function JobPreview({ job, columnId, fullPage = false, flat = false }: JobPreviewProps) {
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: (input: { id: number; title: string; description: string | null }) =>
			client.job.update(input),
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
			onChange: ({ value }) => value.title.trim() ? undefined : "Title is required",
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
		<Item className={cn("items-stretch", flat && "border-x-0 border-t-0", fullPage && "min-h-full")}>
			<ItemContent>
			<div className="flex min-w-0 items-center gap-2">
				<form.Field name="title">
					{(field) => <input
						aria-label="Job title"
						autoFocus={fullPage && job.title === "New job"}
						onFocus={(event) => { if (job.title === "New job") event.currentTarget.select(); }}
						className={cn("min-w-0 flex-1 rounded-none border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold leading-snug text-[#e8eaf6] outline-none focus:border-[#00d4ff] focus:bg-[#090d1d]", fullPage && "text-lg")}
						value={field.state.value}
						onBlur={field.handleBlur}
						onChange={(event) => field.handleChange(event.target.value)}
					/>}
				</form.Field>
				{columnId !== undefined && !fullPage ? <Link className="shrink-0 rounded-none px-1.5 py-0.5 text-[#8892b0] hover:bg-[#121a30] hover:text-[#00d4ff] focus-visible:outline focus-visible:outline-[#00d4ff]"
					to="/column/$columnId/job/$jobId" params={{ columnId: String(columnId), jobId: String(job.id) }} aria-label={`Open job ${job.title}`}>↗</Link> : null}
			</div>
			<form.Field name="description">
				{(field) => <textarea
					aria-label="Job description"
					className="w-full resize-y rounded-none border border-transparent bg-transparent px-1 py-0.5 text-sm leading-normal text-[#8892b0] outline-none placeholder:text-[#8892b0]/65 focus:border-[#00d4ff] focus:bg-[#090d1d]"
					placeholder="Add a description"
					rows={2}
					value={field.state.value}
					onBlur={field.handleBlur}
					onChange={(event) => field.handleChange(event.target.value)}
				/>}
			</form.Field>
			{mutation.isError ? <span className="text-xs text-[#ff00aa]" role="status">Save failed. Edit to retry.</span> : null}
			<TaskList jobId={job.id} columnId={columnId} />
			</ItemContent>
		</Item>
	);
}

function JobSkeleton() {
	return (
		<Card className="min-h-32 p-4" aria-label="Loading job">
			<div className="mb-4 h-4 w-3/4 animate-pulse bg-[#1b2745]" />
			<div className="mb-2 h-2.5 w-full animate-pulse bg-[#1b2745]" />
			<div className="h-2.5 w-2/3 animate-pulse bg-[#1b2745]" />
		</Card>
	);
}

function JobLoadError() {
	return (
		<Card className="p-4 text-[#ff00aa]">Unable to load job.</Card>
	);
}

export interface JobLoaderProps {
	jobId: number;
	columnId?: number;
	eager?: boolean;
	fullPage?: boolean;
	flat?: boolean;
}

/**
 * Job content is query-owned, not component-owned. The IntersectionObserver
 * only enables the query when this job is visible or near-visible.
 */
export function JobLoader({ jobId, columnId, eager = false, fullPage = false, flat = false }: JobLoaderProps) {
	const { isInView, ref } = useInView<HTMLDivElement>();
	const query = useQuery(jobQueryOptions(jobId, eager || isInView));

	return (
		<div ref={ref}>
			{query.data ? <JobPreview job={query.data} columnId={columnId} fullPage={fullPage} flat={flat} /> : null}
			{query.isError ? <JobLoadError /> : null}
			{!query.data && !query.isError ? <JobSkeleton /> : null}
		</div>
	);
}

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
	const { isDragSource, ref } = useSortable({
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
			className={cn("touch-none", isDragSource && "opacity-40 [&_[data-slot=item]]:border-dashed [&_[data-slot=item]]:border-[#00d4ff]")}
			ref={ref}
		>
			<JobLoader jobId={jobId} columnId={columnId} />
		</div>
	);
}
