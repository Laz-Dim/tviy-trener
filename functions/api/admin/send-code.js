/**
 * Cloudflare Pages Function: Send OTP code via Telegram Bot API
 * POST /api/admin/send-code
 * Body: { telegram_id: "5192950042" }
 */

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
    'https://tviy-trener.com',
    'https://sndbx-temp.tviy-trener.com',
    'https://tviy-trener.pages.dev'
  ];
  
  let allowedOrigin = 'https://tviy-trener.com';
  if (origin && (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
    allowedOrigin = origin;
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true'
  };

  try {
    const { telegram_id } = await request.json();
    
    if (!telegram_id) {
      return new Response(JSON.stringify({ error: 'telegram_id є обов\'язковим' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Security: Check if telegram_id is allowed
    const trainerChatId = env.TELEGRAM_TRAINER_CHAT_ID;
    const adminChatId = env.TELEGRAM_ADMIN_CHAT_ID || env.ADMIN_CHAT_ID;
    const allowedIds = [trainerChatId, adminChatId].filter(Boolean).map(String);

    if (allowedIds.length > 0 && !allowedIds.includes(String(telegram_id))) {
      return new Response(JSON.stringify({ error: 'Доступ заборонено: невідомий Telegram ID' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes TTL

    // Store code in KV with TTL
    const kvKey = `otp:${telegram_id}`;
    if (!env.OTP_KV) {
      return new Response(JSON.stringify({ error: 'База даних OTP_KV не налаштована у Cloudflare' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await env.OTP_KV.put(kvKey, JSON.stringify({ code, expiresAt, attempts: 0 }), {
      expirationTtl: 300 // 5 minutes in seconds
    });

    // Send via Telegram Bot API
    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return new Response(JSON.stringify({ error: 'Telegram Bot Token не налаштований у Cloudflare' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const message = `🔐 <b>Код для входу в адмінку</b>\n\nВаш одноразовий код: <code>${code}</code>\n\nКод діє 5 хвилин. Не передавайте його нікому.`;

    const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegram_id,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const tgResult = await tgResponse.json();
    
    if (!tgResult.ok) {
      console.error('Telegram API error:', tgResult);
      return new Response(JSON.stringify({ error: 'Не вдалося надіслати код через Telegram. Переконайтеся, що ви почали діалог з ботом.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Worker error:', err);
    return new Response(JSON.stringify({ error: 'Внутрішня помилка сервера' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle OPTIONS for CORS
export async function onRequestOptions({ request }) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
    'https://tviy-trener.com',
    'https://sndbx-temp.tviy-trener.com',
    'https://tviy-trener.pages.dev'
  ];
  
  let allowedOrigin = 'https://tviy-trener.com';
  if (origin && (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
    allowedOrigin = origin;
  }

  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}
