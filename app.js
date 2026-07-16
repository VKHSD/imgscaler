const sourceCanvas = document.querySelector("#sourceCanvas");
const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
const outputCanvas = document.querySelector("#outputCanvas");
const outputCtx = outputCanvas.getContext("2d", { willReadFrequently: true });
const dropZone = document.querySelector("#dropZone");
const dropHint = document.querySelector("#dropHint");
const sourceMeta = document.querySelector("#sourceMeta");
const outputMeta = document.querySelector("#outputMeta");

const controls = {
  fileInput: document.querySelector("#fileInput"),
  cropBtn: document.querySelector("#cropBtn"),
  resetCropBtn: document.querySelector("#resetCropBtn"),
  squareCrop: document.querySelector("#squareCrop"),
  renderBtn: document.querySelector("#renderBtn"),
  downloadBtn: document.querySelector("#downloadBtn"),
  outWidth: document.querySelector("#outWidth"),
  outHeight: document.querySelector("#outHeight"),
  lockRatio: document.querySelector("#lockRatio"),
  pixelated: document.querySelector("#pixelated"),
  showGrid: document.querySelector("#showGrid"),
  pickAlphaBtn: document.querySelector("#pickAlphaBtn"),
  alphaOn: document.querySelector("#alphaOn"),
  alphaColor: document.querySelector("#alphaColor"),
  alphaTolerance: document.querySelector("#alphaTolerance"),
  removeBg: document.querySelector("#removeBg"),
  bgTolerance: document.querySelector("#bgTolerance"),
  paletteOn: document.querySelector("#paletteOn"),
  paletteColors: document.querySelector("#paletteColors"),
  edgeDetect: document.querySelector("#edgeDetect"),
  edgeStrength: document.querySelector("#edgeStrength"),
  symmetryOn: document.querySelector("#symmetryOn"),
  symmetryAngle: document.querySelector("#symmetryAngle"),
  shadeOn: document.querySelector("#shadeOn"),
  lightStrength: document.querySelector("#lightStrength")
};

const state = {
  image: null,
  fileName: "scaled-image",
  cropMode: false,
  pickingAlpha: false,
  crop: null,
  dragStart: null,
  pointer: null,
  light: { x: 0.35, y: 0.25 }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;

function sanitizeFileName(name) {
  return name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "scaled-image";
}

function getTargetSize() {
  const width = clamp(parseInt(controls.outWidth.value, 10) || 16, 1, 4096);
  const height = controls.lockRatio.checked ? width : clamp(parseInt(controls.outHeight.value, 10) || 16, 1, 4096);
  controls.outWidth.value = width;
  controls.outHeight.value = height;
  return { width, height };
}

function getCrop() {
  if (!state.image) return null;
  return state.crop || { x: 0, y: 0, w: state.image.width, h: state.image.height };
}

function drawSource() {
  if (!state.image) {
    sourceCanvas.width = 900;
    sourceCanvas.height = 600;
    sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    return;
  }

  sourceCanvas.width = state.image.width;
  sourceCanvas.height = state.image.height;
  sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceCtx.drawImage(state.image, 0, 0);

  const crop = state.pointer && state.dragStart ? makeCropRect(state.dragStart, state.pointer) : state.crop;
  if (crop) drawCropOverlay(crop);

  if (controls.symmetryOn.checked) drawSymmetryGuide(sourceCtx, sourceCanvas.width, sourceCanvas.height);
  if (controls.shadeOn.checked) drawLightGuide(sourceCtx, sourceCanvas.width, sourceCanvas.height);
}

function drawCropOverlay(crop) {
  sourceCtx.save();
  sourceCtx.fillStyle = "rgba(0, 0, 0, 0.46)";
  sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceCtx.clearRect(crop.x, crop.y, crop.w, crop.h);
  sourceCtx.strokeStyle = "#6ee7b7";
  sourceCtx.lineWidth = Math.max(2, sourceCanvas.width / 450);
  sourceCtx.setLineDash([10, 7]);
  sourceCtx.strokeRect(crop.x, crop.y, crop.w, crop.h);
  sourceCtx.restore();
}

function drawSymmetryGuide(ctx, width, height) {
  const angle = (parseFloat(controls.symmetryAngle.value) || 0) * Math.PI / 180;
  const cx = width / 2;
  const cy = height / 2;
  const len = Math.hypot(width, height);
  ctx.save();
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = Math.max(2, width / 500);
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(angle) * len, cy - Math.sin(angle) * len);
  ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
  ctx.stroke();
  ctx.restore();
}

