import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

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
const RUN = { origin: { kind: 'composer' }, presentation: { layout: 'main', columns: 160, isFullscreen: false } } as const

type Calls = { toasts: string[]; argv: (readonly string[])[]; ui: string[] }
type Options = { isShown?: boolean; isUp?: boolean; plist?: boolean }

// テストの下にエンジンは無いので、Mod が呼ぶ $ の相手をここで用意する。
// 実在するのはフォルダ（plist が true ならその中の Contents/Info.plist も）だけ
function engineBeneath(on: On, options: Options = {}): Calls {
  const calls: Calls = { toasts: [], argv: [], ui: [] }
  const isShown = options.isShown ?? true
  const isUp = options.isUp ?? true
  on('command.register', () => ({ value: { command: 'files' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('env.get', () => ({ value: '/Users/x' }))
  on('fs.exists', (_, e) => ({ value: !e.path.endsWith('/Contents/Info.plist') || options.plist === true }))
  on('fs.stat', () => ({ value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: false } }))
  on('ui.open', () => {
    calls.ui.push('open')
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => {
    calls.ui.push('close')
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: isUp ? [{ id: 'finder-pane', title: 'ファイル', isShown, isFocused: false, isPlaced: true }] : [],
  }))
  on('ui.toast', (_, e) => {
    calls.toasts.push(e.text)
    return { value: undefined }
  })
  on('process.run', (_, e) => {
    calls.argv.push(e.argv)
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('turn.complete', () => ({ text: '' }))
  return calls
}

async function pressFirstRow($: Engine, answer: string): Promise<void> {
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ ...TURN, answer })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await $.ui.press({ plugin: 'finder-pane', key: 'row0' })
  await ui.unmount()
}

test('後ろのタブに入ったペインはトーストで知らせる', async ($, on) => {
  const calls = engineBeneath(on, { isShown: false })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ ...TURN, answer: '正本は `/Users/x/Documents/app` です。' })
  expect(calls.toasts).toEqual(['ファイル 1 件 — /files で表示'])
})

test('見えているペインにはトーストを出さない', async ($, on) => {
  const calls = engineBeneath(on)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ ...TURN, answer: '正本は `/Users/x/Documents/app` です。' })
  expect(calls.toasts).toEqual([])
})

test('/files は後ろのタブのペインを閉じずに前へ出す', async ($, on) => {
  const calls = engineBeneath(on, { isShown: false })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const ran = await $.command.run({ ...RUN, command: 'files', args: '' })
  expect(calls.ui).toEqual(['close', 'open'])
  expect(ran.text).toBe('ファイルペインを開きました。')
})

test('/files は見えているペインを閉じる', async ($, on) => {
  const calls = engineBeneath(on)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const ran = await $.command.run({ ...RUN, command: 'files', args: '' })
  expect(calls.ui).toEqual(['close'])
  expect(ran.text).toBe('ファイルペインを閉じました。')
})

test('/files は開いていないペインを開く', async ($, on) => {
  const calls = engineBeneath(on, { isUp: false })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.command.run({ ...RUN, command: 'files', args: '' })
  expect(calls.ui).toEqual(['open'])
})

test('フォルダの行は open -R でなくそのフォルダを開く', async ($, on) => {
  const calls = engineBeneath(on)
  await pressFirstRow($, '正本は `/Users/x/Documents/app` です。')
  expect(calls.argv).toEqual([['open', '/Users/x/Documents/app']])
})

test('.app などのバンドルは起動させず open -R で見せる', async ($, on) => {
  const calls = engineBeneath(on)
  await pressFirstRow($, '入れ先は `/Applications/Foo.app` です。')
  expect(calls.argv).toEqual([['open', '-R', '/Applications/Foo.app']])
})

test('拡張子が無くても Contents/Info.plist を持つバンドルは open -R', async ($, on) => {
  const calls = engineBeneath(on, { plist: true })
  await pressFirstRow($, '置き場は `/Users/x/Tools/Odd` です。')
  expect(calls.argv).toEqual([['open', '-R', '/Users/x/Tools/Odd']])
})
