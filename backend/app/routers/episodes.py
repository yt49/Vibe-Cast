import json
from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import StreamingResponse
from google.cloud import storage

router = APIRouter()

BUCKET_NAME = "vibe-cast-tsurudai"


def _gcs_client():
    return storage.Client()


def _read_json_blob(bucket, blob_name: str):
    blob = bucket.blob(blob_name)
    if not blob.exists():
        return None
    return json.loads(blob.download_as_text())


@router.get("/episodes")
def list_episodes():
    """GCS上のエピソード一覧をmeta情報付きで返す"""
    client = _gcs_client()
    bucket = client.bucket(BUCKET_NAME)

    blobs = bucket.list_blobs(prefix="episodes/", delimiter="/")
    episode_ids = []
    for page in blobs.pages:
        for prefix in page.prefixes:
            ep_id = prefix.rstrip("/").split("/")[-1]
            episode_ids.append(ep_id)

    episode_ids.sort(reverse=True)

    episodes = []
    for ep_id in episode_ids:
        meta = _read_json_blob(bucket, f"episodes/{ep_id}/meta.json") or {}
        episodes.append({"id": ep_id, "name": meta.get("name", "")})

    return {"episodes": episodes}


@router.post("/episodes/{episode_id}/meta")
def save_meta(episode_id: str, name: str = Body(..., embed=True)):
    """エピソード名を保存する"""
    client = _gcs_client()
    bucket = client.bucket(BUCKET_NAME)
    blob = bucket.blob(f"episodes/{episode_id}/meta.json")
    blob.upload_from_string(
        json.dumps({"name": name}, ensure_ascii=False),
        content_type="application/json"
    )
    return {"episode_id": episode_id, "name": name}


@router.get("/episodes/{episode_id}/audio")
def stream_audio(episode_id: str, role: str = "host"):
    """GCSから音声をストリーミング配信する"""
    if role not in ("host", "guest"):
        raise HTTPException(status_code=400, detail="role は host または guest")

    blob_name = f"episodes/{episode_id}/raw/{role}_track.webm"
    client = _gcs_client()
    bucket = client.bucket(BUCKET_NAME)
    blob = bucket.blob(blob_name)

    if not blob.exists():
        raise HTTPException(status_code=404, detail="音声ファイルが見つかりません")

    def iterfile():
        with blob.open("rb") as f:
            while chunk := f.read(1024 * 256):  # 256KB chunks
                yield chunk

    return StreamingResponse(iterfile(), media_type="audio/webm")


@router.get("/episodes/{episode_id}/transcript")
def get_transcript(episode_id: str):
    """保存済みトランスクリプトを返す"""
    blob_name = f"episodes/{episode_id}/transcript.json"
    client = _gcs_client()
    bucket = client.bucket(BUCKET_NAME)
    blob = bucket.blob(blob_name)

    if not blob.exists():
        raise HTTPException(status_code=404, detail="トランスクリプトがありません")

    data = json.loads(blob.download_as_text())
    return data


@router.get("/episodes/{episode_id}/summary")
def get_summary(episode_id: str):
    """保存済みサマリーを返す"""
    blob_name = f"episodes/{episode_id}/summary.json"
    client = _gcs_client()
    bucket = client.bucket(BUCKET_NAME)
    blob = bucket.blob(blob_name)

    if not blob.exists():
        raise HTTPException(status_code=404, detail="サマリーがありません")

    data = json.loads(blob.download_as_text())
    return data


@router.delete("/episodes/{episode_id}")
def delete_episode(episode_id: str):
    """エピソード以下の全ファイルを削除する"""
    client = _gcs_client()
    bucket = client.bucket(BUCKET_NAME)

    blobs = list(bucket.list_blobs(prefix=f"episodes/{episode_id}/"))
    if not blobs:
        raise HTTPException(status_code=404, detail="エピソードが見つかりません")

    for blob in blobs:
        blob.delete()

    return {"deleted": episode_id}
