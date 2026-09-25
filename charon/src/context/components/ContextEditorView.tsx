import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import { Item, ItemContent } from "#/components/ui/item";
export function ContextEditorView({
	existing,
	pending,
	saving,
	saved,
	error,
	onSubmit,
	onDelete,
	onClose,
	onReload,
	children,
}: {
	existing: boolean;
	pending: boolean;
	saving: boolean;
	saved: boolean;
	error?: string;
	onSubmit: () => void;
	onDelete: () => void;
	onClose: () => void;
	onReload: () => void;
	children: ReactNode;
}) {
	return (
		<Item className="items-stretch">
			<ItemContent className="gap-3">
				<div className="flex items-center justify-between gap-2">
					<h3 className="font-semibold">
						{existing ? "Edit context" : "New context"}
					</h3>
					<div className="flex items-center gap-2">
						{existing ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={pending}
								onClick={() => onDelete()}
							>
								Delete context
							</Button>
						) : null}
						<Button type="button" variant="ghost" size="sm" onClick={onClose}>
							Close
						</Button>
					</div>
				</div>
				<form
					className="flex flex-col gap-3"
					onSubmit={(event) => {
						event.preventDefault();
						onSubmit();
					}}
				>
					{children}
					{error ? (
						<div role="alert" className="text-sm text-destructive">
							<p>{error}</p>
							{existing ? (
								<Button
									type="button"
									variant="outline"
									className="mt-2"
									onClick={onReload}
								>
									Discard draft and reload file
								</Button>
							) : null}
						</div>
					) : null}
					<div className="flex items-center justify-end gap-3">
						{saved ? (
							<output className="text-sm text-muted-foreground">Saved</output>
						) : null}
						<Button type="submit" disabled={pending}>
							{saving ? "Saving…" : "Save context"}
						</Button>
					</div>
				</form>
			</ItemContent>
		</Item>
	);
}
