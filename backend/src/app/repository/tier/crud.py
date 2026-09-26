from fastcrud import FastCRUD

from src.app.models.tier.models import Tier

crud_tiers: FastCRUD = FastCRUD(Tier)
