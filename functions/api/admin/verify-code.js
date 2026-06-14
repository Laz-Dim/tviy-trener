/**
 * Cloudflare Pages Function: Verify OTP code and issue session token
 * POST /api/admin/verify-code
 * Body: { code: "123456", telegram_id: "5192950042" }
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
    const { code, telegram_id } = await request.json();
    
    if (!code || !telegram_id) {
      return new Response(JSON.stringify({ error: 'Код та telegram_id є обов\'язковими' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Retrieve code from KV
    const kvKey = `otp:${telegram_id}`;
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
    if (code !== storedCode) {
      // Increment attempts
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

    // Generate session token (simple JWT-like string)
    const token = generateToken(telegram_id);
    
    // Return success with token
    return new Response(JSON.stringify({
      success: true,
      token,
      user: { telegram_id }
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

/**
 * Generate a simple session token
 * In production, use a proper JWT library with signing
 */
function generateToken(telegramId) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: telegramId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    role: 'admin'
  }));
  // Simple signature (in production, use crypto.subtle.sign with a secret)
  const signature = btoa('tviy-trener-secret-' + Date.now()).slice(0, 43);
  return `${header}.${payload}.${signature}`;
}
