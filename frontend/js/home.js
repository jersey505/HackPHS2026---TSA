// home page: lists your trips, shows how many items are in each bag, and lets you add or delete trips

(function () {
  renderHeader(document.getElementById("top"), { subtitle: "Pack smart. Fly ready." });
  ensureDefaultTrip();

 const host = document.getElementById("trips");
 document.getElementById("add-trip").addEventListener("click", openAddTrip);
  render();

  async function render() {
    const trips = listTrips();
    let items = [];
     try { items = await getItems(); } catch (e) { toast(e.message, "error"); }
    host.innerHTML = "";
    if (!trips.length) {
      host.append(el("div", { class: "empty" },
        el("div", { class: "mascot", html: MASCOT_SVG }),
        "No trips yet. Tap \"Add new travel\" to start packing!"));
      return;
    }
    trips.forEach((t, i) => host.append(tripCard(t, i, items)));
  }
  // bag buttons: counts the items in a bag and shows a badge when something needs attention
function bagInfo(trip, bag, items) {
    const ids = new Set(trip.bags[bag].itemIds);
    const mine = items.filter((i) => ids.has(i.id));
    const count = mine.reduce((n, i) => n + (i.quantity || 1), 0);
    const issues = mine.filter((i) => i.tsa_status !== "allowed" && !(i.tsa_status === "warning" && trip.bypassed[i.id]));
    const worst = issues.some((i) => i.tsa_status === "prohibited") ? "prohibited" : issues.length ? "warning" : "";
    return { count, issues: issues.length, worst };
  }

  function bagButton(trip, bag, label, items) {
    const info = bagInfo(trip, bag, items);
    const badge = info.issues
      ? el("span", { class: "badge " + info.worst },
          el("span", { "aria-hidden": "true" }, String(info.issues)),
          el("span", { class: "sr-only" }, info.issues + (info.issues === 1 ? " item needs attention" : " items need attention")))
      : null;
    return el("a", { class: "bag-btn", href: "bag.html?trip=" + encodeURIComponent(trip.id) + "&bag=" + bag },
      el("span", { class: "bag-label" }, label),
      el("span", { class: "bag-count" }, info.count + (info.count === 1 ? " item" : " items")),
      badge);
  }
    // trip card picture with color changes
  
 function tripScene(i) {
    const skies = ["#b5e3f6", "#c9ecd9", "#ffe0b8"];
    const accents = ["#1aa7b5", "#2ea66b", "#ff9f43"];
    const sky = skies[i % 3], acc = accents[i % 3];
    return el("div", { class: "scene", "aria-hidden": "true", html:
      '<svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice">' +
      '<rect width="400" height="120" fill="' + sky + '"/>' +
      '<g fill="#fff"><ellipse cx="70" cy="32" rx="34" ry="12"/><ellipse cx="96" cy="38" rx="26" ry="10"/>' +
      '<ellipse cx="310" cy="24" rx="30" ry="10"/><ellipse cx="334" cy="30" rx="22" ry="8"/></g>' +
      '<g transform="translate(150 22) scale(1.5)">' +
      '<path d="M27 20 L15 3 L26 3 L41 19Z" fill="#fff" stroke="#23272f" stroke-width="2" stroke-linejoin="round"/>' +
      '<ellipse cx="33" cy="23" rx="25" ry="9.5" fill="#fff" stroke="#23272f" stroke-width="2"/>' +
      '<path d="M12 19 L5 8 L13 8 L19 18Z" fill="' + acc + '" stroke="#23272f" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="39" cy="22" r="2.6" fill="' + acc + '"/><circle cx="47" cy="22" r="2.6" fill="' + acc + '"/></g>' +
      '<g transform="translate(300 62)"><rect x="0" y="12" width="52" height="40" rx="9" fill="' + acc + '" stroke="#23272f" stroke-width="3"/>' +
      '<path d="M16 12V6a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6" fill="none" stroke="#23272f" stroke-width="3"/>' +
      '<path d="M14 12v40M38 12v40" stroke="#23272f" stroke-opacity=".35" stroke-width="3"/></g>' +
      '<path d="M0 108 Q100 94 200 106 T400 100 V120 H0Z" fill="#fff" fill-opacity=".6"/></svg>' });
  }
  // creates trip card that includes picture, name, date, delete button and the two bag buttons
   function tripCard(trip, i, items) {
    const trash = el("button", {
      class: "icon-btn", type: "button", "aria-label": "Delete trip " + trip.name,
      onclick: () => deleteTripFlow(trip),
    }, icon("trash"));
    return el("article", { class: "trip-card" },
      tripScene(i),
      el("div", { class: "trip-info" },
        el("div", {},
          el("h2", { class: "trip-name" }, trip.name),
          el("p", { class: "trip-date" }, trip.date ? formatDate(trip.date) : "No date set")),
        trash),
      el("div", { class: "bag-buttons" },
        bagButton(trip, "carry_on", "Carry-on", items),
        bagButton(trip, "suitcase", "Suitcase", items)));
  }
  // delete a trip: asks first, then removes the trip and its items from the server
   async function deleteTripFlow(trip) {
    const ok = await confirmDialog("Delete this trip?",
      "\"" + trip.name + "\" and everything packed in it will be removed.", "Delete", true);
    if (!ok) return;
    const gone = deleteTrip(trip.id);
    if (gone) {
      const ids = gone.bags.carry_on.itemIds.concat(gone.bags.suitcase.itemIds);
      await Promise.allSettled(ids.map((id) => deleteItem(id)));
    }
    toast("Trip deleted", "good");
    render();
  }
  // add new trip popup: name, date and an editable list of reminders
function openAddTrip()  {
    let reminders = getDefaultReminders();
    const nameInput = el("input", { type: "text", id: "trip-name", placeholder: "Trip name", maxlength: "40", autocomplete: "off" });
    const dateInput = el("input", { type: "date", id: "trip-date" });
    const list = el("div", {});

function drawReminders() {
     list.innerHTML = "";
     reminders.forEach((text, idx) => {
        const input = el("input", { type: "text", value: text, "aria-label": "Reminder " + (idx + 1), maxlength: "60" });
        input.addEventListener("input", () => { reminders[idx] = input.value; });
        list.append(el("div", { class: "rem-edit-row" }, input,
          el("button", {
            class: "icon-btn", type: "button", "aria-label": "Delete reminder " + text,
            onclick: () => { reminders.splice(idx, 1); drawReminders(); },
          }, icon("trash"))));
      });
      list.append(el("button", {
        class: "btn ghost small", type: "button",
        onclick: () => { reminders.push(""); drawReminders(); const ins = list.querySelectorAll("input"); ins[ins.length - 1].focus(); },
      }, icon("plus"), "Add reminder"));
    }
    drawReminders();
 const body = el("div", {},
      el("label", { class: "field" }, el("span", {}, "Trip name"), nameInput),
      el("label", { class: "field" }, el("span", {}, "Date (optional)"), dateInput),
      el("p", { class: "field" }, el("span", {}, "Reminders for each bag")),
      list);

    showDialog({
      title: "Add new travel", body,
      buttons: [
        { label: "Cancel", kind: "ghost", value: false },
        {
          label: "Create trip", kind: "primary", value: true,
          onClick: () => {
            const name = nameInput.value.trim();
            if (!name) { toast("Give your trip a name first.", "error"); nameInput.focus(); return false; }
            const clean = reminders.map((s) => s.trim()).filter(Boolean);
            setDefaultReminders(clean); // customizing here changes the defaults for next time too
            addTrip({ name, date: dateInput.value, reminders: clean });
            toast("Trip created!", "good");
            render();
          },
        },
      ],
    });
  }
})();
