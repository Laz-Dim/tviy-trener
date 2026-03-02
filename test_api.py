from youtube_transcript_api import YouTubeTranscriptApi

try:
    api = YouTubeTranscriptApi()
    transcript = api.fetch('4V6QVzBrs50', languages=['uk', 'ru', 'en'])
    print("Success!")
    print(transcript[:100])
except Exception as e:
    print(f"Failed: {e}")
