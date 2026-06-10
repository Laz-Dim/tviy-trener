/**
 * Cloudflare Pages Function: Handle contact form submission
 * POST /api/register
 * Body: { name, phone, goal, message }
 */
export async function onRequestPost({ request, env }) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    const { name, phone, goal, message } = await request.json();

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
    const chatId = env.TELEGRAM_ADMIN_CHAT_ID || env.ADMIN_CHAT_ID; // fallback

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
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
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