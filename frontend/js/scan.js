```javascript
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

function resizeImage(file, maxWidth = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");

        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Could not process the image.");
        }

        context.drawImage(
          img, 0, 0, canvas.width, canvas.height
        );

        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);

          if (!blob) {
            reject(new Error("Could not resize the image."));
            return;
          }

          resolve(blob);
        }, "image/jpeg", 0.85);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load the selected image."));
    };

    img.src = objectUrl;
  });
}

photoInput.addEventListener("change", () => {
  selectedFile = photoInput.files?.[0] || null;

  if (!selectedFile) {
    scanBtn.disabled = true;
    preview.style.display = "none";
    return;
  }

  preview.src = URL.createObjectURL(selectedFile);
  preview.style.display = "block";
  scanBtn.disabled = false;
  statusEl.textContent = "";
});

scanBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    statusEl.textContent = "Please select an image first.";
    return;
  }

  scanBtn.disabled = true;
  statusEl.textContent = "Scanning...";

  try {
    console.log("Scan button clicked");

    const small = await resizeImage(selectedFile);

    console.log("Sending image to backend...");

    const result = await scanImage(small, bag);

    if (!result || !Array.isArray(result.detected)) {
      throw new Error("The server response did not contain a detected list.");
    }

    detected = result.detected;
    renderDetected();

    statusEl.textContent = detected.length
      ? `Found ${detected.length} item(s).`
      : "No items found. Try a clearer photo.";
  } catch (error) {
    console.error("Scan failed:", error);
    statusEl.textContent = "Scan failed: " + error.message;
  } finally {
    scanBtn.disabled = false;
  }
});

function renderDetected() {
  detectedEl.replaceChildren();

  detected.forEach((item, index) => {
    const li = document.createElement("li");
    li.appendChild(document.createTextNode(item.name + " "));

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";

    removeBtn.addEventListener("click", () => {
      detected.splice(index, 1);
      renderDetected();
    });

    li.appendChild(removeBtn);
    detectedEl.appendChild(li);
  });

  addBtn.style.display = detected.length ? "inline-block" : "none";
}

addBtn.addEventListener("click", async () => {
  addBtn.disabled = true;
  statusEl.textContent = "Saving items...";

  try {
    await saveItems(bag, detected);
    location.href = "index.html";
  } catch (error) {
    console.error("Save failed:", error);
    statusEl.textContent = "Save failed: " + error.message;
    addBtn.disabled = false;
  }
});
```
