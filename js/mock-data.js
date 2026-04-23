/* =====================================================================
 * Mock Data (로컬 미리보기용)
 * 브라우저 LocalStorage 에 저장되어 새로고침 후에도 유지됩니다.
 * "초기화" 버튼을 누르면 이 파일의 기본값으로 복원됩니다.
 * ---------------------------------------------------------------------
 * v3: 대상자(target) 관리를 "교육 단위"에서 "차수(session) 단위"로 이관.
 *     - session.target_profiles: [{email, name, company, dept}]
 *     - 교육별 요약/리마인더는 모든 차수의 union 으로 계산.
 * ===================================================================== */

const DEFAULT_DATA = {
  users: [
    // role: member | admin
    { id: 'u1', name: '황지현', email: 'gloria8956@sk.com', company: 'SK디스커버리', dept: '기업문화실', role: 'admin' },
    { id: 'u2', name: '김시은', email: 'sekim0424@sk.com',  company: 'SK디스커버리', dept: '기업문화실', role: 'admin' }
  ],

  companies: [
    'SK디스커버리', 'SK케미칼(GC)', 'SK케미칼(Pharma)',
    'SK가스', 'SK바이오사이언스', 'SK플라즈마'
  ],

  trainings: [
    {
      id: 't1',
      title: 'Problem Solving 일반 과정',
      detail_title: 'Problem Solving 일반 과정',
      category: '리더십',
      tag_color: 'blue',
      target_label: '전 팀장',       // 상세 페이지 표시용
      target_short: '전 팀장',       // 카드 표시용
      duration_label: '1 or 2 days',
      short_desc: '팀장/리더를 위한 집중 리더십 과정',
      description: 'McKinsey 7-Step 기반의 구조적 문제해결 방법론을 학습합니다. 실제 업무 이슈를 사례로 가설 수립, 데이터 분석, 솔루션 도출, 커뮤니케이션까지 리더에게 필요한 핵심 사고 기술을 체화합니다.',
      hours: 16
    },
    {
      id: 't2',
      title: '따프 리더십 워크샵',
      detail_title: '따프 리더십 워크샵',
      category: '리더십',
      tag_color: 'blue',
      target_label: '신임 팀장',
      target_short: '신임 팀장',
      duration_label: 'Half day',
      short_desc: 'SKMS · 따프 가치 내재화를 통한 리더십 육성',
      description: 'SKMS의 핵심 가치와 따뜻한 프로페셔널을 일하는 방식에 녹여내는 반나절 집중 과정입니다.',
      hours: 4
    }
  ],

  // ⚠️ 각 차수마다 target_profiles 를 갖습니다. (차수별로 대상자 관리)
  sessions: [
    // Problem Solving 일반 과정 (6차수, 정원 30)
    { id: 's1', training_id: 't1', round_no: 1, start_at: '2026-05-21T09:00', end_at: '2026-05-22T18:00', region: '판교', location: 'ECO Hub',         capacity: 30, date_label: '2026.05.21(목), 22(금)', target_profiles: [] },
    { id: 's2', training_id: 't1', round_no: 2, start_at: '2026-06-22T09:00', end_at: '2026-06-23T18:00', region: '판교', location: 'ECO Hub',         capacity: 30, date_label: '2026.06.22(월), 23(화)', target_profiles: [] },
    { id: 's3', training_id: 't1', round_no: 3, start_at: '2026-06-25T09:00', end_at: '2026-06-25T18:00', region: '송도', location: '글로벌 R&PD 센터',    capacity: 30, target_profiles: [] },
    { id: 's4', training_id: 't1', round_no: 4, start_at: '2026-07-02T09:00', end_at: '2026-07-02T18:00', region: '안동', location: 'L House',             capacity: 30, target_profiles: [] },
    { id: 's5', training_id: 't1', round_no: 5, start_at: '2026-07-03T09:00', end_at: '2026-07-03T18:00', region: '울산', location: 'SK케미칼 - 울산 공장', capacity: 30, target_profiles: [] },
    { id: 's6', training_id: 't1', round_no: 6, start_at: '2026-07-22T09:00', end_at: '2026-07-23T18:00', region: '판교', location: 'ECO Hub',         capacity: 30, date_label: '2026.07.22(수), 23(목)', target_profiles: [] },

    // 따프 리더십 워크샵 (2차수, 정원 25)
    { id: 's7', training_id: 't2', round_no: 1, start_at: '2026-05-26T10:00', end_at: '2026-05-26T16:00', region: '서울', location: '워커힐 2층 WAVEHILL', capacity: 25, target_profiles: [] },
    { id: 's8', training_id: 't2', round_no: 2, start_at: '2026-06-10T10:00', end_at: '2026-06-10T16:00', region: '서울', location: '워커힐 2층 WAVEHILL', capacity: 25, target_profiles: [] }
  ],

  applications: [],

  attendances: []
};

