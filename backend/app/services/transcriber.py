import os
import tempfile
from google.cloud import storage
from openai import OpenAI

BUCKET_NAME = "vibe-cast-tsurudai"

def _get_client() -> OpenAI:
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"].strip())


def _download_from_gcs(blob_name: str) -> bytes:
    gcs = storage.Client()
    bucket = gcs.bucket(BUCKET_NAME)
    blob = bucket.blob(blob_name)
    return blob.download_as_bytes()


def transcribe_episode(episode_id: str) -> dict:
    results = {}

    for role in ("host", "guest"):
        blob_name = f"episodes/{episode_id}/raw/{role}_track.webm"

        try:
            audio_bytes = _download_from_gcs(blob_name)
        except Exception:
            results[role] = None
            continue

        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        try:
            with open(tmp_path, "rb") as audio_file:
                response = _get_client().audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="ja",
                )
            results[role] = response.text
        finally:
            os.unlink(tmp_path)

    return results
