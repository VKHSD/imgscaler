const sourceCanvas = document.querySelector("#sourceCanvas");
const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
const outputCanvas = document.querySelector("#outputCanvas");
const outputCtx = outputCanvas.getContext("2d", { willReadFrequently: true });
const cleanOutputCanvas = document.createElement("canvas");
const cleanOutputCtx = cleanOutputCanvas.getContext("2d", { willReadFrequently: true });
const sampleCanvas = document.createElement("canvas");
const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
const dropZone = document.querySelector("#dropZone");
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
  editSymmetryBtn: document.querySelector("#editSymmetryBtn"),
  resetSymmetryBtn: document.querySelector("#resetSymmetryBtn"),
  shadeOn: document.querySelector("#shadeOn"),
  editLightBtn: document.querySelector("#editLightBtn"),
  lightStrength: document.querySelector("#lightStrength")
};

const state = {
  image: null,
  fileName: "scaled-image",
  cropMode: true,
  pickingAlpha: false,
  editSymmetry: false,
  editLight: false,
  crop: null,
  cropDrag: null,
  outputDrag: null,
  symmetry: {
    a: { x: 0.5, y: 0.0 },
    b: { x: 0.5, y: 1.0 }
  },
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
  return state.crop || makeDefaultCrop();
}

function makeDefaultCrop() {
  if (!state.image) return null;
  if (!controls.squareCrop.checked) {
    return { x: 0, y: 0, w: state.image.width, h: state.image.height };
  }
  const side = Math.min(state.image.width, state.image.height);
  return {
    x: Math.round((state.image.width - side) / 2),
    y: Math.round((state.image.height - side) / 2),
    w: side,
    h: side
  };
}

function resetCrop() {
  state.crop = makeDefaultCrop();
  drawSource();
  renderOutput();
}

function normalizeCrop(crop) {
  if (!state.image) return crop;
  const minSize = 1;
  let x = Math.round(crop.x);
  let y = Math.round(crop.y);
  let w = Math.round(Math.max(minSize, crop.w));
  let h = Math.round(Math.max(minSize, crop.h));

  if (controls.squareCrop.checked) {
    const side = Math.max(minSize, Math.min(w, h));
    w = side;
    h = side;
  }

  if (w > state.image.width) w = state.image.width;
  if (h > state.image.height) h = state.image.height;
  x = clamp(x, 0, state.image.width - w);
  y = clamp(y, 0, state.image.height - h);
  return { x, y, w, h };
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

  if (state.crop) drawCropOverlay(state.crop);
}

function drawCropOverlay(crop) {
  const c = normalizeCrop(crop);
  const alpha = state.cropMode ? 0.56 : 0.34;
  sourceCtx.save();
  sourceCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  sourceCtx.fillRect(0, 0, sourceCanvas.width, c.y);
  sourceCtx.fillRect(0, c.y + c.h, sourceCanvas.width, sourceCanvas.height - c.y - c.h);
  sourceCtx.fillRect(0, c.y, c.x, c.h);
  sourceCtx.fillRect(c.x + c.w, c.y, sourceCanvas.width - c.x - c.w, c.h);

  sourceCtx.strokeStyle = "#6ee7b7";
  sourceCtx.lineWidth = handleScale(sourceCanvas) * 2;
  sourceCtx.setLineDash([]);
  sourceCtx.strokeRect(c.x + 0.5, c.y + 0.5, c.w, c.h);

  sourceCtx.strokeStyle = "rgba(255, 255, 255, 0.42)";
  sourceCtx.lineWidth = handleScale(sourceCanvas);
  sourceCtx.beginPath();
  sourceCtx.moveTo(c.x + c.w / 3, c.y);
  sourceCtx.lineTo(c.x + c.w / 3, c.y + c.h);
  sourceCtx.moveTo(c.x + (c.w * 2) / 3, c.y);
  sourceCtx.lineTo(c.x + (c.w * 2) / 3, c.y + c.h);
  sourceCtx.moveTo(c.x, c.y + c.h / 3);
  sourceCtx.lineTo(c.x + c.w, c.y + c.h / 3);
  sourceCtx.moveTo(c.x, c.y + (c.h * 2) / 3);
  sourceCtx.lineTo(c.x + c.w, c.y + (c.h * 2) / 3);
  sourceCtx.stroke();

  if (state.cropMode) {
    for (const point of getCropHandlePoints(c)) {
      drawHandle(sourceCtx, point.x, point.y, sourceCanvas, point.corner);
    }
  }
  sourceCtx.restore();
}

