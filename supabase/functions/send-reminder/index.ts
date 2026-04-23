// =========================================================================
// Supabase Edge Function: send-reminder
// -------------------------------------------------------------------------
// 미신청자에게 리마인더 메일을 발송합니다.
// 배포:
//   supabase functions deploy send-reminder --no-verify-jwt
// 자동 스케줄 (예: 매일 오전 9시):
//   Supabase Studio > Database > Cron Jobs 에서
//   select net.http_post('https://YOUR-PROJECT.functions.supabase.co/send-reminder',
//                        '{"training_id":"t1"}', '{"Content-Type":"application/json"}');
//   형태로 등록 가능.
// 필수 환경변수 (Supabase Dashboard > Functions > Settings):
//   RESEND_API_KEY   - Resend.com 발송 API 키 (또는 SENDGRID_API_KEY 로 교체)
//   FROM_EMAIL       - 발신자 이메일 (예: no-reply@skdiscovery.com)
//   APP_URL          - 플랫폼 URL  (예: https://dy-edu.vercel.app)
// =========================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const { training_id } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let query = supabase.from('reminder_targets').select('*');
    if (training_id) query = query.eq('training_id', training_id);
    const { data: targets, error } = await query;
    if (error) throw error;

    if (!targets || targets.length === 0) {
      return Response.json({ sent: 0, message: '발송 대상이 없습니다.' });
    }

    const apiKey   = Deno.env.get('RESEND_API_KEY');
    const fromAddr = Deno.env.get('FROM_EMAIL') ?? 'no-reply@skdiscovery.com';
    const appUrl   = Deno.env.get('APP_URL')    ?? 'https://example.com';

    if (!apiKey) {
      return Response.json({
        sent: 0, dryRun: true,
        message: 'RESEND_API_KEY 가 없어 실제 발송을 건너뛰었습니다.',
        preview: targets.slice(0, 5)
      });
    }

    let sent = 0;
    for (const t of targets) {
      const html = `
        <div style="font-family:Pretendard, sans-serif; color:#191F28; max-width:560px; margin:0 auto; padding:32px;">
          <h2 style="letter-spacing:-0.03em;">${t.user_name}님, 아직 신청 전이에요.</h2>
          <p style="color:#4E5968; line-height:1.6;">
            <b>${t.training_title}</b> 교육을 아직 신청하지 않으셨어요.<br/>
            정원이 소진되기 전에 원하시는 차수를 선택해주세요.
          </p>
          <a href="${appUrl}/training.html?id=${t.training_id}"
             style="display:inline-block; margin-top:16px; background:#3182F6; color:#fff;
                    padding:14px 24px; border-radius:12px; font-weight:700; text-decoration:none;">
            지금 신청하기 →
          </a>
          <p style="color:#8B95A1; font-size:12px; margin-top:32px;">
            본 메일은 DY 공통 교육 자동 리마인더 시스템에서 발송되었습니다.
          </p>
        </div>`;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [t.user_email],
          subject: `[DY 교육] ${t.training_title} 신청을 잊지 않으셨나요?`,
          html
        })
      });
      if (res.ok) sent += 1;
    }

    return Response.json({ sent, total: targets.length });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
});
