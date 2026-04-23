import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { body } = await req.json();
    const { emails, subject, message_body } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new Error("No emails provided");
    }

    // Office365 SMTP 설정 (계정 정보 하드코딩 - 향후 환경 변수로 빼는 것을 권장합니다)
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false, // TLS (STARTTLS)
      auth: {
        user: "I24039@partner.sk.com",
        pass: "dycd1004*",
      },
      tls: {
        ciphers: "SSLv3",
      },
    });

    let sentCount = 0;
    
    // 이메일 주소가 노출되지 않도록 수신자별로 개별 발송 처리
    await Promise.all(emails.map(async (email) => {
      try {
        await transporter.sendMail({
          from: '"SK디스커버리 기업문화실" <I24039@partner.sk.com>',
          to: email,
          subject: subject || "교육 리마인더 안내",
          text: message_body,
        });
        sentCount++;
      } catch (err) {
        console.error(`Failed to send email to ${email}:`, err);
      }
    }));

    return new Response(
      JSON.stringify({ sent: sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in send-reminder:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
