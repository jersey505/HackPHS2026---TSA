// Set to false once the backend endpoints are live.
const USE_MOCK = true;

async function request(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function scanImage(file, bag) {
  if (USE_MOCK) {
    return {
      detected: [
        { name: "Shirt", category: "clothing", needs_charging: false, charge_type: "none",
          provides_charge: [], tsa_status: "allowed", tsa_note: "", confidence: 0.95 },
        { name: "Scissors", category: "sharp", needs_charging: false, charge_type: "none",
          provides_charge: [], tsa_status: "warning",
          tsa_note: "Scissors with blades over 4 inches are not allowed in a carry-on.", confidence: 0.8 },
      ],
    };
  }
  const form = new FormData();
  form.append("image", file, "photo.jpg");
  form.append("bag", bag);
  return request("/api/scan", { method: "POST", body: form });
}

async function saveItems(bag, items) {
  if (USE_MOCK) {
    return { items: items };
  }
  return request("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bag, items }),
  });
}