function drawHandle(ctx, x, y, canvas, large = true) {
  const s = handleScale(canvas);
  const radius = (large ? 7 : 5) * s;
  ctx.save();
  ctx.fillStyle = "#101114";
  ctx.strokeStyle = "#6ee7b7";
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function handleScale(canvas) {
  const rect = canvas.getBoundingClientRect();
  return rect.width > 0 ? canvas.width / rect.width : 1;
}

function getCropHandlePoints(crop) {
  const { x, y, w, h } = crop;
  const mx = x + w / 2;
  const my = y + h / 2;
  return [
    { name: "nw", x, y, corner: true },
    { name: "n", x: mx, y, corner: false },
    { name: "ne", x: x + w, y, corner: true },
    { name: "e", x: x + w, y: my, corner: false },
    { name: "se", x: x + w, y: y + h, corner: true },
    { name: "s", x: mx, y: y + h, corner: false },
    { name: "sw", x, y: y + h, corner: true },
    { name: "w", x, y: my, corner: false }
  ];
}

function hitCropTarget(point) {
  const crop = state.crop || makeDefaultCrop();
  const radius = 14 * handleScale(sourceCanvas);
  for (const handle of getCropHandlePoints(crop)) {
    if (Math.hypot(point.x - handle.x, point.y - handle.y) <= radius) return handle.name;
  }
  if (point.x >= crop.x && point.x <= crop.x + crop.w && point.y >= crop.y && point.y <= crop.y + crop.h) {
    return "move";
  }
  return "new";
}

function resizeCropFromDrag(drag, point) {
  const start = drag.startCrop;
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;

  if (drag.target.includes("w")) left = point.x;
  if (drag.target.includes("e")) right = point.x;
  if (drag.target.includes("n")) top = point.y;
  if (drag.target.includes("s")) bottom = point.y;

  if (drag.target === "n" || drag.target === "s") {
    left = start.x;
    right = start.x + start.w;
  }
  if (drag.target === "e" || drag.target === "w") {
    top = start.y;
    bottom = start.y + start.h;
  }

  if (right < left) [left, right] = [right, left];
  if (bottom < top) [top, bottom] = [bottom, top];

  let crop = { x: left, y: top, w: right - left, h: bottom - top };
  if (controls.squareCrop.checked) crop = makeSquareResize(start, crop, drag.target);
  return normalizeCrop(crop);
}

function makeSquareResize(start, crop, target) {
  const side = Math.max(1, Math.min(crop.w, crop.h));
  let x = crop.x;
  let y = crop.y;

  if (target.includes("w")) x = start.x + start.w - side;
  if (target.includes("n")) y = start.y + start.h - side;
  if (target === "e" || target === "w") y = start.y + (start.h - side) / 2;
  if (target === "n" || target === "s") x = start.x + (start.w - side) / 2;
  return { x, y, w: side, h: side };
}

function pointerToCanvas(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) * (canvas.width / rect.width), 0, canvas.width),
    y: clamp((event.clientY - rect.top) * (canvas.height / rect.height), 0, canvas.height)
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
    state.crop = makeDefaultCrop();
    sourceMeta.textContent = `${image.width} x ${image.height}`;
    dropZone.classList.add("has-image");
    drawSource();
    renderOutput();
  };
  image.src = url;
}

