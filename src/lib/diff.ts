import { diffLines } from 'diff';

export interface DiffStats {
  added: number;
  removed: number;
  /** AI に渡す「変更箇所だけ」の抜粋 */
  excerpt: string;
}

const EXCERPT_LIMIT = 6000;

/**
 * 旧 PHP 版は「変更前・変更後の先頭1000文字」を丸ごと AI に渡していたため、
 * ページ後半の変更は AI に見えていませんでした。
 * ここでは行単位の差分を取り、変更行（＋前後1行の文脈）だけを抜粋します。
 */
export function computeDiff(before: string, after: string): DiffStats {
  const parts = diffLines(before, after);
  let added = 0;
  let removed = 0;
  const out: string[] = [];

  parts.forEach((p, i) => {
    const lines = p.value.replace(/\n$/, '').split('\n');
    if (p.added) {
      added += p.value.replace(/\n/g, '').length;
      out.push(...lines.map((l) => `+ ${l}`));
    } else if (p.removed) {
      removed += p.value.replace(/\n/g, '').length;
      out.push(...lines.map((l) => `- ${l}`));
    } else {
      const prevChanged = i > 0;
      const nextChanged = i < parts.length - 1;
      if (lines.length <= 2) {
        if (prevChanged || nextChanged) out.push(...lines.map((l) => `  ${l}`));
      } else {
        if (prevChanged) out.push(`  ${lines[0]}`);
        if (prevChanged && nextChanged) out.push('  …');
        if (nextChanged) out.push(`  ${lines[lines.length - 1]}`);
      }
    }
  });

  let excerpt = out.join('\n');
  if (excerpt.length > EXCERPT_LIMIT) excerpt = excerpt.slice(0, EXCERPT_LIMIT) + '\n（以下省略）';
  return { added, removed, excerpt };
}

/** 空白や記号だけの変化か（AI を呼ぶ価値がない差分） */
export function isTrivialChange(before: string, after: string): boolean {
  const strip = (s: string) => s.replace(/[\s\p{P}\p{S}]/gu, '');
  return strip(before) === strip(after);
}

