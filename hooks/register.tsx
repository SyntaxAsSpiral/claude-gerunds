import type { Register } from 'claude-code'

import type { Verb } from '../types'

// The names a rename would touch. verb and verbs are this plugin's own state.
const STATUS_TOOL = 'mcp__gerunds__status'
const COMMAND = 'gerunds'
const VERB = { plugin: 'gerunds', key: 'verb' } as const
const VERBS = { plugin: 'gerunds', key: 'verbs' } as const
const VERBS_KEPT = 500
const LONG_THINK_SECONDS = 10

let longThinkMs = LONG_THINK_SECONDS * 1000
let owedVerb = false
let mainTurn = ''
let thinkFrom = -1 // when the current stretch of thinking began, or -1
let stepStart = 0
let thoughtThisStep = false
let isThinking = false

function verbsOf(value: unknown): Verb[] {
  if (!Array.isArray(value)) return []
  const out: Verb[] = []
  for (const v of value) {
    if (v && typeof v.at === 'number' && typeof v.text === 'string') out.push({ at: v.at, text: v.text })
  }
  return out
}

function closeThinking(now: number) {
  if (thinkFrom >= 0 && longThinkMs > 0 && now - thinkFrom >= longThinkMs) owedVerb = true
  thinkFrom = -1
  isThinking = false
}

export const register: Register = (on, options) => {
  const seconds = Number(options.longThinkSeconds ?? LONG_THINK_SECONDS)
  longThinkMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0

  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'status',
      description:
        'Call mcp__gerunds__status to set the word shown beside the working spinner: one playful, creative gerund (e.g. "Reticulating", "Discombobulating", "Frolicking", "Enchanting"). Optional and cheap; call it whenever a fresh word fits, no punctuation.',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string', maxLength: 48 } },
        required: ['text'],
      },
      isDeferred: false,
    })
    await $.command.register({ name: COMMAND, description: 'List the verbs the model set this session, with their times' })
    return next(e)
  })

  on('tool.call', { tool: STATUS_TOOL }, async ($, e: any) => {
    owedVerb = false // the model answered, including with an empty text
    const text = String(e.text ?? '').trim().slice(0, 48)
    if (text === '') return { result: 'ok' }
    const at = await $.clock.now()
    const held = await $.state.get(VERBS)
    const verbs = [...verbsOf(held.value), { at, text }].slice(-VERBS_KEPT)
    await $.state.set(VERBS, verbs)
    await $.state.set(VERB, text)
    $.ui.invalidate('ui.render')
    return { result: 'ok' }
  })

  on('command.run', { command: COMMAND }, async $ => {
    const held = await $.state.get(VERBS)
    const verbs = verbsOf(held.value)
    if (verbs.length === 0) return { text: 'No verbs set yet this session.' }
    const clock = (ms: number) => new Date(ms).toTimeString().slice(0, 8)
    // the engine puts the mod's name before the text; the list starts on the line below it
    return { text: '\n' + verbs.map(v => `${clock(v.at)}  ${v.text}`).join('\n') }
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === STATUS_TOOL) owedVerb = false
    const done = await next(e)
    if (!owedVerb || done.deny !== undefined) return done
    owedVerb = false
    return {
      ...done,
      context: [
        ...(done.context ?? []),
        'You just thought for a long while. Call mcp__gerunds__status once, with one creative, expressive verb or short phrase about what you are doing now, then carry on.',
      ],
    }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    mainTurn = e.turnId
    owedVerb = false
    thinkFrom = -1
    isThinking = false
    thoughtThisStep = false
    await $.state.set(VERB, '') // the engine's own word, until the model sets one
    return next(e)
  })

  // Timed on the wall clock, not the spinner's frame tick. The stream is forwarded whole.
  on('turn.step', async function* ($, e, next) {
    if (e.turnId !== mainTurn) return yield* next(e)
    stepStart = await $.clock.now()
    thoughtThisStep = false
    const stream = next(e)
    for await (const chunk of stream) {
      const now = await $.clock.now()
      const kind = (chunk as { kind?: string }).kind
      if (kind === 'thinking') {
        if (thinkFrom < 0) thinkFrom = thoughtThisStep ? now : stepStart
        thoughtThisStep = true
        isThinking = true
      } else if (isThinking) closeThinking(now)
      yield chunk
    }
    closeThinking(await $.clock.now())
    return await stream.result
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    owedVerb = false
    thinkFrom = -1
    isThinking = false
    await $.state.set(VERB, '')
    return next(e)
  })

  // A verb replaces the Spinner word on the way through. No tree: a drawer further in has to run.
  // message and suffix stay as they arrived. A non-null engine message is passed through whole.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.props.message !== null) return next(e)
    const held = await $.state.get(VERB)
    const verb = typeof held.value === 'string' ? held.value : ''
    if (verb === '') return next(e)
    return next({ ...e, props: { ...e.props, word: verb } })
  })

  // The status tool's rows in the transcript, shortened to "updated verb: <the verb>". The verb stays in it, so the
  // row is still the record of what was chosen; ctrl+o shows the whole call and its result.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const p = e.props
    if (p.tool !== STATUS_TOOL || p.isExpanded || p.isErrored || p.isInterrupted) return next(e)
    const text = String((p.input as { text?: unknown } | undefined)?.text ?? '').trim()
    if (text === '') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box paddingTop={1}>
        <Text>{'● updated verb: ' + text}</Text>
      </Box>
    )
  })
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.props.tool !== STATUS_TOOL || e.props.isExpanded || e.props.isErrored) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box /> // the result is only "ok": the row above says it all
  })
}
