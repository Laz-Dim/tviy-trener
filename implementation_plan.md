# План реалізації — Сайт тренера Іллі (Оновлено)

**Мета:** Легкий статичний сайт, що розміщується на безкоштовному/дешевому хостингу (GitHub Pages, Netlify, Cloudflare Pages, Vercel). Без тяжелого бекенду — максимум статики + GitHub Actions для автоматизації.

---

## Архітектура (проста та статична)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  GitHub Actions │────▶│  Static Site     │────▶│  Hosting        │
│  (щоденно)      │     │  (HTML + JS)     │     │  (Pages)        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
  YouTube API           videos_data.json          CDN (глобально)
  (отримуємо відео)     blog_posts.json           HTTPS, швидко
                        sitemap.xml
                        robots.txt
                        Огенеровані blog-*.html
```

**Технології:** Vanilla JS (ES modules) + HTML + CSS. Без React/Vue/빌д-інструментів — просто файли, що працюють у браузері.

---

## 1. Очищення проекту (Видалити зайве)

| Файл/папка | Причина | Статус |
|------------|---------|--------|
| `download_audio.py` | Не потрібен | ✅ Видалено |
| `generate_blog_posts.py` | Не потрібен | ✅ Видалено |
| `get_transcripts.py` | Не потрібен | ✅ Видалено |
| `process_video.sh` | Не потрібен | ✅ Видалено |
| `send_to_telegram.py` | Не потрібен (Telegram лише для автологіну в адмінці) | ✅ Видалено |
| `videos_data_with_transcripts.json` | Не потрібен | ✅ Видалено |
| `posts/` директорія | Старі статті — перенести в `blog_posts.json` | ⚠️ Залишився (блокування системи) |
| Усі `*.vtt` файли | Транскрипції не потрібні | ✅ Видалено |
| `server.js`, `package.json` (Express частина) | Не потрібен бекенд | ✅ Видалено |
| `.github/workflows/` (старі) | Перепишемо під нову архітектуру | ✅ Переписано |

**Залишити/створити:**
- ✅ `index.html` — головна сторінка (оновлено)
- ✅ `style.css` — стилі (оновлено з відео-філтрами, бейджами)
- ✅ `app.js` — логіка фронтенду (ES module)
- ✅ `admin.html` — адмінка (отдельна сторінка)
- ✅ `admin.js` — логіка адмінки
- ✅ `blog-template.html` — шаблон для генерації статей
- ✅ `get_videos.py` — оновлений скрипт для YouTube Data API v3
- ✅ `generate_blog.py` — новий скрипт для генерації `blog-*.html` + `sitemap.xml`
- ✅ `.github/workflows/update-site.yml` — єдиний workflow
- ✅ `videos_data.json` — дані відео (генерується, є приклад)
- ✅ `blog_posts.json` — дані статей (ручні + можливо авто)
- ✅ `sitemap.xml`, `robots.txt` — SEO (генеруються)
- ✅ `functions/admin/send-code.js` — Worker для відправки OTP
- ✅ `functions/admin/verify-code.js` — Worker для перевірки OTP
- ✅ `wrangler.toml` — Cloudflare Pages конфіг
- ✅ `.env.example` — приклад змінних середовища

---

## 2. Секція "Корисні відео" — Автооновлення з YouTube ✅ **РЕАЛІЗОВАНО**

### 2.1 Python-скрипт `get_videos.py` (запускається в GitHub Actions)

```python
# Що робить:
# 1. Використовує YouTube Data API v3 (потрібен API ключ)
# 2. Отримує канал @tviy_trener (channel_id або @handle)
# 3. Забирає останні ~50 відео (-longs + shorts)
# 4. Для кожного: video_id, title, url, thumbnail, published_at, type (video/short)
# 5. Зберігає в videos_data.json (масив об'єктів, новіші першими)
# 6. Не перезаписує існуючі — лише додає нові (дедуп по video_id)
```

**GitHub Secrets:** `YOUTUBE_API_KEY` (створюється в Google Cloud Console)

### 2.2 Фронтенд (`app.js`)

- При завантаженні `index.html` → `fetch('videos_data.json')`
- Рендерить картки в секції `#videos` з `id="videos-grid"`
- Фільтр: All / Videos / Shorts (таби `.video-filter-tab`)
- Кнопка "Показати ще" (пагінація по 6 штук, `#load-more-videos`)
- Schema.org `VideoObject` мікророзмітка в HTML карток
- Бейдж "Shorts" для коротких відео
- Дата публікації, посилання на YouTube

