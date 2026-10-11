// bag page: shows one bag's items, lets you change or remove them, manages reminders, and runs the final check

(function () {
  const first = getTrip(qs("trip")) || listTrips()[0];
  if (!first) { location.replace("index.html"); return; }
  const tripId = first.id;
  let items = [];
  const allowed = bagKeys(first);
  let bag = allowed.includes(qs("bag")) ? qs("bag") : allowed[0];
  const BAG_LABEL = new Proxy({}, { get: (_, b) => bagLabel(first, b) });

  const itemsEl = document.getElementById("items");
  const remEl = document.getElementById("reminders");
  const toggleEl = document.getElementById("toggle");
  document.getElementById("done-btn").addEventListener("click", runDone);
  // draws the whole page: header, scan link, bag toggle, reminders and items
  renderAll();

  async function renderAll() {
    const trip = getTrip(tripId);
    renderHeader(document.getElementById("top"), {
      title: trip.name, subtitle: BAG_LABEL[bag], back: "index.html",
    });
    document.getElementById("scan-link").href = "scan.html?trip=" + encodeURIComponent(tripId) + "&bag=" + bag;
    renderToggle();
    renderReminders();
    await loadItems();
  }
  
  // loads this trip's items from the server and keeps only the ones in this bag
  async function loadItems() {
    try {
      const all = await getItems(bag);
      const ids = new Set(getTrip(tripId).bags[bag].itemIds);
      items = all.filter((i) => ids.has(i.id));
    } catch (e) {
      items = [];
      toast(e.message, "error");
    }
    renderItems();
  }

  function renderToggle() {
    toggleEl.innerHTML = "";
    allowed.forEach((b) => {
      toggleEl.append(el("button", {
        type: "button", class: b === bag ? "active" : "", "aria-pressed": b === bag ? "true" : "false",
        onclick: () => {
          if (b === bag) return;
          bag = b;
          history.replaceState(null, "", "bag.html?trip=" + encodeURIComponent(tripId) + "&bag=" + bag);
          renderAll();
        },
      }, BAG_LABEL[b]));
    });
  }
  
  // item list: one row per item with its icon, name, quantity buttons and warning icon
  function renderItems() {
    itemsEl.innerHTML = "";
    if (!items.length) {
      itemsEl.append(el("div", { class: "empty card" },
        el("div", { class: "mascot", html: MASCOT_SVG }),
        "Nothing packed yet. Tap Scan!"));
      return;
    }
    const trip = getTrip(tripId);
    items.forEach((item) => {
      const bypassed = item.tsa_status === "warning" && trip.bypassed[item.id];
      let status = el("span", { class: "status-spacer" });
      if (item.tsa_status === "warning" || item.tsa_status === "prohibited") {
        const label = item.tsa_status === "prohibited" ? "not allowed by TSA" : bypassed ? "warning bypassed" : "warning";
        status = el("button", {
          type: "button", class: "status-btn" + (bypassed ? " muted" : ""),
          "aria-label": item.name + ": " + label + ". Tap for details.",
          html: statusSvg(item.tsa_status),
          onclick: () => openStatus(item),
        });
      }
      itemsEl.append(el("div", { class: "item-row" },
        el("div", { class: "tile", "aria-hidden": "true" }, categoryIcon(item.category)),
        el("div", { class: "item-name" }, item.name),
        el("div", { class: "qty" },
          el("button", { type: "button", "aria-label": "Fewer " + item.name, onclick: () => changeQty(item, -1) }, icon("minus")),
          el("span", { class: "num", "aria-live": "polite" }, String(item.quantity || 1)),
          el("button", { type: "button", "aria-label": "More " + item.name, onclick: () => changeQty(item, 1) }, icon("plus"))),
        status));
    });
  }

  // item actions: change the quantity (asks before removing at zero) and delete an item
  async function changeQty(item, delta) {
    const next = (item.quantity || 1) + delta;
    if (next < 1) {
      const ok = await confirmDialog("Remove " + item.name + "?", "It will be taken out of your " + BAG_LABEL[bag].toLowerCase() + ".", "Remove", true);
      if (ok) removeItem(item);
      return;
    }
    if (next > 99) return;
    try {
      await updateQuantity(item.id, next);
      item.quantity = next;
      renderItems();
    } catch (e) { toast(e.message, "error"); }
  }

  async function removeItem(item) {
    try {
      await deleteItem(item.id);
      removeItemId(tripId, bag, item.id);
      await loadItems();
    } catch (e) { toast(e.message, "error"); }
  }
  
  // popup shown when you tap a warning icon: explains the problem, lets you remove or bypass
  function openStatus(item) {
    const trip = getTrip(tripId);
    const bypassed = trip.bypassed[item.id];
    const prohibited = item.tsa_status === "prohibited";
    const text = el("div", {},
      el("p", {}, prohibited
        ? (item.name + ": " + (item.tsa_note || "TSA does not allow this item."))
        : ("Warning: " + (item.tsa_note || item.name + " may not be approved."))),
      el("span", { class: "fine" }, "AI-generated, check tsa.gov"));
    const buttons = [{ label: "Remove", kind: "danger", value: "remove", onClick: () => { removeItem(item); } }];
    if (!prohibited && !bypassed) {
      buttons.push({ label: "Bypass", kind: "primary", value: "bypass", onClick: () => { setBypassed(tripId, item.id, true); renderItems(); } });
    } else {
      buttons.push({ label: "Close", kind: "ghost", value: "close" });
    }
    showDialog({ title: prohibited ? "Not allowed by TSA" : "Warning", body: text, buttons });
  }

  // reminders: checklist you can tick, edit, delete, and add to
  function renderReminders() {
    const trip = getTrip(tripId);
    remEl.innerHTML = "";
    remEl.append(el("h2", { id: "rem-title" }, "Reminders for your " + BAG_LABEL[bag].toLowerCase()));
    const ul = el("ul", { class: "rem-list" });
    trip.bags[bag].reminders.forEach((r) => {
      ul.append(el("li", { class: "rem-row" },
        el("button", {
          type: "button", class: "rem-check", "aria-pressed": r.done ? "true" : "false",
          onclick: () => { toggleReminder(tripId, bag, r.id); renderReminders(); },
        }, el("span", { class: "rem-box" }, icon("check")), el("span", { class: "rem-text" }, r.text)),
        el("button", { type: "button", class: "icon-btn", "aria-label": "Edit reminder " + r.text, onclick: () => editFlow(r) }, icon("pencil")),
        el("button", { type: "button", class: "icon-btn", "aria-label": "Delete reminder " + r.text, onclick: () => { deleteReminder(tripId, bag, r.id); renderReminders(); } }, icon("trash"))));
    });
    remEl.append(ul);

    const input = el("input", { type: "text", placeholder: "Add a reminder", "aria-label": "New reminder", maxlength: "60" });
    const form = el("form", { class: "add-row" }, input,
      el("button", { class: "btn primary small", type: "submit" }, icon("plus"), "Add"));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      addReminder(tripId, bag, input.value);
      renderReminders();
      remEl.querySelector("input").focus();
    });
    remEl.append(form);
  }

  function editFlow(r) {
    const input = el("input", { type: "text", value: r.text, "aria-label": "Reminder text", maxlength: "60" });
    showDialog({
      title: "Edit reminder", body: input,
      buttons: [
        { label: "Cancel", kind: "ghost", value: false },
        {
          label: "Save", kind: "primary", value: true,
          onClick: () => {
            if (!input.value.trim()) { toast("A reminder can't be empty.", "error"); return false; }
            editReminder(tripId, bag, r.id, input.value);
            renderReminders();
          },
        },
      ],
    });
  }

  async function runDone() {
    const btn = document.getElementById("done-btn");
    btn.disabled = true;
    try {
      const trip = getTrip(tripId);
      const res = await finish();
      const mine = new Set(Object.values(trip.bags).flatMap((b) => b.itemIds));
      const missing = (res.missing || []).filter((m) => mine.has(m.item_id));
      const all = await getItems();
      const banned = all.filter((i) => mine.has(i.id) && i.tsa_status === "prohibited");
      const open = [];
      allowed.forEach((b) => trip.bags[b].reminders.forEach((r) => {
        if (!r.done) open.push(BAG_LABEL[b] + ": " + r.text);
      }));
      showResult(missing, banned, open);
    } catch (e) {
      toast(e.message, "error");
    }
    btn.disabled = false;
  }
// result popup: "all set" if clean, otherwise lists what is missing, banned or unchecked
  function showResult(missing, banned, open) {
    const body = el("div", {});
    const clean = !missing.length && !banned.length;
    if (clean) body.append(el("div", { class: "dlg-mascot", html: MASCOT_SVG }), el("p", {}, "Nothing is missing from your carry-on or suitcase."));
    const ul = el("ul", { class: "missing-list" });
    missing.forEach((m) => ul.append(el("li", {}, el("span", { html: statusSvg("warning") }), m.message)));
    banned.forEach((b) => ul.append(el("li", { class: "bad" }, el("span", { html: statusSvg("prohibited") }), b.name + " is not allowed by TSA. Remove it.")));
    if (ul.children.length) body.append(ul);
    if (open.length) {
      const rl = el("ul", { class: "missing-list" });
      open.forEach((t) => rl.append(el("li", { class: "note" }, "Still unchecked - " + t)));
      body.append(el("p", { class: "fine" }, "Reminders left:"), rl);
    }
    showDialog({
      title: clean ? "All set!" : "Almost ready", body,
      buttons: [{ label: "Close", kind: "primary", value: true }],
    });
  }
})();
