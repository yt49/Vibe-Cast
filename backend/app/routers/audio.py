from fastapi import APIRouter, UploadFile, File, Query
from google.cloud import storage
from datetime import datetime

router = APIRouter()

BUCKET_NAME = "vibe-cast-tsurudai"


@router.post("/audio/upload")
async def upload_audio(
    file: UploadFile = File(...),
    role: str = Query("host"),
    episode_id: str = Query(None),
):
    if not episode_id:
        episode_id = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    blob_name = f"episodes/{episode_id}/raw/{role}_track.webm"

    client = storage.Client()
    bucket = client.bucket(BUCKET_NAME)
    blob = bucket.blob(blob_name)

    content = await file.read()
    blob.upload_from_string(content, content_type="audio/webm")

    return {
        "episode_id": episode_id,
        "gcs_path": f"gs://{BUCKET_NAME}/{blob_name}",
    }
