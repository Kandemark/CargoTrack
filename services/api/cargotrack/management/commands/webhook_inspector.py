"""
Webhook Inspector — local development tool for testing webhook integrations.

Starts an HTTP server that receives webhook payloads and displays them,
helping developers debug webhook delivery, payload format, and signatures.

Usage:
    python manage.py webhook_inspector --port 9999
    # Then register a webhook endpoint pointing to http://localhost:9999/webhook
    # All received payloads are printed to stdout and saved to webhook_inspector.log

    python manage.py webhook_inspector --port 9999 --replay  # also replay to real URL
"""
import hashlib
import hmac
import json
import os
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

from django.core.management.base import BaseCommand


class WebhookHandler(BaseHTTPRequestHandler):
    server_start: datetime = datetime.now(timezone.utc)
    request_log: list[dict] = []
    replay_url: str = ""

    def log_message(self, fmt, *args):
        print(f"[webhook-inspector] {args[0]}" if args else fmt)

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else b""

        # Try to parse as JSON for pretty printing
        try:
            payload = json.loads(body)
            body_str = json.dumps(payload, indent=2)
        except (json.JSONDecodeError, UnicodeDecodeError):
            body_str = body.decode("utf-8", errors="replace")

        # Verify webhook signature if present
        sig_header = self.headers.get("X-CargoTrack-Signature", "")
        sig_valid = None
        if sig_header:
            secret = os.getenv("WEBHOOK_SECRET_KEY", "dev-secret")
            expected = hmac.new(
                secret.encode(), body, hashlib.sha256,
            ).hexdigest()
            sig_valid = hmac.compare_digest(f"sha256={expected}", sig_header)

        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "method": "POST",
            "path": self.path,
            "headers": dict(self.headers),
            "body_length": len(body),
            "signature_valid": sig_valid,
        }

        WebhookHandler.request_log.append(entry)

        # Print to console
        print(f"\n{'=' * 60}")
        print(f"  WEBHOOK RECEIVED — {entry['timestamp']}")
        print(f"  Source: {self.client_address[0]}")
        print(f"  Path:   {self.path}")
        if sig_valid is not None:
            status = "VALID" if sig_valid else "INVALID"
            print(f"  Signature: {status}")
        print(f"  Headers:")
        for k, v in self.headers.items():
            print(f"    {k}: {v}")
        print(f"  Body ({len(body)} bytes):")
        print(body_str)
        print(f"{'=' * 60}\n")

        # Append to log file
        with open("webhook_inspector.log", "a") as f:
            f.write(json.dumps({**entry, "body": body_str}) + "\n")

        # Replay to real URL if configured
        if WebhookHandler.replay_url:
            import urllib.request
            req = urllib.request.Request(
                WebhookHandler.replay_url,
                data=body,
                headers={k: v for k, v in self.headers.items() if k.lower() != "host"},
                method="POST",
            )
            try:
                urllib.request.urlopen(req, timeout=10)
                print("[replay] Forwarded to real webhook endpoint")
            except Exception as e:
                print(f"[replay] Forward failed: {e}")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "received", "timestamp": entry["timestamp"]}).encode())

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")
            return

        if self.path == "/stats":
            uptime = (datetime.now(timezone.utc) - WebhookHandler.server_start).total_seconds()
            stats = {
                "uptime_seconds": uptime,
                "total_requests": len(WebhookHandler.request_log),
                "requests": WebhookHandler.request_log[-50:],
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(stats, indent=2).encode())
            return

        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Webhook Inspector — POST to /webhook\n")


class Command(BaseCommand):
    help = "Start a webhook inspector HTTP server for local development testing."

    def add_arguments(self, parser):
        parser.add_argument("--port", type=int, default=9999, help="Port to listen on (default: 9999)")
        parser.add_argument("--replay", type=str, default="", help="Replay received payloads to this real webhook URL")

    def handle(self, **options):
        port = options["port"]
        WebhookHandler.replay_url = options.get("replay", "")

        server = HTTPServer(("0.0.0.0", port), WebhookHandler)

        self.stdout.write(self.style.SUCCESS(
            f"\n  Webhook Inspector listening on http://localhost:{port}"
        ))
        self.stdout.write(f"  POST webhooks to: http://localhost:{port}/webhook")
        self.stdout.write(f"  Health check:     http://localhost:{port}/health")
        self.stdout.write(f"  Stats:            http://localhost:{port}/stats")
        self.stdout.write(f"  Log file:         webhook_inspector.log")
        self.stdout.write(f"\n  Press Ctrl+C to stop.\n")

        try:
            server.serve_forever()
        except KeyboardInterrupt:
            self.stdout.write("\n  Webhook inspector stopped.")
            server.server_close()
