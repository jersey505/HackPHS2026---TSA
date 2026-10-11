"""Fly Ready backend.  Run:  python app.py   then open http://127.0.0.1:5000"""
import json
import os
import threading
import uuid

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

load_dotenv()

import gen_ai
from cables import check_missing
from tsa_rules import apply_rules

BASE = os.path.dirname(os.path.abspath(__file__))
FRONTEND = os.path.join(BASE, "..", "frontend")
DATA_FILE = os.path.join(BASE, "items.json")
MAX_UPLOAD = 8 * 1024 * 1024

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD
_lock = threading.Lock()


# ---------- tiny storage (a JSON file, survives restarts) ----------
def load_items():
    try:
        with open(DATA_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def save_items_file(items):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)


# ---------- CORS (so the frontend on port 8000 can call port 5000) ----------
@app.after_request
def add_cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
    return resp


def err(msg, code=400):
    return jsonify({"error": msg}), code


@app.errorhandler(413)
def too_big(_e):
    return err("That photo is too large (max 8 MB).", 413)


# ---------- routes ----------
@app.get("/api/health")
def health():
    return jsonify({"ok": True, "ai_key_set": bool(os.environ.get("GEMINI_API_KEY")),
                    "fake_ai": os.environ.get("USE_FAKE_AI") == "1"})


@app.post("/api/scan")
def scan():
    """multipart: image + bag  ->  {detected: [...]}   (nothing is saved yet)"""
    file = request.files.get("image")
    if not file:
        return err("No photo was sent.")
    bag = "suitcase" if request.form.get("bag") == "suitcase" else "carry_on"
    data = file.read()
    if not data:
        return err("That photo is empty.")
    mime = file.mimetype if (file.mimetype or "").startswith("image/") else "image/jpeg"

    if os.environ.get("USE_FAKE_AI") == "1":
        found = _fake_scan()
    else:
        try:
            found = gen_ai.identify_items(data, mime)
        except RuntimeError as e:
            return err(str(e), 502)

    for it in found:
        it["bag"] = bag
        apply_rules(it)  # TSA rules list has the final say
    return jsonify({"detected": found})


@app.get("/api/items")
def list_items():
    bag = request.args.get("bag")
    items = load_items()
    if bag in ("carry_on", "suitcase"):
        items = [i for i in items if i["bag"] == bag]
    return jsonify({"items": items})


@app.post("/api/items")
def add_items():
    """JSON {bag, items} -> {items: [ALL items]}. Same name in same bag = quantity goes up."""
    body = request.get_json(silent=True) or {}
    bag = "suitcase" if body.get("bag") == "suitcase" else "carry_on"
    incoming = body.get("items")
    if not isinstance(incoming, list):
        return err("Expected a list of items.")
    with _lock:
        items = load_items()
        for raw in incoming:
            if not isinstance(raw, dict) or not str(raw.get("name", "")).strip():
                continue
            new = gen_ai._clean([raw])
            if not new:
                continue
            it = new[0]
            it["bag"] = bag
            apply_rules(it)
            if it["tsa_status"] == "prohibited":
                continue  # never add items TSA does not allow
            same = next((i for i in items if i["bag"] == bag and i["name"].lower() == it["name"].lower()), None)
            if same:
                same["quantity"] = min(99, same.get("quantity", 1) + it["quantity"])
            else:
                it["id"] = "itm_" + uuid.uuid4().hex[:8]
                items.append(it)
        save_items_file(items)
    return jsonify({"items": items})


@app.patch("/api/items/<item_id>")
def update_item(item_id):
    body = request.get_json(silent=True) or {}
    try:
        qty = int(body.get("quantity"))
    except (TypeError, ValueError):
        return err("quantity must be a number.")
    if not 1 <= qty <= 99:
        return err("quantity must be between 1 and 99.")
    with _lock:
        items = load_items()
        item = next((i for i in items if i["id"] == item_id), None)
        if not item:
            return err("Item not found.", 404)
        item["quantity"] = qty
        save_items_file(items)
    return jsonify({"ok": True, "item": item})


@app.delete("/api/items/<item_id>")
def delete_item(item_id):
    with _lock:
        items = load_items()
        kept = [i for i in items if i["id"] != item_id]
        save_items_file(kept)
    return jsonify({"ok": True, "deleted": len(items) - len(kept)})


@app.post("/api/finish")
def finish():
    """Checks BOTH bags for missing chargers/cables."""
    missing = check_missing(load_items())
    return jsonify({"ok": not missing, "missing": missing})


# ---------- serve the frontend too (open http://127.0.0.1:5000) ----------
@app.get("/")
def home():
    return send_from_directory(FRONTEND, "index.html")


@app.get("/<path:path>")
def static_files(path):
    if path.startswith("api/"):
        return err("Not found.", 404)
    return send_from_directory(FRONTEND, path)


_fake_n = 0
def _fake_scan():
    global _fake_n
    sets = [
        [{"name": "Phone", "category": "electronics", "quantity": 1, "needs_charging": True, "charge_type": "usb_c", "provides_charge": [], "tsa_status": "allowed", "tsa_note": "", "confidence": 0.9},
         {"name": "Scissors", "category": "sharp", "quantity": 1, "needs_charging": False, "charge_type": "none", "provides_charge": [], "tsa_status": "allowed", "tsa_note": "", "confidence": 0.8}],
        [{"name": "Fireworks", "category": "other", "quantity": 1, "needs_charging": False, "charge_type": "none", "provides_charge": [], "tsa_status": "allowed", "tsa_note": "", "confidence": 0.8},
         {"name": "USB-C cable", "category": "electronics", "quantity": 1, "needs_charging": False, "charge_type": "none", "provides_charge": ["usb_c"], "tsa_status": "allowed", "tsa_note": "", "confidence": 0.9}],
    ]
    _fake_n += 1
    return json.loads(json.dumps(sets[(_fake_n - 1) % len(sets)]))


if __name__ == "__main__":
    # host 0.0.0.0 lets other devices on the same Wi-Fi reach it (use your computer's IP)
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
