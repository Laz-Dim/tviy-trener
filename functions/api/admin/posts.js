/**
 * Cloudflare Pages Function: Create and save blog posts via GitHub API
 * POST /api/admin/posts
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
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

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
    const imageFile = formData.get('image'); // File object
    const existingImage = formData.get('existingImage');

    // 1. Verify token
    if (!token) {
      return new Response(JSON.stringify({ error: 'Необхідна авторизація' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let telegramId;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token format');
      const payload = JSON.parse(atob(parts[1]));
      if (Date.now() / 1000 > payload.exp) {
        return new Response(JSON.stringify({ error: 'Термін дії сесії закінчився. Увійдіть знову.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      telegramId = payload.sub;
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Некоректний або прострочений токен' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Security check: Verify allowed ID
    const trainerChatId = env.TELEGRAM_TRAINER_CHAT_ID || '5192950042';
    const adminChatId = env.TELEGRAM_ADMIN_CHAT_ID || env.ADMIN_CHAT_ID || '143220916';
    const allowedIds = [trainerChatId, adminChatId].filter(Boolean).map(String);

    if (allowedIds.length > 0 && !allowedIds.includes(String(telegramId))) {
      return new Response(JSON.stringify({ error: 'Доступ заборонено: невідомий користувач' }), {
        status: 403,
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
    const githubRepo = env.GITHUB_REPO; // e.g. "Laz-Dim/tviy-trener"
    const branch = env.GITHUB_BRANCH || 'main';

    if (!githubToken || !githubRepo) {
      return new Response(JSON.stringify({ error: 'Налаштування сервера не завершені (відсутній GITHUB_TOKEN або GITHUB_REPO)' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Upload image to GitHub if present
    let imageRelativePath = existingImage || 'img_new/logo.jpg'; // default fallback

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

      // Upload file via GitHub API
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
      
      // Decode content (UTF-8 safe)
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

    // 4. Prepend new post
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

    // Remove if post with same slug already exists (update)
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
        sha: sha, // required if file exists
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
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

  try {
    const { token, slug } = await request.json();
    
    // 1. Verify token
    if (!token) {
      return new Response(JSON.stringify({ error: 'Необхідна авторизація' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let telegramId;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token format');
      const payload = JSON.parse(atob(parts[1]));
      if (Date.now() / 1000 > payload.exp) {
        return new Response(JSON.stringify({ error: 'Термін дії сесії закінчився. Увійдіть знову.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      telegramId = payload.sub;
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Некоректний або прострочений токен' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Security check: Verify allowed ID
    const trainerChatId = env.TELEGRAM_TRAINER_CHAT_ID || '5192950042';
    const adminChatId = env.TELEGRAM_ADMIN_CHAT_ID || env.ADMIN_CHAT_ID || '143220916';
    const allowedIds = [trainerChatId, adminChatId].filter(Boolean).map(String);

    if (allowedIds.length > 0 && !allowedIds.includes(String(telegramId))) {
      return new Response(JSON.stringify({ error: 'Доступ заборонено: невідомий користувач' }), {
        status: 403,
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
    
    // Decode content
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

    // Filter out the post to delete
    const postToDelete = posts.find(p => p.slug === slug);
    if (!postToDelete) {
      return new Response(JSON.stringify({ error: 'Статтю не знайдено в списку' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const updatedPosts = posts.filter(p => p.slug !== slug);

    // Encode back
    const jsonString = JSON.stringify(updatedPosts, null, 2);
    const utf8Bytes = new TextEncoder().encode(jsonString);
    let binaryJson = '';
    for (let i = 0; i < utf8Bytes.byteLength; i++) {
      binaryJson += String.fromCharCode(utf8Bytes[i]);
    }
    const base64Json = btoa(binaryJson);

    // Save updated json
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

    // 3. Attempt to delete the blog-${slug}.html file from GitHub
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

      // Send delete request
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
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}
