/**
 * Cloudflare Pages Function: Handle contact form submission
 * POST /api/register
 * Body: { name, phone, goal, message }
 */
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
    'https://tviy-trener.com',
    'https://sndbx-temp.tviy-trener.com',
    'https://tviy-trener.pages.dev',
    'https://tviy-trener-v2.pages.dev'
  ];
  
  let allowedOrigin = 'https://tviy-trener.com';
  if (origin && (
    allowedOrigins.includes(origin) ||
    origin.endsWith('.tviy-trener.pages.dev') ||
    origin.endsWith('.tviy-trener-v2.pages.dev') ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  )) {
    allowedOrigin = origin;
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true'
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { name, phone, goal, message, website } = await request.json();

    // 1. Honeypot check (anti-spam trap)
    // If the hidden field is filled, pretend it succeeded but drop it silently
    if (website) {
      console.warn('Spam bot detected via honeypot');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Rate Limiting via Cloudflare KV database (max 3 per 15 minutes)
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const kvKey = `rate:${ip}`;
    
    if (env.OTP_KV) {
      const stored = await env.OTP_KV.get(kvKey, { type: 'json' });
      if (stored) {
        if (stored.count >= 3) {
          return new Response(JSON.stringify({ error: 'Ви перевищили ліміт відправок. Спробуйте знову через 15 хвилин або зателефонуйте.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        // Increment attempts
        await env.OTP_KV.put(kvKey, JSON.stringify({ count: stored.count + 1 }), {
          expirationTtl: 900 // 15 minutes TTL in seconds
        });
      } else {
        // Initialize attempts
        await env.OTP_KV.put(kvKey, JSON.stringify({ count: 1 }), {
          expirationTtl: 900
        });
      }
    }

    // Validation
    if (!name || !phone || !goal) {
      return new Response(JSON.stringify({ error: 'Заповніть обов\'язкові поля' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Phone format validation
    const phoneRegex = /^\+38\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;
    if (!phoneRegex.test(phone)) {
      return new Response(JSON.stringify({ error: 'Невірний формат телефону' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Send to Telegram
    const botToken = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_TRAINER_CHAT_ID || '5192950042'; // Send to trainer Ilya Polishchuk

    if (!botToken || !chatId) {
      console.error('Telegram config missing');
      return new Response(JSON.stringify({ error: 'Сервіс тимчасово недоступний' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const text = `🚀 <b>Нова заявка з сайту!</b>\n\n` +
      `👤 <b>Ім'я:</b> ${escapeHtml(name)}\n` +
      `📞 <b>Телефон:</b> ${escapeHtml(phone)}\n` +
      `🎯 <b>Ціль:</b> ${escapeHtml(goal)}\n` +
      `💬 <b>Повідомлення:</b> ${escapeHtml(message || '—')}`;

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

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
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
    'https://tviy-trener.pages.dev',
    'https://tviy-trener-v2.pages.dev'
  ];
  
  let allowedOrigin = 'https://tviy-trener.com';
  if (origin && (
    allowedOrigins.includes(origin) ||
    origin.endsWith('.tviy-trener.pages.dev') ||
    origin.endsWith('.tviy-trener-v2.pages.dev') ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  )) {
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

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}