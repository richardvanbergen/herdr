import type { ReactNode } from "react";
import { LayoutGrid } from "lucide-react";

/** Lumina's shell. Navigation and queried labels are supplied by the container. */
export function WorkspaceView({
	breadcrumbs,
	children,
}: {
	breadcrumbs: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="flex h-dvh flex-col overflow-hidden bg-background text-[13px] text-foreground selection:bg-primary selection:text-primary-foreground">
			<header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
				<div className="flex items-center gap-4">
					<span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
						<span className="grid size-5 place-items-center border border-primary/70 text-[10px] text-primary">
							C
						</span>
						Charon
					</span>
					<span className="hidden items-center gap-2 border-l border-border pl-4 text-xs text-muted-foreground sm:flex">
						<LayoutGrid className="size-3.5" />
						Workspace
					</span>
				</div>
				<span
					title="Richard"
					aria-label="Richard"
					className="grid size-7 place-items-center border border-border bg-white/[.04] text-[11px] text-primary"
				>
					RV
				</span>
			</header>
			<nav
				aria-label="Breadcrumb"
				className="flex min-h-11 shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-4 text-xs"
			>
				{breadcrumbs}
			</nav>
			<main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				{children}
			</main>
		</div>
	);
}
