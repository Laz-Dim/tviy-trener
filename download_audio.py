import yt_dlp
import os

def download_audio(video_id):
    url = f"https://www.youtube.com/watch?v={video_id}"

    # Створюємо папку для аудіо
    if not os.path.exists('audio'):
        os.makedirs('audio')

    output_path = os.path.join('audio', f'{video_id}.mp3')

    if os.path.exists(output_path):
        print(f"Audio for {video_id} already exists.")
        return output_path

    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': os.path.join('audio', f'{video_id}.%(ext)s'),
        'quiet': True
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"Downloading audio for {video_id}...")
            ydl.download([url])
            return output_path
    except Exception as e:
        print(f"Error downloading {video_id}: {e}")
        return None

if __name__ == "__main__":
    # Тест на одному відео
    test_id = "4V6QVzBrs50"
    download_audio(test_id)
