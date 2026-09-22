/**
 * The business centres' local configuration.
 *
 * One store behind two surfaces: the settings page edits it, the sidebar
 * directory reads it. Keeping it single is what makes "add an agent in
 * settings" and "see it in the sidebar" the same fact rather than a sync
 * problem.
 *
 * The source decides where a capability list comes from. `local` is the rung
 * that ships today: everything here was built on this machine and works with
 * no platform at all. `remote` names an endpoint the client will read from
 * once the platform side exists — the URL is recorded now so the choice is
 * visible, while the transport stays out of this rung on purpose.
 *
 * Persisted per browser beside the sidebar's own preferences, so a change
 * survives reload without asking the Host for anything.
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { AgentDraft, AgentSpec, WorkflowDraft, WorkflowSpec } from './spec.ts'

/** Where the centres read their capability list from. */
export type CenterSource = 'local' | 'remote'

/** The centres' configuration as every reader sees it. */
export interface CentersState {
  /** Which source the directory renders. */
  source: CenterSource
  /** Remote platform origin; recorded now, contacted once the platform side lands. */
  remoteBaseUrl: string
  /** Agents built on this machine, in creation order. */
  agents: readonly AgentSpec[]
  /** Workflows built on this machine, in creation order. */
  workflows: readonly WorkflowSpec[]
}

/** Read-only view of the centres' configuration. */
export type CentersSnapshot = Readonly<CentersState>

/** The centres' local configuration service. */
export interface CentersService extends ObservableSnapshot<CentersSnapshot> {
  /**
   * Choose where the capability list comes from.
   * @param source - the source to read.
   */
  setSource(source: CenterSource): void
  /**
   * Record the remote origin.
   * @param url - the platform origin to read from in remote mode.
   */
  setRemoteBaseUrl(url: string): void
  /**
   * Store one drafted agent.
   * @param draft - the drafted spec.
   * @returns the stored agent, with its assigned id.
   */
  addAgent(draft: AgentDraft): AgentSpec
  /**
   * Rewrite one locally built agent from its edit form; the id stays.
   * @param id - the agent's local id.
   * @param draft - the edited spec.
   */
  updateAgent(id: string, draft: AgentDraft): void
  /**
   * Forget one locally built agent.
   * @param id - the agent's local id.
   */
  removeAgent(id: string): void
  /**
   * Store one drafted workflow.
   * @param draft - the drafted spec.
   * @returns the stored workflow, with its assigned id.
   */
  addWorkflow(draft: WorkflowDraft): WorkflowSpec
  /**
   * Forget one locally built workflow.
   * @param id - the workflow's local id.
   */
  removeWorkflow(id: string): void
}

/** Id prefix of a locally built agent, distinct from any platform id. */
const AGENT_PREFIX = 'local.agent.'

/** Id prefix of a locally built workflow. */
const WORKFLOW_PREFIX = 'local.flow.'

/**
 * First free id under a prefix, so removing an entry never shadows a live one.
 * @param prefix - id prefix for the kind being added.
 * @param taken - ids already in use.
 * @returns the next free id.
 */
function nextId(prefix: string, taken: readonly string[]): string {
  let index = 1
  while (taken.includes(`${prefix}${index}`)) index += 1
  return `${prefix}${index}`
}

/**
 * Create the centres' configuration service.
 * @returns the service, persisted per browser.
 */
export function createCentersService(): CentersService {
  const store = createSnapshotStore<CentersState>(
    { source: 'local', remoteBaseUrl: '', agents: [], workflows: [] },
    { persist: { name: 'dsh.suixing.centers' } },
  )
  return {
    getSnapshot: () => store.getSnapshot(),
    subscribe: listener => store.subscribe(listener),
    setSource: (source) => { store.update((draft) => { draft.source = source }) },
    setRemoteBaseUrl: (remoteBaseUrl) => { store.update((draft) => { draft.remoteBaseUrl = remoteBaseUrl }) },
    addAgent: (draft) => {
      const agent: AgentSpec = {
        id: nextId(AGENT_PREFIX, store.getSnapshot().agents.map(existing => existing.id)),
        ...draft,
      }
      store.update((state) => { state.agents = [...state.agents, agent] })
      return agent
    },
    updateAgent: (id, draft) => {
      store.update((state) => {
        state.agents = state.agents.map(agent => agent.id === id ? { id, ...draft } : agent)
      })
    },
    removeAgent: (id) => {
      store.update((state) => { state.agents = state.agents.filter(agent => agent.id !== id) })
    },
    addWorkflow: (draft) => {
      const workflow: WorkflowSpec = {
        id: nextId(WORKFLOW_PREFIX, store.getSnapshot().workflows.map(existing => existing.id)),
        ...draft,
      }
      store.update((state) => { state.workflows = [...state.workflows, workflow] })
      return workflow
    },
    removeWorkflow: (id) => {
      store.update((state) => { state.workflows = state.workflows.filter(flow => flow.id !== id) })
    },
  }
}
