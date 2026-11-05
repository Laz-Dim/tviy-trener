# Проєкт «Твій Тренер» (tviy-trener)

Офіційна веб-платформа персонального тренера **Іллі Поліщука** (м. Львів) з інтегрованою системою реєстрації клієнтів через Telegram, динамічною відеотекою YouTube, блогом зі статичною генерацією (SSG) та безпарольною панеллю адміністрування.

---

## 🚀 Демо та продакшн-посилання

У репозиторії розгорнуто **дві паралельні версії сайту** на базі **Cloudflare Pages**:

| Версія | Дизайн / Концепція | Гілка Git | Живе посилання |
| :--- | :--- | :--- | :--- |
| **Версія 1 (V1)** | **Класичний атлетичний дизайн**: чистий авторський CSS, фірмові контрастні акценти, олдскульний стиль залу. | [`main`](https://github.com/Laz-Dim/tviy-trener/tree/main) | 🔗 [https://tviy-trener.pages.dev](https://tviy-trener.pages.dev) |
| **Версія 2 (V2)** | **Преміальний темний бруталізм**: Tailwind CSS, динамічний Ken Burns слайдер, 3D flip-картка регалій, анімовані лічильники. | [`v2`](https://github.com/Laz-Dim/tviy-trener/tree/v2) | 🔗 [https://tviy-trener-v2.pages.dev](https://tviy-trener-v2.pages.dev) |

*Цільовий домен після фінального вибору версії:* `tviy-trener.com` / `www.tviy-trener.com`.

---

## ⚡ Архітектурний стек

Сайт побудований за принципом **Serverless JAMstack**:
- **Хостинг:** Cloudflare Pages (швидка глобальна доставка статики на CDN edge).
- **Бекенд (Serverless API):** Cloudflare Pages Functions (V8 Worker runtime у папці [`functions/api/`](./functions/api/)).
- **Сховище стану:** Cloudflare Workers KV (`OTP_KV`) для одноразових кодів входу (OTP) та лімітів запитів.
- **База даних контенту (Git-as-a-CMS):** статті зберігаються у [`blog_posts.json`](./blog_posts.json), відео — у [`videos_data.json`](./videos_data.json).
- **SSG-генератор блогу:** [`generate_blog.py`](./generate_blog.py) (конвертує Markdown у SEO-валідно розмічені сторінки `blog-*.html` та генерує [`sitemap.xml`](./sitemap.xml)).
- **CI/CD:** [GitHub Actions Workflow](./.github/workflows/update-site.yml) автоматично синхронізує відео з YouTube, перегенеровує статті та деплоїть проєкт на Cloudflare Pages.

---

## 🔒 Безпека та ключові фічі

1. **Безпарольний вхід в адмінку (Telegram OTP):**
   - Доступ до `/admin.html` надається лише верифікованим Telegram ID (тренер та адміністратор).
   - Код генерується на 5 хвилин і надсилається особисто в Telegram через бота.
   - Сесія підписується на edge за стандартом **HMAC-SHA256** за допомогою Web Crypto API. Будь-які спроби фальсифікації сесій відхиляються з кодом `401 Unauthorized`.
2. **Захист форми запису від спаму та атак:**
   - **Honeypot-пастка** для виявлення автоматизованих ботів.
   - **Edge Rate Limiting** у Workers KV (не більше 3 заявок на 15 хвилин з однієї IP-адреси).
   - Клієнтське блокування у `localStorage`.
   - Миттєва доставка заявок тренеру та адміністратору в Telegram.
3. **SEO та мікророзмітка:**
   - Повна підтримка Open Graph та Twitter Cards для кожної статті.
   - Мікророзмітка Schema.org: `Person`, `SportsActivityLocation`, `BlogPosting`.
   - Валідний XML-сайтмап [`sitemap.xml`](./sitemap.xml) та [`robots.txt`](./robots.txt).

---

## 📂 Структура репозиторію

```text
├── .github/workflows/
│   └── update-site.yml        # CI/CD: автозбір YouTube, генерація блогу та деплой
├── functions/api/             # Cloudflare Pages Functions (Serverless Edge API)
│   ├── register.js            # POST /api/register (заявки + сповіщення в Telegram)
│   └── admin/
│       ├── send-code.js       # POST /api/admin/send-code (генерація OTP в Telegram)
│       ├── verify-code.js     # POST /api/admin/verify-code (перевірка OTP + HMAC JWT)
│       └── posts.js           # GET, POST, DELETE /api/admin/posts (GitHub Contents API)
├── docs/
│   └── DOCUMENTATION.md       # Повна технічна документація проєкту
├── icons/                     # SVG піктограми для переваг та секцій
├── img_new/                   # Фотографії зали, тренера та обкладинки статей
├── admin.html / admin.js      # Панель управління статтями блогу
├── blog-template.html         # Шаблон сторінки статті блогу
├── blog-*.html                # Згенеровані статичні HTML-сторінки статей
├── blog_posts.json            # База даних статей блогу
├── generate_blog.py           # SSG-генератор блогу та sitemap.xml
├── get_videos.py              # Синхронізатор відео з YouTube Data API v3
├── index.html / app.js        # Головна сторінка сайту та клієнтські скрипти
├── style.css                  # Стилі для Версії 1 (у Версії 2 використовується Tailwind CSS)
├── videos_data.json           # Закешовані відео та Shorts з YouTube
└── wrangler.toml              # Конфігурація Cloudflare Pages та Workers KV
```

---

## 🛠️ Локальна розробка

### 1. Передумови
- Python 3.9+
- Node.js 18+ (для Wrangler CLI)

### 2. Встановлення залежностей
```bash
pip install -r requirements.txt
```

### 3. Локальний запуск статичного сайту
```bash
# Будь-яким локальним веб-сервером:
python -m http.server 8000
# Відкрийте у браузері: http://localhost:8000
```

### 4. Локальний запуск з емуляцією Cloudflare Functions (API)
```bash
npx wrangler pages dev .
```

### 5. Ручна регенерація блогу
```bash
python generate_blog.py
```

---

## 📖 Детальна інженерна документація

Повний технічний розбір внутрішньої логіки, архітектури безпеки, змінних оточення та інструкції з перенесення домену знаходиться у файлі:  
👉 **[`docs/DOCUMENTATION.md`](./docs/DOCUMENTATION.md)**
