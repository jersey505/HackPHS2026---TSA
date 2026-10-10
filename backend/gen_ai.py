
import json
import os
import re

#change whats inside the brakets to change the modle that the api key uses
MODEL = "gemini-3.5-flash-lite"

#this variable tells the ai what to say after anilizing the image
PROMPT = """You are helping a traveler pack. Look at the photo and list every distinct travel item you can clearly see.
Return ONLY a JSON array. Each element must have exactly these keys:
- name: short singular name, e.g. "Phone", "USB-C cable", "Shampoo bottle"
- category: one of clothing, electronics, toiletries, liquids, sharp, tools, documents, food, medicine, other
- quantity: integer count of that item in the photo (default 1)
- needs_charging: true if it has a battery that needs charging (phone, laptop, tablet, camera, headphones, power bank...)
- charge_type: what charges it - one of usb_c, lightning, micro_usb, magsafe, laptop_brick, proprietary, none
- provides_charge: list of charge types THIS item supplies if it is a cable/charger/adapter (e.g. ["usb_c"]), else []
- tsa_status: your best guess for carry-on rules: allowed, warning, or prohibited
- tsa_note: one short sentence explaining a warning/prohibited, else ""
- confidence: number from 0 to 1
Do not invent items you cannot see. If nothing is a packable item, return []."""
#i used ai for this as i dont want to type this promp wrong as this could lead to ai thats anilizing the image to tell me the wronge stuff

VALID_CHARGE = {"usb_c", "lightning", "micro_usb", "magsafe", "laptop_brick", "proprietary", "none"}
VALID_STATUS = {"allowed", "warning", "prohibited"}

#this allows for filtering of the ai's raw responce where it goes throught sevral filter parts like the first one which chekcs the list if the item identifyed is on the list if not it moves one
#then it check if its in the dictinary and moves on then it compares if the words has a charger and what kind then moves on to asine a value for how many there are with protections so it dosent go over 99 and under 1
#it then assines a confedence score and after that puts it all together into one thing that then outputs out of the block
def _clean(raw):
    out = []
    for r in raw if isinstance(raw, list) else []:
        if not isinstance(r, dict) or not str(r.get("name", "")).strip():
            continue
        charge = r.get("charge_type") if r.get("charge_type") in VALID_CHARGE else "none"
        try:
            qty = max(1, min(99, int(r.get("quantity", 1))))
        except (TypeError, ValueError):
            qty = 1
        try:
            conf = max(0.0, min(1.0, float(r.get("confidence", 0.8))))
        except (TypeError, ValueError):
            conf = 0.8
        out.append({
            "name": str(r["name"]).strip()[:60],
            "category": str(r.get("category") or "other"),
            "quantity": qty,
            "needs_charging": bool(r.get("needs_charging")),
            "charge_type": charge,
            "provides_charge": [c for c in (r.get("provides_charge") or []) if c in VALID_CHARGE and c != "none"],
            "tsa_status": r.get("tsa_status") if r.get("tsa_status") in VALID_STATUS else "allowed",
            "tsa_note": str(r.get("tsa_note") or ""),
            "confidence": conf,
        })
    return out

#i used ai for this because i dident know how to clean the text further
# Cleans and extracts JSON data from text removing Markdown wrappers.
def _parse_json(text):
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.M).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\[.*\]", text, re.S)
        return json.loads(m.group(0)) if m else []


# Uses the gemini api to analyze an image and return a json list of items
#it also gives error messages for possible errors to help the user
def identify_items(image_bytes, mime_type="image/jpeg"):
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set. Put it in backend/.env (see README).")
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise RuntimeError("Missing package. Run: pip install -r requirements.txt")
    try:
        client = genai.Client(api_key=key)
        resp = client.models.generate_content(
            model=MODEL,
            contents=[types.Part.from_bytes(data=image_bytes, mime_type=mime_type), PROMPT],
            config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.2),
        )
        return _clean(_parse_json(resp.text))
    except Exception as e:  # network, quota, bad key...
        print("GEMINI ERROR:", repr(e))
        raise RuntimeError(f"The AI could not read that photo ({type(e).__name__}). Try again.")

  
