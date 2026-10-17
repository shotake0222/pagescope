// data-confirm 属性付きフォームの送信前確認
document.querySelectorAll('form[data-confirm]').forEach(function (f) {
  f.addEventListener('submit', function (e) {
    if (!confirm(f.getAttribute('data-confirm'))) e.preventDefault();
  });
});
