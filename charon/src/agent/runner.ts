export interface AgentRunner {
  run(prompt: string): Promise<string>
}

export interface TaskContext {
  project?: { name: string; description?: string | null }
  job: { title: string; description: string | null }
  task: string
}

export function taskPrompt({ project, job, task }: TaskContext): string {
  return [
    'You are working in the current project workspace. Use its files and instructions as context.',
    project ? `Project: ${project.name}\n${project.description ?? ''}` : null,
    `Job: ${job.title}\n${job.description ?? ''}`,
    `Task:\n${task}`,
    'Complete the task and report the result in your final response.',
  ].filter(Boolean).join('\n\n')
}
