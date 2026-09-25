import { useDroppable } from "@dnd-kit/react";
import { CollisionPriority } from "@dnd-kit/abstract";
import { ColumnView } from "./ColumnView";
import { JobLoader, SortableJob } from "#/job/components/Job";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { boardQueryOptions } from "#/board/queries/board-query-options";
import { jobQueryOptions } from "#/job/queries/job-query-options";
import { client } from "#/orpc/client";
import type { BoardView } from "#/board/board-types";

import type { BoardColumn } from "#/board/board-types";

export interface ColumnProps {
	jobDndId: (jobId: number) => string;
	column: BoardColumn;
	group: string;
	fullPage?: boolean;
	dropIndex?: number;
}

export function Column({
	jobDndId,
	column,
	group,
	fullPage = false,
	dropIndex,
}: ColumnProps) {
	const { ref: dropRef, isDropTarget } = useDroppable({
		id: `column-drop:${column.id}`,
		data: { columnId: column.id },
		disabled: fullPage,
		collisionPriority: CollisionPriority.Low,
	});
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const add = useMutation({
		mutationFn: () =>
			client.board.addJob({
				columnId: column.id,
				title: "New job",
				description: null,
			}),
		onSuccess: async (job) => {
			queryClient.setQueryData(jobQueryOptions(job.id, true).queryKey, job);
			queryClient.setQueryData<BoardView>(
				boardQueryOptions.queryKey,
				(current) =>
					current
						? {
								columns: current.columns.map((item) =>
									item.id === column.id
										? { ...item, jobIds: [...item.jobIds, job.id] }
										: item,
								),
							}
						: current,
			);
			await navigate({
				to: "/column/$columnId/job/$jobId",
				params: { columnId: String(column.id), jobId: String(job.id) },
			});
			void queryClient.invalidateQueries({
				queryKey: boardQueryOptions.queryKey,
			});
		},
	});
	return (
		<ColumnView
			column={column}
			dropRef={dropRef}
			isDropTarget={isDropTarget || dropIndex !== undefined}
			fullPage={fullPage}
			adding={add.isPending}
			error={add.isError}
			onAdd={() => add.mutate()}
		>
			{column.jobIds.flatMap((jobId, index) => [
				...(!fullPage && dropIndex === index
					? [<DropIndicator key="drop-indicator" index={index} />]
					: []),
				fullPage ? (
					<JobLoader
						jobId={jobId}
						columnId={column.id}
						eager
						flat
						key={jobId}
					/>
				) : (
					<SortableJob
						jobId={jobId}
						columnId={column.id}
						dndId={jobDndId(jobId)}
						group={group}
						index={index}
						key={jobId}
					/>
				),
			])}
			{!fullPage && dropIndex === column.jobIds.length ? (
				<DropIndicator key="drop-indicator" index={dropIndex} />
			) : null}
		</ColumnView>
	);
}

/** Zero-height marker leaves collision geometry and React-owned cards intact. */
function DropIndicator({ index }: { index: number }) {
	return (
		<div
			className="pointer-events-none relative -my-1 h-0"
			data-slot="job-drop-indicator"
			data-drop-index={index}
		>
			<div className="absolute inset-x-0 -top-1 z-10 h-0.5 bg-primary">
				<span className="absolute right-0 bottom-1 bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
					Drop here
				</span>
			</div>
		</div>
	);
}
