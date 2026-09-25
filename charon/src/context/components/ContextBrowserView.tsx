import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { Item, ItemContent } from "#/components/ui/item";
import type { ContextEntry } from "../types";
export function ContextBrowserView({
	files,
	params,
	loading,
	refreshing,
	error,
	onRefresh,
	editor,
}: {
	files: ContextEntry[];
	params: { columnId: string; jobId: string };
	loading: boolean;
	refreshing: boolean;
	error?: string;
	onRefresh: () => void;
	editor: ReactNode;
}) {
	return (
		<section aria-label="Job context" className="flex min-w-0 flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-sm font-semibold">Context</h2>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onRefresh()}
						disabled={refreshing}
					>
						Refresh context
					</Button>
					<Button variant="outline" size="sm" asChild>
						<Link
							to="/column/$columnId/job/$jobId"
							params={params}
							search={{ context: "new" }}
						>
							Add context
						</Link>
					</Button>
				</div>
			</div>
			<p className="text-sm text-muted-foreground">
				Shared notes for this job. Agents read what they need and can save notes
				here too.
			</p>
			{!!error ? (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			) : null}
			{loading ? (
				<p className="text-sm text-muted-foreground">Loading context…</p>
			) : null}
			{files.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No context yet. Add a note or ask the agent to remember something.
				</p>
			) : null}
			<div className="flex flex-col">
				{files.map((file) => (
					<Item key={file.path} className="border-b-0 last:border-b">
						<ItemContent>
							<Link
								className="font-medium hover:text-primary"
								to="/column/$columnId/job/$jobId"
								params={params}
								search={{ context: file.path }}
							>
								{file.title}
							</Link>
							{file.description ? (
								<p className="text-sm text-muted-foreground">
									{file.description}
								</p>
							) : null}
							<span className="text-xs text-muted-foreground">{file.path}</span>
							{file.error ? (
								<p className="text-sm text-destructive">{file.error}</p>
							) : null}
						</ItemContent>
					</Item>
				))}
			</div>
			{editor}
		</section>
	);
}
