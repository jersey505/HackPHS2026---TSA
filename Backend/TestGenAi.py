
import os
import json
from gen_ai import run_gen_ai

imageFolder = "TestImages"

for imageName in os.listdir(imageFolder):
   imagePath = os.path.join(imageFolder, imageName)

   if imageName.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
      print(f"\nTesting: {imageName}")

      try:
         data = run_gen_ai(imagePath)

         if isinstance(data, str):
            data = json.loads(data)

         for item in data["items"]:
            print(f"Item: {item['itemName']}")
            print(f"Prohibited: {item['prohibited']}")
            print(f"Warning: {item['warning']}")
            print(f"Reason: {item['reason']}")
            print(f"Cable Type: {item['cableType']}")
            print(f"Is Cable: {item['isCable']}")
            print("-" * 30)

      except Exception as error:
         print(f"Error processing {imageName}: {error}")