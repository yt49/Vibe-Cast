from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import signaling, audio, ai, episodes

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(signaling.router)
app.include_router(audio.router)
app.include_router(ai.router)
app.include_router(episodes.router)
