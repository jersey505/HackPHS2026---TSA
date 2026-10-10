const params = new URLSearchParams(location.search);
const bag = params.get("bag") || "carry_on";

const photoInput = document.getElementById("photo");
const preview = document.getElementById("preview");
const scanBtn = document.getElementById("scan-btn");
const statusEl = document.getElementById("status");
const detectedEl = document.getElementById("detected");
const addBtn = document.getElementById("add-btn");

let selectedFile = null;
let detected = [];

// Shrink the photo to about 1024 px wide so uploads are fast.
function resizeImage(file, maxWidth = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.85);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

photoInput.addEventListener("change", () => {
  selectedFile = photoInput.files[0];
  if (!selectedFile) return;
  preview.src = URL.createObjectURL(selectedFile);
  preview.style.display = "block";
  scanBtn.disabled = false;
});

scanBtn.addEventListener("click", async () => {
  scanBtn.disabled = true;
  statusEl.textContent = "Scanning...";
  try {
    const small = await resizeImage(selectedFile);
    const result = await scanImage(small, bag);
    detected = result.detected || [];
    renderDetected();
    statusEl.textContent = detected.length ? "" : "No items found. Try a clearer photo.";
  } catch (err) {
    statusEl.textContent = "Scan failed: " + err.message;
  }
  scanBtn.disabled = false;
});

function addable() {
  return detected.filter((x) => x.tsa_status !== "prohibited");
}

function renderDetected() {
  detectedEl.innerHTML = "";
  detected.forEach((item, i) => {
    const li = document.createElement("li");
    let text = item.name;
    if (item.tsa_status === "prohibited") text += " - NOT ALLOWED by TSA. " + (item.tsa_note || "");
    else if (item.tsa_status === "warning") text += " - Warning: " + (item.tsa_note || "");
    li.textContent = text + " ";
    if (item.tsa_status === "prohibited") li.style.color = "#c0392b";
    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.onclick = () => { detected.splice(i, 1); renderDetected(); };
    li.appendChild(remove);
    detectedEl.appendChild(li);
  });
  addBtn.style.display = addable().length ? "inline-flex" : "none";
}

addBtn.addEventListener("click", async () => {
  try {
    await saveItems(bag, addable());
    location.href = "index.html";
  } catch (err) {
    statusEl.textContent = "Could not save: " + err.message;
  }
});
