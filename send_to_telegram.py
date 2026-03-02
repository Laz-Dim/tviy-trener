import json
import requests
import datetime
import os
import sys

# Конфігурація
# Використовуємо змінні середовища для секретів
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
BASE_URL = os.getenv("BASE_URL", "https://illya-polishchuk.lviv.ua/")

START_DATE = datetime.datetime(2025, 3, 1)
POSTS_FILE = "blog_posts.json"
SENT_LOG = "sent_posts.log"

def get_diff_days():
    """Рахує кількість днів від дати старту"""
    now = datetime.datetime.now()
    # Скидаємо час до початку дня для коректного розрахунку
    today = datetime.datetime(now.year, now.month, now.day)
    delta = today - START_DATE
    return delta.days

def send_to_telegram(post):
    """Надсилає пост в Телеграм"""
    # Формуємо текст з розміткою Markdown
    # Обрізаємо занадто довгий текст для caption (ліміт Телеграм ~1024 симв. для фото)
    title = post.get('title') or "Нотатка тренера"
    preview = post.get('preview', '')[:500] + "..." if len(post.get('preview', '')) > 500 else post.get('preview', '')

    # Використовуємо BASE_URL для формування посилання
    site_url = f"{BASE_URL.rstrip('/')}/#blog"

    text = f"📢 *{title}*\n\n{preview}\n\n🔗 [Читати повністю на сайті]({site_url})\n\n📺 [Дивитись відео]({post.get('url', '')})"

    url = f"https://api.telegram.org/bot{TOKEN}/sendPhoto"
    data = {
        "chat_id": CHAT_ID,
        "photo": post.get('thumbnail'),
        "caption": text,
        "parse_mode": "Markdown"
    }

    try:
        response = requests.post(url, data=data, timeout=10)
        return response.json()
    except Exception as e:
        return {"ok": False, "description": str(e)}

def main():
    if not TOKEN or not CHAT_ID:
        print("Помилка: Необхідно налаштувати TELEGRAM_BOT_TOKEN та TELEGRAM_CHAT_ID у змінних середовища.")
        return

    # Перевірка на аргумент командного рядка для тестування конкретного офсету
    if len(sys.argv) > 1:
        try:
            diff_days = int(sys.argv[1])
            print(f"Тестовий режим: використовуємо зміщення {diff_days}")
        except ValueError:
            print("Використовуйте: python send_to_telegram.py [offset_number]")
            return
    else:
        diff_days = get_diff_days()
        print(f"Поточний зміщення (дні): {diff_days}")

    if diff_days < 0:
        print("Реліз ще не розпочався. Перший пост буде 1 березня 2025.")
        return

    if not os.path.exists(POSTS_FILE):
        print(f"Помилка: Файл {POSTS_FILE} не знайдено.")
        return

    try:
        with open(POSTS_FILE, 'r', encoding='utf-8') as f:
            posts = json.load(f)
    except Exception as e:
        print(f"Помилка при зчитуванні {POSTS_FILE}: {e}")
        return

    # Шукаємо пост для сьогоднішнього дня
    today_post = None
    for post in posts:
        if post.get('date_offset') == diff_days:
            today_post = post
            break

    if not today_post:
        print(f"Пост для дня {diff_days} не знайдено у файлі.")
        return

    post_id = today_post.get('id', 'unknown')

    # Перевіряємо чи не надсилали ми цей пост раніше сьогодні
    if os.path.exists(SENT_LOG):
        try:
            with open(SENT_LOG, 'r') as f:
                sent_ids = f.read().splitlines()
            if post_id in sent_ids:
                print(f"Пост {post_id} вже був надісланий.")
                return
        except Exception as e:
            print(f"Помилка при читанні {SENT_LOG}: {e}")

    print(f"Надсилаємо пост: {today_post.get('title')}")
    res = send_to_telegram(today_post)

    if res.get('ok'):
        try:
            with open(SENT_LOG, 'a') as f:
                f.write(post_id + "\n")
            print("Успішно надіслано в Telegram!")
        except Exception as e:
            print(f"Помилка при записі в {SENT_LOG}: {e}")
    else:
        print(f"Помилка при надсиланні: {res.get('description')}")
        if 'error_code' in res:
            print(f"Код помилки: {res['error_code']}")

if __name__ == "__main__":
    main()
