from fastcrud import FastCRUD

from src.app.models.user.models import User

crud_users: FastCRUD = FastCRUD(User)