function renderOutput() {
  if (!state.image) {
    paintOutputPreview();
    return;
  }

  const crop = getCrop();
  const { width, height } = getTargetSize();
  cleanOutputCanvas.width = width;
  cleanOutputCanvas.height = height;
  cleanOutputCtx.imageSmoothingEnabled = !controls.pixelated.checked;
  cleanOutputCtx.clearRect(0, 0, width, height);
  cleanOutputCtx.drawImage(state.image, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height);

  let imageData = cleanOutputCtx.getImageData(0, 0, width, height);
  imageData = colorToAlpha(imageData);
  if (controls.removeBg.checked) imageData = removeEdgeBackground(imageData);
  if (controls.symmetryOn.checked) imageData = applySymmetry(imageData);
  if (controls.shadeOn.checked) imageData = applyFakeLighting(imageData);
  if (controls.edgeDetect.checked) imageData = applyEdgeDetection(imageData);
  if (controls.paletteOn.checked) imageData = limitPalette(imageData);

  cleanOutputCtx.putImageData(imageData, 0, 0);
  paintOutputPreview();
  outputMeta.textContent = `${width} x ${height}${state.crop ? ` from ${crop.w} x ${crop.h} crop` : ""}`;
}

function paintOutputPreview() {
  const width = cleanOutputCanvas.width || 16;
  const height = cleanOutputCanvas.height || 16;
  outputCanvas.width = width;
  outputCanvas.height = height;
  outputCtx.imageSmoothingEnabled = false;
  outputCtx.clearRect(0, 0, width, height);

  if (cleanOutputCanvas.width) {
    outputCtx.drawImage(cleanOutputCanvas, 0, 0);
  }
  if (controls.showGrid.checked) drawGrid(outputCtx, width, height);
  if (controls.symmetryOn.checked || state.editSymmetry) drawSymmetryOverlay(outputCtx, width, height);
  if (controls.shadeOn.checked || state.editLight) drawLightOverlay(outputCtx, width, height);
  updateOutputPreviewSize(width, height);
}

function colorToAlpha(imageData) {
  if (!controls.alphaOn.checked) return imageData;
  const tolerance = parseFloat(controls.alphaTolerance.value) || 0;
  if (tolerance <= 0) return imageData;

  const target = hexToRgb(controls.alphaColor.value);
  const data = imageData.data;

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
    colors.push({ r: data[p], g: data[p + 1], b: data[p + 2] });
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
  const line = getSymmetryLinePixels(width, height);
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const vx = x - line.a.x;
      const vy = y - line.a.y;
      const side = vx * uy - vy * ux;
      if (side <= 0) continue;

      const dot = vx * ux + vy * uy;
      const px = line.a.x + dot * ux;
      const py = line.a.y + dot * uy;
      const sx = Math.round(clamp(2 * px - x, 0, width - 1));
      const sy = Math.round(clamp(2 * py - y, 0, height - 1));
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
  const radius = Math.max(width, height) * 0.78;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const distance = Math.hypot(x - lx, y - ly) / Math.max(1, radius);
      const falloff = clamp(1 - distance, -0.45, 1);
      const shade = 1 + strength * falloff;
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

function drawSymmetryOverlay(ctx, width, height) {
  const line = getSymmetryLinePixels(width, height);
  const extended = extendLineToCanvas(line.a, line.b, width, height);
  const s = handleScale(outputCanvas);
  ctx.save();
  ctx.strokeStyle = "rgba(250, 204, 21, 0.36)";
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(extended.a.x, extended.a.y);
  ctx.lineTo(extended.b.x, extended.b.y);
  ctx.stroke();

  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(line.a.x, line.a.y);
  ctx.lineTo(line.b.x, line.b.y);
  ctx.stroke();
  drawOutputHandle(ctx, line.a.x, line.a.y, width, "#facc15");
  drawOutputHandle(ctx, line.b.x, line.b.y, width, "#facc15");
  ctx.restore();
}

function drawLightOverlay(ctx, width, height) {
  const x = state.light.x * (width - 1);
  const y = state.light.y * (height - 1);
  const radius = Math.max(width, height) * 0.32;
  const s = handleScale(outputCanvas);
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, "rgba(254, 240, 138, 0.24)");
  gradient.addColorStop(1, "rgba(254, 240, 138, 0)");

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(254, 240, 138, 0.58)";
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  drawOutputHandle(ctx, x, y, width, "#fef08a");
  ctx.restore();
}

