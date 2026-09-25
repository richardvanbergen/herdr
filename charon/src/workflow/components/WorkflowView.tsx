import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import { WorkflowStatus, type WorkflowState } from "./WorkflowStatus";
import { Item, ItemContent } from "#/components/ui/item";
import {
	Message,
	MessageContent,
	MessageResponse,
} from "#/components/ai-elements/message";

export function WorkflowView({
	ready,
	status,
	busy,
	onReady,
	onComplete,
	settings,
	composer,
	messages,
	error,
	taskControls,
}: {
	ready: boolean;
	status: WorkflowState;
	busy: boolean;
	onReady: (value: boolean) => void;
	onComplete: () => void;
	settings: ReactNode;
	composer: ReactNode;
	taskControls?: ReactNode;
	messages: {
		id: number;
		role: "human" | "agent";
		content: string;
		taskId: number | null;
	}[];
	error?: string;
}) {
	return (
		<section className="space-y-5" aria-label="Agent workflow">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<Button
						role="switch"
						aria-checked={ready}
						variant={ready ? "default" : "outline"}
						disabled={busy}
						onClick={() => onReady(!ready)}
					>
						Ready {ready ? "on" : "off"}
					</Button>
					<WorkflowStatus ready={ready} status={status} />
				</div>
				<Button
					variant="outline"
					disabled={busy || status === "working" || status === "done"}
					onClick={onComplete}
				>
					Mark done
				</Button>
			</div>
			<p className="text-xs text-muted-foreground">
				When Ready is on, Hermes picks up this job and new replies
				automatically. You can leave and wait for a Telegram update.
			</p>
			{settings}
			{taskControls}
			<div className="space-y-4" aria-label="Job discussion">
				<h2 className="text-sm font-semibold">Discussion with Hermes</h2>
				{!messages.length && (
					<p className="text-sm text-muted-foreground">
						Add instructions or ask a question. Hermes will reply here.
					</p>
				)}
				{messages.map((message) => (
					<Item key={message.id}>
						<ItemContent>
							<span className="text-xs text-muted-foreground">
								{message.role === "human" ? "You" : "Hermes"}
								{message.taskId ? ` · Task ${message.taskId}` : ""}
							</span>
							<Message from={message.role === "human" ? "user" : "assistant"}>
								<MessageContent>
									<MessageResponse>{message.content}</MessageResponse>
								</MessageContent>
							</Message>
						</ItemContent>
					</Item>
				))}
				{composer}
			</div>
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
		</section>
	);
}
