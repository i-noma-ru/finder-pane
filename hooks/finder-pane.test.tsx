import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'finder-pane',
  component: 'Pane',
  requestId: 'finder-pane',
  props: {
    title: 'ファイル',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const TURN = { durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as const

type Seen = { toasts: string[]; argv: (readonly string[])[] }

// エンジンの代わり: 1 つのフォルダだけが実在し、ペインは isShown の値で開いている
function engine(on: Parameters<Parameters<typeof test>[1]>[1], isShown: boolean): Seen {
  const seen: Seen = { toasts: [], argv: [] }
  on('command.register', () => ({ value: { command: 'files' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('env.get', () => ({ value: '/Users/x' }))
  on('fs.exists', () => ({ value: true }))
  on('fs.stat', () => ({ value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: false } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({
    value: [{ id: 'finder-pane', title: 'ファイル', isShown, isFocused: false, isPlaced: true }],
  }))
  on('ui.toast', (_, e) => {
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('process.run', (_, e) => {
    seen.argv.push(e.argv)
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('turn.complete', () => ({ text: '' }))
  return seen
}

test('後ろのタブに入ったペインはトーストで知らせる', async ($, on) => {
  const seen = engine(on, false)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ ...TURN, answer: '正本は `/Users/x/Documents/app` です。' })
  expect(seen.toasts).toEqual(['ファイル 1 件 — /files で表示'])
})

test('見えているペインにはトーストを出さない', async ($, on) => {
  const seen = engine(on, true)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ ...TURN, answer: '正本は `/Users/x/Documents/app` です。' })
  expect(seen.toasts).toEqual([])
})

test('フォルダの行は open -R でなくそのフォルダを開く', async ($, on) => {
  const seen = engine(on, true)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ ...TURN, answer: '正本は `/Users/x/Documents/app` です。' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await $.ui.press({ plugin: 'finder-pane', key: 'row0' })
  expect(seen.argv).toEqual([['open', '/Users/x/Documents/app']])
  await ui.unmount()
})
