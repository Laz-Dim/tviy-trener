#!/bin/bash
# process_video.sh <video_id>
VIDEO_ID=$1
TRANSCRIPT_DIR="/home/dimon/first_project/transcripts"
SUMMARY_DIR="/home/dimon/first_project/summaries"

echo "--- Processing Video: $VIDEO_ID ---"

# 1. Download audio
echo "Downloading audio..."
yt-dlp -x --audio-format mp3 -o "$TRANSCRIPT_DIR/$VIDEO_ID.%(ext)s" "https://www.youtube.com/watch?v=$VIDEO_ID"

# 2. Transcribe (using whisper-api skill script if available, or direct curl)
# Note: I'll use a direct curl to Whisper API here for reliability within the script
# If OPENAI_API_KEY is not set, this will fail gracefully.
echo "Transcribing..."
# (Placeholder for transcription - I will handle the API call in the main loop to manage errors better)
