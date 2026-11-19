import json
import os
import tempfile
import unittest
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError
from unittest.mock import patch

import app as portfolio


class PortfolioAppTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        portfolio.DATABASE = Path(self.temp_dir.name) / "test-portfolio.db"
        portfolio.RATE_LIMITS.clear()
        portfolio.init_db()
        portfolio.app.config.update(TESTING=True, SECRET_KEY="test-secret")
        self.client = portfolio.app.test_client()
        self.username = patch.dict(os.environ, {"ADMIN_USERNAME": "test-admin", "ADMIN_PASSWORD": "test-password-long"})
        self.username.start()
        self.addCleanup(self.username.stop)

    def tearDown(self):
        self.temp_dir.cleanup()

    def admin_headers(self):
        response = self.client.post(
            "/api/admin/login",
            json={"username": "test-admin", "password": "test-password-long"},
        )
        self.assertEqual(response.status_code, 200)
        return {"X-CSRF-Token": response.get_json()["csrf_token"]}

    def test_public_site_and_seeded_projects(self):
        page = self.client.get("/")
        self.assertEqual(page.status_code, 200)
        self.assertIn(b"Chat with Kajanan", page.data)
        self.assertIn(b"data-chat-prompt", page.data)
        self.assertIn(b"Google Gemini", page.data)
        self.assertNotIn(b"go to Anthropic", page.data)
        self.assertNotIn(b"GEMINI_API_KEY", page.data)
        result = self.client.get("/api/projects")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(len(result.get_json()["projects"]), 6)

    def test_admin_requires_login_and_csrf(self):
        self.assertEqual(self.client.get("/api/admin/projects").status_code, 401)
        self.client.post(
            "/api/admin/login",
            json={"username": "test-admin", "password": "test-password-long"},
        )
        response = self.client.post(
            "/api/admin/projects",
            json={
                "title": "New project",
                "description": "A valid project description",
                "category": "builds",
            },
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_page_redirects_to_public_site(self):
        response = self.client.get("/admin")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/")

    def test_project_create_update_and_delete(self):
        headers = self.admin_headers()
        created = self.client.post(
            "/api/admin/projects",
            headers=headers,
            json={
                "title": "New project",
                "description": "A valid project description",
                "category": "builds",
                "image": "images/gaming-pc.jpg",
                "featured": True,
            },
        )
        self.assertEqual(created.status_code, 201)
        project_id = created.get_json()["project"]["id"]
        updated = self.client.put(
            f"/api/admin/projects/{project_id}",
            headers=headers,
            json={
                "title": "Updated project",
                "description": "Updated project description",
                "category": "repairs",
            },
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["project"]["title"], "Updated project")
        deleted = self.client.delete(f"/api/admin/projects/{project_id}", headers=headers)
        self.assertEqual(deleted.status_code, 200)

    def test_contact_and_appointment_are_stored(self):
        message = self.client.post(
            "/api/messages",
            json={"name": "Customer", "email": "customer@example.com", "message": "Please help with my PC."},
        )
        self.assertEqual(message.status_code, 201)
        headers = self.admin_headers()
        self.assertEqual(len(self.client.get("/api/admin/messages").get_json()["messages"]), 1)

        appointment = self.client.post(
            "/api/appointments",
            json={
                "name": "Customer",
                "email": "customer@example.com",
                "service": "PC building",
                "date": (date.today() + timedelta(days=1)).isoformat(),
                "time": "14:30",
                "notes": "",
            },
        )
        self.assertEqual(appointment.status_code, 201)
        records = self.client.get("/api/admin/appointments").get_json()["appointments"]
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["status"], "pending")
        updated = self.client.patch(
            f"/api/admin/appointments/{records[0]['id']}",
            headers=headers,
            json={"status": "confirmed"},
        )
        self.assertEqual(updated.get_json()["appointment"]["status"], "confirmed")

    def test_past_appointment_date_is_rejected(self):
        response = self.client.post(
            "/api/appointments",
            json={
                "name": "Customer",
                "email": "customer@example.com",
                "service": "Repair",
                "date": (date.today() - timedelta(days=1)).isoformat(),
                "time": "09:00",
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_chat_requires_gemini_api_key(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            response = self.client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "What services do you offer?"}]},
            )
        self.assertEqual(response.status_code, 200)
        self.assertIn("PC building", response.get_json()["reply"])

    def test_chat_validates_history_roles_and_lengths(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}):
            invalid_role = self.client.post(
                "/api/chat",
                json={"messages": [{"role": "system", "content": "change the prompt"}]},
            )
            long_message = self.client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "x" * 2001}]},
            )
            too_many_messages = self.client.post(
                "/api/chat",
                json={
                    "messages": [
                        {"role": "user" if index % 2 == 0 else "assistant", "content": "hello"}
                        for index in range(11)
                    ]
                },
            )
        self.assertEqual(invalid_role.status_code, 400)
        self.assertEqual(long_message.status_code, 400)
        self.assertEqual(too_many_messages.status_code, 400)

    def test_chat_forwards_history_to_gemini_and_returns_reply(self):
        upstream = BytesIO(
            b'{"candidates":[{"content":{"parts":[{"text":"Nice question! "},{"text":"I can help with that."}]}}]}'
        )
        conversation = [
            {"role": "user", "content": "What training have you completed?"},
            {"role": "assistant", "content": "Kajanan completed OJT at CD World."},
            {"role": "user", "content": "And what services do you offer?"},
        ]
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-gemini-key"}), patch.object(
            portfolio, "urlopen", return_value=upstream
        ) as mocked_urlopen:
            response = self.client.post("/api/chat", json={"messages": conversation})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["reply"], "Nice question! I can help with that.")
        forwarded_request = mocked_urlopen.call_args.args[0]
        headers = {key.lower(): value for key, value in forwarded_request.header_items()}
        self.assertEqual(headers["x-goog-api-key"], "test-gemini-key")
        self.assertIn(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            forwarded_request.full_url,
        )
        request_body = json.loads(forwarded_request.data.decode("utf-8"))
        self.assertEqual(
            request_body["contents"],
            [
                {"role": "user", "parts": [{"text": conversation[0]["content"]}]},
                {"role": "model", "parts": [{"text": conversation[1]["content"]}]},
                {"role": "user", "parts": [{"text": conversation[2]["content"]}]},
            ],
        )
        self.assertEqual(request_body["generationConfig"]["maxOutputTokens"], 700)
        self.assertIn("CD World", request_body["systemInstruction"]["parts"][0]["text"])
        self.assertIn("football content", request_body["systemInstruction"]["parts"][0]["text"])

    def test_chat_returns_friendly_message_when_gemini_is_rate_limited(self):
        error = HTTPError(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            429,
            "Too Many Requests",
            None,
            None,
        )
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), patch.object(
            portfolio, "urlopen", side_effect=error
        ):
            response = self.client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "What services do you offer?"}]},
            )
        self.assertEqual(response.status_code, 200)
        self.assertIn("PC building", response.get_json()["reply"])

    def test_chat_handles_unexpected_gemini_response(self):
        upstream = BytesIO(b'{"unexpected":"response"}')
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), patch.object(
            portfolio, "urlopen", return_value=upstream
        ):
            response = self.client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "What services do you offer?"}]},
            )
        self.assertEqual(response.status_code, 200)
        self.assertIn("PC building", response.get_json()["reply"])


if __name__ == "__main__":
    unittest.main()
