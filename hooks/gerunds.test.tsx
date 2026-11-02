import { expect, mock, test } from 'claude-code/testing'

function watch(on: any, tool: (e: any) => unknown = () => ({ result: {} })) {
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ answer: '', text: '' }))
  on('tool.register', (_: any, e: any) => ({ value: { tool: e.name === 'status' ? 'mcp__gerunds__status' : e.name } }))
  on('command.register', () => ({ value: {} }))
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('ui.blit', () => ({ value: {} }))
  on('tool.call', (_: any, e: any) => tool(e))
}

async function listed($: any) {
  return String(((await $.command.run({ command: 'gerunds' })) as any).text)
}

async function think($: any, on: any, ms: number, turnId = 't1') {
  const clock = mock.clock(on)
  watch(on)
  on('turn.step', async function* (_: any, e: any) {
    yield { kind: 'thinking', index: 0, text: 'x' }
    await clock.advance(e.turnId === turnId ? ms : 0)
    yield { kind: 'text', index: 1, text: 'y' }
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { output_tokens: 10, input_tokens: 0, model: 'm' } } as any
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId })
  for await (const _ of $.turn.step({ turnId, index: 0, model: 'm', messageCount: 1 } as any)) {}
  return clock
}

test('the tool and /gerunds register, and the description names the tool', async ($, on) => {
  let description = ''
  let command = ''
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('tool.register', (_: any, e: any) => {
    description = String(e.description ?? '')
    return { value: { tool: 'mcp__gerunds__status' } }
  })
  on('command.register', (_: any, e: any) => {
    command = String(e.name ?? '')
    return { value: {} }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(description).toContain('mcp__gerunds__status')
  expect(command).toBe('gerunds')
})

test('a verb is stored, an empty one is not, and the text is capped at 48', async ($, on) => {
  mock.clock(on)
  watch(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const empty: any = await $.tool.call({ tool: 'mcp__gerunds__status', text: '   ' })
  expect(empty.result).toBe('ok')
  expect(await listed($)).toMatch(/No verbs set yet/)
  await $.tool.call({ tool: 'mcp__gerunds__status', text: 'Frolicking' })
  expect(await listed($)).toMatch(/Frolicking/)
  const long = 'Reticulating'.repeat(8)
  await $.tool.call({ tool: 'mcp__gerunds__status', text: long })
  const lines = (await listed($)).split('\n')
  const held = lines[lines.length - 1].slice(10) // 'HH:MM:SS  ' then the verb
  expect(held.length).toBe(48)
  expect(long.startsWith(held)).toBe(true)
})

function peekVerb(on: any) {
  on('turn.start', async ($: any, e: any, next: any) => {
    const done = await next(e)
    const got = await $.state.get({ plugin: 'gerunds', key: 'verb' })
    return { ...(done ?? {}), verb: got.value }
  })
}

test('the next turn clears the verb and leaves the log', {
  plugins: [{ name: 'peek', tier: 'prepend', register: peekVerb }],
}, async ($, on) => {
  mock.clock(on)
  watch(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.tool.call({ tool: 'mcp__gerunds__status', text: 'Frolicking' })
  const ended: any = await $.turn.complete({ turnId: 't1', answer: '' } as any)
  void ended
  const again: any = await $.turn.start({ text: 'again', turnId: 't2' })
  expect(again.verb).toBe('')
  expect(await listed($)).toMatch(/Frolicking/)
})

test('a subagent turn does not drop the log', async ($, on) => {
  mock.clock(on)
  watch(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 'main' })
  await $.tool.call({ tool: 'mcp__gerunds__status', text: 'Frolicking' })
  await $.turn.start({ text: 'sub', turnId: 'sub', agentId: 'agent-1' })
  expect(await listed($)).toMatch(/Frolicking/)
})

test('/gerunds lists the verbs in order, and says so when there are none', async ($, on) => {
  mock.clock(on)
  watch(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(((await $.command.run({ command: 'gerunds' })) as any).text).toMatch(/No verbs set yet/)
  await $.turn.start({ text: 'hi', turnId: 'v1' })
  await $.tool.call({ tool: 'mcp__gerunds__status', text: 'Inscribing numerals' })
  await $.tool.call({ tool: 'mcp__gerunds__status', text: '' })
  await $.tool.call({ tool: 'mcp__gerunds__status', text: 'Naming the nameless' })
  const lines = String(((await $.command.run({ command: 'gerunds' })) as any).text).split('\n')
  expect(lines.length).toBe(2)
  expect(lines[0]).toMatch(/^\d\d:\d\d:\d\d  Inscribing numerals$/)
  expect(lines[1]).toMatch(/^\d\d:\d\d:\d\d  Naming the nameless$/)
})

test('the log keeps the last 500 verbs', async ($, on) => {
  mock.clock(on)
  watch(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 'v1' })
  for (let i = 0; i < 501; i++) await $.tool.call({ tool: 'mcp__gerunds__status', text: 'V' + i })
  const lines = (await listed($)).split('\n')
  expect(lines.length).toBe(500)
  expect(lines[0]).toMatch(/V1$/)
  expect(lines[499]).toMatch(/V500$/)
})

test('a long think earns one nudge, and the nudge names the tool', async ($, on) => {
  await think($, on, 30000)
  const first: any = await $.tool.call({ tool: 'Bash', command: 'ls' })
  const ctx = (first.context ?? []).join(' ')
  expect(ctx).toContain('mcp__gerunds__status')
  const second: any = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect((second.context ?? []).length).toBe(0)
})

test('a short think earns no nudge', async ($, on) => {
  await think($, on, 5000)
  const r: any = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect((r.context ?? []).length).toBe(0)
})

test('calling the status tool spends the nudge', async ($, on) => {
  await think($, on, 30000)
  await $.tool.call({ tool: 'mcp__gerunds__status', text: 'Frolicking' })
  const r: any = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect((r.context ?? []).length).toBe(0)
})

test('a denied tool result carries no nudge', async ($, on) => {
  const clock = mock.clock(on)
  watch(on, () => ({ deny: 'no' }))
  on('turn.step', async function* (_: any, e: any) {
    yield { kind: 'thinking', index: 0, text: 'x' }
    await clock.advance(30000)
    yield { kind: 'text', index: 1, text: 'y' }
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { output_tokens: 1, input_tokens: 0, model: 'm' } } as any
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 't1' })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 } as any)) {}
  const r: any = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(r.deny).toBe('no')
  expect((r.context ?? []).length).toBe(0)
})

