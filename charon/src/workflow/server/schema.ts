import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { jobs } from "#/job/server/schema";
import { tasks } from "#/task/server/schema";
import { runnerIds } from "#/agent/runner-options";

export const jobWorkflow = sqliteTable("job_workflow", {
	jobId: integer("job_id")
		.primaryKey()
		.references(() => jobs.id, { onDelete: "cascade" }),
	ready: integer({ mode: "boolean" }).notNull().default(false),
	status: text({
		enum: ["draft", "queued", "working", "blocked", "review", "done"],
	})
		.notNull()
		.default("draft"),
	doneWhen: text("done_when").notNull().default(""),
	runner: text({ enum: runnerIds }).notNull().default("codex"),
	revision: integer().notNull().default(0),
	claimRevision: integer("claim_revision"),
	token: text(),
	leaseUntil: integer("lease_until"),
	updatedAt: integer("updated_at").notNull(),
});
export const jobMessages = sqliteTable("job_messages", {
	id: integer().primaryKey({ autoIncrement: true }),
	jobId: integer("job_id")
		.notNull()
		.references(() => jobs.id, { onDelete: "cascade" }),
	taskId: integer("task_id").references(() => tasks.id, {
		onDelete: "set null",
	}),
	role: text({ enum: ["human", "agent"] }).notNull(),
	content: text().notNull(),
	requestId: text("request_id").unique(),
	createdAt: integer("created_at").notNull(),
});
export const workflowDispatches = sqliteTable("workflow_dispatches", {
	requestId: text("request_id").primaryKey(),
	jobId: integer("job_id")
		.notNull()
		.references(() => jobs.id, { onDelete: "cascade" }),
	taskId: integer("task_id")
		.notNull()
		.references(() => tasks.id, { onDelete: "cascade" }),
	runId: integer("run_id"),
});
