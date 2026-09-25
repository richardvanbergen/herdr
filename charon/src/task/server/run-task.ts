import { createServerFn } from '@tanstack/react-start'
import * as z from 'zod'
import { executeTaskRun } from './execute-task'
import { runnerIds } from '#/agent/runner-options'

const input = z.object({
  id: z.number().int().positive(),
  text: z.string().trim().min(1),
  runner: z.enum(runnerIds),
})

export const runTaskStream = createServerFn({ method: 'POST' })
  .validator(input)
  .handler(({ data }) => executeTaskRun(data))
