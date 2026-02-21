from datetime import datetime, timezone, timedelta
import jwt
import sqlite3
from datetime import datetime
from config import Config

DB_PATH = Config.DB_PATH

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            google_id TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            picture TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def get_or_create_user(google_id, email, name, picture):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id, email, name, picture FROM users WHERE google_id = ?', (google_id,))
    user = cursor.fetchone()

    if user:
        cursor.execute('UPDATE users SET last_login = ? WHERE id = ?', (datetime.now(), user[0]))
        conn.commit()
        conn.close()
        return {'id': user[0], 'email': user[1], 'name': user[2], 'picture': user[3]}
    else:
        cursor.execute(
            'INSERT INTO users (google_id, email, name, picture, last_login) VALUES (?, ?, ?, ?, ?)',
            (google_id, email, name, picture, datetime.now())
        )
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        return {'id': user_id, 'email': email, 'name': name, 'picture': picture}

def get_user_by_id(user_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id, email, name, picture, created_at, last_login FROM users WHERE id = ?', (user_id,))
    user = cursor.fetchone()
    conn.close()
    if user:
        return {
            'id': user[0],
            'email': user[1],
            'name': user[2],
            'picture': user[3],
            'created_at': user[4],
            'last_login': user[5]
        }
    return None

def create_jwt_token(user_id: int, email: str) -> str:
    """
    Creates a signed JWT for the frontend to store.
    """
    secret = getattr(Config, "JWT_SECRET", "change-me")
    algorithm = getattr(Config, "JWT_ALGORITHM", "HS256")
    expire_days = int(getattr(Config, "JWT_EXPIRE_DAYS", 7))

    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=expire_days)).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)