const DEFAULT_COMPANIES = [
  'SK디스커버리', 'SK케미칼(GC)', 'SK케미칼(Pharma)',
  'SK가스', 'SK바이오사이언스', 'SK플라즈마'
];

// ⚠️ 스키마/기본 데이터가 바뀌면 반드시 이 버전을 올려주세요 (이전 LocalStorage 캐시 자동 무효화).
const STORAGE_KEY = 'dy_mock_v4';
const LEGACY_KEYS = ['dy_mock_v3']; // 이전 버전에서 사용자가 쌓아둔 데이터 복구 대상

/**
 * 이전 버전(LEGACY_KEYS)에 남아있는 사용자 데이터(유저·신청·대상자)를
 * 현재 버전으로 한 번 복구해 넣는다. 교육/차수 기본 정보(제목·장소 등)는
 * 건드리지 않고 최신값을 유지한다.
 */
function migrateLegacyMock () {
  try {
    for (const key of LEGACY_KEYS) {
      const oldRaw = localStorage.getItem(key);
      if (!oldRaw) continue;
      const old = JSON.parse(oldRaw);

      const currentRaw = localStorage.getItem(STORAGE_KEY);
      const current = currentRaw
        ? JSON.parse(currentRaw)
        : JSON.parse(JSON.stringify(DEFAULT_DATA));

      // 1) users: 현재에 없는 이메일만 추가
      if (Array.isArray(old.users)) {
        const byEmail = new Map();
        (current.users || []).forEach(u => { if (u && u.email) byEmail.set(u.email, u); });
        old.users.forEach(u => { if (u && u.email && !byEmail.has(u.email)) byEmail.set(u.email, u); });
        current.users = Array.from(byEmail.values());
      }

      // 2) 차수 대상자(target_profiles): 현재 비어있는 차수만 v3 값으로 복원
      if (Array.isArray(old.sessions)) {
        const oldById = new Map(old.sessions.map(s => [s.id, s]));
        current.sessions = (current.sessions || []).map(s => {
          if (Array.isArray(s.target_profiles) && s.target_profiles.length) return s;
          const prev = oldById.get(s.id);
          if (prev && Array.isArray(prev.target_profiles) && prev.target_profiles.length) {
            return { ...s, target_profiles: prev.target_profiles };
          }
          return s;
        });
      }

      // 3) applications: id 기준 중복 제거 후 병합
      if (Array.isArray(old.applications)) {
        const seen = new Set((current.applications || []).map(a => a.id));
        const extras = old.applications.filter(a => a && a.id && !seen.has(a.id));
        current.applications = [...(current.applications || []), ...extras];
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      localStorage.removeItem(key); // 한 번만 복구
      console.info(`[dy-mock] ${key} → ${STORAGE_KEY} 복구 완료 (유저/신청/대상자).`);
    }
  } catch (e) {
    console.warn('[dy-mock] legacy 복구 실패:', e);
  }
}

function loadMock () {
  migrateLegacyMock();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.attendances)) parsed.attendances = [];
      return parsed;
    }
  } catch (e) { /* fall through */ }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

