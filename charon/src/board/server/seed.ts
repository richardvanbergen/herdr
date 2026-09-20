import { columns } from "#/board/server/schema";
import { db } from "#/db";

export function seedBoard() {
	if (db.select({ id: columns.id }).from(columns).limit(1).get()) return;

	db.insert(columns).values([
		{ name: "Backlog", position: 1 },
		{ name: "To Do", position: 2 },
		{ name: "In Progress", position: 3 },
		{ name: "Done", position: 4 },
	]).run();
	console.log("Seeded board columns.");
}

seedBoard();
