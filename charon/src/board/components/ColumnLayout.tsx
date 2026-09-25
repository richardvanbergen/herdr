import { Outlet, useMatches } from "@tanstack/react-router";
import { DetailLayout } from "#/components/DetailLayout";
import { useQuery } from "@tanstack/react-query";
import { boardQueryOptions } from "#/board/queries/board-query-options";
import { Column } from "./Column";

export function ColumnLayout({ columnId }: { columnId: number }) {
	const nested = useMatches().some((match) =>
		match.routeId.startsWith("/column/$columnId/job/"),
	);
	const board = useQuery(boardQueryOptions);
	const column = board.data?.columns.find((item) => item.id === columnId);
	if (!column)
		return <div className="p-5 text-muted-foreground">Loading column…</div>;

	if (nested) return <Outlet />;
	return (
		<DetailLayout title={column.name}>
			<Column
				column={column}
				jobDndId={(id) => `job:${id}`}
				group="column"
				fullPage
			/>
		</DetailLayout>
	);
}
