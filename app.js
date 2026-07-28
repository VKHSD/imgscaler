const sourceCanvas = document.querySelector("#sourceCanvas");
const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
const outputCanvas = document.querySelector("#outputCanvas");
const outputCtx = outputCanvas.getContext("2d", { willReadFrequently: true });
const outputOverlay = document.querySelector("#outputOverlay");
const overlayCtx = outputOverlay.getContext("2d");
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
  cropAngle: document.querySelector("#cropAngle"),
  resetToolsBtn: document.querySelector("#resetToolsBtn"),
  renderBtn: document.querySelector("#renderBtn"),
  downloadBtn: document.querySelector("#downloadBtn"),
  downloadSpriteBtn: document.querySelector("#downloadSpriteBtn"),
  imageModeBtn: document.querySelector("#imageModeBtn"),
  animationModeBtn: document.querySelector("#animationModeBtn"),
  outWidth: document.querySelector("#outWidth"),
  outHeight: document.querySelector("#outHeight"),
  lockRatio: document.querySelector("#lockRatio"),
  pixelated: document.querySelector("#pixelated"),
  showGrid: document.querySelector("#showGrid"),
  tilePreview: document.querySelector("#tilePreview"),
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
  showSymmetryGuide: document.querySelector("#showSymmetryGuide"),
  editSymmetryBtn: document.querySelector("#editSymmetryBtn"),
  resetSymmetryBtn: document.querySelector("#resetSymmetryBtn"),
  seamlessOn: document.querySelector("#seamlessOn"),
  seamAlgorithm: document.querySelector("#seamAlgorithm"),
  seamBlend: document.querySelector("#seamBlend"),
  seamAlgorithmNote: document.querySelector("#seamAlgorithmNote"),
  shadeOn: document.querySelector("#shadeOn"),
  editLightBtn: document.querySelector("#editLightBtn"),
  lightStrength: document.querySelector("#lightStrength"),
  animationFps: document.querySelector("#animationFps"),
  animationLength: document.querySelector("#animationLength"),
  animationLoop: document.querySelector("#animationLoop"),
  sheetLayout: document.querySelector("#sheetLayout"),
  animationInterpolation: document.querySelector("#animationInterpolation"),
  playAnimationBtn: document.querySelector("#playAnimationBtn"),
  restartAnimationBtn: document.querySelector("#restartAnimationBtn"),
  animationFrame: document.querySelector("#animationFrame"),
  animationFrameNumber: document.querySelector("#animationFrameNumber"),
  animationAutoKey: document.querySelector("#animationAutoKey"),
  addKeyframeBtn: document.querySelector("#addKeyframeBtn"),
  deleteKeyframeBtn: document.querySelector("#deleteKeyframeBtn"),
  animationStatus: document.querySelector("#animationStatus"),
  timelineEndLabel: document.querySelector("#timelineEndLabel"),
  timelineMarkers: document.querySelector("#timelineMarkers"),
  keyframeSummary: document.querySelector("#keyframeSummary")
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
  light: { x: 0.35, y: 0.25 },
  preview: { width: 16, height: 16, viewWidth: 16, viewHeight: 16, tileCount: 1, cssWidth: 0, cssHeight: 0 },
  animation: {
    mode: false,
    playing: false,
    frame: 0,
    keyframes: [],
    baseSnapshot: null,
    applying: false,
    dirty: false,
    raf: 0,
    lastTime: 0,
    accumulator: 0,
    direction: 1
  }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const toRad = degrees => degrees * Math.PI / 180;
const toDeg = radians => radians * 180 / Math.PI;

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
    return { x: 0, y: 0, w: state.image.width, h: state.image.height, angle: 0 };
  }
  const side = Math.min(state.image.width, state.image.height);
  return {
    x: Math.round((state.image.width - side) / 2),
    y: Math.round((state.image.height - side) / 2),
    w: side,
    h: side,
    angle: 0
  };
}

function resetCrop() {
  controls.cropAngle.value = 0;
  state.crop = makeDefaultCrop();
  markAnimationEdited();
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
  return { x, y, w, h, angle: normalizeAngle(crop.angle || 0) };
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
  const corners = getRotatedCropCorners(c);
  sourceCtx.save();
  sourceCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceCtx.globalCompositeOperation = "destination-out";
  sourceCtx.beginPath();
  corners.forEach((corner, index) => {
    if (index === 0) sourceCtx.moveTo(corner.x, corner.y);
    else sourceCtx.lineTo(corner.x, corner.y);
  });
  sourceCtx.closePath();
  sourceCtx.fill();
  sourceCtx.globalCompositeOperation = "source-over";

  sourceCtx.strokeStyle = "#6ee7b7";
  sourceCtx.lineWidth = handleScale(sourceCanvas) * 2;
  sourceCtx.setLineDash([]);
  sourceCtx.beginPath();
  corners.forEach((corner, index) => {
    if (index === 0) sourceCtx.moveTo(corner.x, corner.y);
    else sourceCtx.lineTo(corner.x, corner.y);
  });
  sourceCtx.closePath();
  sourceCtx.stroke();

  sourceCtx.strokeStyle = "rgba(255, 255, 255, 0.42)";
  sourceCtx.lineWidth = handleScale(sourceCanvas);
  sourceCtx.beginPath();
  drawLocalCropLine(c, -c.w / 6, -c.h / 2, -c.w / 6, c.h / 2);
  drawLocalCropLine(c, c.w / 6, -c.h / 2, c.w / 6, c.h / 2);
  drawLocalCropLine(c, -c.w / 2, -c.h / 6, c.w / 2, -c.h / 6);
  drawLocalCropLine(c, -c.w / 2, c.h / 6, c.w / 2, c.h / 6);
  sourceCtx.stroke();

  if (state.cropMode) {
    const top = localToWorld(c, 0, -c.h / 2);
    const rotate = getRotateHandlePoint(c);
    sourceCtx.strokeStyle = "#6ee7b7";
    sourceCtx.lineWidth = handleScale(sourceCanvas) * 1.35;
    sourceCtx.beginPath();
    sourceCtx.moveTo(top.x, top.y);
    sourceCtx.lineTo(rotate.x, rotate.y);
    sourceCtx.stroke();

    for (const point of getCropHandlePoints(c)) {
      drawHandle(sourceCtx, point.x, point.y, sourceCanvas, point.corner, point.name === "rotate");
    }
  }
  sourceCtx.restore();
}

function drawHandle(ctx, x, y, canvas, large = true, rotate = false) {
  const s = handleScale(canvas);
  const radius = (rotate ? 8 : large ? 7 : 5) * s;
  ctx.save();
  ctx.fillStyle = "#101114";
  ctx.strokeStyle = rotate ? "#facc15" : "#6ee7b7";
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
  return [
    { name: "nw", ...localToWorld(crop, -crop.w / 2, -crop.h / 2), corner: true },
    { name: "n", ...localToWorld(crop, 0, -crop.h / 2), corner: false },
    { name: "ne", ...localToWorld(crop, crop.w / 2, -crop.h / 2), corner: true },
    { name: "e", ...localToWorld(crop, crop.w / 2, 0), corner: false },
    { name: "se", ...localToWorld(crop, crop.w / 2, crop.h / 2), corner: true },
    { name: "s", ...localToWorld(crop, 0, crop.h / 2), corner: false },
    { name: "sw", ...localToWorld(crop, -crop.w / 2, crop.h / 2), corner: true },
    { name: "w", ...localToWorld(crop, -crop.w / 2, 0), corner: false },
    { name: "rotate", ...getRotateHandlePoint(crop), corner: true }
  ];
}

