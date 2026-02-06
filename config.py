import os
from dotenv import load_dotenv

# Load .env from root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

class Config:
    # Secrets
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

    # Database
    DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")

    # Other constants
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
    DEBUG = True  # Flask debug mode
