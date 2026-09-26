from fastcrud import FastCRUD

from src.app.models.api_keys.models import APIKey, KeyPermission, KeyUsage

crud_api_keys: FastCRUD = FastCRUD(APIKey)
crud_key_usage: FastCRUD = FastCRUD(KeyUsage)
crud_key_permissions: FastCRUD = FastCRUD(KeyPermission)
