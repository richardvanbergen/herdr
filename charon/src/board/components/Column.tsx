import { useDroppable } from "@dnd-kit/react";
import { CollisionPriority } from "@dnd-kit/abstract";
import { ColumnView } from "./ColumnView";
import { JobLoader, SortableJob } from "#/job/components/Job";
import { useNavigate } from "@tanstack/react-router";

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

	return (
		<ColumnView
			column={column}
			dropRef={dropRef}
			isDropTarget={isDropTarget || dropIndex !== undefined}
			fullPage={fullPage}
			adding={false}
			error={false}
			onAdd={() => {
				void navigate({
					to: "/column/$columnId/job/new",
					params: { columnId: String(column.id) },
				});
			}}
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
