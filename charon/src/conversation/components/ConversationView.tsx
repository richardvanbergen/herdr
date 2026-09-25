import { ContextActionsView } from "#/context/components/ContextActionsView";
import {
	Conversation,
	ConversationContent,
	ConversationEmptyState,
	ConversationScrollButton,
} from "#/components/ai-elements/conversation";
import {
	Message,
	MessageContent,
	MessageResponse,
} from "#/components/ai-elements/message";
import {
	PromptInput,
	PromptInputBody,
	PromptInputFooter,
	PromptInputSubmit,
	PromptInputTextarea,
} from "#/components/ai-elements/prompt-input";
import { runnerOptions, type RunnerId } from "#/agent/runner-options";
import type { ConversationMessage, ConversationThread } from "../server/schema";
export function ConversationView({
	threads,
	selected,
	messages,
	live,
	draft,
	error,
	creating,
	updating,
	threadError,
	runnerError,
	onCreate,
	onSelect,
	onRunnerChange,
	onSend,
	onDraftChange,
	contextUnavailableReason,
}: {
	threads: ConversationThread[];
	selected?: ConversationThread;
	messages: ConversationMessage[];
	live: { threadId: number; text: string; status: string } | null;
	draft: string;
	error: string | null;
	creating: boolean;
	updating: boolean;
	threadError: boolean;
	runnerError: boolean;
	onCreate: () => void;
	onSelect: (id: number) => void;
	onRunnerChange: (runner: RunnerId) => void;
	onSend: (text: string) => void;
	onDraftChange: (text: string) => void;
	contextUnavailableReason?: string;
}) {
	return (
		<section
			aria-label="Task conversations"
			className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-sm font-semibold text-foreground">Conversations</h2>
				<button
					type="button"
					onClick={() => onCreate()}
					disabled={creating}
					className="border border-border px-3 py-1.5 text-sm text-primary hover:bg-accent disabled:opacity-50"
				>
					+ New thread
				</button>
			</div>
			{threadError ? (
				<p role="status" className="text-sm text-destructive">
					Could not load conversations.
				</p>
			) : null}
			{threads?.length ? (
				<nav
					aria-label="Conversation threads"
					className="flex max-h-24 shrink-0 flex-wrap gap-2 overflow-auto"
				>
					{threads.map((thread) => (
						<button
							key={thread.id}
							type="button"
							onClick={() => onSelect(thread.id)}
							aria-current={thread.id === selected?.id ? "page" : undefined}
							className={`border px-3 py-1.5 text-sm ${thread.id === selected?.id ? "border-primary text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
						>
							{thread.title} #{thread.id}
						</button>
					))}
				</nav>
			) : null}
			{!selected ? (
				<p className="text-sm text-muted-foreground">
					Choose a thread or start a new one.
				</p>
			) : (
				<>
					<Conversation className="min-h-40 flex-1 bg-background">
						<ConversationContent className="gap-4">
							{!messages.length && !live ? (
								<ConversationEmptyState
									title="Start a conversation"
									description="Ask about this task or discuss what should change."
								/>
							) : null}
							{messages.map((message) => (
								<Message
									key={message.id}
									from={message.role === "human" ? "user" : "assistant"}
								>
									<MessageContent className="rounded-none">
										{message.role === "human" ? (
											<p className="whitespace-pre-wrap">{message.content}</p>
										) : (
											<MessageResponse>{message.content}</MessageResponse>
										)}
									</MessageContent>
								</Message>
							))}
							{live?.threadId === selected.id ? (
								<Message from="assistant">
									<MessageContent>
										{live.text ? (
											<MessageResponse mode="streaming">
												{live.text}
											</MessageResponse>
										) : (
											<p className="text-muted-foreground">{live.status}</p>
										)}
									</MessageContent>
								</Message>
							) : null}
						</ConversationContent>
						<ConversationScrollButton />
					</Conversation>
					<div className="flex items-center gap-2">
						<label
							className="text-sm text-muted-foreground"
							htmlFor={`conversation-runner-${selected.id}`}
						>
							Runner
						</label>
						<select
							id={`conversation-runner-${selected.id}`}
							value={selected.runner}
							disabled={updating || !!live}
							onChange={(event) =>
								onRunnerChange(event.target.value as RunnerId)
							}
							className="border border-border bg-background px-2 py-1.5 text-sm text-foreground"
						>
							{runnerOptions.map(({ id, label }) => (
								<option key={id} value={id}>
									{label}
								</option>
							))}
						</select>
					</div>
					{runnerError ? (
						<p role="status" className="text-sm text-destructive">
							Could not change model.
						</p>
					) : null}
					<ContextActionsView
						disabled={!!live || updating}
						unavailableReason={contextUnavailableReason}
						onSelect={(command) =>
							onDraftChange(
								`${command}\n${draft.replace(/^\/context (?:remember|append|review)\s*\n?/, "")}`,
							)
						}
					/>
					<PromptInput
						className="rounded-none"
						onSubmit={(message) => {
							onSend(message.text);
						}}
					>
						<PromptInputBody>
							<PromptInputTextarea
								aria-label="Reply"
								placeholder="Reply in this thread…"
								value={draft}
								onChange={(event) => onDraftChange(event.target.value)}
								disabled={!!live}
							/>
						</PromptInputBody>
						<PromptInputFooter className="justify-end">
							<PromptInputSubmit
								status={live ? "streaming" : "ready"}
								disabled={!draft.trim() || !!live}
							/>
						</PromptInputFooter>
					</PromptInput>
					{error ? (
						<p role="status" className="text-sm text-destructive">
							{error}
						</p>
					) : null}
				</>
			)}
		</section>
	);
}
