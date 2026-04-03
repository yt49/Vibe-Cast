from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.transcriber import transcribe_episode
from app.services.article_generator import generate_summary

router = APIRouter()


class TranscribeRequest(BaseModel):
    episode_id: str


@router.post("/ai/transcribe")
async def transcribe(req: TranscribeRequest):
    if not req.episode_id:
        raise HTTPException(status_code=400, detail="episode_id is required")

    results = transcribe_episode(req.episode_id)

    if results.get("host") is None and results.get("guest") is None:
        raise HTTPException(status_code=404, detail="音声ファイルが見つかりません")

    return {
        "episode_id": req.episode_id,
        "host": results.get("host"),
        "guest": results.get("guest"),
    }


class SummarizeRequest(BaseModel):
    host: str | None = None
    guest: str | None = None


@router.post("/ai/summarize")
async def summarize(req: SummarizeRequest):
    if not req.host and not req.guest:
        raise HTTPException(status_code=400, detail="host または guest のテキストが必要です")

    summary = generate_summary(req.host, req.guest)
    return summary
