const APP_NAME = "Fly Ready";

function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  kids.flat().forEach((c) => {
    if (c == null || c === false) return;
    n.append(c.nodeType ? c : String(c));
  });
  return n;
}

function qs(name) { return new URLSearchParams(location.search).get(name); }
function norm(s) { return String(s || "").toLowerCase().trim(); }

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const ICON_PATHS = {
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  pencil: '<path d="M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
function icon(name, label) {
  const s = el("span", { class: "icon", html: '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON_PATHS[name] + "</svg>" });
  if (label) { s.setAttribute("role", "img"); s.setAttribute("aria-label", label); }
  return s;
}

function statusSvg(kind) {
  if (kind === "prohibited") {
    return '<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><circle cx="16" cy="16" r="12" fill="#fde7e7" stroke="#c0392b" stroke-width="3"/><path d="M8 24L24 8" stroke="#c0392b" stroke-width="3" stroke-linecap="round"/></svg>';
  }
  return '<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path d="M16 4L29 26H3Z" fill="#fff3d6" stroke="#b45309" stroke-width="2.5" stroke-linejoin="round"/><path d="M16 12v7" stroke="#b45309" stroke-width="2.8" stroke-linecap="round"/><circle cx="16" cy="22.5" r="1.7" fill="#b45309"/></svg>';
}

const CATEGORY_ICON = {
  clothing: "\u{1F455}", electronics: "\u{1F4F1}", toiletries: "\u{1F9F4}", liquids: "\u{1F4A7}",
  medication: "\u{1F48A}", documents: "\u{1F4C4}", food: "\u{1F34E}", tools: "\u{1F527}",
  sharp: "✂️", weapon: "⛔", other: "\u{1F392}",
};
function categoryIcon(cat) { return CATEGORY_ICON[cat] || CATEGORY_ICON.other; }

const MASCOT_SVG =
  '<svg viewBox="0 0 64 40" aria-hidden="true">' +
  '<path d="M27 20 L15 3 L26 3 L41 19Z" fill="#9ed8f0" stroke="#23272f" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<path d="M12 19 L5 8 L13 8 L19 18Z" fill="#1aa7b5" stroke="#23272f" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<ellipse cx="33" cy="23" rx="25" ry="9.5" fill="#fff" stroke="#23272f" stroke-width="2.5"/>' +
  '<circle cx="39" cy="22" r="2.8" fill="#1aa7b5"/><circle cx="47" cy="22" r="2.8" fill="#1aa7b5"/>' +
  '<path d="M53 26 q4 -1 5 -5" fill="none" stroke="#ff9f43" stroke-width="3" stroke-linecap="round"/>' +
  "</svg>";

function renderHeader(host, opts) {
  opts = opts || {};
  document.title = (opts.title ? opts.title + " - " : "") + APP_NAME;
  host.innerHTML = "";
  if (opts.back) host.append(el("a", { class: "back", href: opts.back, "aria-label": "Back" }, icon("back")));
  host.append(el("div", { class: "mascot", html: MASCOT_SVG }));
  host.append(el("div", { class: "titles" }, el("h1", {}, opts.title || APP_NAME), opts.subtitle ? el("p", {}, opts.subtitle) : null));
}

function toast(msg, kind) {
  let box = document.getElementById("toasts");
  if (!box) { box = el("div", { id: "toasts", "aria-live": "polite" }); document.body.append(box); }
  const t = el("div", { class: "toast " + (kind || "") }, msg);
  box.append(t);
  setTimeout(() => t.remove(), 4200);
}

function showDialog(opts) {
  const dlg = el("dialog", { class: "dlg", "aria-labelledby": "dlg-title" });
  const row = el("div", { class: "dlg-actions" });
  let done = false;
  const finish = (val) => {
    if (done) return;
    done = true;
    try { dlg.close(); } catch (e) {}
    dlg.remove();
    if (opts.onClose) opts.onClose(val);
  };
  (opts.buttons || []).forEach((b) => {
    row.append(el("button", {
      class: "btn " + (b.kind || "ghost"), type: "button",
      onclick: () => { const r = b.onClick ? b.onClick(dlg) : undefined; if (r !== false) finish(b.value); },
    }, b.label));

      });
  dlg.append(el("h2", { id: "dlg-title" }, opts.title), el("div", { class: "dlg-body" }, opts.body), row);
  dlg.addEventListener("cancel", () => finish(undefined));
  document.body.append(dlg);
  dlg.showModal();
  const first = dlg.querySelector("input") || dlg.querySelector("button");
  if (first) first.focus();
  return dlg;
}

function confirmDialog(title, message, okLabel, danger) {
  return new Promise((resolve) => {
    showDialog({
      title, body: el("p", {}, message),
      buttons: [
        { label: "Cancel", value: false, kind: "ghost" },
        { label: okLabel || "OK", value: true, kind: danger ? "danger" : "primary" },
      ],
      onClose: (v) => resolve(v === true),
    });
  });
}
