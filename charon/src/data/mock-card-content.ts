export interface CardContent {
  id: number
  title: string
  description: string | null
  createdAt: string
}

const cardContent: CardContent[] = [
  {
    id: 1,
    title: 'Research competitor features',
    description: 'Analyze top 5 competitors and document their key differentiators',
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 2,
    title: 'Design user personas',
    description: 'Create 3-4 detailed user personas based on customer interviews',
    createdAt: '2026-01-14T14:30:00Z',
  },
  {
    id: 3,
    title: 'Set up analytics tracking',
    description: 'Implement Mixpanel events for key user actions',
    createdAt: '2026-01-13T09:15:00Z',
  },
  {
    id: 4,
    title: 'Write API documentation',
    description: 'Document all REST endpoints with request/response examples',
    createdAt: '2026-01-16T11:20:00Z',
  },
  {
    id: 5,
    title: 'Implement authentication flow',
    description: 'Add OAuth2 support for Google and GitHub providers',
    createdAt: '2026-01-15T16:45:00Z',
  },
  {
    id: 6,
    title: 'Build dashboard layout',
    description: 'Create responsive grid system with sidebar navigation',
    createdAt: '2026-01-17T08:00:00Z',
  },
  {
    id: 7,
    title: 'Project setup and configuration',
    description: 'Initialize repo, configure CI/CD, set up development environment',
    createdAt: '2026-01-10T13:00:00Z',
  },
  {
    id: 8,
    title: 'Define project scope',
    description: 'Create PRD with feature list and timeline',
    createdAt: '2026-01-11T10:30:00Z',
  },
  {
    id: 9,
    title: 'Stakeholder review',
    description: 'Present project plan to leadership team and get approval',
    createdAt: '2026-01-12T15:00:00Z',
  },
]

/** Temporary front-end fixture adapter. Replace only this function with an API call later. */
export async function fetchCardContent(cardId: number): Promise<CardContent> {
  const card = cardContent.find((candidate) => candidate.id === cardId)

  if (!card) {
    throw new Error(`Card ${cardId} was not found`)
  }

  return card
}
