from app.Services import CatalogueService
from config.settings import Settings


class CatalogueController:
    @staticmethod
    def get(settings: Settings) -> dict:
        return CatalogueService.catalogue(settings)
