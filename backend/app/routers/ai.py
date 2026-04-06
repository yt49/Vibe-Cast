import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google.cloud import storage
from app.services.transcriber import transcribe_episode
from app.services.article_generator import generate_summary

router = APIRouter()

BUCKET_NAME = "vibe-cast-tsurudai"


def _save_to_gcs(blob_name: str, data: dict):
    client = storage.Client()
    bucket = client.bucket(BUCKET_NAME)
    blob = bucket.blob(blob_name)
    blob.upload_from_string(json.dumps(data, ensure_ascii=False), content_type="application/json")


class TranscribeRequest(BaseModel):
    episode_id: str


@router.post("/ai/transcribe")
async def transcribe(req: TranscribeRequest):
    if not req.episode_id:
        raise HTTPException(status_code=400, detail="episode_id is required")

    results = transcribe_episode(req.episode_id)

    if results.get("host") is None and results.get("guest") is None:
        raise HTTPException(status_code=404, detail="音声ファイルが見つかりません")

    payload = {
        "episode_id": req.episode_id,
        "host": results.get("host"),
        "guest": results.get("guest"),
    }
    _save_to_gcs(f"episodes/{req.episode_id}/transcript.json", payload)

    return payload


class SummarizeRequest(BaseModel):
    episode_id: str | None = None
    host: str | None = None
    guest: str | None = None


@router.post("/ai/summarize")
async def summarize(req: SummarizeRequest):
    if not req.host and not req.guest:
        raise HTTPException(status_code=400, detail="host または guest のテキストが必要です")

    summary = generate_summary(req.host, req.guest)

    if req.episode_id:
        _save_to_gcs(f"episodes/{req.episode_id}/summary.json", summary)

    return summary
