from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from config import Config  # root config
from .users import get_or_create_user, get_user_by_id
import sqlite3
auth_bp = Blueprint('auth', __name__)

GOOGLE_CLIENT_ID = Config.GOOGLE_CLIENT_ID
JWT_SECRET_KEY = Config.JWT_SECRET_KEY
DB_PATH = Config.DB_PATH

@auth_bp.route('/google', methods=['POST'])
def google_login():
    token = request.json.get('token')
    if not token:
        return jsonify({'error': 'Token missing'}), 400

    try:
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)

        google_id = idinfo['sub']
        email = idinfo['email']
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')

        user = get_or_create_user(google_id, email, name, picture)
        access_token = create_access_token(identity=str(user['id']))

        return jsonify({'token': access_token, 'user': user}), 200

    except ValueError:
        return jsonify({'error': 'Invalid Google token'}), 401

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    user = get_user_by_id(int(user_id))

    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify(user), 200