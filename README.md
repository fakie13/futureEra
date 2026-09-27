# FutureEra

Academic pathway planning and workforce technology evaluation platform.

FutureEra provides structured multi-year curriculum roadmaps for secondary school graduates (Class 12) and workforce skill audits for graduating university students.

---

## Technical Architecture

- Backend: Python 3, FastAPI, Uvicorn, Pydantic, Python-Dotenv
- Model Integration: Google Gemini API (google-genai SDK)
- Frontend: HTML5, Vanilla JavaScript (ES6+), Tailwind CSS, Custom Architectural CSS

---

## Local Development Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Edit the `.env` file located in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
HOST=127.0.0.1
PORT=8000
```

### 3. Run the Development Server
```bash
python run.py
```
Access the application locally at:
http://127.0.0.1:8000

---

## Custom Domain and Production Deployment Guide

To deploy this application to your custom domain (e.g., `careercompass.yourdomain.com` or `yourdomain.com`):

### 1. DNS Configuration (Domain Registrar / Cloudflare)
Add the following DNS records in your domain provider:

| Type  | Name | Value | TTL |
|-------|------|-------|-----|
| A     | @ (or subdomain) | [Your Server Public IP] | Auto / 300 |
| CNAME | www  | yourdomain.com | Auto / 300 |

### 2. Production Web Server (Reverse Proxy)
Run the application using Uvicorn managed by systemd or Docker, bound to localhost (`127.0.0.1:8000`), and use Nginx or Caddy as the SSL-terminating reverse proxy.

#### Example Nginx Configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Automatic SSL with Certbot:
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Static Assets and Compliance Pages

- Application Interface: `/`
- Privacy Policy: `/privacy`
- Terms and Conditions: `/terms`
- Favicon: `/favicon.ico` and `/static/favicon.svg`
