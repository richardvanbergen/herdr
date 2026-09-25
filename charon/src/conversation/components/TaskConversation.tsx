import { ConversationView } from "./ConversationView";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { client } from "#/orpc/client";
import { replyToThread } from "../server/reply";
import { contextQueryOptions } from "#/context/queries/context-query-options";
import { type RunnerId } from "#/agent/runner-options";

const threadsKey = (taskId: number) =>
	["conversation", "threads", taskId] as const;
const messagesKey = (threadId: number) =>
	["conversation", "messages", threadId] as const;

export function TaskConversation({
	columnId,
	jobId,
	taskId,
	threadId,
	useJobContext,
}: {
	columnId: number;
	jobId: number;
	taskId: number;
	threadId?: number;
	useJobContext: boolean;
}) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [draft, setDraft] = useState("");
	const [live, setLive] = useState<{
		threadId: number;
		text: string;
		status: string;
	} | null>(null);
	const [error, setError] = useState<string | null>(null);
	const threads = useQuery({
		queryKey: threadsKey(taskId),
		queryFn: () => client.conversation.listThreads({ taskId }),
	});
	const selected = threads.data?.find((thread) => thread.id === threadId);
	const messages = useQuery({
		queryKey: messagesKey(threadId ?? 0),
		queryFn: () => client.conversation.listMessages({ threadId: threadId! }),
		enabled: !!selected,
	});
	const selectThread = (id: number) =>
		navigate({
			to: "/column/$columnId/job/$jobId/task/$taskId",
			params: {
				columnId: String(columnId),
				jobId: String(jobId),
				taskId: String(taskId),
			},
			search: (previous) => ({ ...previous, thread: id, panel: "discussion" }),
		});
	const create = useMutation({
		mutationFn: () =>
			client.conversation.createThread({ taskId, title: "New conversation" }),
		onSuccess: async (thread) => {
			await queryClient.invalidateQueries({ queryKey: threadsKey(taskId) });
			await selectThread(thread.id);
		},
	});
	const update = useMutation({
		mutationFn: (runner: RunnerId) =>
			client.conversation.updateThread({ id: selected!.id, runner }),
		onSuccess: (thread) =>
			queryClient.setQueryData(
				threadsKey(taskId),
				(current: typeof threads.data) =>
					current?.map((item) => (item.id === thread.id ? thread : item)),
			),
	});

	async function send(content: string) {
		if (!selected || !content.trim() || live) return;
		const activeThread = selected.id;
		setError(null);
		setDraft("");
		setLive({ threadId: activeThread, text: "", status: "Thinking…" });
		try {
			for await (const event of await replyToThread({
				data: { threadId: activeThread, content: content.trim() },
			})) {
				if (event.type === "started") {
					await queryClient.invalidateQueries({
						queryKey: messagesKey(activeThread),
					});
					void queryClient.invalidateQueries({ queryKey: threadsKey(taskId) });
				} else if (event.type === "text") {
					setLive((current) =>
						current?.threadId === activeThread
							? {
									...current,
									status: "Writing…",
									text: current.text + event.delta,
								}
							: current,
					);
				} else if (event.type === "status") {
					setLive((current) =>
						current?.threadId === activeThread
							? { ...current, status: event.message }
							: current,
					);
				} else if (event.type === "completed") {
					await queryClient.invalidateQueries({
						queryKey: messagesKey(activeThread),
					});
					setLive(null);
				} else if (event.type === "failed") {
					setError(event.message);
					setLive(null);
				}
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not send reply");
			setLive(null);
			await queryClient.invalidateQueries({
				queryKey: messagesKey(activeThread),
			});
		} finally {
			setLive(null);
			void queryClient.invalidateQueries({
				queryKey: contextQueryOptions(jobId).queryKey,
			});
		}
	}

	return (
		<ConversationView
			threads={threads.data ?? []}
			selected={selected}
			messages={messages.data ?? []}
			live={live}
			draft={draft}
			error={error}
			creating={create.isPending}
			updating={update.isPending}
			threadError={threads.isError || create.isError}
			runnerError={update.isError}
			onCreate={() => create.mutate()}
			onSelect={(id) => {
				void selectThread(id);
			}}
			onRunnerChange={(runner) => update.mutate(runner)}
			onSend={(text) => {
				void send(text);
			}}
			onDraftChange={setDraft}
			contextUnavailableReason={
				!useJobContext
					? "Enable Use job context to use these actions."
					: selected?.runner === "openrouter"
						? "Select Codex or Hermes; OpenRouter has no file tools yet."
						: undefined
			}
		/>
	);
}
