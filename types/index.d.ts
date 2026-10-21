/** ペインの 1 行＝返答に出た実在するパス */
export type FinderRow = {
  /** 絶対パス（open -R に渡す） */
  abs: string
  /** 返答に書かれていた形（表示用） */
  shown: string
  /** フォルダなら open、ファイルなら open -R */
  isDir: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'finder-pane': { rows: FinderRow[]; cwd: string }
  }
}
