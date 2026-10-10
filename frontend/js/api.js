```javascript
const USE_MOCK = false;
const API = "http://172.16.240.112:5000";

async function request(url, options = {}) {
  const response = await fetch(`${API}${url}`, options);

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Server returned invalid JSON (HTTP ${response.status})`);
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

async function scanImage(file, bag) {
  if (USE_MOCK) {
    return {
      detected: [
        {
          name: "Test Shirt",
          category: "clothing",
          needs_charging: false,
          charge_type: "none",
          provides_charge: [],
          tsa_status: "allowed",
          tsa_note: "",
          confidence: 0.95
        }
      ]
    };
  }

  const form = new FormData();
  form.append("image", file, "photo.jpg");
  form.append("bag", bag);

  return request("/api/scan", {
    method: "POST",
    body: form
  });
}

async function saveItems(bag, items) {
  if (USE_MOCK) {
    return { items };
  }

  return request("/api/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ bag, items })
  });
}
```
