import type { ReactNode } from "react";

/** The active page owns padding; nested routes do not add another visible frame. */
export function DetailLayout({
	title,
	actions,
	children,
}: {
	title: string;
	actions?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
			<header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
				<h1 className="min-w-0 truncate text-base font-semibold">{title}</h1>
				<div className="flex shrink-0 items-center gap-2">{actions}</div>
			</header>
			<div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">{children}</div>
		</section>
	);
}
