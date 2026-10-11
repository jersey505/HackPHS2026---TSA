import json
import os

_PATH = os.path.join(os.path.dirname(__file__), "tsa_rules.json")
with open(_PATH, encoding="utf-8") as f:
    RULES = json.load(f)["rules"]

RANK = {"allowed": 0, "warning": 1, "prohibited": 2}

