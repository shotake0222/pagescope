// PageScope dashboard — 即時パトロール / コピー / トースト
(function () {
  'use strict';

  const data = JSON.parse(document.getElementById('dashboard-data')?.textContent || '{"targets":[]}');

  const ICONS = {
    success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>',
    warning: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>',
    error: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01"></path>',
  };
  const TONE = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  let toastTimer;

  function showToast(title, desc, type) {
    type = type || 'success';
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-desc').textContent = desc || '';
    icon.className = 'w-7 h-7 rounded-full flex items-center justify-center border shrink-0 ' + TONE[type];
    icon.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">' + ICONS[type] + '</svg>';
    toast.classList.remove('translate-y-full', 'opacity-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('translate-y-full', 'opacity-0'), 5000);
  }

  // フィルタのセレクトを変えたら送信
  document.querySelectorAll('[data-autosubmit]').forEach((el) => {
    el.addEventListener('change', () => el.form && el.form.submit());
  });

  // 削除確認
  document.querySelectorAll('form[data-confirm]').forEach((f) => {
    f.addEventListener('submit', (e) => {
      if (!confirm(f.getAttribute('data-confirm'))) e.preventDefault();
    });
  });

  // 共有URLのコピー
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy');
      try {
        await navigator.clipboard.writeText(text);
        showToast('クリップボードにコピーしました', 'そのまま共有チャットなどにペースト可能です。', 'success');
      } catch {
        prompt('URLをコピーしてください', text);
      }
    });
  });

  async function patrolOne(id) {
    const res = await fetch('/api/patrol/' + id, { method: 'POST', headers: { Accept: 'application/json' } });
    if (res.status === 401) {
      location.href = '/login';
      throw new Error('ログインが必要です');
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  const btn = document.getElementById('patrol-btn');
  const icon = document.getElementById('patrol-icon');
  const text = document.getElementById('patrol-text');
  const ORIGINAL = text ? text.textContent : '';

  function setBusy(busy, label) {
    if (!btn) return;
    btn.disabled = busy;
    icon.classList.toggle('animate-spin', busy);
    if (label) text.textContent = label;
    else text.textContent = ORIGINAL;
  }

  async function run(ids) {
    const results = [];
    for (let i = 0; i < ids.length; i++) {
      setBusy(true, 'AIがパトロール中... (' + (i + 1) + '/' + ids.length + ')');
      try {
        results.push(await patrolOne(ids[i]));
      } catch (e) {
        results.push({ status: 'error', message: e.message });
      }
    }
    const changed = results.filter((r) => r.status === 'changed' || r.status === 'baseline').length;
    const errors = results.filter((r) => r.status === 'error');
    const skipped = results.filter((r) => r.status === 'skipped').length;

    if (errors.length) {
      showToast('一部のLPで取得エラーが発生しました', errors.map((r) => (r.name ? r.name + '：' : '') + r.message).join(' / '), 'error');
    } else if (changed) {
      showToast('パトロール完了', changed + '件のレポートを作成しました。画面を更新します。', 'success');
    } else if (skipped === results.length) {
      showToast('しばらくお待ちください', results[0] ? results[0].message : '', 'warning');
    } else {
      showToast('パトロール完了', '変更はありませんでした。', 'success');
    }
    setBusy(true, '完了！');
    setTimeout(() => location.reload(), changed || errors.length ? 1800 : 1200);
  }

  if (btn) {
    btn.addEventListener('click', () => {
      if (!data.targets.length) return;
      run(data.targets.map((t) => t.id));
    });
  }
  document.querySelectorAll('[data-patrol-one]').forEach((b) => {
    b.addEventListener('click', () => {
      b.disabled = true;
      b.querySelector('svg').classList.add('animate-spin');
      run([Number(b.getAttribute('data-patrol-one'))]);
    });
  });
})();