function drawLightGuide(ctx, width, height) {
  const x = state.light.x * width;
  const y = state.light.y * height;
  ctx.save();
  ctx.fillStyle = "#fef08a";
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = Math.max(2, width / 500);
  ctx.beginPath();
  ctx.arc(x, y, Math.max(7, width / 80), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function makeCropRect(a, b) {
  let x1 = clamp(a.x, 0, sourceCanvas.width);
  let y1 = clamp(a.y, 0, sourceCanvas.height);
  let x2 = clamp(b.x, 0, sourceCanvas.width);
  let y2 = clamp(b.y, 0, sourceCanvas.height);

  if (controls.squareCrop.checked) {
    const side = Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1));
    x2 = x1 + Math.sign(x2 - x1 || 1) * side;
    y2 = y1 + Math.sign(y2 - y1 || 1) * side;
  }

  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.max(1, Math.abs(x2 - x1));
  const h = Math.max(1, Math.abs(y2 - y1));
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

function pointerToCanvas(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

async function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    state.image = image;
    state.fileName = sanitizeFileName(file.name);
    state.crop = null;
    sourceMeta.textContent = `${image.width} x ${image.height}`;
    dropZone.classList.add("has-image");
    drawSource();
    renderOutput();
  };
  image.src = url;
}

function renderOutput() {
  if (!state.image) return;

  const crop = getCrop();
  const { width, height } = getTargetSize();
  outputCanvas.width = width;
  outputCanvas.height = height;
  outputCtx.imageSmoothingEnabled = !controls.pixelated.checked;
  outputCtx.clearRect(0, 0, width, height);
  outputCtx.drawImage(state.image, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height);

  let imageData = outputCtx.getImageData(0, 0, width, height);
  imageData = colorToAlpha(imageData);
  if (controls.removeBg.checked) imageData = removeEdgeBackground(imageData);
  if (controls.symmetryOn.checked) imageData = applySymmetry(imageData);
  if (controls.shadeOn.checked) imageData = applyFakeLighting(imageData);
  if (controls.edgeDetect.checked) imageData = applyEdgeDetection(imageData);
  if (controls.paletteOn.checked) imageData = limitPalette(imageData);

  outputCtx.putImageData(imageData, 0, 0);
  if (controls.showGrid.checked) drawGrid(outputCtx, width, height);
  updateOutputPreviewSize(width, height);
  outputMeta.textContent = `${width} x ${height}${state.crop ? ` from ${crop.w} x ${crop.h} crop` : ""}`;
}

function colorToAlpha(imageData) {
  if (!controls.alphaOn.checked) return imageData;
  const tolerance = parseFloat(controls.alphaTolerance.value) || 0;
  if (tolerance <= 0) return imageData;

  const target = hexToRgb(controls.alphaColor.value);
  const data = imageData.data;
  const maxDistance = Math.sqrt(3 * 255 * 255);

  for (let i = 0; i < data.length; i += 4) {
    const d = colorDistance(data[i], data[i + 1], data[i + 2], target.r, target.g, target.b);
    if (d <= tolerance) {
      const alpha = clamp(d / tolerance, 0, 1);
      data[i + 3] = Math.round(data[i + 3] * alpha);
    } else if (d < tolerance * 1.65) {
      const blend = clamp((d - tolerance) / Math.max(1, tolerance * 0.65), 0, 1);
      const fade = lerp(0.72, 1, blend);
      data[i + 3] = Math.round(data[i + 3] * fade);
    }
  }

  return imageData;
}

