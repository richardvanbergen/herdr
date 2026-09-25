import { createFileRoute } from "@tanstack/react-router";
import { NewTask } from "#/task/components/NewTask";
export const Route = createFileRoute("/column/$columnId/job/$jobId/task/new")({
	component: NewTaskRoute,
});
function NewTaskRoute() {
	const { columnId, jobId } = Route.useParams();
	return (
		<NewTask key={jobId} columnId={Number(columnId)} jobId={Number(jobId)} />
	);
}
