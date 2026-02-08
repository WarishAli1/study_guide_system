import os
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
print(f"Looking for .env at: {env_path}")
print(f".env file exists: {os.path.exists(env_path)}")

load_dotenv(dotenv_path=env_path)

class Config:
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-key")
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    DEBUG = True