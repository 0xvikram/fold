// Local stand-in for '@devvit/web/client', used only by `npm run preview`.
export const context = { username: 'you', postId: 't3_preview' };

export function showToast(text: string | { text: string }) {
  const msg = typeof text === 'string' ? text : text.text;
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#262536;color:#fff;padding:10px 16px;border-radius:999px;font:600 14px system-ui;z-index:99';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

export function requestExpandedMode() {
  location.href = '/game.html';
}
