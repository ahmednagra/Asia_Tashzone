from fastapi import APIRouter
from sqlalchemy import text

from app.Core.security import DB, Config

router = APIRouter(tags=["Health"])


@router.get("/health")
def health(db: DB, settings: Config):
    db.execute(text("SELECT 1"))
    return {"ok": True, "tag": settings.release_tag, "commit": settings.release_commit}