---

## 3. Секція "Нотатки тренера" — Ручне додавання через адмінку ✅ **РЕАЛІЗОВАНО**

### 3.1 Адмінка (`admin.html` + `admin.js`) — Telegram OTP логін

**Flow:**
1. Ілля відкриває `https://tviy-trener.com/admin.html`
2. Вводить свій Telegram `chat_id` (захардкоджено `5192950042`)
3. Натискає "Отримати код" → Cloudflare Worker надсилає 6-значний код ботом
4. Ілля вводить код → якщо валідний → `sessionStorage.setItem('admin_token', jwt)`
5. Відкривається форма створення нотатки

**Worker endpoints:**
- `POST /api/admin/send-code` — надсилає код в Telegram
- `POST /api/admin/verify-code` — перевіряє код, видає JWT токен

### 3.2 Форма нотатки (після логіну)

Поля:
- ✅ Заголовок (обов'язково)
- ✅ Slug / ЧПУ (автогенерується з заголовку, редагується)
- ✅ Категорія: `nutrition` / `training` / `mindset` / `recovery` / `boxing` / `general`
- ✅ Теги (через кому)
- ✅ Короткий опис (для прев'ю)
- ✅ Повний текст (Markdown — заголовки, **жирний**, *курсив*, списки, посилання, зображення)
- ✅ Фото (опціонально) — `input type="file"` з preview
- ✅ Дата публікації (за замовчуванням сьогодні)

### 3.3 Генерація статичної сторінки нотатки

При натисканні "Опублікувати":
1. Worker (або GitHub Action) бере `blog-template.html`
2. Підставляє дані: title, description, content (Markdown → HTML), date, slug, image, schema.org `BlogPosting`
3. Зберігає як `blog-{slug}.html` в корінь
4. Оновлює `blog_posts.json` (додає об'єкт на початок масиву)
5. Регенерує `sitemap.xml`
6. Комітить і пушить в `main` → хостинг автоматично перебудовує

---

## 4. GitHub Actions Workflow (`.github/workflows/update-site.yml`) ✅ **СТВОРЕНО**

```yaml
name: Update Site Data

on:
  schedule:
    - cron: '0 6 * * *'  # щоденно о 06:00 UTC
  workflow_dispatch:      # ручний запуск

permissions:
  contents: write

jobs:
  update-videos:
    name: Fetch YouTube Videos
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { token: ${{ secrets.GH_PAT }} }
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r requirements.txt
      - env: { YOUTUBE_API_KEY: ${{ secrets.YOUTUBE_API_KEY }} }
        run: python get_videos.py
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add videos_data.json
          git diff --staged --quiet || git commit -m "chore: update videos data [skip ci]"
          git push

  generate-blog:
    name: Generate Blog Pages
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && contains(github.event.head_commit.modified, 'blog_posts.json') || github.event_name == 'workflow_dispatch'
    steps:
      - uses: actions/checkout@v4
        with: { token: ${{ secrets.GH_PAT }} }
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r requirements.txt
      - run: python generate_blog.py
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add blog-*.html sitemap.xml blog_posts.json
          git diff --staged --quiet || git commit -m "chore: generate blog pages + sitemap [skip ci]"
          git push
```

**requirements.txt:**
```
google-api-python-client
python-dotenv
```

---

## 5. SEO та статична генерація ✅ **РЕАЛІЗОВАНО**

| Файл | Як створюється |
|------|----------------|
| `sitemap.xml` | `generate_blog.py` при пуші `blog_posts.json` |
| `robots.txt` | Статичний файл на корені |
| `blog-*.html` | `generate_blog.py` з `blog-template.html` + `blog_posts.json` |
| Schema.org | В `blog-template.html` (BlogPosting), в картках відео (VideoObject), в `index.html` (Person, SportsActivityLocation) |
| Canonical | `<link rel="canonical" href="https://tviy-trener.com/...">` на всіх сторінках |
| OG / Twitter | Метатеги в шаблоні та `index.html` |

---

## 6. Хостинг — вибір безкоштовного тарифу

| Платформа | Статичні сайти | Functions (для Telegram OTP) | Custom Domain | Плейсхолдер |
|-----------|----------------|-------------------------------|---------------|-------------|
| **Cloudflare Pages** | ✅ Безкоштовно (unlimited) | ✅ Workers (100k/день безкоштовно) | ✅ | **Найкращий вибір** |
| Netlify | ✅ 100GB/міс | ✅ Functions (125k/міс) | ✅ | Добре |
| GitHub Pages | ✅ Безкоштовно | ❌ (потрібен окремий Workers/Functions) | ✅ | Просте, але без Functions |
| Vercel | ✅ Безкоштовно | ✅ Functions | ✅ | Добре |

**Рекомендація: Cloudflare Pages + Cloudflare Workers**
- Всі в одній екосистемі
- Workers для Telegram OTP функцій
- Безкоштовний CDN, DDoS захист, SSL
- Простий деплой: `wrangler pages deploy .` або через GitHub інтеграцію

---

## 7. Структура файлів (фінальна)

```
tviy-trener/
├── index.html              # Головна сторінка ✅
├── admin.html              # Адмінка (окрема сторінка) ✅
├── blog-template.html      # Шаблон для нотаток ✅
├── style.css               # Стилі ✅
├── app.js                  # Фронтенд логіка (відео, нотатки список) ✅
├── admin.js                # Адмінка логіка (логін, форма) ✅
├── generate_blog.py        # Генерує blog-*.html + sitemap.xml ✅
├── get_videos.py           # Отримує відео з YouTube API ✅
├── requirements.txt        # python deps ✅
├── videos_data.json        # (генерується) дані відео ✅
├── blog_posts.json         # (ручне + генерується) мета даних нотаток ✅
├── sitemap.xml             # (генерується) ✅
├── robots.txt              # (статичний) ✅
├── .env.example            # приклад змінних середовища ✅
├── img/
│   └── notes/              # фото для нотаток (створиться автоматично)
├── .github/
│   └── workflows/
│       └── update-site.yml # Щоденний оновлення відео + генерація блогу ✅
├── functions/              # Cloudflare Workers ✅
│   ├── admin/
│   │   ├── send-code.js    # POST /api/admin/send-code ✅
│   │   └── verify-code.js  # POST /api/admin/verify-code ✅
└── wrangler.toml           # Cloudflare Pages конфіг ✅
```

---

## 8. Послідовність реалізації (пріоритези) — **ВИКОНАНО**

### ✅ Етап 1: Фундамент (ВИКОНАНО)
- [x] Видалити всі зайві файли
- [x] Створити базовий `index.html` + `style.css` + `app.js` (скелет)
- [x] Створити `admin.html` + `admin.js`
- [x] Створити `blog-template.html`
- [x] Створити `generate_blog.py` + `get_videos.py`
- [x] Створити `.github/workflows/update-site.yml`
- [x] Створити Cloudflare Workers (`functions/`)
- [x] Створити `wrangler.toml`, `robots.txt`, `.env.example`
- [x] Перевірити генерацію блогу: `python generate_blog.py` ✅

### 🔄 Етап 2: Налаштування Cloudflare Pages (ПОТРІБНО ЗРОБИТИ)
- [ ] Створити проект на Cloudflare Pages, підключити GitHub репозиторій
- [ ] Створити KV namespace `OTP_KV` для Workers
- [ ] Додати Secrets в Cloudflare:
  - `TELEGRAM_BOT_TOKEN`
  - `ADMIN_CHAT_ID` = `5192950042`
- [ ] Розгорнути на `*.pages.dev` подомені — перевірити що працює
- [ ] Налаштувати кастомний домен `tviy-trener.com`

### 🔄 Етап 3: Налаштування GitHub Actions (ПОТРІБНО ЗРОБИТИ)
- [ ] Отримати YouTube Data API v3 ключ → GitHub Secrets (`YOUTUBE_API_KEY`)
- [ ] Створити GitHub Personal Access Token (repo scope) → GitHub Secrets (`GH_PAT`)
- [ ] Перевірити запуск workflow вручну (`workflow_dispatch`)

### 🔄 Етап 4: Тестування адмінки (ПОТРІБНО ЗРОБИТИ)
- [ ] Отримати Telegram Bot Token від Іллі → додати в Cloudflare Workers Secrets
- [ ] Протестувати логін через admin.html
- [ ] Створити тестову нотатку через адмінку
- [ ] Перевірити автогенерацію `blog-*.html` + `sitemap.xml` при пуші

### 🔄 Етап 5: Фінал (ПОТРІБНО ЗРОБИТИ)
- [ ] Перевірити `sitemap.xml`, `robots.txt`
- [ ] Перевірити Canonical, OG, Twitter метатеги на всіх сторінках
- [ ] Налаштувати кастомний домен `tviy-trener.com` на Cloudflare Pages
- [ ] Передати Іллі інструкцію: як зайти в адмінку, як додати нотатку

---

## 9. Змінні середовища / Secrets

| Де зберігається | Змінна | Призначення | Статус |
|------------------|--------|-------------|--------|
| GitHub Secrets | `YOUTUBE_API_KEY` | YouTube Data API v3 | ⏳ Потрібно |
| GitHub Secrets | `GH_PAT` | Personal Access Token (repo scope) для комітів | ⏳ Потрібно |
| GitHub Secrets | `TELEGRAM_BOT_TOKEN` | Токен бота (дублювання для Workers) | ⏳ Потрібно |
| Cloudflare Workers KV / Secrets | `TELEGRAM_BOT_TOKEN` | Токен бота для відправки кодів | ⏳ Потрібно |
| Cloudflare Workers KV / Secrets | `ADMIN_CHAT_ID` | `5192950042` — куди слати коди | ⏳ Потрібно |
| Cloudflare Pages Env Vars | -- | не потрібні (статика) | ✅ Готово |

---

## 10. Що НЕ потрібно (в основі твого запиту)

- ❌ Express/Node.js бекенд — не потрібен для статичного хостингу
- ❌ База даних — JSON файли в репозиторії = "база даних"
- ❌ Docker, VPS, сервер — надлишок
- ❌ Складна авторизація (OAuth, JWT, сесії) — простий OTP через Telegram + GitHub PAT для пушу
- ❌ Білд-кіт (Vite, Webpack) — vanilla JS працює нативно
- ❌ Python-скрипти для аудіо/транскрипцій — видаляємо

---

## 11. Резюме: чому це спрацює на легкому хостингу

1. **Всі обчислення — або в GitHub Actions (безкоштовно), або в Cloudflare Workers (безкоштовно до 100k/день), або в браузері користувача**
2. **Хостинг — лише статичні файли (HTML, CSS, JS, JSON, зображення)**
3. **GitHub Actions запускається по розкладю + при пуші з адмінки**
4. **Cloudflare Workers обробляє лише 2 легкі ендпоінти для Telegram OTP**
5. **Жодного постійно працюючого сервера, БД, контейнерів**
6. **Деплой — просто `git push` (або автоматично через Cloudflare Pages інтеграцію)**

---

## 📋 Чек-лист для розгортання (NEXT STEPS)

### 1. Cloudflare Pages Setup
```bash
# Встановити Wrangler
npm install -g wrangler

# Увійти в Cloudflare
wrangler login

# Створити KV namespace
wrangler kv:namespace create "OTP_KV"
wrangler kv:namespace create "OTP_KV" --preview

# Задеплоїти (або через GitHub інтеграцію в dashboard)
wrangler pages deploy .
```

### 2. Cloudflare DashboardSettings
- Workers & Pages → KV → Create namespace `OTP_KV` (записати ID в wrangler.toml)
- Workers & Pages → [your-project] → Settings → Environment variables:
  - `TELEGRAM_BOT_TOKEN` = [токен від Іллі]
  - `ADMIN_CHAT_ID` = `5192950042`

### 3. GitHub Repository Settings
- Settings → Secrets and variables → Actions → New repository secret:
  - `YOUTUBE_API_KEY` = [з Google Cloud Console]
  - `GH_PAT` = [Personal Access Token з repo scope]
  - `TELEGRAM_BOT_TOKEN` = [той самий, що й в Cloudflare]

### 4. Google Cloud Console
- Створити проект → Enable YouTube Data API v3
- Credentials → Create API Key → обмежити по HTTP referrers (github.com, cloudflare workers)

### 5. Тестування
1. Зайти на `https://<project>.pages.dev/admin.html`
2. Ввести `5192950042` → "Отримати код"
3. Перевірити Telegram → ввести код → "Увійти"
4. Створити нотатку → "Опублікувати"
5. Перевірити, що з'явився коміт в GitHub з новим `blog-*.html`
6. Перевірити сайт — нова сторінка доступна

---

**Готовність: ~85%** — основна архітектура реалізована, залишився деплой та налаштування секретів.