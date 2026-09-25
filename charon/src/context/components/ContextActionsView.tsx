import { Button } from "#/components/ui/button";
import { contextActions } from "../actions";

export function ContextActionsView({
	disabled,
	unavailableReason,
	onSelect,
}: {
	disabled: boolean;
	unavailableReason?: string;
	onSelect: (command: string) => void;
}) {
	return (
		<details className="shrink-0 border-t border-border pt-2 text-xs">
			<summary className="cursor-pointer text-muted-foreground hover:text-foreground">
				Context actions
			</summary>
			<p className="my-2 text-muted-foreground">
				Choose an action, add details, then send it to the agent.
			</p>
			<div className="flex flex-wrap gap-2">
				{contextActions.map((action) => (
					<Button
						key={action.command}
						type="button"
						variant="outline"
						size="sm"
						title={`${action.command}: ${action.description}`}
						disabled={disabled || !!unavailableReason}
						onClick={() => onSelect(action.command)}
					>
						{action.label}
					</Button>
				))}
			</div>
			<p className="mt-2 text-muted-foreground">
				{unavailableReason ??
					"You can also type /context remember, /context append, or /context review on the first line."}
			</p>
		</details>
	);
}