function getCropCenter(crop) {
  return { x: crop.x + crop.w / 2, y: crop.y + crop.h / 2 };
}

function localToWorld(crop, localX, localY) {
  const center = getCropCenter(crop);
  const angle = toRad(crop.angle || 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: center.x + localX * cos - localY * sin,
    y: center.y + localX * sin + localY * cos
  };
}

function worldToLocal(crop, point) {
  const center = getCropCenter(crop);
  const angle = toRad(crop.angle || 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos
  };
}

function getRotatedCropCorners(crop) {
  return [
    localToWorld(crop, -crop.w / 2, -crop.h / 2),
    localToWorld(crop, crop.w / 2, -crop.h / 2),
    localToWorld(crop, crop.w / 2, crop.h / 2),
    localToWorld(crop, -crop.w / 2, crop.h / 2)
  ];
}

function getRotateHandlePoint(crop) {
  const offset = Math.max(24, Math.min(crop.w, crop.h) * 0.22);
  return localToWorld(crop, 0, -crop.h / 2 - offset);
}

function drawLocalCropLine(crop, x1, y1, x2, y2) {
  const a = localToWorld(crop, x1, y1);
  const b = localToWorld(crop, x2, y2);
  sourceCtx.moveTo(a.x, a.y);
  sourceCtx.lineTo(b.x, b.y);
}

function hitCropTarget(point) {
  const crop = state.crop || makeDefaultCrop();
  const radius = 14 * handleScale(sourceCanvas);
  for (const handle of getCropHandlePoints(crop)) {
    if (Math.hypot(point.x - handle.x, point.y - handle.y) <= radius) return handle.name;
  }
  const local = worldToLocal(crop, point);
  if (Math.abs(local.x) <= crop.w / 2 && Math.abs(local.y) <= crop.h / 2) {
    return "move";
  }
  return "new";
}

function resizeCropFromDrag(drag, point) {
  const start = drag.startCrop;
  const local = worldToLocal(start, point);
  let left = -start.w / 2;
  let top = -start.h / 2;
  let right = start.w / 2;
  let bottom = start.h / 2;

  if (drag.target.includes("w")) left = local.x;
  if (drag.target.includes("e")) right = local.x;
  if (drag.target.includes("n")) top = local.y;
  if (drag.target.includes("s")) bottom = local.y;

  if (drag.target === "n" || drag.target === "s") {
    left = -start.w / 2;
    right = start.w / 2;
  }
  if (drag.target === "e" || drag.target === "w") {
    top = -start.h / 2;
    bottom = start.h / 2;
  }

  if (right < left) [left, right] = [right, left];
  if (bottom < top) [top, bottom] = [bottom, top];

  let w = Math.max(1, right - left);
  let h = Math.max(1, bottom - top);
  let localCenter = { x: (left + right) / 2, y: (top + bottom) / 2 };

  if (controls.squareCrop.checked) {
    const side = Math.max(1, Math.min(w, h));
    if (drag.target.includes("w")) localCenter.x = start.w / 2 - side / 2;
    if (drag.target.includes("e")) localCenter.x = -start.w / 2 + side / 2;
    if (drag.target.includes("n")) localCenter.y = start.h / 2 - side / 2;
    if (drag.target.includes("s")) localCenter.y = -start.h / 2 + side / 2;
    if (drag.target === "n" || drag.target === "s") localCenter.x = 0;
    if (drag.target === "e" || drag.target === "w") localCenter.y = 0;
    w = side;
    h = side;
  }

  const center = getCropCenter(start);
  const angle = toRad(start.angle || 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const worldCenter = {
    x: center.x + localCenter.x * cos - localCenter.y * sin,
    y: center.y + localCenter.x * sin + localCenter.y * cos
  };
  return normalizeCrop({
    x: worldCenter.x - w / 2,
    y: worldCenter.y - h / 2,
    w,
    h,
    angle: start.angle || 0
  });
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
    controls.cropAngle.value = 0;
    state.crop = makeDefaultCrop();
    sourceMeta.textContent = `${image.width} x ${image.height}`;
    dropZone.classList.add("has-image");
    resetAnimationProject();
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
  const cropBuffer = makeCropBuffer(crop);
  cleanOutputCtx.drawImage(cropBuffer, 0, 0, width, height);

  let imageData = cleanOutputCtx.getImageData(0, 0, width, height);
  imageData = colorToAlpha(imageData);
  if (controls.removeBg.checked) imageData = removeEdgeBackground(imageData);
  if (controls.symmetryOn.checked) imageData = applySymmetry(imageData);
  if (controls.shadeOn.checked) imageData = applyFakeLighting(imageData);
  if (controls.edgeDetect.checked) imageData = applyEdgeDetection(imageData);
  if (controls.seamlessOn.checked) imageData = applySeamlessTileBlend(imageData);
  if (controls.paletteOn.checked) imageData = limitPalette(imageData);

  cleanOutputCtx.putImageData(imageData, 0, 0);
  paintOutputPreview();
  outputMeta.textContent = `${width} x ${height}${controls.tilePreview.checked ? " in 3x3 tile preview" : ""}${state.crop ? ` from ${crop.w} x ${crop.h} crop` : ""}`;
}

function makeCropBuffer(crop) {
  const buffer = document.createElement("canvas");
  buffer.width = Math.max(1, Math.round(crop.w));
  buffer.height = Math.max(1, Math.round(crop.h));
  const ctx = buffer.getContext("2d");
  const center = getCropCenter(crop);
  ctx.imageSmoothingEnabled = !controls.pixelated.checked;
  ctx.clearRect(0, 0, buffer.width, buffer.height);
  ctx.translate(buffer.width / 2, buffer.height / 2);
  ctx.rotate(-toRad(crop.angle || 0));
  ctx.translate(-center.x, -center.y);
  ctx.drawImage(state.image, 0, 0);
  return buffer;
}

function paintOutputPreview() {
  const width = cleanOutputCanvas.width || 16;
  const height = cleanOutputCanvas.height || 16;
  const tileCount = controls.tilePreview.checked ? 3 : 1;
  const viewWidth = width * tileCount;
  const viewHeight = height * tileCount;
  outputCanvas.width = viewWidth;
  outputCanvas.height = viewHeight;
  outputCtx.imageSmoothingEnabled = false;
  outputCtx.clearRect(0, 0, viewWidth, viewHeight);

  if (cleanOutputCanvas.width) {
    for (let ty = 0; ty < tileCount; ty++) {
      for (let tx = 0; tx < tileCount; tx++) {
        outputCtx.drawImage(cleanOutputCanvas, tx * width, ty * height);
      }
    }
  }
  updateOutputPreviewSize(width, height, viewWidth, viewHeight, tileCount);
  drawOutputOverlay();
}

function resizeOutputPreview() {
  const width = cleanOutputCanvas.width || 16;
  const height = cleanOutputCanvas.height || 16;
  const tileCount = controls.tilePreview.checked ? 3 : 1;
  updateOutputPreviewSize(width, height, width * tileCount, height * tileCount, tileCount);
  drawOutputOverlay();
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
      const cx = x + 0.5;
      const cy = y + 0.5;
      const vx = cx - line.a.x;
      const vy = cy - line.a.y;
      const side = vx * uy - vy * ux;
      if (side <= 0) continue;

      const dot = vx * ux + vy * uy;
      const px = line.a.x + dot * ux;
      const py = line.a.y + dot * uy;
      const sample = bilinearSample(original, width, height, 2 * px - cx - 0.5, 2 * py - cy - 0.5);
      const to = (y * width + x) * 4;
      const blend = smoothstep(0.08, 0.95, side);
      data[to] = Math.round(lerp(original[to], sample.r, blend));
      data[to + 1] = Math.round(lerp(original[to + 1], sample.g, blend));
      data[to + 2] = Math.round(lerp(original[to + 2], sample.b, blend));
      data[to + 3] = Math.round(lerp(original[to + 3], sample.a, blend));
    }
  }

  return imageData;
}

