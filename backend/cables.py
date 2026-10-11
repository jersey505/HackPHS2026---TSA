#this system detects missing cables
MESSAGES = {
    "usb_c": "a USB-C cable", "lightning": "a Lightning cable", "micro_usb": "a micro-USB cable",
    "magsafe": "a MagSafe charger", "laptop_brick": "its laptop charger", "proprietary": "its own charger",
}


def check_missing(items):
    provided = set()
    for i in items:
        provided.update(i.get("provides_charge") or [])
    missing = []
    for i in items:
        needed = i.get("charge_type") or "none"
        if i.get("needs_charging") and needed != "none" and needed not in provided:
            missing.append({
                "item_id": i["id"], "item_name": i["name"], "needs": needed,
                "message": f"{i['name']} needs {MESSAGES.get(needed, 'a charger')}.",
            })
    return missing
