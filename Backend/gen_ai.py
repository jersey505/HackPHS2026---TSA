from google import genai
from google.genai import types

import json
import os

client = genai.Client()

def run_gen_ai(imagePath):
   inputImage = client.files.upload(file=imagePath)

   prompt = """
   Detect the items in this image and respond in the following JSON format:

   {
      "items": [
         {
            "itemName": "",
            "prohibited": false,
            "warning": false,
            "reason": null,
            "cableType": null,
            "isCable": false
         }
      ]
   }

   Rules:
   - itemName: The name of the detected item.
   - prohibited: A boolean indicating whether the item is prohibited under applicable TSA rules.
   - warning: A boolean indicating whether the item requires special attention, has restrictions, or may need additional screening.
   - reason: If prohibited or warning is true, explain why in a short string. Otherwise, use null.
   - cableType: If the item requires a cable, specify the type of cable it needs. Otherwise, use null.
   - isCable: A boolean indicating whether the detected item itself is a cable.
   - If isCable is true, set cableType to the detected cable type.
   - Do not invent items that cannot reasonably be identified in the image.
   - Include every identifiable item, including cables and accessories.
   - Use these standardized connector names:
     USB-A, USB-C, Micro-USB, Mini-USB, Lightning, HDMI,
     Mini-HDMI, Micro-HDMI, DisplayPort, Mini-DisplayPort,
     Ethernet, 3.5mm-Audio, RCA-Audio, Optical-Audio, SATA,
     IEC-Power, AC-Power, DC-Barrel.
   - For cables, use CONNECTOR-to-CONNECTOR format.
     Examples: USB-C-to-USB-C, USB-A-to-USB-C,
     USB-C-to-Lightning.
   - Do not guess a cable's connector type if it cannot be identified.
   - Return valid JSON only.
   """

   response = client.models.generate_content(
      model="gemini-3.5-flash-lite",
      contents=[
         inputImage,
         prompt
      ],
      config=types.GenerateContentConfig(
         response_mime_type="application/json"
      )
   )
   
   response = client.models.generate_content(
      model="gemini-3.5-flash-lite",
      contents=[
         inputImage,
         prompt
      ],
      config=types.GenerateContentConfig(
         response_mime_type="application/json"
      )
   )

   data = json.loads(response.text)
   return data
