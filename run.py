import sys
import uvicorn
from app.config import HOST, PORT

if __name__ == "__main__":
    # Ensure stdout handles utf-8 safely on Windows
    if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    print(f"Starting FutureEra on http://{HOST}:{PORT}")
    print(f"Swagger API Docs available at http://{HOST}:{PORT}/docs")
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
