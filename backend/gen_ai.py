
import json
import os
import re

//change whats inside the brakets to change the modle that the api key uses
MODEL = "gemini-3.5-flash-lite"
//this variable tells the ai what to say after anilizing the image
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
//i used ai for this as i dont want to type this promp wrong as this could lead to ai thats anilizing the image to tell me the wronge stuff

