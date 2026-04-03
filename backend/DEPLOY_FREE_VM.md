# Free Deployment Guide (Oracle Always Free VM + Vercel)

## 1. Backend VM (Ubuntu)

### Install dependencies
```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx certbot python3-certbot-nginx tesseract-ocr
```

### Clone and set up backend
```bash
sudo mkdir -p /opt/study_guide_system
sudo chown -R $USER:$USER /opt/study_guide_system
cd /opt/study_guide_system
git clone https://github.com/WarishAli1/study_guide_system.git .

cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Configure environment
```bash
cp .env.example .env
mkdir -p /opt/study-guide/data/datasets
```

Edit `.env` and set production values:
- `ENV=production`
- `CORS_ORIGINS=https://your-frontend.vercel.app`
- `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GROQ_API_KEY`
- `DB_PATH=/opt/study-guide/data/database.db`
- `DATASETS_DIR=/opt/study-guide/data/datasets`

### Configure systemd
```bash
sudo cp deploy/systemd/study-guide-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable study-guide-backend
sudo systemctl start study-guide-backend
sudo systemctl status study-guide-backend
```

## 2. Nginx reverse proxy

```bash
sudo cp deploy/nginx/study-guide-api.conf /etc/nginx/sites-available/study-guide-api
sudo ln -s /etc/nginx/sites-available/study-guide-api /etc/nginx/sites-enabled/study-guide-api
sudo nginx -t
sudo systemctl reload nginx
```

## 3. HTTPS (free TLS)

```bash
sudo certbot --nginx -d api.yourdomain.com
```

## 4. Frontend on Vercel

Set env var in Vercel project settings:
- `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`

Then deploy frontend from `frontend/`.

## 5. Optional quick check

```bash
curl http://127.0.0.1:8000/
curl https://api.yourdomain.com/
```

If both return JSON response, backend is live.
