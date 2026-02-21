import logging
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from config import Config
from auth.users import get_or_create_user, create_jwt_token

logger = logging.getLogger(__name__)
router = APIRouter()


class GoogleLoginRequest(BaseModel):
    token: str


def _try_verify_id_token(token: str) -> dict | None:
    """
    Try verifying token as a Google ID token. If it fails, return None.
    """
    try:
        return id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            getattr(Config, "GOOGLE_CLIENT_ID", None),
        )
    except Exception:
        return None


async def _get_userinfo_from_access_token(access_token: str) -> dict:
    """
    Fetch user profile from Google using OAuth access_token.
    """
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    return resp.json()


@router.post("/google")
async def google_login(request: GoogleLoginRequest):
    token = request.token

    decoded = _try_verify_id_token(token)
    if decoded:
        google_id = decoded.get("sub")
        email = decoded.get("email")
        name = decoded.get("name") or ""
        picture = decoded.get("picture") or ""
    else:
        data = await _get_userinfo_from_access_token(token)
        google_id = data.get("sub")
        email = data.get("email")
        name = data.get("name") or ""
        picture = data.get("picture") or ""

    if not google_id or not email:
        raise HTTPException(status_code=401, detail="Could not retrieve Google identity")

    user = get_or_create_user(google_id, email, name, picture)
    jwt_token = create_jwt_token(user["id"], user["email"])

    return {
        "token": jwt_token,
        "user": user,
    }