function removeEdgeBackground(imageData) {
  const { width, height, data } = imageData;
  const tolerance = parseFloat(controls.bgTolerance.value) || 0;
  const visited = new Uint8Array(width * height);
  const queue = [];
  const bg = sampleEdgeColor(imageData);

  for (let x = 0; x < width; x++) {
    queue.push([x, 0], [x, height - 1]);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push([0, y], [width - 1, y]);
  }

  while (queue.length) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const idx = y * width + x;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const p = idx * 4;
    if (data[p + 3] === 0) continue;
    if (colorDistance(data[p], data[p + 1], data[p + 2], bg.r, bg.g, bg.b) > tolerance) continue;

    data[p + 3] = 0;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return imageData;
}

function applyEdgeDetection(imageData) {
  const { width, height, data } = imageData;
  const original = new Uint8ClampedArray(data);
  const strength = (parseFloat(controls.edgeStrength.value) || 0) / 100;

  const grayAt = (x, y) => {
    const i = (clamp(y, 0, height - 1) * width + clamp(x, 0, width - 1)) * 4;
    return original[i] * 0.299 + original[i + 1] * 0.587 + original[i + 2] * 0.114;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (original[i + 3] === 0) continue;
      const gx = -grayAt(x - 1, y - 1) - 2 * grayAt(x - 1, y) - grayAt(x - 1, y + 1)
        + grayAt(x + 1, y - 1) + 2 * grayAt(x + 1, y) + grayAt(x + 1, y + 1);
      const gy = -grayAt(x - 1, y - 1) - 2 * grayAt(x, y - 1) - grayAt(x + 1, y - 1)
        + grayAt(x - 1, y + 1) + 2 * grayAt(x, y + 1) + grayAt(x + 1, y + 1);
      const edge = clamp(Math.hypot(gx, gy) * strength, 0, 255);
      data[i] = clamp(data[i] - edge * 0.7, 0, 255);
      data[i + 1] = clamp(data[i + 1] - edge * 0.7, 0, 255);
      data[i + 2] = clamp(data[i + 2] - edge * 0.7, 0, 255);
    }
  }

  return imageData;
}

function limitPalette(imageData) {
  const { data } = imageData;
  const maxColors = clamp(parseInt(controls.paletteColors.value, 10) || 16, 2, 256);
  controls.paletteColors.value = maxColors;

  const colors = [];
  const sampleStride = Math.max(1, Math.ceil((data.length / 4) / 20000));
  for (let p = 0, pixel = 0; p < data.length; p += 4, pixel++) {
    if (data[p + 3] < 8 || pixel % sampleStride !== 0) continue;
    colors.push({ r: data[p], g: data[p + 1], b: data[p + 2], count: 1 });
  }
  if (colors.length <= maxColors) return imageData;

  const palette = buildMedianCutPalette(colors, maxColors);
  const cache = new Map();

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    let nearest = cache.get(key);
    if (!nearest) {
      nearest = nearestPaletteColor(data[i], data[i + 1], data[i + 2], palette);
      cache.set(key, nearest);
    }
    data[i] = nearest.r;
    data[i + 1] = nearest.g;
    data[i + 2] = nearest.b;
  }

  return imageData;
}

function buildMedianCutPalette(colors, maxColors) {
  let boxes = [{ colors }];

  while (boxes.length < maxColors) {
    boxes.sort((a, b) => colorBoxRange(b) - colorBoxRange(a));
    const box = boxes.shift();
    if (!box || box.colors.length <= 1) {
      if (box) boxes.push(box);
      break;
    }

    const channel = widestChannel(box.colors);
    box.colors.sort((a, b) => a[channel] - b[channel]);
    const mid = Math.floor(box.colors.length / 2);
    boxes.push({ colors: box.colors.slice(0, mid) }, { colors: box.colors.slice(mid) });
  }

  return boxes.map(box => averageColor(box.colors));
}

function colorBoxRange(box) {
  const ranges = getColorRanges(box.colors);
  return Math.max(ranges.r, ranges.g, ranges.b);
}

function widestChannel(colors) {
  const ranges = getColorRanges(colors);
  if (ranges.r >= ranges.g && ranges.r >= ranges.b) return "r";
  if (ranges.g >= ranges.b) return "g";
  return "b";
}