window.MOCK = {
  ...loadMock(),
  companies: DEFAULT_COMPANIES,
  save () {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      users: this.users, trainings: this.trainings,
      sessions: this.sessions, applications: this.applications,
      attendances: this.attendances || []
    }));
  },
  reset () {
    const d = JSON.parse(JSON.stringify(DEFAULT_DATA));
    this.users = d.users; this.trainings = d.trainings;
    this.sessions = d.sessions; this.applications = d.applications;
    this.attendances = d.attendances || [];
    this.save();
  },
  countByStatus (sessionId, status) {
    return this.applications.filter(a =>
      a.session_id === sessionId && a.status === status).length;
  },
  hydrate (app) {
    const u = this.users.find(x => x.id === app.user_id) || {};
    const t = this.trainings.find(x => x.id === app.training_id) || {};
    const s = this.sessions.find(x => x.id === app.session_id) || {};
    return {
      user_name: u.name, user_email: u.email, user_dept: u.dept,
      user_company: u.company,
      training_title: t.title, training_category: t.category,
      round_no: s.round_no, start_at: s.start_at, end_at: s.end_at,
      region: s.region, location: s.location, date_label: s.date_label
    };
  },
  addUser ({ name, email, company, dept }) {
    const exists = this.users.find(u => u.email === email);
    if (exists) throw new Error('이미 가입된 이메일입니다.');
    const user = {
      id: 'u_' + Date.now(),
      name, email, company, dept, role: 'member'
    };
    this.users.push(user);
    this.save();
    return user;
  },

  /* ---------- 차수별 대상자 관리 ---------- */
  setSessionTargetsDetailed (sessionId, rows) {
    const s = this.sessions.find(x => x.id === sessionId);
    if (!s) throw new Error('차수를 찾을 수 없습니다.');
    const seen = new Set();
    const cleaned = [];
    (rows || []).forEach(r => {
      const email = String((r && r.email) || '').trim().toLowerCase();
      if (!email || seen.has(email)) return;
      seen.add(email);
      cleaned.push({
        email,
        name:    String((r.name    || '')).trim(),
        company: String((r.company || '')).trim(),
        dept:    String((r.dept    || '')).trim()
      });
    });
    s.target_profiles = cleaned;
    // 대상자들을 자동으로 회원가입 처리 (이미 가입된 이메일은 기존 정보 유지)
    this.autoRegisterUsers(cleaned);
    this.save();
    return cleaned;
  },

  /** 대상자 목록을 users 테이블에 자동 등록. 이미 존재하는 이메일은 비워진 필드만 채움. */
  autoRegisterUsers (rows) {
    let added = 0;
    (rows || []).forEach(r => {
      const email = String((r && r.email) || '').trim().toLowerCase();
      if (!email) return;
      const existing = this.users.find(u => String(u.email).trim().toLowerCase() === email);
      if (existing) {
        // 기존 사용자의 빈 프로필 필드만 채워줍니다.
        if (!existing.name    && r.name)    existing.name    = r.name;
        if (!existing.company && r.company) existing.company = r.company;
        if (!existing.dept    && r.dept)    existing.dept    = r.dept;
        return;
      }
      this.users.push({
        id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name:    r.name    || email.split('@')[0],
        email:   email,
        company: r.company || '',
        dept:    r.dept    || '',
        role:    'member',
        auto_registered: true
      });
      added++;
    });
    return added;
  },

  setSessionTargetEmails (sessionId, emails) {
    // 엑셀 업로드 등 email만 들어오는 경로. 기존 profile 은 최대한 유지.
    const s = this.sessions.find(x => x.id === sessionId);
    if (!s) throw new Error('차수를 찾을 수 없습니다.');
    const existing = Array.isArray(s.target_profiles) ? s.target_profiles : [];
    const byEmail = {};
    existing.forEach(p => { if (p && p.email) byEmail[String(p.email).toLowerCase()] = p; });

    const cleanEmails = Array.from(new Set(
      (emails || []).map(e => String(e).trim().toLowerCase()).filter(Boolean)
    ));
    s.target_profiles = cleanEmails.map(e => byEmail[e] || { email: e, name: '', company: '', dept: '' });
    // 대상자들을 자동으로 회원가입 처리
    this.autoRegisterUsers(s.target_profiles);
    this.save();
    return s.target_profiles;
  }
};
