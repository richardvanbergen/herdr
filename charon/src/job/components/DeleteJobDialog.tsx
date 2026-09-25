import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

export function DeleteJobDialog({
	title,
	open,
	pending,
	error,
	onOpenChange,
	onConfirm,
}: {
	title: string;
	open: boolean;
	pending: boolean;
	error: string | undefined;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={(value) => {
				if (!pending) onOpenChange(value);
			}}
		>
			<DialogContent showCloseButton={!pending}>
				<DialogHeader>
					<DialogTitle>Delete “{title}”?</DialogTitle>
					<DialogDescription>
						This removes the job from the board and pauses agent work. Its
						tasks, outputs, conversations and context are kept for recovery. A
						run already in progress may finish.
					</DialogDescription>
				</DialogHeader>
				{error && (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				)}
				<DialogFooter>
					<Button
						variant="outline"
						disabled={pending}
						onClick={() => onOpenChange(false)}
						autoFocus
					>
						Cancel
					</Button>
					<Button variant="destructive" disabled={pending} onClick={onConfirm}>
						{pending ? "Deleting…" : "Delete job"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
