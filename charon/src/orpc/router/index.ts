import { os } from "@orpc/server";

import { jobRouter } from "#/job/server/orpc";
import { boardRouter } from "#/board/server/orpc";
import { taskRouter } from "#/task/server/orpc";

const router = os.router({
	job: jobRouter,
	board: boardRouter,
	task: taskRouter,
});

export default router;