test('a subagent think does not earn the nudge', async ($, on) => {
  const clock = mock.clock(on)
  watch(on)
  on('turn.step', async function* (_: any, e: any) {
    yield { kind: 'thinking', index: 0, text: 'x' }
    await clock.advance(30000)
    yield { kind: 'text', index: 1, text: 'y' }
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { output_tokens: 1, input_tokens: 0, model: 'm' } } as any
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 'main' })
  await $.turn.start({ text: 'sub', turnId: 'sub', agentId: 'agent-1' })
  for await (const _ of $.turn.step({ turnId: 'sub', index: 0, model: 'm', messageCount: 1 } as any)) {}
  const r: any = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect((r.context ?? []).length).toBe(0)
})

async function nudge($: any, on: any, ms: number) {
  await think($, on, ms)
  const r: any = await $.tool.call({ tool: 'Bash', command: 'ls' })
  return (r.context ?? []).join(' ')
}

test('longThinkSeconds lowers the threshold', { options: { longThinkSeconds: 3 } }, async ($, on) => {
  expect(await nudge($, on, 5000)).toContain('mcp__gerunds__status')
})

test('longThinkSeconds raises the threshold', { options: { longThinkSeconds: 60 } }, async ($, on) => {
  expect(await nudge($, on, 30000)).toBe('')
})

test('longThinkSeconds 0 turns the nudge off', { options: { longThinkSeconds: 0 } }, async ($, on) => {
  expect(await nudge($, on, 30000)).toBe('')
})