function getColorRanges(colors) {
  let minR = 255, minG = 255, minB = 255;
  let maxR = 0, maxG = 0, maxB = 0;
  for (const color of colors) {
    minR = Math.min(minR, color.r);
    minG = Math.min(minG, color.g);
    minB = Math.min(minB, color.b);
    maxR = Math.max(maxR, color.r);
    maxG = Math.max(maxG, color.g);
    maxB = Math.max(maxB, color.b);
  }
  return { r: maxR - minR, g: maxG - minG, b: maxB - minB };
}

function averageColor(colors) {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const color of colors) {
    r += color.r;
    g += color.g;
    b += color.b;
  }
  const count = Math.max(1, colors.length);
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count)
  };
}

function nearestPaletteColor(r, g, b, palette) {
  let best = palette[0];
  let bestDistance = Infinity;
  for (const color of palette) {
    const d = colorDistance(r, g, b, color.r, color.g, color.b);
    if (d < bestDistance) {
      bestDistance = d;
      best = color;
    }
  }
  return best;
}

function applySymmetry(imageData) {
  const { width, height, data } = imageData;
  const original = new Uint8ClampedArray(data);
  const angle = (parseFloat(controls.symmetryAngle.value) || 0) * Math.PI / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const side = (x - cx) * -dy + (y - cy) * dx;
      if (side < 0) continue;

      const rx = x - 2 * side * -dy;
      const ry = y - 2 * side * dx;
      const sx = Math.round(clamp(rx, 0, width - 1));
      const sy = Math.round(clamp(ry, 0, height - 1));
      const to = (y * width + x) * 4;
      const from = (sy * width + sx) * 4;
      data[to] = original[from];
      data[to + 1] = original[from + 1];
      data[to + 2] = original[from + 2];
      data[to + 3] = original[from + 3];
    }
  }

  return imageData;
}

function applyFakeLighting(imageData) {
  const { width, height, data } = imageData;
  const strength = (parseFloat(controls.lightStrength.value) || 0) / 100;
  const lx = state.light.x * (width - 1);
  const ly = state.light.y * (height - 1);
  const maxDistance = Math.hypot(Math.max(lx, width - lx), Math.max(ly, height - ly));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const distance = Math.hypot(x - lx, y - ly) / Math.max(1, maxDistance);
      const shade = 1 + strength * (1 - distance * 1.75);
      data[i] = clamp(data[i] * shade, 0, 255);
      data[i + 1] = clamp(data[i + 1] * shade, 0, 255);
      data[i + 2] = clamp(data[i + 2] * shade, 0, 255);
    }
  }

  return imageData;
}

