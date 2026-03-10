from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.database import init_db
from app.routes.auth_routes import router as auth_router
from app.routes.chat_routes import router as chat_router
from app.routes.apikey_routes import router as apikey_router
from app.routes.api_routes import router as api_router
from app.routes.voice_routes import router as voice_router

app = FastAPI(title="YubiAI API", version="1.0.0", description="YubiAI - AI Assistant by Devopods")

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include routers
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(apikey_router)
app.include_router(api_router)
app.include_router(voice_router)


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
