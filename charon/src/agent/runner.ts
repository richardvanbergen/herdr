export interface AgentRunner {
  run(prompt: string, signal?: AbortSignal): AsyncIterable<AgentEvent>
}

export type AgentEvent =
  | { type: 'status'; message: string }
  | { type: 'text'; delta: string }
  | { type: 'tool'; id: string; name: string; status: 'running' | 'completed' | 'failed'; detail?: string; output?: string; exitCode?: number; cwd?: string }

export interface TaskContext {
  project?: { name: string; description?: string | null }
  job: { title: string; description: string | null }
  task: string
  contextInstructions?: string
}

export function taskPrompt({ project, job, task, contextInstructions }: TaskContext): string {
  return [
    'You are working in the current project workspace. Use its files and instructions as context.',
    project ? `Project: ${project.name}\n${project.description ?? ''}` : null,
    `Job: ${job.title}\n${job.description ?? ''}`,
    `Task:\n${task}`,
    contextInstructions,
    'Complete the task and report the result in your final response.',
  ].filter(Boolean).join('\n\n')
}