function applyFakeLighting(imageData) {
  const { width, height, data } = imageData;
  const strength = (parseFloat(controls.lightStrength.value) || 0) / 100;
  const effect = Math.abs(strength);
  if (effect <= 0.001) return imageData;

  const original = new Uint8ClampedArray(data);
  const lx = state.light.x * width;
  const ly = state.light.y * height;
  const lightHeight = Math.max(width, height) * 0.72;
  const maxDistance = Math.hypot(Math.max(lx, width - lx), Math.max(ly, height - ly));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;

      const centerX = x + 0.5;
      const centerY = y + 0.5;
      const heightLeft = luminanceAt(original, width, height, x - 1, y) / 255;
      const heightRight = luminanceAt(original, width, height, x + 1, y) / 255;
      const heightUp = luminanceAt(original, width, height, x, y - 1) / 255;
      const heightDown = luminanceAt(original, width, height, x, y + 1) / 255;
      const normal = normalize3(
        (heightLeft - heightRight) * 1.65,
        (heightUp - heightDown) * 1.65,
        1
      );

      let light = normalize3(lx - centerX, ly - centerY, lightHeight);
      if (strength < 0) light = { x: -light.x, y: -light.y, z: light.z };

      const diffuse = clamp(normal.x * light.x + normal.y * light.y + normal.z * light.z, 0, 1);
      const distance = Math.hypot(centerX - lx, centerY - ly) / Math.max(1, maxDistance);
      const falloff = lerp(1, 0.72, clamp(distance, 0, 1));
      const baseLum = luminanceAt(original, width, height, x, y) / 255;
      const shadowBias = lerp(0.9, 1.08, baseLum);
      const shade = lerp(0.72, 1.28, diffuse) * falloff * shadowBias;
      const multiplier = lerp(1, shade, effect);

      data[i] = clamp(original[i] * multiplier, 0, 255);
      data[i + 1] = clamp(original[i + 1] * multiplier, 0, 255);
      data[i + 2] = clamp(original[i + 2] * multiplier, 0, 255);
    }
  }

  return imageData;
}

function applySeamlessTileBlend(imageData) {
  if (controls.seamAlgorithm.value === "reconcile") {
    return applyStrongEdgeReconcile(imageData);
  }
  return applyGentleEdgeCrossfade(imageData);
}

function applyGentleEdgeCrossfade(imageData) {
  const { width, height, data } = imageData;
  if (width < 2 || height < 2) return imageData;

  const percent = clamp(parseFloat(controls.seamBlend.value) || 18, 1, 50) / 100;
  controls.seamBlend.value = Math.round(percent * 100);
  const bandX = clamp(Math.round(width * percent), 1, Math.floor(width / 2));
  const bandY = clamp(Math.round(height * percent), 1, Math.floor(height / 2));
  const original = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = original[i];
      let g = original[i + 1];
      let b = original[i + 2];
      let a = original[i + 3];

      if (x < bandX) {
        const w = 0.5 * (1 - smoothstep(0, 1, x / bandX));
        const p = ((y * width) + (width - bandX + x)) * 4;
        r = lerp(r, original[p], w);
        g = lerp(g, original[p + 1], w);
        b = lerp(b, original[p + 2], w);
        a = lerp(a, original[p + 3], w);
      } else if (x >= width - bandX) {
        const w = 0.5 * (1 - smoothstep(0, 1, (width - 1 - x) / bandX));
        const p = ((y * width) + (x - (width - bandX))) * 4;
        r = lerp(r, original[p], w);
        g = lerp(g, original[p + 1], w);
        b = lerp(b, original[p + 2], w);
        a = lerp(a, original[p + 3], w);
      }

      if (y < bandY) {
        const w = 0.5 * (1 - smoothstep(0, 1, y / bandY));
        const p = (((height - bandY + y) * width) + x) * 4;
        r = lerp(r, original[p], w);
        g = lerp(g, original[p + 1], w);
        b = lerp(b, original[p + 2], w);
        a = lerp(a, original[p + 3], w);
      } else if (y >= height - bandY) {
        const w = 0.5 * (1 - smoothstep(0, 1, (height - 1 - y) / bandY));
        const p = (((y - (height - bandY)) * width) + x) * 4;
        r = lerp(r, original[p], w);
        g = lerp(g, original[p + 1], w);
        b = lerp(b, original[p + 2], w);
        a = lerp(a, original[p + 3], w);
      }

      data[i] = Math.round(r);
      data[i + 1] = Math.round(g);
      data[i + 2] = Math.round(b);
      data[i + 3] = Math.round(a);
    }
  }

  return imageData;
}

function applyStrongEdgeReconcile(imageData) {
  const { width, height, data } = imageData;
  if (width < 2 || height < 2) return imageData;

  const percent = clamp(parseFloat(controls.seamBlend.value) || 18, 1, 50) / 100;
  controls.seamBlend.value = Math.round(percent * 100);
  const bandX = clamp(Math.round(width * percent), 1, Math.floor(width / 2));
  const bandY = clamp(Math.round(height * percent), 1, Math.floor(height / 2));

  reconcileOppositeBands(data, width, height, bandX, true);
  reconcileOppositeBands(data, width, height, bandY, false);

  // The second pass can introduce sub-rounding differences at the corners.
  // Reconcile the outermost rows and columns once more so every exported edge
  // is byte-for-byte tileable.
  reconcileOppositeBands(data, width, height, 1, true);
  reconcileOppositeBands(data, width, height, 1, false);
  return imageData;
}

function reconcileOppositeBands(data, width, height, band, horizontal) {
  const original = new Uint8ClampedArray(data);
  const span = Math.max(1, band - 1);

  for (let distance = 0; distance < band; distance++) {
    const feather = 1 - smootherstep(distance / span);
    const amount = distance === 0 ? 1 : feather;
    if (amount <= 0) continue;

    const lineLength = horizontal ? height : width;
    for (let line = 0; line < lineLength; line++) {
      const ax = horizontal ? distance : line;
      const ay = horizontal ? line : distance;
      const bx = horizontal ? width - 1 - distance : line;
      const by = horizontal ? line : height - 1 - distance;
      const a = (ay * width + ax) * 4;
      const b = (by * width + bx) * 4;

      for (let channel = 0; channel < 4; channel++) {
        const midpoint = (original[a + channel] + original[b + channel]) * 0.5;
        data[a + channel] = Math.round(lerp(original[a + channel], midpoint, amount));
        data[b + channel] = Math.round(lerp(original[b + channel], midpoint, amount));
      }
    }
  }
}

