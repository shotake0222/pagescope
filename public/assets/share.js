// PageScope share report — 行単位＋文字単位の差分ハイライト、スクロール同期、PDF化
(function () {
  'use strict';

  document.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => window.print()));

  const dataEl = document.getElementById('diff-data');
  if (!dataEl) return;
  const { old: oldText, new: newText } = JSON.parse(dataEl.textContent);
  const left = document.getElementById('diff-left');
  const right = document.getElementById('diff-right');

  const CLS = {
    del: 'diff-del bg-red-500/20 text-red-400 line-through decoration-red-500/60 rounded px-0.5',
    add: 'diff-add bg-emerald-500/20 text-emerald-300 font-bold rounded px-0.5 border-b border-emerald-500/50',
    sameL: 'text-slate-500 opacity-60',
    sameR: 'text-slate-400',
  };

  function span(text, cls) {
    const s = document.createElement('span');
    s.textContent = text;
    if (cls) s.className = cls;
    return s;
  }

  function block(isSame) {
    const d = document.createElement('div');
    if (isSame) d.className = 'diff-same';
    return d;
  }

  /**
   * 文字単位の差分は「9,800円 → 10,500円」が「9|8 → 10|5」のように細切れになるため、
   * 変更に挟まれた短い一致部分（2文字以下）を変更側に取り込み、連続する変更をまとめる。
   */
  function readable(parts) {
    const isChange = (q) => q && (q.added || q.removed);
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      const q = parts[i];
      if (!isChange(q) && q.value.length <= 2 && !q.value.includes('\n') && isChange(out[out.length - 1]) && isChange(parts[i + 1])) {
        out.push({ removed: true, value: q.value }, { added: true, value: q.value });
      } else {
        out.push(q);
      }
    }
    // 連続する変更を「削除1つ＋追加1つ」にまとめる
    const merged = [];
    let del = '';
    let add = '';
    const flush = () => {
      if (del) merged.push({ removed: true, value: del });
      if (add) merged.push({ added: true, value: add });
      del = add = '';
    };
    out.forEach((q) => {
      if (q.removed) del += q.value;
      else if (q.added) add += q.value;
      else {
        flush();
        merged.push(q);
      }
    });
    flush();
    return merged;
  }

  function render() {
    if (typeof Diff === 'undefined') {
      left.textContent = oldText;
      right.textContent = newText;
      return;
    }
    const fragL = document.createDocumentFragment();
    const fragR = document.createDocumentFragment();
    const parts = Diff.diffLines(oldText, newText);

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const next = parts[i + 1];

      // 「削除 → 追加」が並んでいる場合は、行の中の変わった文字だけを強調する
      if (p.removed && next && next.added) {
        const bl = block(false);
        const br = block(false);
        const inline = p.value.length + next.value.length < 20000 ? readable(Diff.diffChars(p.value, next.value)) : null;
        if (inline) {
          inline.forEach((q) => {
            if (q.added) br.appendChild(span(q.value, CLS.add));
            else if (q.removed) bl.appendChild(span(q.value, CLS.del));
            else {
              bl.appendChild(span(q.value, 'text-red-300/70'));
              br.appendChild(span(q.value, 'text-emerald-200/80'));
            }
          });
        } else {
          bl.appendChild(span(p.value, CLS.del));
          br.appendChild(span(next.value, CLS.add));
        }
        fragL.appendChild(bl);
        fragR.appendChild(br);
        i++;
        continue;
      }
      if (p.added) {
        const b = block(false);
        b.appendChild(span(p.value, CLS.add));
        fragR.appendChild(b);
      } else if (p.removed) {
        const b = block(false);
        b.appendChild(span(p.value, CLS.del));
        fragL.appendChild(b);
      } else {
        const bl = block(true);
        const br = block(true);
        bl.appendChild(span(p.value, CLS.sameL));
        br.appendChild(span(p.value, CLS.sameR));
        fragL.appendChild(bl);
        fragR.appendChild(br);
      }
    }
    left.replaceChildren(fragL);
    right.replaceChildren(fragR);
  }

  try {
    render();
  } catch (e) {
    left.innerHTML = '<span class="text-red-400">解析エラー</span>';
    right.innerHTML = '<span class="text-red-400">解析エラー</span>';
  }

  // 「変更箇所の周辺だけ表示」
  const toggle = document.getElementById('only-changes');
  if (toggle) {
    toggle.addEventListener('change', () => {
      document.querySelectorAll('.diff-same').forEach((el) => {
        if (!toggle.checked) {
          el.style.display = '';
          el.firstChild.textContent = el.dataset.full || el.firstChild.textContent;
          return;
        }
        const full = el.dataset.full || el.firstChild.textContent;
        el.dataset.full = full;
        const lines = full.replace(/\n$/, '').split('\n');
        if (lines.length > 4) {
          el.firstChild.textContent = lines.slice(0, 1).join('\n') + '\n  ⋯ ' + (lines.length - 2) + '行省略 ⋯\n' + lines.slice(-1).join('\n') + '\n';
        }
      });
    });
  }

  // 左右のスクロール同期
  const panes = document.querySelectorAll('.diff-scroll');
  if (panes.length === 2) {
    let lock = null;
    panes.forEach((pane, idx) => {
      const other = panes[1 - idx];
      pane.addEventListener('scroll', () => {
        if (lock && lock !== pane) return;
        lock = pane;
        const ratio = pane.scrollTop / Math.max(1, pane.scrollHeight - pane.clientHeight);
        other.scrollTop = ratio * (other.scrollHeight - other.clientHeight);
        requestAnimationFrame(() => (lock = null));
      });
    });
  }
})();
