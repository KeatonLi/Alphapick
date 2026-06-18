"""HTTP client utilities for datasource fetchers."""

from __future__ import annotations

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def create_datasource_session(proxy_url: str | None = None) -> requests.Session:
    session = requests.Session()
    session.trust_env = False
    session.proxies = {}
    if proxy_url:
        session.proxies = {"http": proxy_url, "https": proxy_url}

    retry = Retry(
        total=2,
        connect=2,
        read=2,
        backoff_factor=0.5,
        status_forcelist=(500, 502, 503, 504),
        allowed_methods=("GET", "POST"),
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


datasource_session = create_datasource_session()
