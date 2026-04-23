/* =====================================================================
 * Supabase Client (배포 시 활성화)
 * ---------------------------------------------------------------------
 * 1. HTML <head>에 다음 스크립트 추가:
 *    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * 2. 아래 URL / ANON KEY 를 본인 Supabase 프로젝트 값으로 교체
 * 3. window.USE_SUPABASE = true 로 바꾸면 실제 DB와 통신
 *    false 면 js/mock-data.js 의 LocalStorage mock 데이터 사용
 * =====================================================================
 */
window.SUPABASE_URL = 'https://jcjejmjnmccpbtwxpgsa.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_G_GMSzX5P_nxykCdYE0uqg_U-6wYe7u';
window.USE_SUPABASE = true; // Supabase 실제 연동

(function initSupabase () {
  if (!window.USE_SUPABASE) return;
  if (typeof supabase === 'undefined') {
    console.warn('[supabase-client] @supabase/supabase-js 스크립트를 먼저 로드하세요.');
    return;
  }
  window.sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
})();

/* ---------------------------------------------------------------------
 * Data Access Layer (DAL)
 * UI 코드는 이 함수들만 호출합니다. 내부에서 mock/supabase 를 자동 분기.
 * --------------------------------------------------------------------- */
window.DAL = {
  /* ---------- Auth ---------- */
  async getCurrentUser () {
    if (window.USE_SUPABASE) {
      const { data } = await window.sb.auth.getUser();
      if (!data.user) return null;
      const { data: profile } = await window.sb
        .from('profiles').select('*').eq('id', data.user.id).single();
      return profile;
    }
    const raw = localStorage.getItem('dy_current_user');
    return raw ? JSON.parse(raw) : null;
  },
  async signInMock (email) {
    // 데모용 간편 로그인 (실제 배포에서는 Supabase Auth 사용)
    const list = MOCK.users;
    const user = list.find(u => u.email === email) || list[0];
    localStorage.setItem('dy_current_user', JSON.stringify(user));
    return user;
  },
  async signUp ({ name, email, company, dept }) {
    if (window.USE_SUPABASE) {
      const { data, error } = await window.sb.from('profiles')
        .insert({ name, email, company, dept, role: 'member' })
        .select().single();
      if (error) throw error;
      localStorage.setItem('dy_current_user', JSON.stringify(data));
      return data;
    }
    const user = MOCK.addUser({ name, email, company, dept });
    localStorage.setItem('dy_current_user', JSON.stringify(user));
    return user;
  },
  async signOut () {
    if (window.USE_SUPABASE) await window.sb.auth.signOut();
    localStorage.removeItem('dy_current_user');
  },

  /* ---------- Training ---------- */
  async listTrainings () {
    if (window.USE_SUPABASE) {
      const { data } = await window.sb.from('trainings').select('*').order('created_at');
      return data || [];
    }
    return MOCK.trainings;
  },
  async getTraining (id) {
    if (window.USE_SUPABASE) {
      const { data } = await window.sb.from('trainings').select('*').eq('id', id).single();
      return data;
    }
    return MOCK.trainings.find(t => t.id === id);
  },

  /* ---------- Sessions (차수) ---------- */
  async listSessions (trainingId) {
    if (window.USE_SUPABASE) {
      const { data } = await window.sb.from('training_sessions_with_count')
        .select('*').eq('training_id', trainingId).order('round_no');
      return data || [];
    }
    return MOCK.sessions
      .filter(s => s.training_id === trainingId)
      .map(s => ({ ...s, registered_count: MOCK.countByStatus(s.id, 'confirmed') }));
  },

  /* ---------- Applications ---------- */
  async listMyApplications (userId) {
    if (window.USE_SUPABASE) {
      const { data } = await window.sb
        .from('applications_detail')
        .select('*')
        .eq('user_id', userId)
        .order('applied_at', { ascending: false });
      return data || [];
    }
    return MOCK.applications
      .filter(a => a.user_id === userId)
      .map(a => ({ ...a, ...MOCK.hydrate(a) }));
  },

  async applyToSession (userId, sessionId) {
    if (window.USE_SUPABASE) {
      // FCFS는 DB 함수(apply_session)로 원자적으로 처리
      const { data, error } = await window.sb.rpc('apply_session',
        { p_user: userId, p_session: sessionId });
      if (error) throw error;
      return data;
    }
    const s = MOCK.sessions.find(x => x.id === sessionId);
    const count = MOCK.countByStatus(sessionId, 'confirmed');
    if (count >= s.capacity) throw new Error('정원이 마감되었습니다.');
    const exists = MOCK.applications.find(a =>
      a.user_id === userId && a.training_id === s.training_id && a.status !== 'cancelled');
    if (exists) throw new Error('해당 교육은 이미 신청하셨습니다. 변경은 \'내 신청\'에서 가능해요.');
    MOCK.applications.push({
      id: 'app_' + Date.now(),
      user_id: userId,
      training_id: s.training_id,
      session_id: sessionId,
      status: 'confirmed',
      applied_at: new Date().toISOString()
    });
    MOCK.save();
    return true;
  },

  async cancelApplication (applicationId) {
    if (window.USE_SUPABASE) {
      const { error } = await window.sb.rpc('cancel_application',
        { p_app: applicationId });
      if (error) throw error;
      return true;
    }
    const app = MOCK.applications.find(a => a.id === applicationId);
    if (app) app.status = 'cancelled';
    MOCK.save();
    return true;
  },

  async deleteApplication (applicationId) {
    if (window.USE_SUPABASE) {
      const { error } = await window.sb.from('applications')
        .delete().eq('id', applicationId);
      if (error) throw error;
      return true;
    }
    const before = MOCK.applications.length;
    MOCK.applications = MOCK.applications.filter(a => a.id !== applicationId);
    if (MOCK.applications.length === before) throw new Error('해당 신청 내역을 찾지 못했어요.');
    MOCK.save();
    return true;
  },

  async adminDeleteApplication (applicationId) {
    return this.deleteApplication(applicationId);
  },

  async changeSession (applicationId, newSessionId) {
    if (window.USE_SUPABASE) {
      const { error } = await window.sb.rpc('change_session',
        { p_app: applicationId, p_new_session: newSessionId });
      if (error) throw error;
      return true;
    }
    const app = MOCK.applications.find(a => a.id === applicationId);
    const newS = MOCK.sessions.find(s => s.id === newSessionId);
    const count = MOCK.countByStatus(newSessionId, 'confirmed');
    if (count >= newS.capacity) throw new Error('변경하려는 차수가 마감되었습니다.');
    app.session_id = newSessionId;
    app.status = 'confirmed';
    MOCK.save();
    return true;
  },

  /* ---------- Admin ---------- */
  async listAllUsers () {
    if (window.USE_SUPABASE) {
      const { data } = await window.sb.from('profiles').select('*').order('name');
      return data || [];
    }
    return MOCK.users;
  },

  async listAllApplications () {
    if (window.USE_SUPABASE) {
      const { data } = await window.sb.from('applications_detail').select('*')
        .order('applied_at', { ascending: false });
      return data || [];
    }
    return MOCK.applications.map(a => ({ ...a, ...MOCK.hydrate(a) }));
  },

  async trainingStats () {
    if (window.USE_SUPABASE) {
      const { data } = await window.sb.from('training_stats').select('*');
      return data || [];
    }
    return MOCK.trainings.map(t => {
      const sessions = MOCK.sessions.filter(s => s.training_id === t.id);
      const capacity = sessions.reduce((a, s) => a + s.capacity, 0);
      const registered = MOCK.applications.filter(a =>
        a.training_id === t.id && a.status !== 'cancelled').length;
      return { ...t, capacity_total: capacity, registered_total: registered,
               fill_rate: capacity ? registered / capacity : 0 };
    });
  },

  async adminChangeSession (applicationId, newSessionId) {
    return this.changeSession(applicationId, newSessionId);
  },
  async adminCancelApplication (applicationId) {
    return this.cancelApplication(applicationId);
  },

  /* =====================================================================
   * Target management — 차수(session) 단위
   * ---------------------------------------------------------------------
   * 데이터 저장 위치:
   *   - Mock: MOCK.sessions[i].target_profiles = [{email, name, company, dept}]
   *   - Supabase: session_targets 테이블 (session_id 기준)
   * 교육(training) 단위 조회는 모든 차수의 union 으로 계산합니다.
   * =================================================================== */

  /** 특정 차수의 "지정 대상자" 상세 반환 ([{email, name, company, dept}]) */
  async listSessionDesignated (sessionId) {
    if (window.USE_SUPABASE) {
      const { data } = await window.sb.from('session_targets')
        .select('email,name,company,dept').eq('session_id', sessionId);
      return (data || []).map(r => ({
        email: r.email,
        name: r.name || '',
        company: r.company || '',
        dept: r.dept || ''
      }));
    }
    const s = MOCK.sessions.find(x => x.id === sessionId);
    const profiles = (s && Array.isArray(s.target_profiles)) ? s.target_profiles : [];
    return profiles.map(p => ({
      email: p.email,
      name: p.name || '',
      company: p.company || '',
      dept: p.dept || ''
    }));
  },

  /** 차수의 지정 대상자 상세 행들을 저장 (수동 편집 경로) */
  async setSessionTargetsDetailed (sessionId, rows) {
    if (window.USE_SUPABASE) {
      await window.sb.from('session_targets').delete().eq('session_id', sessionId);
      if (rows && rows.length) {
        await window.sb.from('session_targets').insert(
          rows.map(r => ({
            session_id: sessionId,
            email:   r.email,
            name:    r.name    || null,
            company: r.company || null,
            dept:    r.dept    || null
          }))
        );
        // 대상자들을 자동으로 회원가입 처리
        await this.autoRegisterProfiles(rows);
      }
      return rows;
    }
    return MOCK.setSessionTargetsDetailed(sessionId, rows);
  },

  /** 차수의 지정 대상자를 이메일 목록만으로 저장 (엑셀 업로드 등) */
  async setSessionTargetEmails (sessionId, emails) {
    if (window.USE_SUPABASE) {
      await window.sb.from('session_targets').delete().eq('session_id', sessionId);
      if (emails && emails.length) {
        await window.sb.from('session_targets').insert(
          emails.map(e => ({ session_id: sessionId, email: e }))
        );
        // 대상자들을 자동으로 회원가입 처리 (프로필 정보는 비워둠)
        await this.autoRegisterProfiles(emails.map(e => ({ email: e })));
      }
      return emails;
    }
    return MOCK.setSessionTargetEmails(sessionId, emails);
  },

  /**
   * 대상자 이메일로 profiles 테이블에 자동 등록.
   * 이미 가입된 이메일은 건너뜀 (onConflict: email, ignoreDuplicates).
   * 기존 signUp 과 동일한 패턴으로 profiles 테이블에 직접 insert 합니다.
   */
  async autoRegisterProfiles (rows) {
    if (!window.USE_SUPABASE) return 0;
    if (!rows || !rows.length) return 0;
    const seen = new Set();
    const payload = [];
    rows.forEach(r => {
      const email = String((r && r.email) || '').trim().toLowerCase();
      if (!email || seen.has(email)) return;
      seen.add(email);
      payload.push({
        email,
        name:    r.name    || email.split('@')[0],
        company: r.company || null,
        dept:    r.dept    || null,
        role:    'member'
      });
    });
    if (!payload.length) return 0;
    // 이미 가입된 이메일은 건너뜀
    const { error } = await window.sb
      .from('profiles')
      .upsert(payload, { onConflict: 'email', ignoreDuplicates: true });
    if (error) console.warn('[autoRegisterProfiles]', error.message);
    return payload.length;
  },

  /**
   * 특정 차수의 대상자 상세 반환 (지정 + 해당 차수 신청자 union).
   * 반환: [{email, name, company, dept, designated, applied}]
   *   - designated: 관리자가 이 차수의 대상자로 지정했는지
   *   - applied:    이 차수에 신청 완료 상태인지
   * 이름/회사/소속은 우선순위: 가입 정보 > 관리자 입력 > 신청 시 스냅샷
   */
  async listSessionTargetsDetailed (sessionId) {
    const [designated, allApps, allUsers] = await Promise.all([
      this.listSessionDesignated(sessionId),
      this.listAllApplications(),
      this.listAllUsers()
    ]);

    const norm = (e) => String(e || '').trim().toLowerCase();
    const userByEmail = {};
    allUsers.forEach(u => { userByEmail[norm(u.email)] = u; });

    const designatedByEmail = {};
    designated.forEach(r => { designatedByEmail[norm(r.email)] = r; });
    const designatedSet = new Set(Object.keys(designatedByEmail));

    const appliedByEmail = {};
    allApps
      .filter(a => a.session_id === sessionId && a.status !== 'cancelled')
      .forEach(a => {
        const key = norm(a.user_email);
        if (key) appliedByEmail[key] = a;
      });

    const allEmails = new Set([
      ...designatedSet,
      ...Object.keys(appliedByEmail)
    ]);

    return Array.from(allEmails)
      .map(email => {
        const u = userByEmail[email] || {};
        const d = designatedByEmail[email] || {};
        const a = appliedByEmail[email];
        return {
          email,
          name:    u.name    || d.name    || a?.user_name    || '',
          company: u.company || d.company || a?.user_company || '',
          dept:    u.dept    || d.dept    || a?.user_dept    || '',
          designated: designatedSet.has(email),
          applied:    !!a,
          application_id: a ? a.id : null
        };
      })
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'ko'));
  },

  /**
   * 교육(training) 단위 대상자 상세 반환 = 모든 차수의 union + 해당 교육 신청자.
   * 반환: [{email, name, company, dept, designated, applied}]
   *   - designated: 어느 차수에라도 대상자로 지정돼 있으면 true
   *   - applied:    이 교육의 어느 차수에라도 신청 완료면 true
   * (교육별 요약 / 전체 차수 리마인더 안내에 사용)
   */
  async listTargetsDetailed (trainingId) {
    const sessions = await this.listSessions(trainingId);
    const [allApps, allUsers, ...perSessionDesignated] = await Promise.all([
      this.listAllApplications(),
      this.listAllUsers(),
      ...sessions.map(s => this.listSessionDesignated(s.id))
    ]);

    const norm = (e) => String(e || '').trim().toLowerCase();
    const userByEmail = {};
    allUsers.forEach(u => { userByEmail[norm(u.email)] = u; });

    const designatedByEmail = {};
    perSessionDesignated.forEach(rows => {
      rows.forEach(r => {
        const k = norm(r.email);
        if (!designatedByEmail[k]) designatedByEmail[k] = r;
      });
    });
    const designatedSet = new Set(Object.keys(designatedByEmail));

    const appliedByEmail = {};
    allApps
      .filter(a => a.training_id === trainingId && a.status !== 'cancelled')
      .forEach(a => {
        const key = norm(a.user_email);
        if (key) appliedByEmail[key] = a;
      });

    const allEmails = new Set([
      ...designatedSet,
      ...Object.keys(appliedByEmail)
    ]);

    return Array.from(allEmails)
      .map(email => {
        const u = userByEmail[email] || {};
        const d = designatedByEmail[email] || {};
        const a = appliedByEmail[email];
        return {
          email,
          name:    u.name    || d.name    || a?.user_name    || '',
          company: u.company || d.company || a?.user_company || '',
          dept:    u.dept    || d.dept    || a?.user_dept    || '',
          designated: designatedSet.has(email),
          applied:    !!a
        };
      })
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'ko'));
  },

  /* ---------- Reminder (관리자에서 트리거) ---------- */
  /**
   * 리마인더 발송.
   *   - sendReminders(trainingId)                          → 전체 차수 대상자 중 미신청자
   *   - sendReminders(trainingId, { sessionId })           → 해당 차수 대상자 중 미신청자
   *   - sendReminders(trainingId, { allMembers: true })    → 전체 구성원 중 미신청자
   * "신청 완료"의 기준은 해당 교육(trainingId)의 어느 차수에라도 신청했는지입니다
   * (한 교육 당 1회 신청 원칙).
   */
  async sendReminders (trainingId, opts = {}) {
    const sessionId  = opts.sessionId  || null;
    const allMembers = !!opts.allMembers;

    if (window.USE_SUPABASE) {
      const body = { training_id: trainingId };
      if (sessionId)  body.session_id  = sessionId;
      if (allMembers) body.all_members = true;
      const { data, error } = await window.sb.functions.invoke('send-reminder', { body });
      if (error) throw error;
      return data;
    }

    // Mock
    const appliedUserIds = new Set(
      MOCK.applications
        .filter(a => a.training_id === trainingId && a.status !== 'cancelled')
        .map(a => a.user_id)
    );

    // 대상자 이메일 계산
    let targetEmails = [];
    if (allMembers) {
      targetEmails = [];  // 아래에서 전체 구성원으로 fallback
    } else if (sessionId) {
      const s = MOCK.sessions.find(x => x.id === sessionId);
      targetEmails = ((s && s.target_profiles) || []).map(p => p.email);
    } else {
      // 전체 차수 union
      const sess = MOCK.sessions.filter(x => x.training_id === trainingId);
      const set = new Set();
      sess.forEach(s => (s.target_profiles || []).forEach(p => set.add(p.email)));
      targetEmails = Array.from(set);
    }

    let candidates;
    if (!allMembers && targetEmails.length > 0) {
      const set = new Set(targetEmails.map(e => String(e).toLowerCase()));
      candidates = MOCK.users.filter(u => set.has(String(u.email).toLowerCase()));
    } else {
      candidates = MOCK.users.filter(u => u.role === 'member');
    }
    const recipients = candidates.filter(u => !appliedUserIds.has(u.id));
    return { sent: recipients.length, recipients: recipients.map(u => u.email) };
  },

  /* ---------- Attendance (출석 체크) ---------- */
  /** 특정 차수의 출석자 목록 반환 ([{id, session_id, name, checked_at}]) */
  async listAttendances (sessionId) {
    if (window.USE_SUPABASE) {
      let q = window.sb.from('attendances').select('*').order('checked_at', { ascending: false });
      if (sessionId) q = q.eq('session_id', sessionId);
      const { data } = await q;
      return data || [];
    }
    const list = (MOCK.attendances || []).slice();
    return sessionId ? list.filter(a => a.session_id === sessionId) : list;
  },

  /** 출석 체크 (이름으로 등록) */
  async markAttendance (sessionId, name) {
    const clean = String(name || '').trim();
    if (!clean) throw new Error('이름을 입력해주세요.');
    if (!sessionId) throw new Error('차수 정보가 없어요.');
    if (window.USE_SUPABASE) {
      const { data, error } = await window.sb.from('attendances')
        .insert({ session_id: sessionId, name: clean })
        .select().single();
      if (error) throw error;
      return data;
    }
    if (!Array.isArray(MOCK.attendances)) MOCK.attendances = [];
    const entry = {
      id: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      session_id: sessionId,
      name: clean,
      checked_at: new Date().toISOString()
    };
    MOCK.attendances.push(entry);
    MOCK.save();
    return entry;
  },

  /** 출석 기록 삭제 */
  async deleteAttendance (attendanceId) {
    if (window.USE_SUPABASE) {
      const { error } = await window.sb.from('attendances').delete().eq('id', attendanceId);
      if (error) throw error;
      return true;
    }
    MOCK.attendances = (MOCK.attendances || []).filter(a => a.id !== attendanceId);
    MOCK.save();
    return true;
  },

  /** 차수 정보 반환 (출석 페이지에서 사용) */
  async getSessionWithTraining (sessionId) {
    if (window.USE_SUPABASE) {
      const { data: s } = await window.sb.from('training_sessions_with_count')
        .select('*').eq('id', sessionId).single();
      if (!s) return null;
      const { data: t } = await window.sb.from('trainings')
        .select('*').eq('id', s.training_id).single();
      return { session: s, training: t };
    }
    const s = MOCK.sessions.find(x => x.id === sessionId);
    if (!s) return null;
    const t = MOCK.trainings.find(x => x.id === s.training_id);
    return { session: s, training: t };
  }
};