function drawOutputHandle(ctx, x, y, width, color) {
  const s = handleScale(outputCanvas);
  const radius = 8 * s;
  ctx.save();
  ctx.fillStyle = "#101114";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function getSymmetryLinePixels(width, height) {
  return {
    a: { x: state.symmetry.a.x * (width - 1), y: state.symmetry.a.y * (height - 1) },
    b: { x: state.symmetry.b.x * (width - 1), y: state.symmetry.b.y * (height - 1) }
  };
}

function extendLineToCanvas(a, b, width, height) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const far = Math.hypot(width, height);
  return {
    a: { x: a.x - ux * far, y: a.y - uy * far },
    b: { x: a.x + ux * far, y: a.y + uy * far }
  };
}

function updateOutputPreviewSize(width, height) {
  const wrap = outputCanvas.parentElement.getBoundingClientRect();
  const maxSide = Math.max(160, Math.min(wrap.width - 32, wrap.height - 32, 720));
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
  return samples[Math.floor(samples.length / 2)] || { r: 255, g: 255, b: 255 };
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

function sampleOriginalPixel(x, y) {
  sampleCanvas.width = 1;
  sampleCanvas.height = 1;
  sampleCtx.clearRect(0, 0, 1, 1);
  sampleCtx.drawImage(state.image, x, y, 1, 1, 0, 0, 1, 1);
  return sampleCtx.getImageData(0, 0, 1, 1).data;
}

function downloadOutput() {
  if (!state.image || !cleanOutputCanvas.width) return;
  const link = document.createElement("a");
  link.download = `${state.fileName}-${cleanOutputCanvas.width}x${cleanOutputCanvas.height}.png`;
  link.href = cleanOutputCanvas.toDataURL("image/png");
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

function resetSymmetry() {
  state.symmetry = {
    a: { x: 0.5, y: 0.0 },
    b: { x: 0.5, y: 1.0 }
  };
  renderOutput();
}

function setOutputPoint(point, which) {
  const x = clamp(point.x / Math.max(1, outputCanvas.width - 1), 0, 1);
  const y = clamp(point.y / Math.max(1, outputCanvas.height - 1), 0, 1);
  if (which === "light") state.light = { x, y };
  if (which === "a") state.symmetry.a = { x, y };
  if (which === "b") state.symmetry.b = { x, y };
}

function hitOutputPoint(point) {
  const radius = 16 * handleScale(outputCanvas);
  const line = getSymmetryLinePixels(outputCanvas.width, outputCanvas.height);
  const light = {
    x: state.light.x * (outputCanvas.width - 1),
    y: state.light.y * (outputCanvas.height - 1)
  };

  if (state.editLight && Math.hypot(point.x - light.x, point.y - light.y) <= radius) return "light";
  if (state.editSymmetry) {
    const da = Math.hypot(point.x - line.a.x, point.y - line.a.y);
    const db = Math.hypot(point.x - line.b.x, point.y - line.b.y);
    if (da <= radius || db <= radius) return da <= db ? "a" : "b";
    return da <= db ? "a" : "b";
  }
  if (state.editLight) return "light";
  return null;
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
    const sample = sampleOriginalPixel(sampleX, sampleY);
    controls.alphaColor.value = rgbToHex(sample[0], sample[1], sample[2]);
    controls.alphaOn.checked = true;
    state.pickingAlpha = false;
    controls.pickAlphaBtn.classList.remove("active");
    renderOutput();
    return;
  }

  if (!state.cropMode) return;
  state.crop = state.crop || makeDefaultCrop();
  const target = hitCropTarget(p);
  state.cropDrag = {
    target,
    start: p,
    pointer: p,
    startCrop: { ...state.crop }
  };
  sourceCanvas.setPointerCapture(event.pointerId);
});

