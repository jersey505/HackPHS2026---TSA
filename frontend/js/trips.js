// saves trips and reminders in the browser (localStorage) and has helpers to read and change them

const TRIPS_KEY = "flyready_trips";
const DEFAULTS_KEY = "flyready_default_reminders";
const SEEDED_KEY = "flyready_seeded";
const FALLBACK_REMINDERS = ["Headphones", "Phone charger", "Toothbrush and paste"];

function readJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { }
}
function uid(prefix) { return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// default reminders: the list every new trip starts with
function getDefaultReminders() {
  const d = readJSON(DEFAULTS_KEY, null);
  return Array.isArray(d) ? d : FALLBACK_REMINDERS.slice();
}
function setDefaultReminders(list) {
  writeJSON(DEFAULTS_KEY, list.map((s) => String(s).trim()).filter(Boolean));
}
// trip structure: builds a bag, fills in missing fields, and reads/saves/finds trips
function makeBag(reminders) {
  return { itemIds: [], reminders: reminders.map((t) => ({ id: uid("r"), text: t, done: false })) };
}
function normalizeTrip(t) {
  t.bags = t.bags || {};
  ["carry_on", "suitcase"].forEach((b) => {
    t.bags[b] = t.bags[b] || { itemIds: [], reminders: [] };
    t.bags[b].itemIds = t.bags[b].itemIds || [];
    t.bags[b].reminders = t.bags[b].reminders || [];
  });
  t.bypassed = t.bypassed || {};
  return t;
}
function listTrips() { return readJSON(TRIPS_KEY, []).map(normalizeTrip); }
function saveTrips(trips) { writeJSON(TRIPS_KEY, trips); }
function getTrip(id) { return listTrips().find((t) => t.id === id) || null; }
// create and delete trips, and make one starter trip the very first time the app opens
function addTrip(opts) {
  const reminders = opts.reminders || getDefaultReminders();
  const trip = {
    id: uid("trip"), name: (opts.name || "Trip").trim(), date: opts.date || "", bypassed: {},
    bags: { carry_on: makeBag(reminders), suitcase: makeBag(reminders) },
  };
  const trips = listTrips();
  trips.push(trip);
  saveTrips(trips);
  return trip;
}

function deleteTrip(id) {
  const trips = listTrips();
  const gone = trips.find((t) => t.id === id) || null;
  saveTrips(trips.filter((t) => t.id !== id));
  return gone;
}

function ensureDefaultTrip() {
  if (!readJSON(SEEDED_KEY, false) && listTrips().length === 0) {
    addTrip({ name: "Trip 1", date: "", reminders: getDefaultReminders() });
  }
  writeJSON(SEEDED_KEY, true);
}

// item links: a trip only remembers item ids
function mutateTrip(id, fn) {
  const trips = listTrips();
  const trip = trips.find((t) => t.id === id);
  if (!trip) return null;
  fn(trip);
  saveTrips(trips);
  return trip;
}

function addItemIds(tripId, bag, ids) {
  mutateTrip(tripId, (t) => {
    ids.forEach((id) => { if (!t.bags[bag].itemIds.includes(id)) t.bags[bag].itemIds.push(id); });
  });
}
function removeItemId(tripId, bag, id) {
  mutateTrip(tripId, (t) => {
    t.bags[bag].itemIds = t.bags[bag].itemIds.filter((x) => x !== id);
    delete t.bypassed[id];
  });
}
function setBypassed(tripId, itemId, value) {
  mutateTrip(tripId, (t) => { if (value) t.bypassed[itemId] = true; else delete t.bypassed[itemId]; });
}


function toggleReminder(tripId, bag, rid) {
  mutateTrip(tripId, (t) => { const r = t.bags[bag].reminders.find((x) => x.id === rid); if (r) r.done = !r.done; });
}
function addReminder(tripId, bag, text) {
  mutateTrip(tripId, (t) => { t.bags[bag].reminders.push({ id: uid("r"), text: text.trim(), done: false }); });
}
function editReminder(tripId, bag, rid, text) {
  mutateTrip(tripId, (t) => { const r = t.bags[bag].reminders.find((x) => x.id === rid); if (r) r.text = text.trim(); });
}
function deleteReminder(tripId, bag, rid) {
  mutateTrip(tripId, (t) => { t.bags[bag].reminders = t.bags[bag].reminders.filter((x) => x.id !== rid); });
}
