import { os } from "@orpc/server";

import { cardRouter } from "#/card/server/orpc";

const router = os.router({
	card: cardRouter,
});

export default router;