sourceCanvas.addEventListener("pointermove", event => {
  if (!state.cropDrag) return;
  const p = pointerToCanvas(event, sourceCanvas);
  const drag = state.cropDrag;

  if (drag.target === "move") {
    state.crop = normalizeCrop({
      ...drag.startCrop,
      x: drag.startCrop.x + p.x - drag.start.x,
      y: drag.startCrop.y + p.y - drag.start.y
    });
  } else if (drag.target === "new") {
    state.crop = normalizeCrop(makeCropRect(drag.start, p));
  } else {
    state.crop = resizeCropFromDrag(drag, p);
  }

  drawSource();
  renderOutput();
});

sourceCanvas.addEventListener("pointerup", () => {
  state.cropDrag = null;
});

outputCanvas.addEventListener("pointerdown", event => {
  if (!state.image) return;
  const p = pointerToCanvas(event, outputCanvas);
  const target = hitOutputPoint(p);
  if (!target) return;
  state.outputDrag = target;
  setOutputPoint(p, target);
  outputCanvas.setPointerCapture(event.pointerId);
  renderOutput();
});

outputCanvas.addEventListener("pointermove", event => {
  if (!state.outputDrag) return;
  const p = pointerToCanvas(event, outputCanvas);
  setOutputPoint(p, state.outputDrag);
  renderOutput();
});

outputCanvas.addEventListener("pointerup", () => {
  state.outputDrag = null;
});

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

  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.max(1, Math.abs(x2 - x1)),
    h: Math.max(1, Math.abs(y2 - y1))
  };
}

controls.cropBtn.addEventListener("click", () => {
  state.cropMode = !state.cropMode;
  controls.cropBtn.classList.toggle("active", state.cropMode);
  drawSource();
});

controls.pickAlphaBtn.addEventListener("click", () => {
  state.pickingAlpha = !state.pickingAlpha;
  controls.pickAlphaBtn.classList.toggle("active", state.pickingAlpha);
});

controls.editSymmetryBtn.addEventListener("click", () => {
  state.editSymmetry = !state.editSymmetry;
  if (state.editSymmetry) state.editLight = false;
  controls.editSymmetryBtn.classList.toggle("active", state.editSymmetry);
  controls.editLightBtn.classList.toggle("active", state.editLight);
  paintOutputPreview();
});

controls.editLightBtn.addEventListener("click", () => {
  state.editLight = !state.editLight;
  if (state.editLight) state.editSymmetry = false;
  controls.editLightBtn.classList.toggle("active", state.editLight);
  controls.editSymmetryBtn.classList.toggle("active", state.editSymmetry);
  paintOutputPreview();
});

controls.resetCropBtn.addEventListener("click", resetCrop);
controls.resetSymmetryBtn.addEventListener("click", resetSymmetry);
controls.renderBtn.addEventListener("click", renderOutput);
controls.downloadBtn.addEventListener("click", downloadOutput);

Object.values(controls).forEach(control => {
  if (!control || control.type === "file") return;
  control.addEventListener("input", () => {
    syncSizeInputs(control);
    if (control === controls.squareCrop && state.image) {
      const crop = state.crop || makeDefaultCrop();
      const cx = crop.x + crop.w / 2;
      const cy = crop.y + crop.h / 2;
      const side = Math.min(crop.w, crop.h);
      state.crop = controls.squareCrop.checked
        ? normalizeCrop({ x: cx - side / 2, y: cy - side / 2, w: side, h: side })
        : normalizeCrop(crop);
    }
    drawSource();
    renderOutput();
  });
});

window.addEventListener("resize", paintOutputPreview);

setupDragNumbers();
drawSource();
paintOutputPreview();
