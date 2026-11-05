/**
 * Cloudflare Pages Function: Verify OTP code and issue HMAC-SHA256 signed session token
 * POST /api/admin/verify-code
 * Body: { code: "123456", telegram_id: "5192950042" }
 */

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
    'https://tviy-trener.com',
    'https://www.tviy-trener.com',
    'https://sndbx-temp.tviy-trener.com',
    'https://tviy-trener.pages.dev',
    'https://tviy-trener-v2.pages.dev',
    'https://tviy-trener-1hq.pages.dev',
    'https://tviy-trener-v2-5pv.pages.dev'
  ];

  let allowedOrigin = 'https://tviy-trener.com';
  if (origin && (
    allowedOrigins.includes(origin) ||
    origin.endsWith('.tviy-trener.pages.dev') ||
    origin.endsWith('.tviy-trener-v2.pages.dev') ||
    origin.endsWith('.tviy-trener-1hq.pages.dev') ||
    origin.endsWith('.tviy-trener-v2-5pv.pages.dev') ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  )) {
    allowedOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true'
  };
}

export async function onRequestPost({ request, env }) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const { code, telegram_id } = await request.json();

    if (!code || !telegram_id) {
      return new Response(JSON.stringify({ error: 'Код та telegram_id є обов\'язковими' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resolve username to numeric Telegram ID
    let resolvedTelegramId = String(telegram_id).trim();
    const usernameMapping = {
      'illyapolishchyk': '5192950042',
      '@illyapolishchyk': '5192950042',
      'dima_lazarev': '143220916',
      '@dima_lazarev': '143220916'
    };

    const normalizedInput = resolvedTelegramId.toLowerCase();
    if (usernameMapping[normalizedInput]) {
      resolvedTelegramId = usernameMapping[normalizedInput];
    }

    // Retrieve code from KV
    const kvKey = `otp:${resolvedTelegramId}`;
    if (!env.OTP_KV) {
      return new Response(JSON.stringify({ error: 'База даних OTP_KV не налаштована у Cloudflare' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const stored = await env.OTP_KV.get(kvKey, { type: 'json' });

    if (!stored) {
      return new Response(JSON.stringify({ error: 'Код не знайдено або прострочено. Запитайте новий.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { code: storedCode, expiresAt, attempts = 0 } = stored;

    // Check expiration
    if (Date.now() > expiresAt) {
      await env.OTP_KV.delete(kvKey);
      return new Response(JSON.stringify({ error: 'Код прострочений. Отримайте новий.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check attempts (max 3)
    if (attempts >= 3) {
      await env.OTP_KV.delete(kvKey);
      return new Response(JSON.stringify({ error: 'Занадто багато спроб. Отримайте новий код.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify code
    if (String(code).trim() !== String(storedCode).trim()) {
      await env.OTP_KV.put(kvKey, JSON.stringify({ ...stored, attempts: attempts + 1 }), {
        expirationTtl: 300
      });
      return new Response(JSON.stringify({ error: 'Невірний код' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Code is valid - delete from KV
    await env.OTP_KV.delete(kvKey);

    // Generate cryptographically signed session token (HMAC-SHA256)
    const secret = (env.JWT_SECRET || env.TELEGRAM_BOT_TOKEN || '') + ':' + (env.GITHUB_TOKEN || 'tviy-trener');
    const token = await generateSignedToken(resolvedTelegramId, secret);

    return new Response(JSON.stringify({
      success: true,
      token,
      user: { telegram_id: resolvedTelegramId }
    }), {
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

export async function onRequestOptions({ request }) {
  return new Response(null, {
    headers: getCorsHeaders(request)
  });
}

function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateSignedToken(telegramId, secret) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(JSON.stringify({
    sub: String(telegramId),
    iat: now,
    exp: now + 24 * 60 * 60, // 24 hours
    role: 'admin'
  }));

  const data = `${header}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const sigBytes = new Uint8Array(sigBuffer);
  let binary = '';
  for (let i = 0; i < sigBytes.byteLength; i++) {
    binary += String.fromCharCode(sigBytes[i]);
  }
  const signature = base64UrlEncode(binary);

  return `${data}.${signature}`;
}
