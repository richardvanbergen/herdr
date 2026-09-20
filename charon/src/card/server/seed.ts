import { cards } from "#/card/server/schema";
import { db } from "#/db";

const developmentCards = [
	{
		title: "Research competitor features",
		description:
			"Analyze top 5 competitors and document their key differentiators",
	},
	{
		title: "Design user personas",
		description:
			"Create 3-4 detailed user personas based on customer interviews",
	},
	{
		title: "Set up analytics tracking",
		description: "Implement Mixpanel events for key user actions",
	},
	{
		title: "Write API documentation",
		description:
			"Document all REST endpoints with request and response examples",
	},
	{
		title: "Implement authentication flow",
		description: "Add OAuth2 support for Google and GitHub providers",
	},
	{
		title: "Build dashboard layout",
		description: "Create a responsive grid system for the application shell",
	},
	{
		title: "Project setup and configuration",
		description: "Initialize the repository and development environment",
	},
	{
		title: "Define project scope",
		description: "Create a PRD with the feature list and timeline",
	},
	{
		title: "Stakeholder review",
		description: "Present the project plan and collect feedback",
	},
];

const existingCard = db.select({ id: cards.id }).from(cards).limit(1).get();

if (!existingCard) {
	db.insert(cards).values(developmentCards).run();
	console.log(`Seeded ${developmentCards.length} development cards.`);
} else {
	console.log("Cards already exist; seed skipped.");
}
