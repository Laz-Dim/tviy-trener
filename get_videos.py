import yt_dlp
import json

def get_channel_videos(urls):
    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
    }

    videos = []
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for url in urls:
            print(f"Fetching from {url}...")
            result = ydl.extract_info(url, download=False)
            if 'entries' in result:
                for entry in result['entries']:
                    videos.append({
                        'id': entry['id'],
                        'title': entry['title'],
                        'thumbnail': entry.get('thumbnail'),
                        'url': f"https://www.youtube.com/watch?v={entry['id']}"
                    })
    return videos

if __name__ == "__main__":
    channel_urls = [
        'https://www.youtube.com/@tviy_trener/videos',
        'https://www.youtube.com/@tviy_trener/shorts'
    ]
    all_videos = get_channel_videos(channel_urls)

    with open('videos_data.json', 'w', encoding='utf-8') as f:
        json.dump(all_videos, f, ensure_ascii=False, indent=4)

    print(f"Extracted {len(all_videos)} videos to videos_data.json")
