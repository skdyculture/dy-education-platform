# DY 공통 교육 신청 관리 플랫폼

SK Discovery 기업문화실(DY)의 공통 교육 신청을 위한 경량 웹 플랫폼입니다.
순수 HTML/CSS/JS 로 작성되어 있으며, 배포는 **Vercel** + **Supabase** 조합을 상정해 설계했습니다.

---

## 📂 프로젝트 구조

```
dy-education-platform/
├── index.html              # 교육 목록 (홈)
├── training.html           # 교육 상세 · 차수 선택/신청
├── my-applications.html    # 내 신청 내역 (변경/취소)
├── admin.html              # 관리자 대시보드
├── login.html              # 로그인 (데모 빠른 선택 포함)
├── css/style.css           # 토스 스타일 디자인 시스템
├── js/
│   ├── app.js              # 공용 UI 유틸 (헤더/모달/토스트/포매터)
│   ├── mock-data.js        # 로컬 미리보기용 Mock Data (LocalStorage)
│   └── supabase-client.js  # DAL (Mock ↔ Supabase 자동 분기)
├── supabase/
│   ├── schema.sql          # 테이블/뷰/RPC/RLS
│   ├── seed.sql            # 샘플 교육/차수 데이터
│   └── functions/send-reminder/index.ts  # 리마인더 메일 Edge Function
└── vercel.json             # Vercel 설정 (cleanUrls 등)
```

---

## 🚀 빠른 시작 (로컬 미리보기)

어떤 백엔드도 필요 없습니다. 아무 정적 서버로 루트를 띄우세요.

```bash
# Python 내장 서버
python3 -m http.server 5173

# 또는 Node의 serve
npx serve .
```

브라우저에서 `http://localhost:5173` 접속 → 로그인 화면의 **빠른 계정 선택** 으로 체험.
(`김시은` 계정은 관리자 권한으로 설정되어 있어요.)

---

## 🎨 디자인

- 토스 홈페이지 스타일을 참고했습니다.
  - **컬러**: #3182F6 메인 블루, 중립 그레이 스케일, 8px 기준 spacing
  - **폰트**: Pretendard (CDN)
  - **라운드**: 12/16/20px, 부드러운 shadow, subtle hover transform
  - **반응형**: 모바일에서는 카드 1열 / 테이블은 카드형 변환

---

## 🗄 Supabase 연결 (배포)

### 1) 프로젝트 생성
1. https://supabase.com 에서 프로젝트 생성
2. **Project Settings → API** 에서 `Project URL`, `anon key` 복사

### 2) 스키마 적용
Supabase Studio → **SQL Editor** 에
1. `supabase/schema.sql` 통째로 붙여넣고 Run
2. `supabase/seed.sql` 실행 (샘플 교육 등록)

### 3) 관리자 지정
구성원이 회원가입하면 자동으로 `profiles` 에 생성됩니다.
관리자로 지정하려면:
```sql
update public.profiles set role = 'admin' where email = 'sekim0424@skdiscovery.com';
```

### 4) 프론트 연결
`js/supabase-client.js` 상단 수정:
```js
window.SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
window.SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
window.USE_SUPABASE = true;   // Mock → 실DB 로 전환
```

모든 HTML `<head>` 에 Supabase CDN 추가:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

> **참고**: 현재 `login.html` 은 데모용 즉시 로그인만 구현되어 있습니다.
> 실서비스 전환 시에는 Supabase Auth(매직링크 또는 이메일/비밀번호)로 교체하세요.

---

## 📧 자동 리마인더 (Edge Function + Cron)

### 1) Resend.com (권장) 또는 SendGrid 계정에서 API 키 발급

### 2) Edge Function 배포
```bash
supabase login
supabase link --project-ref <YOUR-PROJECT-REF>
supabase functions deploy send-reminder --no-verify-jwt
supabase secrets set RESEND_API_KEY=re_xxx FROM_EMAIL=no-reply@skdiscovery.com APP_URL=https://dy-edu.vercel.app
```

### 3) 수동 트리거
- 관리자 대시보드의 **"📧 미신청자에게 리마인더 보내기"** 버튼

### 4) 자동 스케줄 (Supabase Cron)
Supabase Studio → **Database → Cron Jobs** 에서 새 Job 등록:
```sql
-- 매주 월요일 오전 9시 (KST = UTC+9)
select cron.schedule(
  'weekly-reminder',
  '0 0 * * 1',   -- UTC 기준 (KST 월요일 09:00)
  $$ select net.http_post(
       'https://YOUR-PROJECT.functions.supabase.co/send-reminder',
       '{}',
       '{"Content-Type":"application/json"}'
     ); $$
);
```
특정 교육만 대상으로 하려면 body 를 `'{"training_id":"t1"}'` 로.

---

## ▲ Vercel 배포

### 1) GitHub 저장소로 push
```bash
git init
git add .
git commit -m "init: DY education platform"
git remote add origin <YOUR-REPO>
git push -u origin main
```

### 2) Vercel → Add New Project
- Framework Preset: **Other** (정적 파일만)
- Build Command: (비움)
- Output Directory: `.`
- Deploy

`vercel.json` 이 cleanUrls / 보안 헤더를 자동 적용합니다.
루트 URL 이 `index.html` 을 서빙하므로 추가 설정 불필요.

### 3) 커스텀 도메인 연결 (선택)
예: `edu.skdiscovery.com` → Vercel Project Settings → Domains

---

## ✅ 기능 체크리스트

**사용자**
- [x] 교육 목록 조회
- [x] 교육별 상세 + 차수별 일시/장소/남은자리 테이블
- [x] 선착순 신청 (정원 마감 시 버튼 비활성화)
- [x] 내 신청 내역 조회
- [x] 차수 변경 / 신청 취소
- [x] 모바일 반응형

**관리자**
- [x] KPI 대시보드 (인원/충원율)
- [x] 교육별 차수별 신청현황 프로그레스 바
- [x] 전체 신청 내역 열람
- [x] 관리자의 신청 변경/취소
- [x] 구성원 명단 + 검색
- [x] 교육별 리마인더 수동 발송

**자동화 (Supabase)**
- [x] 선착순 원자성 (RPC `apply_session` with row-lock)
- [x] RLS 기반 권한 (본인 or 관리자)
- [x] 미신청자 뷰 `reminder_targets`
- [x] 리마인더 Edge Function + Cron 스케줄 예시

---

## 🛠 추가 개선 아이디어

- Supabase Auth 연동 (매직링크 / 카카오워크 SSO)
- 교육/차수 등록 UI 를 관리자 페이지에 추가 (현재는 DB 직접)
- 대기자 명단 (waitlist) — 정원 마감 시 대기 등록 + 자동 승격
- 엑셀 내보내기 (구성원별 이수 현황)
- 이수 완료 자동 체크 + 이수증 PDF 발급

---

© SK Discovery · 기업문화실 (DY)
