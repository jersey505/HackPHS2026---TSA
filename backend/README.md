fly ready backend
Fly Ready uses Flask and Gemini AI to scan your bags and check items against TSA rules.

getting started for windows

1. Make sure you have Python 3.10 or newer installed then apen a terminal in the `backend` folder.
2. Install the required packages:
   py -m pip install -r requirements.txt 
3. Get a free Gemini API key at https://aistudio.google.com/apikey
4. use .env and put in your api key
5. Start the server:
  py app.py
6. Open http://127.0.0.1:5000/index.html in your browser


fly ready frontend
In js/api.js set these values depending on how you're running the app:

Using Flask to serve the frontend: USE_MOCK = false and API = ""
Running the frontend separately on port 8000: Set API = "http://127.0.0.1:5000" CORS is already configured

API routes 

| Route | Description |
|---|---|
| `POST /api/scan` | Scans an image and checks the detected items against TSA rules. Accepts `image` and `bag` as form data. Doesn't save the image. |
| `GET /api/items?bag=` | Gets the saved items for a bag. |
| `POST /api/items` | Saves items to a bag. Accepts `{bag, items}` and rejects prohibited items. |
| `PATCH /api/items/<id>` | Updates an item's quantity. |
| `DELETE /api/items/<id>` | Removes an item. |
| `POST /api/finish` | Checks whether any chargers or cables are missing. Accepts `{ok, missing:[...]}`. |
| `GET /api/health` | Checks the backend status and whether an API key is configured. |

editing tsa rules

The `tsa_rules.json` file contains the keywords used to identify items and their allowed status for carry-on and checked bags.

You can edit this file to change the rules. These rules take priority over the AI's results.


