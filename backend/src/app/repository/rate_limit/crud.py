from fastcrud import FastCRUD

from src.app.models.rate_limit.models import RateLimit

crud_rate_limits: FastCRUD = FastCRUD(RateLimit)
