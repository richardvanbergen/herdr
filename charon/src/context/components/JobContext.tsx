import { ContextBrowserView } from "./ContextBrowserView";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	contextFileQueryOptions,
	contextQueryOptions,
} from "../queries/context-query-options";
import type { ContextFile } from "../types";
import { ContextEditor } from "./ContextEditor";

function ExistingContextEditor({
	jobId,
	path,
	onSaved,
	onClose,
	onDeleted,
}: {
	jobId: number;
	path: string;
	onSaved: (file: ContextFile) => Promise<void>;
	onClose: () => void;
	onDeleted: () => Promise<void>;
}) {
	const query = useQuery(contextFileQueryOptions(jobId, path));
	const [reload, setReload] = useState(0);
	if (query.isError)
		return (
			<p role="alert" className="text-sm text-destructive">
				{query.error.message}{" "}
				<Button variant="ghost" onClick={() => void query.refetch()}>
					Retry
				</Button>
			</p>
		);
	if (!query.data)
		return <p className="text-sm text-muted-foreground">Loading context…</p>;
	// Keep a draft mounted through background refreshes; only explicit reload discards it.
	return (
		<ContextEditor
			key={`${path}-${reload}`}
			jobId={jobId}
			file={query.data}
			onSaved={onSaved}
			onClose={onClose}
			onDeleted={onDeleted}
			onReload={() => {
				void query.refetch().then((result) => {
					if (result.isSuccess) setReload((value) => value + 1);
				});
			}}
		/>
	);
}

export function JobContext({
	jobId,
	columnId,
	selected,
}: {
	jobId: number;
	columnId: number;
	selected?: string;
}) {
	const query = useQuery(contextQueryOptions(jobId));
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const params = { columnId: String(columnId), jobId: String(jobId) };
	const select = (context?: string) =>
		navigate({
			to: "/column/$columnId/job/$jobId",
			params,
			search: { context },
		});
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: contextQueryOptions(jobId).queryKey,
		});
	const saved = async (file: ContextFile) => {
		queryClient.setQueryData(
			contextFileQueryOptions(jobId, file.path).queryKey,
			file,
		);
		await refresh();
		if (selected === "new") await select(file.path);
	};
	const deleted = async () => {
		await refresh();
		await select();
	};
	return (
		<ContextBrowserView
			files={query.data?.files ?? []}
			params={params}
			loading={query.isPending}
			refreshing={query.isFetching}
			error={query.error?.message}
			onRefresh={() => {
				void refresh();
			}}
			editor={
				selected === "new" ? (
					<ContextEditor
						key="new"
						jobId={jobId}
						onSaved={saved}
						onClose={() => void select()}
						onReload={() => {}}
						onDeleted={deleted}
					/>
				) : selected ? (
					<ExistingContextEditor
						key={selected}
						jobId={jobId}
						path={selected}
						onSaved={saved}
						onClose={() => void select()}
						onDeleted={deleted}
					/>
				) : null
			}
		/>
	);
}
