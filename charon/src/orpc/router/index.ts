import { workflowRouter } from "#/workflow/server/orpc";
import { os } from "@orpc/server";

import { jobRouter } from "#/job/server/orpc";
import { boardRouter } from "#/board/server/orpc";
import { taskRouter } from "#/task/server/orpc";
import { conversationRouter } from "#/conversation/server/orpc";
import { contextRouter } from "#/context/server/orpc";

const router = os.router({
	job: jobRouter,
	board: boardRouter,
	task: taskRouter,
	conversation: conversationRouter,
	context: contextRouter,
	workflow: workflowRouter,
});

export default router;
