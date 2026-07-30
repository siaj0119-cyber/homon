// ============================================
// 홈피몬스터 워커 — 이지랜딩 방식 풀 API
// ============================================
// 데이터 흐름:
// 1. 데이터 받기 + IP 추출
// 2. 설정 조회 (external_settings)
// 3. IP 차단 체크
// 4. 유효성 검사
// 5. DB 저장 (가장 먼저!)
// 6. 알림 발사 (텔레그램 + 웹훅, Promise.allSettled)
// 7. 성공 응답 반환
// ============================================

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    // CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // GET 요청: 이지랜딩 방식의 동적 HTMLRewriter (미리보기 og:title / og:description 주입)
    if (request.method === 'GET') {
      const response = await fetch(request);
      if (!response.headers.get('content-type')?.includes('text/html')) {
        return response;
      }

      try {
        const settingsResp = await fetch(
          `${env.SUPABASE_URL}/rest/v1/external_settings?id=eq.1&select=page_name,og_title,og_description`,
          {
            headers: {
              'apikey': env.SUPABASE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_KEY}`,
            },
          }
        );

        if (settingsResp.ok) {
          const settingsArr = await settingsResp.json();
          const settings = settingsArr[0] || {};
          const titleVal = settings.og_title || settings.page_name || '';
          const descVal = settings.og_description || '';

          return new HTMLRewriter()
            .on('title', {
              element(el) {
                if (titleVal) el.setText(titleVal);
              },
            })
            .on('meta[property="og:title"]', {
              element(el) {
                if (titleVal) el.setAttribute('content', titleVal);
              },
            })
            .on('meta[name="twitter:title"]', {
              element(el) {
                if (titleVal) el.setAttribute('content', titleVal);
              },
            })
            .on('meta[property="og:description"]', {
              element(el) {
                if (descVal) el.setAttribute('content', descVal);
              },
            })
            .on('meta[name="twitter:description"]', {
              element(el) {
                if (descVal) el.setAttribute('content', descVal);
              },
            })
            .on('meta[name="description"]', {
              element(el) {
                if (descVal) el.setAttribute('content', descVal);
              },
            })
            .transform(response);
        }
      } catch (e) {
        console.error('Worker HTMLRewriter Error:', e);
      }
      return response;
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
      // ── STEP 1: 데이터 받기 + IP 추출 ──
      const data = await request.json();
      const ip = request.headers.get('CF-Connecting-IP')
        || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || '';

      // ── STEP 2: 설정 조회 ──
      const settingsResp = await fetch(
        `${env.SUPABASE_URL}/rest/v1/external_settings?id=eq.1&select=*`,
        {
          headers: {
            'apikey': env.SUPABASE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_KEY}`,
          },
        }
      );

      let settings = {};
      if (settingsResp.ok) {
        const settingsArr = await settingsResp.json();
        if (settingsArr.length > 0) settings = settingsArr[0];
      }

      // ── STEP 3: IP 차단 체크 ──
      if (settings.ip_block_list && ip) {
        const blockedIPs = settings.ip_block_list
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean);
        if (blockedIPs.includes(ip)) {
          return jsonResponse({ error: 'blocked', message: '차단된 IP입니다.' }, 403);
        }
      }

      // ── STEP 4: 유효성 검사 ──
      if (!data.customer_name || !data.customer_name.trim()) {
        return jsonResponse({ error: 'validation', message: '이름을 입력해주세요.' }, 400);
      }
      if (!data.customer_phone || !data.customer_phone.trim()) {
        return jsonResponse({ error: 'validation', message: '전화번호를 입력해주세요.' }, 400);
      }

      const phoneDigits = data.customer_phone.replace(/[^0-9]/g, '');
      if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        return jsonResponse({ error: 'validation', message: '올바른 전화번호 형식이 아닙니다.' }, 400);
      }

      // ── STEP 5: DB 저장 (가장 먼저!) ──
      const leadPayload = {
        customer_name: data.customer_name.trim(),
        customer_phone: data.customer_phone.trim(),
        form_data: {
          industry: data.industry || '',
          question: data.question || '',
        },
        status: '신규접수',
        platform: data.platform || '직접유입',
        ip_address: ip,
      };

      const dbResp = await fetch(`${env.SUPABASE_URL}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(leadPayload),
      });

      if (!dbResp.ok) {
        const errText = await dbResp.text();
        console.error('DB Insert Error:', errText);
        return jsonResponse({ error: 'db_error', message: 'DB 저장 실패' }, 500);
      }

      const savedLeads = await dbResp.json();
      const savedLead = savedLeads[0] || {};

      // ── STEP 6: 알림 발사 (Promise.allSettled, 백그라운드) ──
      const notifications = [];

      const pc = settings.page_config || {};

      // 6-A. 텔레그램 알림
      if (pc.telegram === true && settings.telegram_bot_token && settings.telegram_chat_id) {
        const pageName = settings.page_name || '홈페이지';
        const msg = [
          `🚨 [${pageName}] 신규 DB 접수`,
          '',
          `👤 이름: ${leadPayload.customer_name}`,
          `📞 연락처: ${leadPayload.customer_phone}`,
          `🏢 업종: ${leadPayload.form_data.industry || '-'}`,
          `💬 문의: ${leadPayload.form_data.question || '-'}`,
          '',
          '신속하게 응대해 주세요!',
        ].join('\n');

        notifications.push(
          fetch(`https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: settings.telegram_chat_id,
              text: msg,
            }),
          }).catch(err => console.error('Telegram Error:', err))
        );
      }

      // 6-B. 웹훅 (CRM/구글시트 등)
      if (pc.webhook === true && settings.webhook_url) {
        notifications.push(
          fetch(settings.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: savedLead.id,
              customer_name: leadPayload.customer_name,
              customer_phone: leadPayload.customer_phone,
              industry: leadPayload.form_data.industry,
              question: leadPayload.form_data.question,
              status: leadPayload.status,
              platform: leadPayload.platform,
              ip_address: leadPayload.ip_address,
              created_at: savedLead.created_at,
            }),
          }).catch(err => console.error('Webhook Error:', err))
        );
      }

      // 백그라운드에서 실행 (응답 차단 안 함)
      if (notifications.length > 0) {
        ctx.waitUntil(Promise.allSettled(notifications));
      }

      // ── STEP 7: 성공 응답 ──
      return jsonResponse({
        success: true,
        id: savedLead.id,
        created_at: savedLead.created_at,
      }, 201);

    } catch (error) {
      console.error('Worker Error:', error);
      return jsonResponse({ error: 'server_error', message: error.message }, 500);
    }
  },
};
