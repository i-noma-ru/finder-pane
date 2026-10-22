import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { FinderRow } from '../types'
import { baseName, extractCandidates, resolveAbs } from './logic'

const PANE_ID = 'finder-pane'
const PANE_TITLE = 'ファイル'
const rows = atom({ plugin: 'finder-pane', key: 'rows' } as const, [])
const cwdAtom = atom({ plugin: 'finder-pane', key: 'cwd' } as const, '')

// $ を受け取る関数はモジュール直下に置く（フックの中で作った関数へ渡すと validate が落とす）

async function openPane($: EngineInterface): Promise<boolean> {
  try {
    const opened = await $.ui.open({ id: PANE_ID, title: PANE_TITLE })
    return opened.isPlaced
  } catch {
    // 画面の無い実行（claude -p）では開けない
    return false
  }
}

/** 返答の本文から実在するパスだけを集めて行にする */
async function collect($: EngineInterface, answer: string): Promise<FinderRow[]> {
  const cwd = await read($, cwdAtom)
  const home = (await $.env.get('HOME')) ?? ''
  const found: FinderRow[] = []
  for (const shown of extractCandidates(answer)) {
    const abs = resolveAbs(shown, cwd, home)
    try {
      if (!(await $.fs.exists(abs))) continue
      const stat = await $.fs.stat(abs)
      found.push({ abs, shown, isDir: stat.kind === 'dir' })
    } catch {
      // 読めない場所は載せない
    }
  }
  return found
}

/** Finder で見せる: ファイルは選択状態で親フォルダを、フォルダはそのフォルダを開く */
async function reveal($: EngineInterface, row: FinderRow): Promise<void> {
  const argv = row.isDir ? ['open', row.abs] : ['open', '-R', row.abs]
  try {
    const ran = await $.process.run(argv, { timeoutMs: 10000 })
    if (ran.exitCode !== 0) $.ui.toast(`Finder で開けません: ${baseName(row.abs)}`)
  } catch {
    $.ui.toast(`Finder で開けません: ${baseName(row.abs)}`)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await update($, cwdAtom, () => e.cwd)
    try {
      await $.command.register({
        name: 'files',
        description: 'ファイルペインを開く／閉じる（返答に出たパスを Finder で開く）',
      })
    } catch {
      // 登録できなくても、セッションの開始は止めない
    }
    return next(e)
  })

  on('command.run', { command: 'files' }, async $ => {
    const isUp = (await $.ui.panes()).some(pane => pane.id === PANE_ID)
    if (isUp) {
      await $.ui.close({ id: PANE_ID })
      return { text: 'ファイルペインを閉じました。' }
    }
    const placed = await openPane($)
    return {
      text: placed
        ? 'ファイルペインを開きました。'
        : 'ファイルペインは開きましたが、この画面には置けません（ターミナルが狭い、または画面が無い）。',
    }
  })

  // 主ループの返答だけ（サブエージェントの報告は拾わない）
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined || e.isAborted || e.answer === '') return done
    const found = await collect($, e.answer)
    if (found.length === 0) return done
    await update($, rows, () => found)
    const isUp = (await $.ui.panes()).some(pane => pane.id === PANE_ID)
    if (!isUp) await openPane($)
    else $.ui.invalidate('ui.render')
    // 頼まれずに開いたペインは他の MOD のペインの後ろのタブに入ることがあり、前に出す API は無い
    const pane = (await $.ui.panes()).find(p => p.id === PANE_ID)
    if (pane !== undefined && (!pane.isShown || !pane.isPlaced)) {
      $.ui.toast(`ファイル ${found.length} 件 — /files で表示`)
    }
    return done
  })

  // matcher はリテラルで書く（定数だと validate が requestId=? と読む）
  on('ui.render', { component: 'Pane', requestId: 'finder-pane' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, rows)
    const width = Math.max(20, (e.viewport?.columns ?? 40) - 6)

    return (
      <Box flexDirection="column">
        {list.length === 0 && <Text dimColor>返答にパスが出ると、ここに並びます。</Text>}
        {list.map((row, index) => {
          const label = row.shown.length > width ? `…${row.shown.slice(-(width - 1))}` : row.shown
          return (
            <Button
              key={`row${index}`}
              hotkey={String(index + 1)}
              plain
              onPress={() => {
                void reveal($, row)
              }}
            >
              {label}
              {row.isDir ? <Text dimColor>/</Text> : null}
            </Button>
          )
        })}
        {list.length > 0 && <Text dimColor>数字キーかクリックで Finder に表示</Text>}
      </Box>
    )
  })
}
