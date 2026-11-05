/**
 * Cloudflare Pages Function: Handle contact form submission
 * POST /api/register
 * Body: { name, phone, goal, message }
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
    const { name, phone, goal, message, website } = await request.json();

    // 1. Honeypot check (anti-spam trap)
    if (website) {
      console.warn('Spam bot detected via honeypot');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Validation (before incrementing rate limit so typos don't lock out real users)
    if (!name || !name.trim() || !phone || !goal) {
      return new Response(JSON.stringify({ error: 'Заповніть обов\'язкові поля' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const phoneRegex = /^\+38\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;
    if (!phoneRegex.test(phone)) {
      return new Response(JSON.stringify({ error: 'Невірний формат телефону' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Rate Limiting via Cloudflare KV database (max 3 per 15 minutes)
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const kvKey = `rate:${ip}`;
    let currentCount = 0;

    if (env.OTP_KV) {
      const stored = await env.OTP_KV.get(kvKey, { type: 'json' });
      if (stored && stored.count >= 3) {
        return new Response(JSON.stringify({ error: 'Ви перевищили ліміт відправок. Спробуйте знову через 15 хвилин або зателефонуйте.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      currentCount = stored ? stored.count : 0;
    }

    // 4. Send to Telegram
    const botToken = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_TRAINER_CHAT_ID || '5192950042';

    if (!botToken || !chatId) {
      console.error('Telegram config missing');
      return new Response(JSON.stringify({ error: 'Сервіс тимчасово недоступний' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const text = `🚀 <b>Нова заявка з сайту!</b>\n\n` +
      `👤 <b>Ім'я:</b> ${escapeHtml(name.trim())}\n` +
      `📞 <b>Телефон:</b> ${escapeHtml(phone)}\n` +
      `🎯 <b>Ціль:</b> ${escapeHtml(goal)}\n` +
      `💬 <b>Повідомлення:</b> ${escapeHtml(message ? message.trim() : '—')}`;

    const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });

    const tgResult = await tgResponse.json();

    if (!tgResult.ok) {
      console.error('Telegram API error:', tgResult);
      return new Response(JSON.stringify({ error: 'Не вдалося надіслати повідомлення' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Increment rate limit counter after successful send
    if (env.OTP_KV) {
      await env.OTP_KV.put(kvKey, JSON.stringify({ count: currentCount + 1 }), {
        expirationTtl: 900
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Function error:', err);
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

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
