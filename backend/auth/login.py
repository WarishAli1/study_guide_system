from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from jose import jwt
from datetime import datetime, timedelta
from config import Config
from auth.users import get_or_create_user

router = APIRouter()

GOOGLE_CLIENT_ID = Config.GOOGLE_CLIENT_ID
JWT_SECRET_KEY = Config.JWT_SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

class TokenSchema(BaseModel):
    token: str

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/google")
async def google_login(payload: TokenSchema):
    token = payload.token
    print("=" * 60)
    print(f"GOOGLE_CLIENT_ID loaded: {GOOGLE_CLIENT_ID}")
    print(f"CLIENT_ID is None: {GOOGLE_CLIENT_ID is None}")
    print(f"CLIENT_ID length: {len(GOOGLE_CLIENT_ID) if GOOGLE_CLIENT_ID else 0}")
    print(f"Token received (first 50 chars): {token[:50]}...")
    print(f"Token length: {len(token)}")
    print("=" * 60)

    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )

        print(f"Verification SUCCESS: {idinfo.get('email')}")

        google_id = idinfo['sub']
        email = idinfo['email']
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')

        user = get_or_create_user(google_id, email, name, picture)
        access_token = create_access_token(data={"sub": str(user['id'])})

        return {"token": access_token, "user": user}

    except ValueError as e:
        print(f"TOKEN VERIFICATION FAILED: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")

    except Exception as e:
        print(f"UNEXPECTED ERROR: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@router.get("/profile")
async def get_profile(user_id: int):
    from auth.users import get_user_by_id
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user