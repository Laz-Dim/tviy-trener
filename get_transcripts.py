import json
import os
import subprocess
import re

def clean_vtt(vtt_content):
    # Remove WEBVTT header and kind/language lines
    lines = vtt_content.splitlines()
    cleaned_lines = []
    for line in lines:
        if '-->' in line or 'WEBVTT' in line or 'Kind:' in line or 'Language:' in line:
            continue
        # Remove HTML-like tags (e.g., <00:00:01.760><c>)
        line = re.sub(r'<[^>]+>', '', line)
        line = line.strip()
        if line:
            cleaned_lines.append(line)

    # Remove duplicates that often appear in VTT from YouTube
    final_lines = []
    if cleaned_lines:
        final_lines.append(cleaned_lines[0])
        for i in range(1, len(cleaned_lines)):
            if cleaned_lines[i] != cleaned_lines[i-1]:
                final_lines.append(cleaned_lines[i])

    return " ".join(final_lines)

def get_transcript_yt_dlp(video_id):
    vtt_file = f"temp_{video_id}.uk.vtt"
    # Try Ukrainian first
    cmd = [
        "yt-dlp", "--skip-download", "--write-auto-subs", "--sub-langs", "uk",
        "--output", f"temp_{video_id}", f"https://www.youtube.com/watch?v={video_id}"
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        if os.path.exists(vtt_file):
            with open(vtt_file, 'r', encoding='utf-8') as f:
                content = f.read()
            os.remove(vtt_file)
            return clean_vtt(content)
    except Exception as e:
        print(f"Failed to get uk transcript for {video_id}: {e}")

    # Fallback to English if Ukrainian fails
    vtt_file_en = f"temp_{video_id}.en.vtt"
    cmd[-3] = "en"
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        if os.path.exists(vtt_file_en):
            with open(vtt_file_en, 'r', encoding='utf-8') as f:
                content = f.read()
            os.remove(vtt_file_en)
            return clean_vtt(content)
    except Exception as e:
        print(f"Failed to get en transcript for {video_id}: {e}")

    return None

def main():
    if not os.path.exists('videos_data.json'):
        print("videos_data.json not found")
        return

    with open('videos_data.json', 'r', encoding='utf-8') as f:
        videos = json.load(f)

    output_file = 'videos_data_with_transcripts.json'

    # Load existing progress if any
    if os.path.exists(output_file):
        with open(output_file, 'r', encoding='utf-8') as f:
            processed_videos = json.load(f)
            processed_ids = {v['id'] for v in processed_videos if v.get('transcript')}
    else:
        processed_videos = []
        processed_ids = set()

    for i, video in enumerate(videos):
        video_id = video['id']
        if video_id in processed_ids:
            print(f"[{i+1}/{len(videos)}] Already processed {video_id}")
            continue

        print(f"[{i+1}/{len(videos)}] Processing {video_id}...")

        if not video.get('thumbnail'):
            video['thumbnail'] = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

        transcript = get_transcript_yt_dlp(video_id)
        video['transcript'] = transcript

        # Update or append
        found = False
        for pv in processed_videos:
            if pv['id'] == video_id:
                pv['transcript'] = transcript
                found = True
                break
        if not found:
            processed_videos.append(video)

        # Save progress every 10 videos
        if (i + 1) % 10 == 0:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(processed_videos, f, ensure_ascii=False, indent=4)

    # Final save
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(processed_videos, f, ensure_ascii=False, indent=4)

    print("Finished processing transcripts.")

if __name__ == "__main__":
    main()
