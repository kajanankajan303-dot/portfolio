# Kajanan Personal Portfolio

This project includes the public portfolio, a Google Gemini-powered portfolio chatbot, and contact and appointment intake. The admin dashboard UI has been removed; protected admin API endpoints remain available.

## Requirements

- Python 3.10 or newer
- A Google Gemini API key for the chatbot
- Gmail with 2-Step Verification and a Google App Password for email notifications (optional)

## Install and run on Windows

Open PowerShell in this project folder:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` and set a Google Gemini API key, a unique admin password, and a secret key. Create the API key in [Google AI Studio](https://aistudio.google.com/apikey). For example, generate a signing key using:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Paste that value into `APP_SECRET_KEY`. Keep `GEMINI_API_KEY` only in `.env` or the hosting provider's secret environment settings. Never put API keys or passwords in HTML or JavaScript.

Start the local server:

```powershell
python app.py
```

Open <http://127.0.0.1:5000/> for the portfolio. The `/admin` URL redirects to the public site. The configured admin username is `kajanan` by default; change it in `.env` if you use the protected admin API.

## Email notifications

Messages and appointment requests are saved to SQLite. To also receive email notifications, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `CONTACT_EMAIL` in `.env`.

For Gmail, enable 2-Step Verification and create an App Password in your Google Account. Use the App Password as `SMTP_PASSWORD`, not your regular Google password. SMTP is optional; if it is not configured or delivery fails, the submission is still saved in the local database and the server logs the notification failure.

## Projects and images

Project data is stored in `portfolio.db`. To attach an image through the protected admin API, put the image file in the existing `images` folder and use a relative path such as `images/my-project.jpg`. The application rejects paths outside the images folder. Back up `portfolio.db` and `images/` together.

## Deployment

Use a persistent disk for the SQLite database and keep `.env` outside version control. Run behind a production WSGI server and HTTPS reverse proxy; do not expose Flask's development server to the public internet. For example, after installing requirements:

```powershell
waitress-serve --listen=127.0.0.1:5000 app:app
```

Set `COOKIE_SECURE=true` when HTTPS is enabled. Configure `GEMINI_API_KEY`, a strong `APP_SECRET_KEY`, a unique `ADMIN_PASSWORD`, and `DATABASE_PATH` pointing to persistent storage. Do not commit `.env`, the database, or credentials.

For a Python host such as Render, Railway, or a VM:

1. Deploy this project with `pip install -r requirements.txt` as the build command.
2. Set `GEMINI_API_KEY` and the other required secrets in the host's environment-variable settings.
3. Use `waitress-serve --listen=0.0.0.0:$PORT app:app` as the start command on hosts that provide a `PORT` environment variable; otherwise use `waitress-serve --listen=0.0.0.0:5000 app:app`.
4. Enable HTTPS and set `COOKIE_SECURE=true`. Do not upload `.env` or commit API keys.

## Data and privacy

- Contact messages and appointment requests are stored in the local SQLite database.
- The site does not claim that an appointment is confirmed when requested; confirm or decline it through the protected admin API and contact the visitor by email.
- Chat messages are sent to Google Gemini to generate replies and are not saved by this application. Avoid sending sensitive information.
- The chatbot has no web-search integration, so answers about current events, live scores, or current prices may be out of date.
- Basic per-IP rate limits protect chat, messages, appointment submissions, and login. For a high-traffic deployment, use a shared rate-limit store and managed database.

## API overview

- `GET /api/health`, `GET /api/projects`
- `POST /api/chat`, `POST /api/messages`, `POST /api/appointments`
- Admin session endpoints under `/api/admin/` require login; state-changing requests also require a CSRF token.
