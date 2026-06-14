#!/usr/bin/env python3
"""
Fetch videos from YouTube channel @tviy_trener using YouTube Data API v3.
Saves to videos_data.json with deduplication (keeps existing, adds new).
"""
import os
import json
import sys
from pathlib import Path
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Load .env if exists
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
CHANNEL_HANDLE = "@tviy_trener"
OUTPUT_FILE = Path(__file__).parent / "videos_data.json"
MAX_RESULTS = 50  # per request (videos + shorts separately)

def get_channel_id(youtube, handle):
    """Resolve @handle to channel ID."""
    try:
        req = youtube.search().list(
            part="snippet",
            q=handle,
            type="channel",
            maxResults=1
        )
        resp = req.execute()
        if resp["items"]:
            return resp["items"][0]["snippet"]["channelId"]
    except HttpError as e:
        print(f"Error resolving channel handle: {e}")
    return None

def get_uploads_playlist_id(youtube, channel_id):
    """Get the 'uploads' playlist ID for a channel."""
    try:
        req = youtube.channels().list(
            part="contentDetails",
            id=channel_id
        )
        resp = req.execute()
        if resp["items"]:
            return resp["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
    except HttpError as e:
        print(f"Error getting uploads playlist: {e}")
    return None

def fetch_video_details(youtube, video_ids):
    """Fetch detailed info for a batch of video IDs."""
    if not video_ids:
        return {}
    try:
        req = youtube.videos().list(
            part="snippet,contentDetails,statistics",
            id=",".join(video_ids)
        )
        resp = req.execute()
        details = {}
        for item in resp.get("items", []):
            vid = item["id"]
            details[vid] = {
                "title": item["snippet"]["title"],
                "thumbnail": item["snippet"]["thumbnails"].get("medium", {}).get("url")
                            or item["snippet"]["thumbnails"].get("high", {}).get("url")
                            or item["snippet"]["thumbnails"].get("default", {}).get("url"),
                "published_at": item["snippet"]["publishedAt"],
                "duration": item["contentDetails"]["duration"],
                "view_count": int(item["statistics"].get("viewCount", 0)),
            }
        return details
    except HttpError as e:
        print(f"Error fetching video details: {e}")
    return {}

def is_short(duration):
    """Check if video is a Short (under 60 seconds)."""
    # Duration format: PT#M#S or PT#S
    import re
    match = re.match(r"PT(?:(\d+)M)?(?:(\d+)S)?", duration)
    if not match:
        return False
    minutes = int(match.group(1) or 0)
    seconds = int(match.group(2) or 0)
    return (minutes * 60 + seconds) <= 60

def load_existing_videos():
    """Load existing videos_data.json if exists."""
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return []

def save_videos(videos):
    """Save videos to JSON file."""
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(videos, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(videos)} videos to {OUTPUT_FILE}")

def main():
    if not YOUTUBE_API_KEY:
        print("ERROR: YOUTUBE_API_KEY not set in environment", file=sys.stderr)
        sys.exit(1)

    youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)

    # Use fixed Channel ID for @tviy_trener to save API quota and ensure 100% reliability
    channel_id = "UCCQuvsZ0rd5MM08M14lAvpg"
    print(f"Channel ID: {channel_id}")

    # Get uploads playlist
    uploads_playlist = get_uploads_playlist_id(youtube, channel_id)
    if not uploads_playlist:
        print("ERROR: Could not get uploads playlist", file=sys.stderr)
        sys.exit(1)
    print(f"Uploads playlist: {uploads_playlist}")

    # Fetch all video IDs from uploads playlist
    video_ids = []
    next_page = None
    while True:
        try:
            req = youtube.playlistItems().list(
                part="snippet,contentDetails",
                playlistId=uploads_playlist,
                maxResults=50,
                pageToken=next_page
            )
            resp = req.execute()
            for item in resp.get("items", []):
                vid = item["contentDetails"]["videoId"]
                video_ids.append(vid)
            next_page = resp.get("nextPageToken")
            if not next_page:
                break
        except HttpError as e:
            print(f"Error fetching playlist items: {e}")
            break

    print(f"Found {len(video_ids)} total videos in playlist")

    # Load existing data for deduplication
    existing_videos = load_existing_videos()
    existing_ids = {v["id"] for v in existing_videos}

    # Fetch details for NEW videos only (process in batches of 50)
    new_videos = []
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i+50]
        # Filter to only new videos
        new_batch = [v for v in batch if v not in existing_ids]
        if not new_batch:
            continue
        
        details = fetch_video_details(youtube, new_batch)
        for vid in new_batch:
            if vid not in details:
                continue
            d = details[vid]
            video_type = "short" if is_short(d["duration"]) else "video"
            new_videos.append({
                "id": vid,
                "title": d["title"],
                "url": f"https://www.youtube.com/watch?v={vid}",
                "thumbnail": d["thumbnail"],
                "published_at": d["published_at"],
                "type": video_type,
                "duration": d["duration"],
                "view_count": d["view_count"],
            })
            existing_ids.add(vid)

    print(f"Found {len(new_videos)} new videos")

    # Combine: new videos first (they're newer), then existing
    all_videos = new_videos + existing_videos

    # Sort by published_at descending (newest first)
    all_videos.sort(key=lambda x: x.get("published_at", ""), reverse=True)

    save_videos(all_videos)
    print("Done!")

if __name__ == "__main__":
    main()