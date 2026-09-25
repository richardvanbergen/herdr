import { createFileRoute } from "@tanstack/react-router";
import { NewJob } from "#/job/components/NewJob";
export const Route = createFileRoute("/column/$columnId/job/new")({
	component: NewJobRoute,
});
function NewJobRoute() {
	const { columnId } = Route.useParams();
	return <NewJob key={columnId} columnId={Number(columnId)} />;
}