function drawGrid(ctx, width, height) {
  if (width > 128 || height > 128) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.26)";
  ctx.lineWidth = 1;
  for (let x = 1; x < width; x++) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }
  for (let y = 1; y < height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function updateOutputPreviewSize(width, height) {
  const maxSide = Math.min(420, Math.max(240, window.innerWidth * 0.34));
  const scale = Math.min(maxSide / width, maxSide / height);
  outputCanvas.style.width = `${Math.max(1, Math.round(width * scale))}px`;
  outputCanvas.style.height = `${Math.max(1, Math.round(height * scale))}px`;
}

function sampleEdgeColor(imageData) {
  const { width, height, data } = imageData;
  const samples = [];

  for (let x = 0; x < width; x++) {
    samples.push(pixelAt(data, width, x, 0), pixelAt(data, width, x, height - 1));
  }
  for (let y = 1; y < height - 1; y++) {
    samples.push(pixelAt(data, width, 0, y), pixelAt(data, width, width - 1, y));
  }

  samples.sort((a, b) => luminance(a) - luminance(b));
  const mid = samples[Math.floor(samples.length / 2)] || { r: 255, g: 255, b: 255 };
  return mid;
}

function pixelAt(data, width, x, y) {
  const i = (y * width + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

function luminance(c) {
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

function downloadOutput() {
  if (!state.image) return;
  const link = document.createElement("a");
  link.download = `${state.fileName}-${outputCanvas.width}x${outputCanvas.height}.png`;
  link.href = outputCanvas.toDataURL("image/png");
  link.click();
}

function setupDragNumbers() {
  document.querySelectorAll(".drag-number").forEach(input => {
    let startY = 0;
    let startValue = 0;
    let dragging = false;

    input.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      dragging = true;
      startY = event.clientY;
      startValue = parseFloat(input.value) || 0;
      input.setPointerCapture(event.pointerId);
    });

    input.addEventListener("pointermove", event => {
      if (!dragging) return;
      const step = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
      const delta = Math.round((startY - event.clientY) / 6) * step;
      const min = input.min === "" ? -Infinity : parseFloat(input.min);
      const max = input.max === "" ? Infinity : parseFloat(input.max);
      input.value = clamp(startValue + delta, min, max);
      syncSizeInputs(input);
      renderOutput();
    });

    input.addEventListener("pointerup", () => {
      dragging = false;
    });
  });
}

function syncSizeInputs(input) {
  if (controls.lockRatio.checked && input === controls.outWidth) controls.outHeight.value = controls.outWidth.value;
  if (controls.lockRatio.checked && input === controls.outHeight) controls.outWidth.value = controls.outHeight.value;
}

dropZone.addEventListener("dragover", event => {
  event.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

dropZone.addEventListener("drop", event => {
  event.preventDefault();
  dropZone.classList.remove("dragover");
  loadFile(event.dataTransfer.files[0]);
});

controls.fileInput.addEventListener("change", event => loadFile(event.target.files[0]));

sourceCanvas.addEventListener("pointerdown", event => {
  if (!state.image) return;
  const p = pointerToCanvas(event, sourceCanvas);

  if (state.pickingAlpha) {
    const sampleX = clamp(Math.round(p.x), 0, sourceCanvas.width - 1);
    const sampleY = clamp(Math.round(p.y), 0, sourceCanvas.height - 1);
    const sample = sourceCtx.getImageData(sampleX, sampleY, 1, 1).data;
    controls.alphaColor.value = rgbToHex(sample[0], sample[1], sample[2]);
    controls.alphaOn.checked = true;
    state.pickingAlpha = false;
    controls.pickAlphaBtn.classList.remove("active");
    renderOutput();
    return;
  }

  if (controls.shadeOn.checked && !state.cropMode) {
    state.light = { x: clamp(p.x / sourceCanvas.width, 0, 1), y: clamp(p.y / sourceCanvas.height, 0, 1) };
    drawSource();
    renderOutput();
    return;
  }

  if (!state.cropMode) return;
  state.dragStart = p;
  state.pointer = p;
  sourceCanvas.setPointerCapture(event.pointerId);
  drawSource();
});

sourceCanvas.addEventListener("pointermove", event => {
  if (!state.dragStart) return;
  state.pointer = pointerToCanvas(event, sourceCanvas);
  drawSource();
});

sourceCanvas.addEventListener("pointerup", () => {
  if (state.dragStart && state.pointer) {
    state.crop = makeCropRect(state.dragStart, state.pointer);
    state.dragStart = null;
    state.pointer = null;
    drawSource();
    renderOutput();
  }
});

controls.cropBtn.addEventListener("click", () => {
  state.cropMode = !state.cropMode;
  controls.cropBtn.classList.toggle("active", state.cropMode);
});

controls.pickAlphaBtn.addEventListener("click", () => {
  state.pickingAlpha = !state.pickingAlpha;
  controls.pickAlphaBtn.classList.toggle("active", state.pickingAlpha);
});

controls.resetCropBtn.addEventListener("click", () => {
  state.crop = null;
  drawSource();
  renderOutput();
});

controls.renderBtn.addEventListener("click", renderOutput);
controls.downloadBtn.addEventListener("click", downloadOutput);

Object.values(controls).forEach(control => {
  if (!control || control.type === "file") return;
  control.addEventListener("input", () => {
    syncSizeInputs(control);
    drawSource();
    renderOutput();
  });
});

setupDragNumbers();
drawSource();
