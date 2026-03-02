import json
import re
import os

def format_text(text):
    if not text:
        return ""

    # Split into sentences (basic heuristic)
    sentences = re.split(r'(?<=[.!?])\s+', text)

    # Group sentences into paragraphs (e.g., every 3-5 sentences)
    paragraphs = []
    current_paragraph = []
    for i, sentence in enumerate(sentences):
        current_paragraph.append(sentence)
        if (i + 1) % 4 == 0:
            paragraphs.append(" ".join(current_paragraph))
            current_paragraph = []

    if current_paragraph:
        paragraphs.append(" ".join(current_paragraph))

    return "\n\n".join(paragraphs)

def main():
    try:
        with open('videos_data_with_transcripts.json', 'r', encoding='utf-8') as f:
            videos = json.load(f)
    except FileNotFoundError:
        print("videos_data_with_transcripts.json not found")
        return

    # Створюємо директорію для окремих постів, якщо її немає
    if not os.path.exists('posts'):
        os.makedirs('posts')

    blog_summary = []
    for i, video in enumerate(videos):
        raw_text = video.get('transcript') or video['title']
        formatted_text = format_text(raw_text)

        # Strip hashtags for title and clean it
        title = re.sub(r'#\w+', '', video['title']).strip()
        title = re.sub(r'\s+', ' ', title)

        post_id = video['id']

        # Створюємо пост для summary (без повного тексту)
        summary_entry = {
            "id": post_id,
            "title": title,
            "url": video['url'],
            "thumbnail": video['thumbnail'],
            "preview": raw_text[:150].strip() + "...",
            "date_offset": i
        }
        blog_summary.append(summary_entry)

        # Зберігаємо повний текст в окремий файл
        full_post = {
            "id": post_id,
            "title": title,
            "url": video['url'],
            "thumbnail": video['thumbnail'],
            "text": formatted_text,
            "date_offset": i
        }

        with open(f'posts/{post_id}.json', 'w', encoding='utf-8') as f:
            json.dump(full_post, f, ensure_ascii=False, indent=4)

    # Зберігаємо список всіх постів (summary)
    with open('blog_posts.json', 'w', encoding='utf-8') as f:
        json.dump(blog_summary, f, ensure_ascii=False, indent=4)

    print(f"Generated {len(blog_summary)} summaries and individual post files in /posts.")

if __name__ == "__main__":
    main()
