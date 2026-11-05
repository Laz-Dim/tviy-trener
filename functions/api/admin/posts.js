/**
 * Cloudflare Pages Function: List, create, update, and delete blog posts via GitHub API
 * GET /api/admin/posts
 * POST /api/admin/posts
 * DELETE /api/admin/posts
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
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };
}

function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

async function verifySignedToken(token, env) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Необхідна авторизація' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Некоректний формат токена' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const secret = (env.JWT_SECRET || env.TELEGRAM_BOT_TOKEN || '') + ':' + (env.GITHUB_TOKEN || 'tviy-trener');

  try {
    const data = `${headerB64}.${payloadB64}`;
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
    const expectedSig = base64UrlEncode(binary);

    if (signatureB64 !== expectedSig) {
      return { valid: false, error: 'Недійсний підпис сесії. Увійдіть знову.' };
    }

    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (!payload.exp || Date.now() / 1000 > payload.exp) {
      return { valid: false, error: 'Термін дії сесії закінчився. Увійдіть знову.' };
    }

    const trainerChatId = env.TELEGRAM_TRAINER_CHAT_ID || '5192950042';
    const adminChatId = env.TELEGRAM_ADMIN_CHAT_ID || env.ADMIN_CHAT_ID || '143220916';
    const allowedIds = [trainerChatId, adminChatId].filter(Boolean).map(String);

    if (allowedIds.length > 0 && !allowedIds.includes(String(payload.sub))) {
      return { valid: false, error: 'Доступ заборонено: невідомий користувач', status: 403 };
    }

    return { valid: true, telegramId: String(payload.sub) };
  } catch (err) {
    return { valid: false, error: 'Некоректний або прострочений токен' };
  }
}

export async function onRequestGet({ request, env }) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const githubToken = env.GITHUB_TOKEN;
    const githubRepo = env.GITHUB_REPO;
    const branch = env.GITHUB_BRANCH || 'main';

    if (!githubToken || !githubRepo) {
      return new Response(JSON.stringify({ error: 'Налаштування сервера не завершені' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const postsUrl = `https://api.github.com/repos/${githubRepo}/contents/blog_posts.json?ref=${branch}`;
    const getResponse = await fetch(postsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Cloudflare-Pages-Function'
      }
    });

    if (!getResponse.ok) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }

    const fileData = await getResponse.json();
    const decodedContent = decodeURIComponent(
      atob(fileData.content.replace(/\s/g, ''))
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const posts = JSON.parse(decodedContent);
    return new Response(JSON.stringify(posts), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch (err) {
    console.error('GET posts error:', err);
    return new Response(JSON.stringify({ error: 'Помилка отримання списку нотаток' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost({ request, env }) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const formData = await request.formData();
    const token = formData.get('token');
    const title = formData.get('title');
    const slug = formData.get('slug');
    const category = formData.get('category');
    const tags = formData.get('tags');
    const description = formData.get('description');
    const content = formData.get('content');
    const date = formData.get('date');
    const imageFile = formData.get('image');
    const existingImage = formData.get('existingImage');

    // 1. Verify HMAC-signed token
    const auth = await verifySignedToken(token, env);
    if (!auth.valid) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status || 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!title || !slug || !description || !content) {
      return new Response(JSON.stringify({ error: 'Заповніть усі обов\'язкові поля (Заголовок, Слаг, Опис, Текст)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanSlug) {
      return new Response(JSON.stringify({ error: 'Некоректний слаг' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const githubToken = env.GITHUB_TOKEN;
    const githubRepo = env.GITHUB_REPO;
    const branch = env.GITHUB_BRANCH || 'main';

    if (!githubToken || !githubRepo) {
      return new Response(JSON.stringify({ error: 'Налаштування сервера не завершені (відсутній GITHUB_TOKEN або GITHUB_REPO)' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Upload image to GitHub if present
    let imageRelativePath = existingImage || 'img_new/logo.jpg';

    if (imageFile && imageFile.size > 0) {
      const arrayBuffer = await imageFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Content = btoa(binary);

      const fileExt = imageFile.name ? imageFile.name.substring(imageFile.name.lastIndexOf('.')) : '.jpg';
      const uniqueName = `blog-${cleanSlug}-${Date.now()}${fileExt}`;
      const imagePath = `img_new/${uniqueName}`;

      const uploadUrl = `https://api.github.com/repos/${githubRepo}/contents/${imagePath}`;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Cloudflare-Pages-Function',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `feat: upload image for post ${cleanSlug}`,
          content: base64Content,
          branch: branch
        })
      });

      if (!uploadResponse.ok) {
        const uploadErr = await uploadResponse.json();
        console.error('GitHub image upload failed:', uploadErr);
        return new Response(JSON.stringify({ error: `Не вдалося завантажити зображення: ${uploadErr.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      imageRelativePath = `img_new/${uniqueName}`;
    }

    // 3. Fetch and update blog_posts.json from GitHub
    const postsUrl = `https://api.github.com/repos/${githubRepo}/contents/blog_posts.json?ref=${branch}`;
    const getResponse = await fetch(postsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Cloudflare-Pages-Function'
      }
    });

    let posts = [];
    let sha = null;

    if (getResponse.ok) {
      const fileData = await getResponse.json();
      sha = fileData.sha;

      const decodedContent = decodeURIComponent(
        atob(fileData.content.replace(/\s/g, ''))
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      try {
        posts = JSON.parse(decodedContent);
      } catch (e) {
        console.error('Failed to parse blog_posts.json:', e);
        posts = [];
      }
    }

    // 4. Prepend new/updated post
    const newPost = {
      slug: cleanSlug,
      title: title.trim(),
      category: category || 'general',
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      description: description.trim(),
      content: content.trim(),
      date: date || new Date().toISOString().split('T')[0],
      image: imageRelativePath
    };

    posts = posts.filter(p => p.slug !== cleanSlug);
    posts.unshift(newPost);

    // Encode content to Base64 (UTF-8 safe)
    const jsonString = JSON.stringify(posts, null, 2);
    const utf8Bytes = new TextEncoder().encode(jsonString);
    let binaryJson = '';
    for (let i = 0; i < utf8Bytes.byteLength; i++) {
      binaryJson += String.fromCharCode(utf8Bytes[i]);
    }
    const base64Json = btoa(binaryJson);

    // Save updated blog_posts.json to GitHub
    const saveResponse = await fetch(`https://api.github.com/repos/${githubRepo}/contents/blog_posts.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Cloudflare-Pages-Function',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `feat: publish post ${cleanSlug} via admin panel`,
        content: base64Json,
        sha: sha,
        branch: branch
      })
    });

    if (!saveResponse.ok) {
      const saveErr = await saveResponse.json();
      console.error('GitHub blog_posts.json save failed:', saveErr);
      return new Response(JSON.stringify({ error: `Не вдалося зберегти статтю в базу: ${saveErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Статтю збережено. Почався процес генерації сайту!' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Posts function error:', err);
    return new Response(JSON.stringify({ error: 'Внутрішня помилка сервера' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete({ request, env }) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const { token, slug } = await request.json();

    // 1. Verify HMAC-signed token
    const auth = await verifySignedToken(token, env);
    if (!auth.valid) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status || 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Слаг статті обов\'язковий для видалення' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const githubToken = env.GITHUB_TOKEN;
    const githubRepo = env.GITHUB_REPO;
    const branch = env.GITHUB_BRANCH || 'main';

    if (!githubToken || !githubRepo) {
      return new Response(JSON.stringify({ error: 'Налаштування сервера не завершені' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Fetch and update blog_posts.json
    const postsUrl = `https://api.github.com/repos/${githubRepo}/contents/blog_posts.json?ref=${branch}`;
    const getResponse = await fetch(postsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Cloudflare-Pages-Function'
      }
    });

    if (!getResponse.ok) {
      return new Response(JSON.stringify({ error: 'Не вдалося отримати список статей з GitHub' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const fileData = await getResponse.json();
    const sha = fileData.sha;

    const decodedContent = decodeURIComponent(
      atob(fileData.content.replace(/\s/g, ''))
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    let posts = [];
    try {
      posts = JSON.parse(decodedContent);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Помилка парсингу списку статей' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const postToDelete = posts.find(p => p.slug === slug);
    if (!postToDelete) {
      return new Response(JSON.stringify({ error: 'Статтю не знайдено в списку' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const updatedPosts = posts.filter(p => p.slug !== slug);

    const jsonString = JSON.stringify(updatedPosts, null, 2);
    const utf8Bytes = new TextEncoder().encode(jsonString);
    let binaryJson = '';
    for (let i = 0; i < utf8Bytes.byteLength; i++) {
      binaryJson += String.fromCharCode(utf8Bytes[i]);
    }
    const base64Json = btoa(binaryJson);

    const saveResponse = await fetch(`https://api.github.com/repos/${githubRepo}/contents/blog_posts.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Cloudflare-Pages-Function',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `chore: delete post ${slug} via admin panel`,
        content: base64Json,
        sha: sha,
        branch: branch
      })
    });

    if (!saveResponse.ok) {
      return new Response(JSON.stringify({ error: 'Не вдалося зберегти оновлений список статей на GitHub' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Delete the blog-${slug}.html file from GitHub if it exists
    const htmlFileUrl = `https://api.github.com/repos/${githubRepo}/contents/blog-${slug}.html?ref=${branch}`;
    const getHtmlResponse = await fetch(htmlFileUrl, {
      method: 'GET',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Cloudflare-Pages-Function'
      }
    });

    if (getHtmlResponse.ok) {
      const htmlFileData = await getHtmlResponse.json();
      const htmlSha = htmlFileData.sha;

      await fetch(`https://api.github.com/repos/${githubRepo}/contents/blog-${slug}.html`, {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Cloudflare-Pages-Function',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `chore: delete generated file blog-${slug}.html`,
          sha: htmlSha,
          branch: branch
        })
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Статтю успішно видалено! Сайт оновлюється.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Delete function error:', err);
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
