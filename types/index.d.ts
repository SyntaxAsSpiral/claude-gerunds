export type Verb = { at: number; text: string }

declare module 'claude-code' {
  interface PluginState {
    gerunds: { verb: string; verbs: Verb[] }
  }
}
