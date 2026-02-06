from flask import Flask
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from backend.auth.login import auth_bp
from backend.auth.users import init_db
from config import Config  # root config

app = Flask(__name__)
CORS(app)

# JWT setup
app.config['JWT_SECRET_KEY'] = Config.JWT_SECRET_KEY
jwt = JWTManager(app)

# Initialize database
init_db()

# Register auth blueprint
app.register_blueprint(auth_bp, url_prefix='/api/auth')

if __name__ == '__main__':
    app.run(debug=Config.DEBUG, port=5001, host='0.0.0.0')