test('the status row reads "updated verb: ..." and passes the rest through', async ($, on) => {
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const row = async (tool: string, extra: Record<string, unknown> = {}, input: unknown = { text: 'Winding the timer' }) => {
    const ui = await $.ui.mount({
      plugin: 'gerunds', surface: 'terminal', component: 'ToolUse', requestId: 'x' + Math.random(),
      props: { tool_use_id: 'x', tool, input, isRunning: false, isErrored: false, isInterrupted: false, isExpanded: false, ...extra },
    })
    const text = (await ui.find({ type: 'Text' }))?.text
    await ui.unmount()
    return text
  }
  const status = 'mcp__gerunds__status'
  expect(await row(status)).toBe('● updated verb: Winding the timer')
  expect(await row(status, { isRunning: true })).toBe('● updated verb: Winding the timer')
  expect(await row(status, { isExpanded: true })).toBe('engine')
  expect(await row(status, { isErrored: true })).toBe('engine')
  expect(await row(status, { isInterrupted: true })).toBe('engine')
  expect(await row(status, {}, { text: '  ' })).toBe('engine')
  expect(await row('Bash', {}, { command: 'ls' })).toBe('engine')
})

test('the status result is an empty box until it is expanded', async ($, on) => {
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const result = async (tool: string, isExpanded: boolean) => {
    const ui = await $.ui.mount({
      plugin: 'gerunds', surface: 'terminal', component: 'ToolResult', requestId: 'r' + Math.random(),
      props: { tool_use_id: 'x', tool, output: { result: 'ok' }, isErrored: false, isExpanded },
    })
    const text = (await ui.find({ type: 'Text' }))?.text
    await ui.unmount()
    return text
  }
  expect(await result('mcp__gerunds__status', false)).toBeUndefined()
  expect(await result('mcp__gerunds__status', true)).toBe('engine')
  expect(await result('Bash', false)).toBe('engine')
})

test('a held verb is the word the next hook sees, and a message passes through', async ($, on) => {
  mock.clock(on)
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('tool.register', (_: any, e: any) => ({ value: { tool: e.name === 'status' ? 'mcp__gerunds__status' : e.name } }))
  on('command.register', () => ({ value: {} }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    if (e.component !== 'Spinner') return <Text>engine</Text>
    return <Text>{'w=' + e.props.word + '|m=' + String(e.props.message) + '|s=' + e.props.suffix}</Text>
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 'spin' })
  const ui = await $.ui.mount({
    plugin: 'gerunds', surface: 'terminal', component: 'Spinner', requestId: 's1',
    props: { word: 'Working', message: null, suffix: '…', mode: 'thinking' },
  })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('w=Working|m=null|s=…')
  await $.tool.call({ tool: 'mcp__gerunds__status', text: 'Frolicking' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('w=Frolicking|m=null|s=…')
  await ui.redraw({ word: 'Working', message: 'saving', suffix: '…', mode: 'thinking' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('w=Working|m=saving|s=…')
  await ui.unmount()
})

test("/gerunds draws its list without the engine's 'gerunds:' label; other commands keep theirs", async ($, on) => {
  const drawn: Record<string, string> = {}
  on('ui.render', ($: any, e: any) => {
    drawn[e.requestId] = e.props.text
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const rows: [string, string, string][] = [
    ['g', 'gerunds', 'gerunds: 19:42:12  Herding grok\n19:42:54  Juggling glyphs'],
    ['bare', 'gerunds', '19:42:12  Herding grok'],
    ['other', 'cost', 'gerunds: not ours'],
  ]
  for (const [id, command, text] of rows) {
    const ui = await $.ui.mount({ plugin: 'gerunds', surface: 'terminal', component: 'CommandOutput', requestId: id, props: { command, args: '', text, isErrored: false } })
    await ui.unmount()
  }
  expect(drawn.g).toBe('19:42:12  Herding grok\n19:42:54  Juggling glyphs')
  expect(drawn.bare).toBe('19:42:12  Herding grok')
  expect(drawn.other).toBe('gerunds: not ours')
})
