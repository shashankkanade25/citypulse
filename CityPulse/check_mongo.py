"""Quick MongoDB connectivity check for CityPulse.

- Loads CityPulse/.env (and optionally the portal envs) via python-dotenv
- Connects with PyMongo
- Prints db name and counts for collections used by realtime chat grounding

Run:
  python check_mongo.py
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse


def _load_envs() -> None:
    try:
        from dotenv import load_dotenv
    except Exception:
        print("python-dotenv not installed. Run: pip install -r requirements.txt")
        return

    load_dotenv(Path(__file__).with_name(".env"), override=False)

    if not (os.getenv("CITYPULSE_MONGODB_URL") or os.getenv("MONGODB_URL")):
        repo_root = Path(__file__).resolve().parents[1]
        candidate_envs = [
            repo_root / "Puranpoli_Protocol" / "authority" / ".env",
            repo_root / "Puranpoli_Protocol" / "authority" / ".env.local",
            repo_root / "Puranpoli_Protocol" / "citizens" / ".env",
            repo_root / "Puranpoli_Protocol" / "citizens" / ".env.local",
        ]
        for env_path in candidate_envs:
            if env_path.exists():
                load_dotenv(env_path, override=False)


def _resolve_db_name(uri: str) -> str:
    env_db = (os.getenv("CITYPULSE_MONGODB_DB") or os.getenv("MONGODB_DB") or "").strip()
    if env_db:
        return env_db

    try:
        parsed = urlparse(uri)
        uri_db = (parsed.path or "").lstrip("/")
        return uri_db
    except Exception:
        return ""


def main() -> None:
    _load_envs()

    uri = os.getenv("CITYPULSE_MONGODB_URL") or os.getenv("MONGODB_URL")
    if not uri:
        print("No CITYPULSE_MONGODB_URL or MONGODB_URL found in environment.")
        return

    try:
        from pymongo import MongoClient
    except Exception as e:
        print(f"PyMongo not installed/available: {type(e).__name__}: {e}")
        print("Run: pip install -r requirements.txt")
        return

    db_name = _resolve_db_name(uri)

    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        client.admin.command("ping")
        print("Mongo ping: OK")
    except Exception as e:
        print(f"Mongo ping: FAILED ({type(e).__name__}: {e})")
        if "dnspython" in str(e).lower():
            print("Hint: Atlas mongodb+srv requires dnspython. Ensure requirements are installed.")
        return

    db = None
    if db_name:
        db = client.get_database(db_name)
    else:
        try:
            db = client.get_default_database()
        except Exception:
            db = None

    if db is None:
        print("Could not resolve a database name. Set CITYPULSE_MONGODB_DB (or include /<db> in URI).")
        return

    print(f"DB: {db.name}")

    for col_name in ("issues", "incidents"):
        try:
            count = db.get_collection(col_name).estimated_document_count()
            print(f"{col_name}: {count}")
        except Exception as e:
            print(f"{col_name}: error ({type(e).__name__}: {e})")


if __name__ == "__main__":
    main()
