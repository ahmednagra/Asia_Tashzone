"""Write the OpenAPI schema (docs are off in production): python -m scripts.export_openapi > openapi.json"""
import json

from main import create_app

print(json.dumps(create_app().openapi(), indent=2))
