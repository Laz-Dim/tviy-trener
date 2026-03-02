import json
import re
import os

def format_with_ai_style(text, title):
    """
    Імітуємо обробку тексту через GPT: додаємо пунктуацію, структуру та акценти.
    Для реального проєкту тут буде виклик OpenAI API.
    """
    if not text:
        return ""

    # Видаляємо зайві пробіли та символи
    text = re.sub(r'\s+', ' ', text).strip()

    # Просте розбиття на речення за припущенням про пунктуацію (якщо вона вже є частково)
    sentences = re.split(r'(?<=[.!?])\s+', text)

    # 1. Додаємо вступ на основі назви
    ai_text = f"💡 **Про що це відео:** {title}\n\n"

    # 2. Формуємо основний зміст із булет-поінтами
    # Імітуємо логічні блоки: кожні 4-5 речень робимо абзацом або пунктом
    paragraphs = []
    current_chunk = []
    for i, sentence in enumerate(sentences):
        current_chunk.append(sentence)
        if (i + 1) % 5 == 0:
            para = " ".join(current_chunk)
            if i < 10: # Перші блоки робимо абзацами
                paragraphs.append(para)
            else: # Далі робимо список порад
                paragraphs.append(f"✅ {para}")
            current_chunk = []

    if current_chunk:
        paragraphs.append(" ".join(current_chunk))

    ai_text += "\n\n".join(paragraphs)

    # 3. Додаємо фінальний заклик
    ai_text += "\n\n--- \n🚀 **Порада від Іллі:** Не просто дивись — дій! Тренуйся розумно та бережи своє здоров'я."

    return ai_text

def main():
    try:
        with open('videos_data_with_transcripts.json', 'r', encoding='utf-8') as f:
            videos = json.load(f)
    except FileNotFoundError:
        print("videos_data_with_transcripts.json not found")
        return

    if not os.path.exists('posts'):
        os.makedirs('posts')

    blog_summary = []
    for i, video in enumerate(videos):
        raw_text = video.get('transcript') or video['title']

        # Очищуємо заголовок
        title = re.sub(r'#\w+', '', video['title']).strip()
        title = re.sub(r'\s+', ' ', title)

        # Обробляємо текст в AI стилі
        ai_processed_text = format_with_ai_style(raw_text, title)

        post_id = video['id']

        summary_entry = {
            "id": post_id,
            "title": title,
            "url": video['url'],
            "thumbnail": video['thumbnail'],
            "preview": raw_text[:150].strip() + "...",
            "date_offset": i
        }
        blog_summary.append(summary_entry)

        full_post = {
            "id": post_id,
            "title": title,
            "url": video['url'],
            "thumbnail": video['thumbnail'],
            "text": ai_processed_text,
            "date_offset": i
        }

        with open(f'posts/{post_id}.json', 'w', encoding='utf-8') as f:
            json.dump(full_post, f, ensure_ascii=False, indent=4)

    with open('blog_posts.json', 'w', encoding='utf-8') as f:
        json.dump(blog_summary, f, ensure_ascii=False, indent=4)

    print(f"Generated {len(blog_summary)} AI-styled blog posts.")

if __name__ == "__main__":
    main()
