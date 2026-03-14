from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

load_dotenv()

from app.database import init_db
from app.routes.auth_routes import router as auth_router
from app.routes.chat_routes import router as chat_router
from app.routes.apikey_routes import router as apikey_router
from app.routes.api_routes import router as api_router
from app.routes.voice_routes import router as voice_router
from app.routes.suggestions_routes import router as suggestions_router, init_suggestions

app = FastAPI(title="YubiAI API", version="1.0.0", description="YubiAI - AI Assistant by Devopods")

# CORS configuration: allow frontend origins for cross-origin API access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:8000",  # Same-origin dev
        "https://olympic-badly-wave-convinced.trycloudflare.com",  # Cloudflare tunnel
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-Auth-Token"],  # Include custom auth header
    expose_headers=["X-Auth-Token"],
)

# Include routers
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(apikey_router)
app.include_router(api_router)
app.include_router(voice_router)
app.include_router(suggestions_router)


@app.on_event("startup")
async def startup():
    init_db()
    init_suggestions()


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


# Serve frontend static files (for deployed same-origin mode)
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # Serve static files if they exist, otherwise serve index.html for SPA routing
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))
