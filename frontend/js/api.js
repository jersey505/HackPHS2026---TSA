function norm(s) { return String(s || "").toLowerCase().trim(); }

const USE_MOCK = true;

const API = "http://127.0.0.1:5000";

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(`${API}${url}`, options);
  } catch (e) {
    throw new Error("Can't reach the server. Is the backend running?");
  }
  if (!res.ok) throw new Error("Server error (" + res.status + ")");
  return res.json();
}

async function scanImage(file, bag) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800));
    return {
      detected: [
        { id: "m1", name: "Test Shirt", category: "clothing", bag, quantity: 1, tsa_status: "allowed", tsa_note: "" },
        { id: "m2", name: "Pocket Knife", category: "tool", bag, quantity: 1, tsa_status: "prohibited", tsa_note: "Knives are not allowed in carry-ons." },
        { id: "m3", name: "Perfume", category: "liquid", bag, quantity: 1, tsa_status: "warning", tsa_note: "Liquids must be 3.4 oz or less." },
      ],
    };
  }
  const form = new FormData();
  form.append("image", file, "photo.jpg");
  form.append("bag", bag);
  return request("/api/scan", { method: "POST", body: form });
}

async function saveItems(bag, items) {
  if (USE_MOCK) return { items };
  return request("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bag, items }),
  });
}
}
```
