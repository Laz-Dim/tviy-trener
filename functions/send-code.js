/**
 * Cloudflare Worker: Send OTP code via Telegram Bot API
 * POST /api/admin/send-code
 * Body: { telegram_id: "5192950042" }
 */
import { kv } from '@cloudflare/kv-asset-handler';

export default {
  async fetch(request, env, ctx) {
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
      const { telegram_id } = await request.json();
      
      if (!telegram_id) {
        return new Response(JSON.stringify({ error: 'telegram_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Generate 6-digit OTP code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes TTL

      // Store code in KV with TTL
      const kvKey = `otp:${telegram_id}`;
      await env.OTP_KV.put(kvKey, JSON.stringify({ code, expiresAt, attempts: 0 }), {
        expirationTtl: 300 // 5 minutes in seconds
      });

      // Send via Telegram Bot API
      const botToken = env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        console.error('TELEGRAM_BOT_TOKEN not configured');
        return new Response(JSON.stringify({ error: 'Bot not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const chatId = telegram_id.startsWith('@') ? telegram_id : telegram_id;
      const message = `🔐 <b>Код для входу в адмінку</b>\n\nВаш одноразовий код: <code>${code}</code>\n\nКод діє 5 хвилин. Не передавайте його нікому.`;

      const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });

      const tgResult = await tgResponse.json();
      
      if (!tgResult.ok) {
        console.error('Telegram API error:', tgResult);
        // Don't expose internal errors
        return new Response(JSON.stringify({ error: 'Failed to send code' }), {
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
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};