"""An agent with web access opens Fernbrook and stops at the door.

It reads the live homepage, then asks for QLMR estimates with no API key.
It prints a short transcript and stops on the 401. It does not sign up,
send a key, or call Misa.

    python agent/scripts/presenter_demo.py
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from html.parser import HTMLParser
from urllib.parse import urlsplit

HOST = "fernbrook-api-misa-ae73ae92.vercel.app"
ORIGIN = f"https://{HOST}"
HOME_URL = f"{ORIGIN}/"
ESTIMATES_URL = f"{ORIGIN}/v1/companies/QLMR/estimates"
EXPECTED_TITLE = "Fernbrook Estimates"
EXPECTED_DETAIL = "Send a valid API key in the X-API-Key header. Get one at /signup."
ALLOWED_PATHS = {"/", "/v1/companies/QLMR/estimates"}
# Compared only. These hosts are never requested.
REFUSED_HOSTS = {"api.trymisa.com", "trymisa.com"}


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, msg, headers, fp)


class _Anchor:
    def __init__(self, href: str) -> None:
        self.href = href
        self.text: list[str] = []


class _Home(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._in_title = False
        self._title: list[str] = []
        self._anchor: _Anchor | None = None
        self.title = ""
        self.has_subscribe = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self._in_title = True
        if tag == "a":
            self._anchor = _Anchor(dict(attrs).get("href") or "")

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
            self.title = "".join(self._title).strip()
        if tag == "a" and self._anchor is not None:
            text = "".join(self._anchor.text).strip()
            if text == "Subscribe" and self._anchor.href in {"/signup", f"{ORIGIN}/signup"}:
                self.has_subscribe = True
            self._anchor = None

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title.append(data)
        if self._anchor is not None:
            self._anchor.text.append(data)


def guard(url: str) -> None:
    """Refuse anything except the two Fernbrook GETs this demo is allowed to make."""
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    if host in REFUSED_HOSTS or host.endswith(".trymisa.com"):
        raise RuntimeError("refusing to call Misa")
    if "signup" in parts.path.lower():
        raise RuntimeError("refusing to open signup")
    if parts.scheme != "https" or host != HOST or parts.path not in ALLOWED_PATHS or parts.query or parts.fragment:
        raise RuntimeError(f"refusing to call {url}")


def _media_type(content_type: str) -> str:
    return content_type.split(";", 1)[0].strip().lower()


def get(url: str, accept: str) -> tuple[int, str, bytes]:
    guard(url)
    headers = {"Accept": accept, "User-Agent": "fernbrook-presenter-demo"}
    if any(name.lower() in {"x-api-key", "authorization"} for name in headers):
        raise RuntimeError("refusing to send an API key")
    request = urllib.request.Request(url, method="GET", headers=headers)
    opener = urllib.request.build_opener(_NoRedirect)
    try:
        with opener.open(request, timeout=20) as response:
            return response.status, response.headers.get("content-type", ""), response.read()
    except urllib.error.HTTPError as error:
        content_type = error.headers.get("content-type", "") if error.headers else ""
        return error.code, content_type, error.read()


def read_home(html: str) -> tuple[str, bool]:
    page = _Home()
    page.feed(html)
    page.close()
    return page.title, page.has_subscribe


def problem_detail(body: bytes) -> str | None:
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    detail = payload.get("detail")
    return detail if isinstance(detail, str) else None


def main() -> int:
    status, content_type, body = get(HOME_URL, "text/html")
    title, has_subscribe = read_home(body.decode("utf-8", "replace"))
    if status != 200 or _media_type(content_type) != "text/html" or title != EXPECTED_TITLE or not has_subscribe:
        print(
            f"Homepage was {status} {content_type!r}, title {title!r}, Subscribe link {has_subscribe}.",
            file=sys.stderr,
        )
        return 1

    print("An agent opens Fernbrook.", flush=True)
    print(flush=True)
    print(f"Homepage title: {title}", flush=True)
    print("Subscribe is on the page. This is a subscription site for people.", flush=True)
    print(flush=True)
    print("The agent asks for QLMR estimates, with no API key.", flush=True)
    print(f"GET {ESTIMATES_URL}", flush=True)
    print(flush=True)

    status, content_type, body = get(ESTIMATES_URL, "application/problem+json")
    detail = problem_detail(body)
    if status != 401 or _media_type(content_type) != "application/problem+json" or detail != EXPECTED_DETAIL:
        print(
            f"Expected 401 application/problem+json. Got {status} {content_type!r}, detail {detail!r}.",
            file=sys.stderr,
        )
        return 1

    print("Fernbrook answers 401, application/problem+json.", flush=True)
    print(f'"{detail}"', flush=True)
    print(flush=True)
    print("The agent stops.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
