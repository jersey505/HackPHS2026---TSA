#Compares the item to a predetermined list, if it's on the list it overrides gemini choice
import json
import os

_PATH = os.path.join(os.path.dirname(__file__), "tsa_rules.json")
with open(_PATH, encoding="utf-8") as f:
    RULES = json.load(f)["rules"]

RANK = {"allowed": 0, "warning": 1, "prohibited": 2}


def apply_rules(item):
    """Set item['tsa_status'] / ['tsa_note'] using the rules for the item's bag.
    The stricter of (AI guess, rules list) wins."""
    bag_key = "checked" if item.get("bag") == "suitcase" else "carry_on"
    name = (item.get("name") or "").lower()
    status = item.get("tsa_status") if item.get("tsa_status") in RANK else "allowed"
    note = item.get("tsa_note") or ""
    for rule in RULES:
        if any(k in name for k in rule["keywords"]):
            rule_status = rule[bag_key]
            if RANK[rule_status] >= RANK[status]:
                status = rule_status
                note = rule["note"] if rule_status != "allowed" else ""
            break
    item["tsa_status"] = status
    item["tsa_note"] = note if status != "allowed" else ""
    return item
