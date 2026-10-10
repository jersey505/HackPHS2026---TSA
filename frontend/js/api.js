const USE_MOCK = false;
const API = "";
const MOCK_ITEMS_KEY = "flyready_mock_items";
const MOCK_SCAN_KEY = "flyready_mock_scan_n";

async function request(url, options) {
  let res;
  try {
     res = await fetch(API + url, options);
  } catch (e) {
    throw new Error("Can't reach the server. Is the backend running?");
  }
  let data = {};
  try { data = await res.json(); } catch (e) { }
  if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mockLoad() {
  try { return JSON.parse(localStorage.getItem(MOCK_ITEMS_KEY) || "[]"); } catch (e) { return []; }
}

function mockSave(items) {
  try { localStorage.setItem(MOCK_ITEMS_KEY, JSON.stringify(items)); } catch (e) { /* ignore */ }
}

function mockId() { return "itm_" + Math.random().toString(16).slice(2, 10); }

function mkItem(name, category, extra) {
  return Object.assign({
    name, category, needs_charging: false, charge_type: "none", provides_charge: [],
    tsa_status: "allowed", tsa_note: "", confidence: 0.9,
  }, extra || {});
}

const MOCK_SCANS = [
  [
    mkItem("Shirt", "clothing"),
    mkItem("Scissors", "sharp", { tsa_status: "warning", tsa_note: "Scissors with blades over 4 inches are not allowed in a carry-on." }),
  ],
  [
    mkItem("Phone", "electronics", { needs_charging: true, charge_type: "usb_c" }),
    mkItem("Fireworks", "other", { tsa_status: "prohibited", tsa_note: "Fireworks are not allowed in carry-on or checked bags." }),
  ],
  [
    mkItem("USB-C cable", "electronics", { provides_charge: ["usb_c"] }),
    mkItem("Laptop", "electronics", { needs_charging: true, charge_type: "laptop_brick" }),
    mkItem("Large shampoo bottle", "liquids", { tsa_status: "warning", tsa_note: "Liquids over 3.4 oz (100 ml) are not allowed in a carry-on. Pack it in your suitcase." }),
  ],
];

const CABLE_MESSAGES = {
  usb_c: "a USB-C cable", lightning: "a Lightning cable", micro_usb: "a micro-USB cable",
  magsafe: "a MagSafe charger", laptop_brick: "its laptop charger", proprietary: "its own charger",
};
function mockCableCheck(items) {
  const provided = new Set();
  items.forEach((i) => (i.provides_charge || []).forEach((c) => provided.add(c)));
  const missing = [];
  items.forEach((i) => {
    const needed = i.charge_type || "none";
    if (i.needs_charging && needed !== "none" && !provided.has(needed)) {
      missing.push({ item_id: i.id, item_name: i.name, needs: needed, message: i.name + " needs " + (CABLE_MESSAGES[needed] || "a charger") + "." });
    }
  });
  return { ok: missing.length === 0, missing };
}

async function getItems(bag) {
  if (USE_MOCK) {
    const items = mockLoad();
    return bag ? items.filter((i) => i.bag === bag) : items;
  }
  const data = await request("/api/items" + (bag ? "?bag=" + encodeURIComponent(bag) : ""));
  return data.items || [];
}

async function deleteItem(id) {
  if (USE_MOCK) {
    mockSave(mockLoad().filter((i) => i.id !== id));
    return { ok: true };
  }
  return request("/api/items/" + encodeURIComponent(id), { method: "DELETE" });
}

async function updateQuantity(id, quantity) {
  if (USE_MOCK) {
    const items = mockLoad();
    const it = items.find((i) => i.id === id);
    if (it) it.quantity = quantity;
    mockSave(items);
    return { ok: true };
  }
  return request("/api/items/" + encodeURIComponent(id), {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity }),
  });
}

async function scanImage(file, bag) {
  if (USE_MOCK) {
    await sleep(900);
    let n = 0;
    try { n = Number(localStorage.getItem(MOCK_SCAN_KEY) || 0); localStorage.setItem(MOCK_SCAN_KEY, String(n + 1)); } catch (e) { /* ignore */ }
    return { detected: MOCK_SCANS[n % MOCK_SCANS.length].map((x) => Object.assign({}, x)) };
  }
  const form = new FormData();
  form.append("image", file, "photo.jpg");
  form.append("bag", bag);
  return request("/api/scan", { method: "POST", body: form });
}

async function saveItems(bag, items) {
  if (USE_MOCK) {
    const current = mockLoad();
    items.forEach((it) => {
      const same = current.find((c) => c.bag === bag && norm(c.name) === norm(it.name));
      if (same) same.quantity = (same.quantity || 1) + 1;
      else current.push(Object.assign({}, it, { id: mockId(), bag, quantity: 1 }));
    });
    mockSave(current);
    return { items: current };
  }
    return request("/api/items", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bag, items }),
  });
}

async function finish() {
  if (USE_MOCK) {
    await sleep(300);
    return mockCableCheck(mockLoad());
  }
  return request("/api/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}
