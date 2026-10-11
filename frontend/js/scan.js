// scan page: pick a photo, send it to the ai, review the items it found (warnings first), then add them to the bag
(function () {
const trip = getTrip(qs("trip")) || listTrips()[0];
if (!trip) { location.replace("index.html"); return; }
const tripId = trip.id;
const keys = bagKeys(trip);
const bag = keys.includes(qs("bag")) ? qs("bag") : keys[0];
const BAG_LABEL = bagLabel(trip, bag);
const backUrl = "bag.html?trip=" + encodeURIComponent(tripId) + "&bag=" + bag;
renderHeader(document.getElementById("top"), { title: "Scan", subtitle: trip.name + " - " + BAG_LABEL, back: backUrl });  

const photoInput = document.getElementById("photo");
const camInput = document.getElementById("photo-cam");
const camBtn = document.getElementById("cam-btn");
const preview = document.getElementById("preview");
const scanBtn = document.getElementById("scan-btn");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("detected");
const addBtn = document.getElementById("add-btn");

let selectedFile = null;
  let detected = [];
  const RANK = { prohibited: 0, warning: 1, allowed: 2 };
   // shrinks the photo to about 1024px wide so the upload is fast
  function resizeImage(file, maxWidth) {
  maxWidth = maxWidth || 1024;
  return new Promise((resolve) => {
    const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.85);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }
// choosing a photo: shows a preview and turns on the scan button
  // a chosen or captured photo: shows a preview and turns on the scan button
  function setFile(file) {
    if (!file) return;
    selectedFile = file;
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    scanBtn.disabled = false;
    statusEl.textContent = "";
  }
  photoInput.addEventListener("change", () => setFile(photoInput.files[0]));
  camInput.addEventListener("change", () => setFile(camInput.files[0]));

  // take a photo: phones open their camera app, computers open the webcam in a popup
  camBtn.addEventListener("click", async () => {
   const isPhone = window.matchMedia("(pointer: coarse) and (hover: none)").matches;
       const canUseWebcam = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
       if (isPhone) { camInput.click(); return; }
       if (!canUseWebcam) {
         // browsers only allow the webcam on https or localhost
         toast("Webcam needs https or http://127.0.0.1:5000. Opening file picker instead.", "error");
         camInput.click();
         return;
       }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    } catch (e) {
      toast("Couldn't open a camera. Use \"Choose a photo\" instead.", "error");
      return;
    }
    const video = el("video", { class: "cam-video", autoplay: true, playsinline: true });
    video.muted = true;
    video.srcObject = stream;
    video.play().catch(() => {});
    showDialog({
      title: "Take a photo", body: video,
      buttons: [
        { label: "Cancel", kind: "ghost", value: false },
        {
          label: "Capture", kind: "primary", value: true,
          onClick: () => {
            if (!video.videoWidth) return false;
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d").drawImage(video, 0, 0);
            canvas.toBlob((blob) => { if (blob) setFile(new File([blob], "photo.jpg", { type: "image/jpeg" })); }, "image/jpeg", 0.9);
          },
        },
      ],
      onClose: () => stream.getTracks().forEach((t) => t.stop()),
    });
  });
  // scan button: sends the photo to the backend and sorts the results with warnings first
scanBtn.addEventListener("click", async () => {
    scanBtn.disabled = true;
    scanBtn.replaceChildren(el("span", { class: "spinner", "aria-hidden": "true" }), "Scanning...");
    statusEl.textContent = "";
    try {
       const small = await resizeImage(selectedFile);
      const result = await scanImage(small, bag);
      detected = (result.detected || []).map((x) => Object.assign({}, x, { _skipped: false }));
      detected.sort((a, b) => (RANK[a.tsa_status] ?? 2) - (RANK[b.tsa_status] ?? 2)); 
      statusEl.textContent = detected.length ? "" : "No items found. Try a clearer photo.";
      renderDetected();
    } catch (e) {
      toast(e.message, "error");
    }
    scanBtn.textContent = "Scan again";
    scanBtn.disabled = false;
  });

 function renderDetected() {
    listEl.innerHTML = "";
    detected.forEach((item, idx) => {
      const status = item.tsa_status || "allowed";
      const buttons = [];
      buttons.push(el("button", { type: "button", class: "btn ghost small", onclick: () => { detected.splice(idx, 1); renderDetected(); } }, "Remove"));
      if (status === "warning" && !item._skipped) {
        buttons.push(el("button", { type: "button", class: "btn primary small", onclick: () => { item._skipped = true; renderDetected(); } }, "Skip"));
      }

 let chip, note = null;
      if (status === "prohibited") {
        chip = el("span", { class: "chip prohibited" }, "Not allowed by TSA");
        note = el("p", { class: "note" }, item.tsa_note || "TSA does not allow this item. It will not be added.");
      } else if (status === "warning") {
        chip = el("span", { class: "chip warning" }, item._skipped ? "Warning skipped" : "Warning");
        note = el("p", { class: "note" }, item.tsa_note || "This item may not be approved.");
      } else {
        chip = el("span", { class: "chip allowed" }, "OK");
      }

      listEl.append(el("article", { class: "detected " + status },
        el("div", { class: "tile", "aria-hidden": "true" }, categoryIcon(item.category)),
        el("div", { class: "body" },
          el("h3", {}, item.name), chip, note,
          status !== "allowed" ? el("span", { class: "fine" }, "AI-generated, check tsa.gov") : null,
          el("div", { class: "row-btns" }, buttons))));
    });
    updateAddButton();
  }

  function addable() { return detected.filter((x) => x.tsa_status !== "prohibited"); }
  function pending() { return detected.filter((x) => x.tsa_status === "warning" && !x._skipped); }
  // add button rules
  function updateAddButton() {
    const n = addable().length;
    addBtn.textContent = n ? "Add " + n + (n === 1 ? " item" : " items") + " to " + BAG_LABEL.toLowerCase() : "Add to bag";
    addBtn.disabled = n === 0 || pending().length > 0;
    if (pending().length) statusEl.textContent = "Skip or remove each warning first.";
    else if (detected.length) statusEl.textContent = "";
  }
    // add button: saves the items, links them to this trip, then goes back to the bag page
  addBtn.addEventListener("click", async () => {
    const toAdd = addable();
    addBtn.disabled = true;
    try {
      const payload = toAdd.map((it) => { const c = Object.assign({}, it); delete c._skipped; return c; });
      const res = await saveItems(bag, payload);
      const all = res.items || [];
      toAdd.forEach((it) => {
        const match = all.find((x) => x.bag === bag && norm(x.name) === norm(it.name));
        if (match) {
          addItemIds(tripId, bag, [match.id]);
          if (it._skipped) setBypassed(tripId, match.id, true);
        }
      });
      location.href = backUrl;
    } catch (e) {
      toast(e.message, "error");
      updateAddButton();
    }
  });
})();
      
