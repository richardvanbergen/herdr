import { createFileRoute } from '@tanstack/react-router'
import { BoardContainer } from '#/components/BoardContainer'
import { useEffect } from 'react'
import { boardStore } from '#/store/boardStore'

export const Route = createFileRoute('/')({
  component: BoardPage,
})

function BoardPage() {
  useEffect(() => {
    // Mock data for now - we'll wire up the API later
    boardStore.setState((prev) => ({
      ...prev,
      currentBoard: {
        id: 1,
        name: 'Project Alpha',
        columns: [
          {
            id: 1,
            boardId: 1,
            name: 'Backlog',
            position: 1,
            cards: [
              {
                id: 1,
                columnId: 1,
                title: 'Research competitor features',
                description: 'Analyze top 5 competitors and document their key differentiators',
                position: 1,
                createdAt: '2026-01-15T10:00:00Z',
              },
              {
                id: 2,
                columnId: 1,
                title: 'Design user personas',
                description: 'Create 3-4 detailed user personas based on customer interviews',
                position: 2,
                createdAt: '2026-01-14T14:30:00Z',
              },
              {
                id: 3,
                columnId: 1,
                title: 'Set up analytics tracking',
                description: 'Implement Mixpanel events for key user actions',
                position: 3,
                createdAt: '2026-01-13T09:15:00Z',
              },
            ],
          },
          {
            id: 2,
            boardId: 1,
            name: 'To Do',
            position: 2,
            cards: [
              {
                id: 4,
                columnId: 2,
                title: 'Write API documentation',
                description: 'Document all REST endpoints with request/response examples',
                position: 1,
                createdAt: '2026-01-16T11:20:00Z',
              },
              {
                id: 5,
                columnId: 2,
                title: 'Implement authentication flow',
                description: 'Add OAuth2 support for Google and GitHub providers',
                position: 2,
                createdAt: '2026-01-15T16:45:00Z',
              },
            ],
          },
          {
            id: 3,
            boardId: 1,
            name: 'In Progress',
            position: 3,
            cards: [
              {
                id: 6,
                columnId: 3,
                title: 'Build dashboard layout',
                description: 'Create responsive grid system with sidebar navigation',
                position: 1,
                createdAt: '2026-01-17T08:00:00Z',
              },
            ],
          },
          {
            id: 4,
            boardId: 1,
            name: 'Done',
            position: 4,
            cards: [
              {
                id: 7,
                columnId: 4,
                title: 'Project setup and configuration',
                description: 'Initialize repo, configure CI/CD, set up development environment',
                position: 1,
                createdAt: '2026-01-10T13:00:00Z',
              },
              {
                id: 8,
                columnId: 4,
                title: 'Define project scope',
                description: 'Create PRD with feature list and timeline',
                position: 2,
                createdAt: '2026-01-11T10:30:00Z',
              },
              {
                id: 9,
                columnId: 4,
                title: 'Stakeholder review',
                description: 'Present project plan to leadership team and get approval',
                position: 3,
                createdAt: '2026-01-12T15:00:00Z',
              },
            ],
          },
        ],
      },
    }))
  }, [])

  return <BoardContainer />
}
