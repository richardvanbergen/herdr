import type { ReactNode } from "react";
import { DetailLayout } from "./DetailLayout";
import { Item, ItemContent } from "./ui/item";
import { Button } from "./ui/button";

/** Page padding belongs to DetailLayout; form content supplies its own fields. */
export function CreateItemView({
	title,
	children,
	pending,
	valid,
	error,
	onSave,
	onCancel,
}: {
	title: string;
	children: ReactNode;
	pending: boolean;
	valid: boolean;
	error?: string;
	onSave: () => void;
	onCancel: () => void;
}) {
	return (
		<DetailLayout title={title}>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					onSave();
				}}
			>
				<Item>
					<ItemContent>
						<div className="space-y-4">
							{children}
							<p className="text-xs text-muted-foreground">
								Save to create this item. Changes will autosave after that.
							</p>
							{error && (
								<p role="alert" className="text-sm text-destructive">
									{error}
								</p>
							)}
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									disabled={pending}
									onClick={onCancel}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={pending || !valid}>
									{pending ? "Saving…" : "Save"}
								</Button>
							</div>
						</div>
					</ItemContent>
				</Item>
			</form>
		</DetailLayout>
	);
}
