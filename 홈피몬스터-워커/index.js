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

    // GET 요청: 이지랜딩 방식의 동적 HTMLRewriter (미리보기 og:title / og:description 및 스크립트/픽셀 주입)
    if (request.method === 'GET') {
      const response = await fetch(request);
      if (!response.headers.get('content-type')?.includes('text/html')) {
        return response;
      }

      try {
        const settingsResp = await fetch(
          `${env.SUPABASE_URL}/rest/v1/external_settings?id=eq.1&select=*`,
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
          const pc = settings.page_config || {};

          // 스크립트 및 픽셀 생성
          let headInject = '';
          let bodyInject = '';

          // 1. 커스텀 스크립트
          if (pc.scripts === true) {
            if (settings.head_script) headInject += `\n${settings.head_script}\n`;
            if (settings.foot_script) bodyInject += `\n${settings.foot_script}\n`;
          }

          // 2. 픽셀 코드
          if (pc.pixels === true) {
            if (settings.meta_pixel_id) {
              headInject += `\n<!-- Meta Pixel -->\n<script>\n!function(f,b,e,v,n,t,s)\n{if(f.fbq)return;n=f.fbq=function(){n.callMethod?\nn.callMethod.apply(n,arguments):n.queue.push(arguments)};\nif(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';\nn.queue=[];t=b.createElement(e);t.async=!0;\nt.src=v;s=b.getElementsByTagName(e)[0];\ns.parentNode.insertBefore(t,s)}(window, document,'script',\n'https://connect.facebook.net/en_US/fbevents.js');\nfbq('init', '${settings.meta_pixel_id}');\nfbq('track', 'PageView');\n</script>\n<noscript><img height="1" width="1" style="display:none"\nsrc="https://www.facebook.com/tr?id=${settings.meta_pixel_id}&ev=PageView&noscript=1"\n/></noscript>\n`;
            }
            if (settings.google_ads_id) {
              headInject += `\n<!-- Google Ads -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=${settings.google_ads_id}"></script>\n<script>\nwindow.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', '${settings.google_ads_id}');\n</script>\n`;
            }
            if (settings.kakao_pixel_id) {
              headInject += `\n<!-- Kakao Pixel -->\n<script type="text/javascript" charset="UTF-8" src="//t1.daumcdn.net/kas/static/kp.js"></script>\n<script type="text/javascript">\nkakaoPixel('${settings.kakao_pixel_id}').pageView();\n</script>\n`;
            }
            if (settings.tiktok_pixel_id) {
              headInject += `\n<!-- TikTok Pixel -->\n<script>\n!function (w, d, t) {\n  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};\n  ttq.load('${settings.tiktok_pixel_id}');\n  ttq.page();\n}(window, document, 'ttq');\n</script>\n`;
            }
            if (settings.daangn_pixel_id) {
              headInject += `\n<!-- Daangn Pixel -->\n<script src="https://karrot-pixel.kr/js/karrot-pixel.umd.js"></script>\n<script>\nwindow.karrotPixel.init('${settings.daangn_pixel_id}');\nwindow.karrotPixel.track('ViewPage');\n</script>\n`;
            }
            if (settings.clarity_id) {
              headInject += `\n<!-- Clarity -->\n<script type="text/javascript">\n(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "${settings.clarity_id}");\n</script>\n`;
            }
          }

          let rewriter = new HTMLRewriter()
            .on('title', {
              element(el) {
                if (titleVal) el.setInnerContent(titleVal);
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
            });

          if (headInject) {
            rewriter.on('head', {
              element(el) {
                el.append(headInject, { html: true });
              }
            });
          }

          if (bodyInject) {
            rewriter.on('body', {
              element(el) {
                el.append(bodyInject, { html: true });
              }
            });
          }

          return rewriter.transform(response);
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
      // ── STEP 3-5: 페이지 뷰 트래킹 ──
      if (data.type === 'page_view') {
        const userAgent = request.headers.get('user-agent') || '';
        if (userAgent.toLowerCase().includes('bot') || userAgent.toLowerCase().includes('crawler')) {
          return jsonResponse({ success: true, ignored: true });
        }
        
        // 한국 시간(KST, UTC+9) 기준 오늘 날짜 (YYYY-MM-DD)
        const kstNow = new Date(Date.now() + (9 * 60 * 60 * 1000));
        const kstDateStr = kstNow.toISOString().split('T')[0];

        const pvPayload = {
          ip_address: ip,
          user_agent: userAgent,
          visit_date: kstDateStr
        };
        const pvResp = await fetch(`${env.SUPABASE_URL}/rest/v1/page_views`, {
          method: 'POST',
          headers: {
            'apikey': env.SUPABASE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=ignore-duplicates'
          },
          body: JSON.stringify(pvPayload),
        });
        
        if (!pvResp.ok) {
          console.error('Page view insert error:', await pvResp.text());
        }
        return jsonResponse({ success: true });
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
      const newId = crypto.randomUUID();
      const nowStr = new Date().toISOString();
      const leadPayload = {
        id: newId,
        customer_name: data.customer_name.trim(),
        customer_phone: data.customer_phone.trim(),
        form_data: {
          industry: data.industry || '',
          question: data.question || '',
          marketing_agree: data.marketing_agree === true,
        },
        status: '신규',
        platform: data.platform || '직접유입',
        ip_address: ip,
        created_at: nowStr,
      };

      const dbResp = await fetch(`${env.SUPABASE_URL}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(leadPayload),
      });

      if (!dbResp.ok) {
        const errText = await dbResp.text();
        console.error('DB Insert Error:', errText);
        return jsonResponse({ error: 'db_error', message: 'DB 저장 실패' }, 500);
      }

      const savedLead = leadPayload;

      // ── STEP 6: 알림 발사 (Promise.allSettled, 백그라운드) ──
      const notifications = [];

      const pc = settings.page_config || {};

      // 6-A. 텔레그램 알림
      if (pc.telegram === true && settings.telegram_bot_token && settings.telegram_chat_id) {
        const pageName = settings.page_name || '홈페이지';
        const msg = [
          `🚨 [${pageName}] 신규 DB`,
          '',
          `1) 이름: ${leadPayload.customer_name}`,
          `2) 연락처: ${leadPayload.customer_phone}`,
          `3) 업종: ${leadPayload.form_data.industry || '-'}`,
          `4) 문의: ${leadPayload.form_data.question || '-'}`,
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
