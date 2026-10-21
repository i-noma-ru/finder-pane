// 返答の本文からローカルのパス候補を拾う（純粋関数・テストしやすいよう $ を持たない）

/** パスらしい語: 絶対パス、~/、または「a/b.ext」「a/b/」の形。全角文字を含む名前も拾う */
const CANDIDATE = /(?:^|[\s（(「`'"=＝:：])((?:~\/|\/)?(?:[^\s`'"()（）「」<>|*?:：,、。]+\/)+[^\s`'"()（）「」<>|*?:：,、。]*|\/[^\s`'"()（）「」<>|*?:：,、。]+)/g

/** 末尾の句読点・閉じ括弧・読点を落とす */
function trimTail(raw: string): string {
  return raw.replace(/[.,、。)）」』]+$/u, '')
}

/** 候補を抜き出し、重複を除いて順に返す（最大 limit 件） */
export function extractCandidates(text: string, limit = 9): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  // URL と、* を含む語（glob）は丸ごと外してから探す（途中で切れた断片を拾わないため）
  // 日本語の文は空白で切れないので、句読点・括弧・バッククォートも語の切れ目として扱う
  const W = '[^\\s、。「」（）()`\'"]'
  const cleaned = text
    .replace(new RegExp(`[a-z]+:\\/\\/${W}+`, 'g'), ' ')
    .replace(new RegExp(`${W}*\\*${W}*`, 'g'), ' ')
  for (const m of cleaned.matchAll(CANDIDATE)) {
    const raw = trimTail(m[1] ?? '')
    if (raw.length < 3) continue
    if (raw.startsWith('http') || raw.includes('://')) continue
    if (raw.includes('*')) continue
    if (raw.endsWith('/') && raw.split('/').length <= 2 && !raw.startsWith('/')) continue
    if (seen.has(raw)) continue
    seen.add(raw)
    out.push(raw)
    if (out.length >= limit) break
  }
  return out
}

/** cwd を基準に絶対パスへ。~ はホームへ */
export function resolveAbs(raw: string, cwd: string, home: string): string {
  if (raw.startsWith('/')) return raw
  if (raw.startsWith('~/')) return `${home}/${raw.slice(2)}`
  return `${cwd.replace(/\/$/, '')}/${raw.replace(/^\.\//, '')}`
}

/** 末尾の名前だけ（ペインが狭いときの表示用） */
export function baseName(p: string): string {
  const parts = p.replace(/\/$/, '').split('/')
  return parts[parts.length - 1] ?? p
}
