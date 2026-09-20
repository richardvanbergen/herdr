import { ORPCError, os } from "@orpc/server";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { cards } from "#/card/server/schema";
import { db } from "#/db";

const cardIdInput = z.object({
	id: z.number().int().positive(),
});

/** Retrieves card content only; placement is intentionally not part of this API. */
export const getCard = os.input(cardIdInput).handler(({ input }) => {
	const card = db.select().from(cards).where(eq(cards.id, input.id)).get();

	if (!card) {
		throw new ORPCError("NOT_FOUND");
	}

	return card;
});

export const cardRouter = {
	get: getCard,
};