function getSymmetryLinePixels(width, height) {
  return {
    a: { x: state.symmetry.a.x * width, y: state.symmetry.a.y * height },
    b: { x: state.symmetry.b.x * width, y: state.symmetry.b.y * height }
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

function updateOutputPreviewSize(width, height, viewWidth = width, viewHeight = height, tileCount = 1) {
  const stage = document.querySelector("#previewStage");
  const wrap = stage.parentElement.getBoundingClientRect();
  const maxWidth = Math.max(120, Math.min(wrap.width - 24, 860));
  const maxHeight = Math.max(120, Math.min(wrap.height - 24, window.innerHeight - 150, 860));
  const scale = Math.min(maxWidth / viewWidth, maxHeight / viewHeight);
  const cssWidth = Math.max(1, Math.round(viewWidth * scale));
  const cssHeight = Math.max(1, Math.round(viewHeight * scale));
  state.preview = { width, height, viewWidth, viewHeight, tileCount, cssWidth, cssHeight };
  stage.style.width = `${cssWidth}px`;
  stage.style.height = `${cssHeight}px`;
  outputCanvas.style.width = `${cssWidth}px`;
  outputCanvas.style.height = `${cssHeight}px`;
  outputOverlay.style.width = `${cssWidth}px`;
  outputOverlay.style.height = `${cssHeight}px`;
}

function drawOutputOverlay() {
  const { width, height, viewWidth, viewHeight, cssWidth, cssHeight } = state.preview;
  const dpr = window.devicePixelRatio || 1;
  outputOverlay.width = Math.max(1, Math.round(cssWidth * dpr));
  outputOverlay.height = Math.max(1, Math.round(cssHeight * dpr));
  overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  overlayCtx.clearRect(0, 0, cssWidth, cssHeight);

  if (controls.showGrid.checked || state.editSymmetry) drawOverlayGrid(viewWidth, viewHeight, cssWidth, cssHeight);
  if ((controls.symmetryOn.checked || state.editSymmetry) && controls.showSymmetryGuide.checked) {
    drawSymmetryOverlay(width, height, cssWidth, cssHeight);
  }
  if (state.editLight) drawLightOverlay(width, height, cssWidth, cssHeight);
}

function drawOverlayGrid(width, height, cssWidth, cssHeight) {
  if (width > 192 || height > 192) return;
  overlayCtx.save();
  overlayCtx.strokeStyle = "rgba(0, 0, 0, 0.82)";
  overlayCtx.lineWidth = 1;

  for (let x = 0; x <= width; x++) {
    const cssX = crispLine((x / width) * cssWidth);
    overlayCtx.beginPath();
    overlayCtx.moveTo(cssX, 0);
    overlayCtx.lineTo(cssX, cssHeight);
    overlayCtx.stroke();
  }

  for (let y = 0; y <= height; y++) {
    const cssY = crispLine((y / height) * cssHeight);
    overlayCtx.beginPath();
    overlayCtx.moveTo(0, cssY);
    overlayCtx.lineTo(cssWidth, cssY);
    overlayCtx.stroke();
  }

  overlayCtx.restore();
}

function drawSymmetryOverlay(width, height, cssWidth, cssHeight) {
  overlayCtx.save();
  const { tileCount } = state.preview;
  const centerTile = Math.floor(tileCount / 2);
  const line = getSymmetryLinePixels(width, height);

  for (let ty = 0; ty < tileCount; ty++) {
    for (let tx = 0; tx < tileCount; tx++) {
      const shifted = {
        a: { x: line.a.x + tx * width, y: line.a.y + ty * height },
        b: { x: line.b.x + tx * width, y: line.b.y + ty * height }
      };
      drawOneSymmetryLine(shifted, state.preview.viewWidth, state.preview.viewHeight, cssWidth, cssHeight);
    }
  }

  if (state.editSymmetry) {
    const centerLine = {
      a: { x: line.a.x + centerTile * width, y: line.a.y + centerTile * height },
      b: { x: line.b.x + centerTile * width, y: line.b.y + centerTile * height }
    };
    const a = gridToCss(centerLine.a, state.preview.viewWidth, state.preview.viewHeight, cssWidth, cssHeight);
    const b = gridToCss(centerLine.b, state.preview.viewWidth, state.preview.viewHeight, cssWidth, cssHeight);
    drawOutputHandle(a.x, a.y, "#38bdf8");
    drawOutputHandle(b.x, b.y, "#38bdf8");
  }
  overlayCtx.restore();
}

function drawOneSymmetryLine(line, viewWidth, viewHeight, cssWidth, cssHeight) {
  const extended = extendLineToCanvas(line.a, line.b, viewWidth, viewHeight);
  const a = gridToCss(line.a, viewWidth, viewHeight, cssWidth, cssHeight);
  const b = gridToCss(line.b, viewWidth, viewHeight, cssWidth, cssHeight);
  const ea = gridToCss(extended.a, viewWidth, viewHeight, cssWidth, cssHeight);
  const eb = gridToCss(extended.b, viewWidth, viewHeight, cssWidth, cssHeight);

  overlayCtx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  overlayCtx.lineWidth = 5;
  overlayCtx.beginPath();
  overlayCtx.moveTo(ea.x, ea.y);
  overlayCtx.lineTo(eb.x, eb.y);
  overlayCtx.stroke();

  overlayCtx.strokeStyle = "#0ea5e9";
  overlayCtx.lineWidth = 2;
  overlayCtx.beginPath();
  overlayCtx.moveTo(ea.x, ea.y);
  overlayCtx.lineTo(eb.x, eb.y);
  overlayCtx.stroke();

  overlayCtx.strokeStyle = "#38bdf8";
  overlayCtx.lineWidth = 3;
  overlayCtx.beginPath();
  overlayCtx.moveTo(a.x, a.y);
  overlayCtx.lineTo(b.x, b.y);
  overlayCtx.stroke();
}

function drawLightOverlay(width, height, cssWidth, cssHeight) {
  const centerTile = Math.floor(state.preview.tileCount / 2);
  const point = gridToCss(
    { x: state.light.x * width + centerTile * width, y: state.light.y * height + centerTile * height },
    state.preview.viewWidth,
    state.preview.viewHeight,
    cssWidth,
    cssHeight
  );
  const radius = Math.min(cssWidth, cssHeight) * 0.28;

  overlayCtx.save();
  overlayCtx.strokeStyle = "rgba(255, 255, 255, 0.86)";
  overlayCtx.lineWidth = 2;
  overlayCtx.setLineDash([7, 6]);
  overlayCtx.beginPath();
  overlayCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  overlayCtx.stroke();
  overlayCtx.setLineDash([]);
  overlayCtx.strokeStyle = "rgba(0, 0, 0, 0.75)";
  overlayCtx.lineWidth = 1;
  overlayCtx.beginPath();
  overlayCtx.arc(point.x, point.y, radius + 2, 0, Math.PI * 2);
  overlayCtx.stroke();
  drawOutputHandle(point.x, point.y, "#f8fafc");
  overlayCtx.restore();
}

function drawOutputHandle(x, y, color) {
  overlayCtx.save();
  overlayCtx.fillStyle = "#101114";
  overlayCtx.strokeStyle = color;
  overlayCtx.lineWidth = 2;
  overlayCtx.beginPath();
  overlayCtx.arc(x, y, 8, 0, Math.PI * 2);
  overlayCtx.fill();
  overlayCtx.stroke();
  overlayCtx.restore();
}

function crispLine(value) {
  return Math.round(value) + 0.5;
}

function gridToCss(point, width, height, cssWidth, cssHeight) {
  return {
    x: (point.x / width) * cssWidth,
    y: (point.y / height) * cssHeight
  };
}

function pointerToOutputGrid(event) {
  const rect = outputOverlay.getBoundingClientRect();
  const { width, height, viewWidth, viewHeight } = state.preview;
  const viewX = clamp(((event.clientX - rect.left) / rect.width) * viewWidth, 0, viewWidth);
  const viewY = clamp(((event.clientY - rect.top) / rect.height) * viewHeight, 0, viewHeight);
  return {
    x: clamp(((viewX % width) + width) % width, 0, width),
    y: clamp(((viewY % height) + height) % height, 0, height)
  };
}

function bilinearSample(data, width, height, x, y) {
  const x0 = Math.floor(clamp(x, 0, width - 1));
  const y0 = Math.floor(clamp(y, 0, height - 1));
  const x1 = clamp(x0 + 1, 0, width - 1);
  const y1 = clamp(y0 + 1, 0, height - 1);
  const tx = clamp(x - x0, 0, 1);
  const ty = clamp(y - y0, 0, 1);
  const c00 = rawPixelAt(data, width, x0, y0);
  const c10 = rawPixelAt(data, width, x1, y0);
  const c01 = rawPixelAt(data, width, x0, y1);
  const c11 = rawPixelAt(data, width, x1, y1);
  return {
    r: lerp(lerp(c00.r, c10.r, tx), lerp(c01.r, c11.r, tx), ty),
    g: lerp(lerp(c00.g, c10.g, tx), lerp(c01.g, c11.g, tx), ty),
    b: lerp(lerp(c00.b, c10.b, tx), lerp(c01.b, c11.b, tx), ty),
    a: lerp(lerp(c00.a, c10.a, tx), lerp(c01.a, c11.a, tx), ty)
  };
}

function rawPixelAt(data, width, x, y) {
  const i = (y * width + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

function luminanceAt(data, width, height, x, y) {
  const sx = clamp(x, 0, width - 1);
  const sy = clamp(y, 0, height - 1);
  const i = (sy * width + sx) * 4;
  return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
}

function normalize3(x, y, z) {
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function smootherstep(value) {
  const t = clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function normalizeAngle(angle) {
  let value = ((angle + 180) % 360 + 360) % 360 - 180;
  if (Object.is(value, -0)) value = 0;
  return value;
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

const ANIMATED_CONTROL_KEYS = [
  "squareCrop",
  "cropAngle",
  "outWidth",
  "outHeight",
  "lockRatio",
  "pixelated",
  "showGrid",
  "tilePreview",
  "alphaOn",
  "alphaColor",
  "alphaTolerance",
  "removeBg",
  "bgTolerance",
  "paletteOn",
  "paletteColors",
  "edgeDetect",
  "edgeStrength",
  "symmetryOn",
  "showSymmetryGuide",
  "seamlessOn",
  "seamAlgorithm",
  "seamBlend",
  "shadeOn",
  "lightStrength"
];

function setEditorMode(mode) {
  const animationMode = mode === "animation";
  state.animation.mode = animationMode;
  document.body.classList.toggle("animation-mode", animationMode);
  controls.imageModeBtn.classList.toggle("active", !animationMode);
  controls.animationModeBtn.classList.toggle("active", animationMode);

  if (animationMode) {
    if (!state.animation.baseSnapshot) state.animation.baseSnapshot = captureEditorSnapshot();
    syncAnimationEditor();
  } else {
    pauseAnimation();
  }
  requestAnimationFrame(resizeOutputPreview);
}

function captureEditorSnapshot() {
  const controlValues = {};
  for (const key of ANIMATED_CONTROL_KEYS) {
    const control = controls[key];
    if (!control) continue;
    if (control.type === "checkbox") controlValues[key] = control.checked;
    else if (control.type === "number" || control.type === "range") {
      controlValues[key] = parseFloat(control.value) || 0;
    } else {
      controlValues[key] = control.value;
    }
  }

  return {
    controls: controlValues,
    crop: state.crop ? { ...state.crop } : null,
    symmetry: {
      a: { ...state.symmetry.a },
      b: { ...state.symmetry.b }
    },
    light: { ...state.light }
  };
}

function cloneSnapshot(snapshot) {
  return snapshot ? JSON.parse(JSON.stringify(snapshot)) : null;
}

function applyEditorSnapshot(snapshot) {
  if (!snapshot) return;
  state.animation.applying = true;

  for (const [key, value] of Object.entries(snapshot.controls || {})) {
    const control = controls[key];
    if (!control) continue;
    if (control.type === "checkbox") control.checked = Boolean(value);
    else control.value = value;
  }

  if (snapshot.crop && state.image) {
    state.crop = normalizeAnimatedCrop(snapshot.crop);
    controls.cropAngle.value = Math.round((state.crop.angle || 0) * 100) / 100;
  }
  if (snapshot.symmetry) {
    state.symmetry = {
      a: { ...snapshot.symmetry.a },
      b: { ...snapshot.symmetry.b }
    };
  }
  if (snapshot.light) state.light = { ...snapshot.light };

  updateSeamAlgorithmNote();
  state.animation.applying = false;
}

function normalizeAnimatedCrop(crop) {
  if (!state.image) return crop;
  let w = clamp(Number(crop.w) || 1, 1, state.image.width);
  let h = clamp(Number(crop.h) || 1, 1, state.image.height);
  if (controls.squareCrop.checked) {
    const side = Math.min(w, h);
    w = side;
    h = side;
  }
  return {
    x: clamp(Number(crop.x) || 0, 0, state.image.width - w),
    y: clamp(Number(crop.y) || 0, 0, state.image.height - h),
    w,
    h,
    angle: normalizeAngle(Number(crop.angle) || 0)
  };
}

function interpolateEditorSnapshots(a, b, t) {
  if (!a) return cloneSnapshot(b);
  if (!b) return cloneSnapshot(a);
  const result = cloneSnapshot(a);

  for (const key of ANIMATED_CONTROL_KEYS) {
    const av = a.controls?.[key];
    const bv = b.controls?.[key];
    if (av === undefined || bv === undefined) continue;
    if (key === "alphaColor") result.controls[key] = lerpHexColor(av, bv, t);
    else if (key === "cropAngle") result.controls[key] = lerpAngle(av, bv, t);
    else if (typeof av === "number" && typeof bv === "number") result.controls[key] = lerp(av, bv, t);
    else result.controls[key] = t >= 1 ? bv : av;
  }

  if (a.crop && b.crop) {
    result.crop = {
      x: lerp(a.crop.x, b.crop.x, t),
      y: lerp(a.crop.y, b.crop.y, t),
      w: lerp(a.crop.w, b.crop.w, t),
      h: lerp(a.crop.h, b.crop.h, t),
      angle: lerpAngle(a.crop.angle || 0, b.crop.angle || 0, t)
    };
  }

  result.symmetry = {
    a: {
      x: lerp(a.symmetry.a.x, b.symmetry.a.x, t),
      y: lerp(a.symmetry.a.y, b.symmetry.a.y, t)
    },
    b: {
      x: lerp(a.symmetry.b.x, b.symmetry.b.x, t),
      y: lerp(a.symmetry.b.y, b.symmetry.b.y, t)
    }
  };
  result.light = {
    x: lerp(a.light.x, b.light.x, t),
    y: lerp(a.light.y, b.light.y, t)
  };
  return result;
}

function lerpHexColor(a, b, t) {
  const ac = hexToRgb(a || "#000000");
  const bc = hexToRgb(b || "#000000");
  return rgbToHex(
    Math.round(lerp(ac.r, bc.r, t)),
    Math.round(lerp(ac.g, bc.g, t)),
    Math.round(lerp(ac.b, bc.b, t))
  );
}

function lerpAngle(a, b, t) {
  const delta = normalizeAngle((Number(b) || 0) - (Number(a) || 0));
  return normalizeAngle((Number(a) || 0) + delta * t);
}

function resetAnimationProject() {
  pauseAnimation();
  state.animation.frame = 0;
  state.animation.direction = 1;
  state.animation.keyframes = [];
  state.animation.baseSnapshot = captureEditorSnapshot();
  state.animation.dirty = false;
  syncAnimationEditor();
}

function getAnimationLength() {
  const length = clamp(parseInt(controls.animationLength.value, 10) || 16, 2, 240);
  controls.animationLength.value = length;
  return length;
}

function getAnimationFps() {
  const fps = clamp(parseInt(controls.animationFps.value, 10) || 8, 1, 60);
  controls.animationFps.value = fps;
  return fps;
}

function setAnimationFrame(frame, render = true) {
  const length = getAnimationLength();
  state.animation.frame = clamp(Math.round(frame), 0, length - 1);
  controls.animationFrame.max = length - 1;
  controls.animationFrame.value = state.animation.frame;
  controls.animationFrameNumber.max = length;
  controls.animationFrameNumber.value = state.animation.frame + 1;
  controls.timelineEndLabel.textContent = length;

  const snapshot = getAnimationSnapshotAtFrame(state.animation.frame);
  if (snapshot) applyEditorSnapshot(snapshot);
  state.animation.dirty = false;
  updateAnimationStatus();
  updateKeyframeSummary();
  updateTimelineMarkerSelection();

  if (render) {
    drawSource();
    renderOutput();
  }
}

function getAnimationSnapshotAtFrame(frame) {
  const frames = [...state.animation.keyframes].sort((a, b) => a.frame - b.frame);
  if (!frames.length) return null;
  const exact = frames.find(item => item.frame === frame);
  if (exact) return cloneSnapshot(exact.snapshot);

  if (frame < frames[0].frame) {
    if (frames[0].frame === 0) return cloneSnapshot(frames[0].snapshot);
    return interpolateSnapshotFrames(
      { frame: 0, snapshot: state.animation.baseSnapshot },
      frames[0],
      frame
    );
  }
  if (frame > frames[frames.length - 1].frame) return cloneSnapshot(frames[frames.length - 1].snapshot);

  for (let i = 0; i < frames.length - 1; i++) {
    if (frame > frames[i].frame && frame < frames[i + 1].frame) {
      return interpolateSnapshotFrames(frames[i], frames[i + 1], frame);
    }
  }
  return null;
}

function interpolateSnapshotFrames(a, b, frame) {
  if (b.frame === a.frame) return cloneSnapshot(b.snapshot);
  let t = clamp((frame - a.frame) / (b.frame - a.frame), 0, 1);
  if (controls.animationInterpolation.value === "hold") t = 0;
  if (controls.animationInterpolation.value === "smooth") t = smootherstep(t);
  return interpolateEditorSnapshots(a.snapshot, b.snapshot, t);
}

function syncAnimationEditor() {
  const length = getAnimationLength();
  getAnimationFps();
  controls.animationFrame.max = length - 1;
  controls.animationFrameNumber.max = length;
  if (state.animation.frame >= length) state.animation.frame = length - 1;
  setAnimationFrame(state.animation.frame, false);
  updateKeyframeSummary();
  renderTimelineMarkers();
}

function setAnimationKeyframe() {
  if (!state.animation.baseSnapshot) state.animation.baseSnapshot = captureEditorSnapshot();
  const snapshot = captureEditorSnapshot();
  const existing = state.animation.keyframes.find(item => item.frame === state.animation.frame);
  if (existing) existing.snapshot = snapshot;
  else state.animation.keyframes.push({ frame: state.animation.frame, snapshot });
  state.animation.keyframes.sort((a, b) => a.frame - b.frame);
  state.animation.dirty = false;
  updateKeyframeSummary();
  renderTimelineMarkers();
  updateAnimationStatus();
}

function deleteAnimationKeyframe() {
  state.animation.keyframes = state.animation.keyframes.filter(item => item.frame !== state.animation.frame);
  state.animation.dirty = false;
  updateKeyframeSummary();
  renderTimelineMarkers();
  setAnimationFrame(state.animation.frame);
}

function markAnimationEdited(allowAutoKey = true) {
  if (!state.animation.mode || state.animation.applying || state.animation.playing) return;
  state.animation.dirty = true;
  if (allowAutoKey && controls.animationAutoKey.checked) {
    setAnimationKeyframe();
  } else {
    updateAnimationStatus();
    updateKeyframeSummary();
  }
}

function commitAutoKeyIfNeeded() {
  if (state.animation.mode && state.animation.dirty && controls.animationAutoKey.checked) {
    setAnimationKeyframe();
  }
}

function isAnimatableControl(control) {
  return ANIMATED_CONTROL_KEYS.some(key => controls[key] === control);
}

function currentFrameKeyframe() {
  return state.animation.keyframes.find(item => item.frame === state.animation.frame) || null;
}

function updateAnimationStatus() {
  const keyed = Boolean(currentFrameKeyframe());
  controls.animationStatus.classList.toggle("dirty", state.animation.dirty);
  controls.animationStatus.classList.toggle("keyed", keyed && !state.animation.dirty);
  controls.animationStatus.textContent = state.animation.dirty
    ? `Frame ${state.animation.frame + 1} / ${getAnimationLength()} • Edited`
    : keyed
      ? `Frame ${state.animation.frame + 1} / ${getAnimationLength()} • Keyed`
      : `Frame ${state.animation.frame + 1} / ${getAnimationLength()}`;
  controls.addKeyframeBtn.textContent = keyed ? "Update full state" : "Capture full state";
}

function updateKeyframeSummary() {
  const frames = state.animation.keyframes
    .filter(item => item.frame < getAnimationLength())
    .map(item => item.frame + 1);
  if (state.animation.dirty) {
    controls.keyframeSummary.textContent = "Unsaved editor changes at this frame. Capture them or enable Auto-key.";
  } else if (frames.length) {
    controls.keyframeSummary.textContent = `Full-state keyframes: ${frames.join(", ")}. Every editable tool is included.`;
  } else {
    controls.keyframeSummary.textContent = "No keyframes yet. Edit anything above, then capture the full state.";
  }
}

function renderTimelineMarkers() {
  controls.timelineMarkers.replaceChildren();
  const length = getAnimationLength();
  const denominator = Math.max(1, length - 1);

  for (const item of state.animation.keyframes) {
    if (item.frame >= length) continue;
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "timeline-marker";
    marker.classList.toggle("selected", item.frame === state.animation.frame);
    marker.style.left = `${(item.frame / denominator) * 100}%`;
    marker.dataset.frame = item.frame;
    marker.title = `Full editor state — frame ${item.frame + 1}`;
    marker.addEventListener("click", () => {
      pauseAnimation();
      setAnimationFrame(item.frame);
    });
    controls.timelineMarkers.append(marker);
  }
}

function updateTimelineMarkerSelection() {
  controls.timelineMarkers.querySelectorAll(".timeline-marker").forEach(marker => {
    marker.classList.toggle(
      "selected",
      parseInt(marker.dataset.frame, 10) === state.animation.frame
    );
  });
}

function toggleAnimationPlayback() {
  if (state.animation.playing) {
    pauseAnimation();
    return;
  }
  if (!state.image || !state.animation.keyframes.length) return;
  state.animation.playing = true;
  state.animation.lastTime = performance.now();
  state.animation.accumulator = 0;
  controls.playAnimationBtn.textContent = "Pause";
  state.animation.raf = requestAnimationFrame(animationTick);
}

function pauseAnimation() {
  state.animation.playing = false;
  if (state.animation.raf) cancelAnimationFrame(state.animation.raf);
  state.animation.raf = 0;
  if (controls.playAnimationBtn) controls.playAnimationBtn.textContent = "Play";
}

function restartAnimation() {
  pauseAnimation();
  state.animation.direction = 1;
  setAnimationFrame(0);
}

function animationTick(now) {
  if (!state.animation.playing) return;
  const interval = 1000 / getAnimationFps();
  state.animation.accumulator += Math.min(250, now - state.animation.lastTime);
  state.animation.lastTime = now;

  while (state.animation.accumulator >= interval) {
    state.animation.accumulator -= interval;
    advanceAnimationFrame();
  }
  state.animation.raf = requestAnimationFrame(animationTick);
}

function advanceAnimationFrame() {
  const length = getAnimationLength();
  if (controls.animationLoop.value === "boomerang") {
    let next = state.animation.frame + state.animation.direction;
    if (next >= length) {
      state.animation.direction = -1;
      next = Math.max(0, length - 2);
    } else if (next < 0) {
      state.animation.direction = 1;
      next = Math.min(length - 1, 1);
    }
    setAnimationFrame(next);
  } else {
    state.animation.direction = 1;
    setAnimationFrame((state.animation.frame + 1) % length);
  }
}

function getAnimationSequence() {
  const length = getAnimationLength();
  const sequence = Array.from({ length }, (_, index) => index);
  if (controls.animationLoop.value === "boomerang" && length > 2) {
    for (let frame = length - 2; frame >= 1; frame--) sequence.push(frame);
  }
  return sequence;
}

function getSheetGrid(frameCount, cellWidth, cellHeight, maxDimension = 16384) {
  if (controls.sheetLayout.value === "vertical") {
    return { columns: 1, rows: frameCount };
  }
  if (controls.sheetLayout.value === "horizontal") {
    return { columns: frameCount, rows: 1 };
  }
  const columns = Math.max(1, Math.min(frameCount, Math.floor(maxDimension / cellWidth)));
  return { columns, rows: Math.ceil(frameCount / columns) };
}

async function downloadSpriteSheet() {
  if (!state.image || !state.animation.keyframes.length) return;
  const wasPlaying = state.animation.playing;
  const previousFrame = state.animation.frame;
  const previousDirection = state.animation.direction;
  pauseAnimation();

  const sequence = getAnimationSequence();
  const maxDimension = 16384;
  let cellWidth = 1;
  let cellHeight = 1;

  for (const frame of sequence) {
    setAnimationFrame(frame, false);
    drawSource();
    renderOutput();
    cellWidth = Math.max(cellWidth, cleanOutputCanvas.width);
    cellHeight = Math.max(cellHeight, cleanOutputCanvas.height);
  }

  const { columns, rows } = getSheetGrid(sequence.length, cellWidth, cellHeight, maxDimension);
  if (columns * cellWidth > maxDimension || rows * cellHeight > maxDimension) {
    window.alert("This sprite sheet is too large. Reduce the frame count or output size.");
    state.animation.direction = previousDirection;
    setAnimationFrame(previousFrame);
    return;
  }

  const sheet = document.createElement("canvas");
  sheet.width = columns * cellWidth;
  sheet.height = rows * cellHeight;
  const sheetCtx = sheet.getContext("2d");
  sheetCtx.imageSmoothingEnabled = false;

  sequence.forEach((frame, index) => {
    setAnimationFrame(frame, false);
    drawSource();
    renderOutput();
    const cellX = (index % columns) * cellWidth;
    const cellY = Math.floor(index / columns) * cellHeight;
    const x = cellX + Math.floor((cellWidth - cleanOutputCanvas.width) / 2);
    const y = cellY + Math.floor((cellHeight - cleanOutputCanvas.height) / 2);
    sheetCtx.drawImage(cleanOutputCanvas, x, y);
  });

  const blob = await new Promise(resolve => sheet.toBlob(resolve, "image/png"));
  if (blob) {
    const link = document.createElement("a");
    link.download = `${state.fileName}-${getAnimationFps()}fps-${controls.animationLoop.value}-${controls.sheetLayout.value}-sheet.png`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  state.animation.direction = previousDirection;
  setAnimationFrame(previousFrame);
  if (wasPlaying) toggleAnimationPlayback();
}

function updateSeamAlgorithmNote() {
  controls.seamAlgorithmNote.textContent = controls.seamAlgorithm.value === "reconcile"
    ? "Forces opposite edge bands to agree, with an exact outer-edge match."
    : "Softly overlaps wrapped edge bands.";
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
      input.dispatchEvent(new Event("input", { bubbles: true }));
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
  markAnimationEdited();
  renderOutput();
}

function resetTools() {
  controls.outWidth.value = 16;
  controls.outHeight.value = 16;
  controls.lockRatio.checked = true;
  controls.pixelated.checked = true;
  controls.showGrid.checked = false;
  controls.tilePreview.checked = false;
  controls.squareCrop.checked = true;
  controls.cropAngle.value = 0;
  controls.alphaOn.checked = false;
  controls.alphaColor.value = "#ffffff";
  controls.alphaTolerance.value = 36;
  controls.removeBg.checked = false;
  controls.bgTolerance.value = 42;
  controls.paletteOn.checked = true;
  controls.paletteColors.value = 16;
  controls.edgeDetect.checked = false;
  controls.edgeStrength.value = 80;
  controls.symmetryOn.checked = false;
  controls.showSymmetryGuide.checked = true;
  controls.seamlessOn.checked = false;
  controls.seamAlgorithm.value = "crossfade";
  controls.seamBlend.value = 18;
  controls.shadeOn.checked = false;
  controls.lightStrength.value = 34;

  state.cropMode = true;
  state.pickingAlpha = false;
  state.editSymmetry = false;
  state.editLight = false;
  state.cropDrag = null;
  state.outputDrag = null;
  state.symmetry = {
    a: { x: 0.5, y: 0.0 },
    b: { x: 0.5, y: 1.0 }
  };
  state.light = { x: 0.35, y: 0.25 };
  state.crop = state.image ? makeDefaultCrop() : null;

  controls.cropBtn.classList.add("active");
  controls.pickAlphaBtn.classList.remove("active");
  controls.editSymmetryBtn.classList.remove("active");
  controls.editLightBtn.classList.remove("active");

  updateSeamAlgorithmNote();
  resetAnimationProject();
  drawSource();
  renderOutput();
}

function setOutputPoint(point, which) {
  const { width, height } = state.preview;
  const x = clamp(point.x / Math.max(1, width), 0, 1);
  const y = clamp(point.y / Math.max(1, height), 0, 1);
  if (which === "light") state.light = { x, y };
  if (which === "a") state.symmetry.a = { x, y };
  if (which === "b") state.symmetry.b = { x, y };
}

function hitOutputPoint(point) {
  const { width, height, viewWidth, cssWidth } = state.preview;
  const radius = 16 / Math.max(1, cssWidth / viewWidth);
  const line = getSymmetryLinePixels(width, height);
  const light = {
    x: state.light.x * width,
    y: state.light.y * height
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
    markAnimationEdited();
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

  if (drag.target === "rotate") {
    const center = getCropCenter(drag.startCrop);
    const angle = normalizeAngle(toDeg(Math.atan2(p.y - center.y, p.x - center.x)) + 90);
    state.crop = normalizeCrop({ ...drag.startCrop, angle });
    controls.cropAngle.value = Math.round(angle);
  } else if (drag.target === "move") {
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

  markAnimationEdited(false);
  drawSource();
  renderOutput();
});

sourceCanvas.addEventListener("pointerup", () => {
  state.cropDrag = null;
  commitAutoKeyIfNeeded();
});

outputOverlay.addEventListener("pointerdown", event => {
  if (!state.image) return;
  const p = pointerToOutputGrid(event);
  const target = hitOutputPoint(p);
  if (!target) return;
  state.outputDrag = target;
  setOutputPoint(p, target);
  outputOverlay.setPointerCapture(event.pointerId);
  markAnimationEdited(false);
  renderOutput();
});

outputOverlay.addEventListener("pointermove", event => {
  if (!state.outputDrag) return;
  const p = pointerToOutputGrid(event);
  setOutputPoint(p, state.outputDrag);
  markAnimationEdited(false);
  renderOutput();
});

outputOverlay.addEventListener("pointerup", () => {
  state.outputDrag = null;
  commitAutoKeyIfNeeded();
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
    h: Math.max(1, Math.abs(y2 - y1)),
    angle: normalizeAngle(parseFloat(controls.cropAngle.value) || 0)
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
  if (state.editSymmetry) {
    state.editLight = false;
    controls.symmetryOn.checked = true;
  }
  controls.editSymmetryBtn.classList.toggle("active", state.editSymmetry);
  controls.editLightBtn.classList.toggle("active", state.editLight);
  markAnimationEdited();
  renderOutput();
});

controls.editLightBtn.addEventListener("click", () => {
  state.editLight = !state.editLight;
  if (state.editLight) {
    state.editSymmetry = false;
    controls.shadeOn.checked = true;
  }
  controls.editLightBtn.classList.toggle("active", state.editLight);
  controls.editSymmetryBtn.classList.toggle("active", state.editSymmetry);
  markAnimationEdited();
  renderOutput();
});

controls.resetCropBtn.addEventListener("click", resetCrop);
controls.resetToolsBtn.addEventListener("click", resetTools);
controls.resetSymmetryBtn.addEventListener("click", resetSymmetry);
controls.renderBtn.addEventListener("click", renderOutput);
controls.downloadBtn.addEventListener("click", downloadOutput);
controls.downloadSpriteBtn.addEventListener("click", downloadSpriteSheet);
controls.imageModeBtn.addEventListener("click", () => setEditorMode("image"));
controls.animationModeBtn.addEventListener("click", () => setEditorMode("animation"));
controls.playAnimationBtn.addEventListener("click", toggleAnimationPlayback);
controls.restartAnimationBtn.addEventListener("click", restartAnimation);
controls.addKeyframeBtn.addEventListener("click", setAnimationKeyframe);
controls.deleteKeyframeBtn.addEventListener("click", deleteAnimationKeyframe);

document.querySelectorAll(".tool-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tool-tab").forEach(item => item.classList.toggle("active", item === tab));
    document.querySelectorAll(".tool-section").forEach(section => {
      section.classList.toggle("active", section.dataset.toolPanel === tab.dataset.tool);
    });
  });
});

controls.seamAlgorithm.addEventListener("input", updateSeamAlgorithmNote);
controls.animationLength.addEventListener("input", () => {
  state.animation.direction = 1;
  syncAnimationEditor();
});
controls.animationFps.addEventListener("input", getAnimationFps);
controls.animationLoop.addEventListener("input", () => {
  state.animation.direction = 1;
});
controls.animationInterpolation.addEventListener("input", () => setAnimationFrame(state.animation.frame));
controls.animationFrame.addEventListener("input", () => {
  pauseAnimation();
  setAnimationFrame(parseInt(controls.animationFrame.value, 10) || 0);
});
controls.animationFrameNumber.addEventListener("input", () => {
  pauseAnimation();
  setAnimationFrame((parseInt(controls.animationFrameNumber.value, 10) || 1) - 1);
});
controls.animationAutoKey.addEventListener("input", () => {
  if (controls.animationAutoKey.checked && state.animation.dirty) setAnimationKeyframe();
});

Object.values(controls).forEach(control => {
  if (!control || control.type === "file") return;
  control.addEventListener("input", () => {
    syncSizeInputs(control);
    if (control === controls.cropAngle && state.crop) {
      const angle = normalizeAngle(parseFloat(controls.cropAngle.value) || 0);
      controls.cropAngle.value = Math.round(angle * 100) / 100;
      state.crop = normalizeCrop({ ...state.crop, angle });
    }
    if (control === controls.squareCrop && state.image) {
      const crop = state.crop || makeDefaultCrop();
      const cx = crop.x + crop.w / 2;
      const cy = crop.y + crop.h / 2;
      const side = Math.min(crop.w, crop.h);
      state.crop = controls.squareCrop.checked
        ? normalizeCrop({ x: cx - side / 2, y: cy - side / 2, w: side, h: side, angle: crop.angle || 0 })
        : normalizeCrop(crop);
    }
    if (isAnimatableControl(control)) markAnimationEdited();
    drawSource();
    renderOutput();
  });
});

window.addEventListener("resize", resizeOutputPreview);

setupDragNumbers();
updateSeamAlgorithmNote();
syncAnimationEditor();
drawSource();
paintOutputPreview();
