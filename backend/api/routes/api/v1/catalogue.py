from fastapi import APIRouter

from app.Core.security import Config
from app.Http.Controllers.CatalogueController import CatalogueController

router = APIRouter(prefix="/catalogue", tags=["Catalogue"])


@router.get("")
def get_catalogue(settings: Config):
    return CatalogueController.get(settings)
