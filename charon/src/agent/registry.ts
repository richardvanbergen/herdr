import type { AgentRunner } from './runner'
import { CodexRunner } from './codex-runner'
import { OpenRouterRunner } from './openrouter-runner'
import { HermesRunner } from './hermes-runner'
import type { RunnerId } from './runner-options'

export type { RunnerId } from './runner-options'

const runners: Record<RunnerId, AgentRunner> = {
  codex: new CodexRunner(),
  openrouter: new OpenRouterRunner(),
  hermes: new HermesRunner(),
}

export function getRunner(id: RunnerId): AgentRunner {
  return runners[id]
}
