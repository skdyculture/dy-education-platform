/* =====================================================================
 * 공용 UI 유틸 / 헤더 렌더 / 포매터
 * ===================================================================== */

/* ---------- Formatters ---------- */
window.fmt = {
  date (iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const w = ['일','월','화','수','목','금','토'][d.getDay()];
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} (${w})`;
  },
  time (iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },
  dateRange (start, end) {
    if (!start) return '';
    const s = new Date(start), e = new Date(end);
    const sameDay = s.toDateString() === e.toDateString();
    return sameDay
      ? `${this.date(start)} · ${this.time(start)}~${this.time(end)}`
      : `${this.date(start)} ~ ${this.date(end)}`;
  },
  dateOnly (iso) { return this.date(iso); }
};

/* ---------- Header ---------- */
window.renderHeader = function (active) {
  const host = document.getElementById('app-header');
  if (!host) return;
  const user = JSON.parse(localStorage.getItem('dy_current_user') || 'null');
  const initial = user ? user.name.slice(0,1) : '?';
  host.innerHTML = `
    <header class="header">
      <div class="container header-inner">
        <a href="index.html" class="logo">
          <span class="logo-badge">DY</span>
          <span>교육 신청</span>
        </a>
        <nav class="nav">
          <a href="index.html" class="${active==='home'?'active':''}">교육 목록</a>
          <a href="my-applications.html" class="${active==='mine'?'active':''}">내 신청</a>
          ${user && user.role === 'admin'
            ? `<a href="admin.html" class="${active==='admin'?'active':''}">관리자</a>` : ''}
        </nav>
        <div class="flex gap-8" style="align-items:center;">
          ${user ? `
            <span class="user-chip">
              <span class="avatar">${initial}</span>
              ${user.name}
            </span>
            <button class="btn btn-secondary btn-sm" id="btn-signout">로그아웃</button>
          ` : `
            <a class="btn btn-secondary btn-sm" href="signup.html">회원가입</a>
            <a class="btn btn-primary btn-sm" href="login.html">로그인</a>
          `}
        </div>
      </div>
    </header>
  `;
  const so = document.getElementById('btn-signout');
  if (so) so.onclick = async () => {
    await DAL.signOut();
    location.href = 'login.html';
  };
};

/* ---------- Require Login (member / admin 구분) ---------- */
window.requireLogin = async function (mode = 'any') {
  const user = await DAL.getCurrentUser();
  if (!user) {
    location.href = 'login.html';
    return null;
  }
  if (mode === 'admin' && user.role !== 'admin') {
    showToast('관리자만 접근할 수 있는 페이지예요.');
    setTimeout(() => location.href = 'index.html', 900);
    return null;
  }
  return user;
};

/* ---------- Toast ---------- */
window.showToast = function (msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2000);
};

/* ---------- Modal ---------- */
window.openModal = function ({ title, body, confirmText = '확인', cancelText = '취소', onConfirm, danger = false }) {
  let wrap = document.getElementById('global-modal');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'global-modal';
    wrap.className = 'modal-backdrop';
    document.body.appendChild(wrap);
  }
  wrap.innerHTML = `
    <div class="modal">
      <h3>${title}</h3>
      <div class="mt-8">${body || ''}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="m-cancel">${cancelText}</button>
        <button class="btn ${danger ? 'btn-danger-outline' : 'btn-primary'}" id="m-ok">${confirmText}</button>
      </div>
    </div>
  `;
  wrap.classList.add('show');
  wrap.querySelector('#m-cancel').onclick = () => wrap.classList.remove('show');
  wrap.querySelector('#m-ok').onclick = async () => {
    try { if (onConfirm) await onConfirm(); } finally { wrap.classList.remove('show'); }
  };
  wrap.onclick = (e) => { if (e.target === wrap) wrap.classList.remove('show'); };
};

/* ---------- Capacity util ---------- */
window.capacityInfo = function (registered, capacity) {
  const remain = Math.max(0, capacity - registered);
  const rate = capacity ? registered / capacity : 0;
  let level = 'ok';
  if (remain === 0) level = 'full';
  else if (rate >= 0.8) level = 'warn';
  return { remain, rate, level };
};
