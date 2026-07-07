"use strict";

const $ = (s) => document.querySelector(s);

// ---------- 상태 ----------
const state = {
  images: [], // { id, name, img, url, title, subtitle, zoom, offsetX, offsetY }
  sel: -1,
};

const settings = {
  w: 800, h: 800, bg: "#222222",
  overlayType: "dim", overlayColor: "#000000", overlayOpacity: 0.35,
  tFont: "Black Han Sans", tSize: 64, tColor: "#ffffff",
  tAlign: "center", tVpos: "middle", tOffset: 0,
  tShadow: true, tStroke: false, tStrokeColor: "#000000",
  sFont: "Noto Sans KR", sSize: 30, sColor: "#f1f1f1",
  bText: "", bBg: "#03c75a", bColor: "#ffffff", bPos: "top-left", bSize: 26,
  format: "jpeg", quality: 0.92, prefix: "thumb",
};

const canvas = $("#canvas");
const ctx = canvas.getContext("2d");

// ---------- 유틸 ----------
function selected() {
  return state.sel >= 0 ? state.images[state.sel] : null;
}

async function ensureFonts() {
  const families = ["Black Han Sans", "Noto Sans KR", "Noto Serif KR", "Jua", "Do Hyeon", "Gugi", "Nanum Gothic", "Nanum Pen Script"];
  await Promise.all(families.map((f) => document.fonts.load(`700 40px "${f}"`, "가나다 ABC")));
  await document.fonts.ready;
}

// ---------- 렌더링 ----------
function render(cv, item) {
  const c = cv.getContext("2d");
  const W = cv.width, H = cv.height;

  // 배경
  c.fillStyle = settings.bg;
  c.fillRect(0, 0, W, H);

  // 이미지 (cover + 줌 + 팬)
  if (item && item.img) {
    const img = item.img;
    const scale = Math.max(W / img.width, H / img.height) * item.zoom;
    const dw = img.width * scale, dh = img.height * scale;
    const dx = (W - dw) / 2 + item.offsetX;
    const dy = (H - dh) / 2 + item.offsetY;
    c.drawImage(img, dx, dy, dw, dh);
  }

  // 오버레이
  const { overlayType, overlayColor, overlayOpacity } = settings;
  if (overlayType !== "none" && overlayOpacity > 0) {
    c.save();
    c.globalAlpha = overlayOpacity;
    if (overlayType === "dim") {
      c.fillStyle = overlayColor;
    } else {
      const g = overlayType === "gradBottom"
        ? c.createLinearGradient(0, H * 0.35, 0, H)
        : c.createLinearGradient(0, H * 0.65, 0, 0);
      g.addColorStop(0, "transparent");
      g.addColorStop(1, overlayColor);
      c.fillStyle = g;
    }
    c.fillRect(0, 0, W, H);
    c.restore();
  }

  // 제목 + 부제목
  if (item) {
    const titleLines = (item.title || "").split("\n").filter((l) => l.trim() !== "");
    const sub = (item.subtitle || "").trim();
    const tLH = settings.tSize * 1.25;
    const sLH = settings.sSize * 1.3;
    const gap = titleLines.length && sub ? settings.tSize * 0.4 : 0;
    const blockH = titleLines.length * tLH + gap + (sub ? sLH : 0);

    if (blockH > 0) {
      const pad = Math.round(W * 0.06);
      let x, align = settings.tAlign;
      if (align === "left") x = pad;
      else if (align === "right") x = W - pad;
      else x = W / 2;

      let yTop;
      if (settings.tVpos === "top") yTop = pad + tLH * 0.2;
      else if (settings.tVpos === "bottom") yTop = H - pad - blockH;
      else yTop = (H - blockH) / 2;
      yTop += settings.tOffset;

      c.save();
      c.textAlign = align;
      c.textBaseline = "top";

      if (settings.tShadow) {
        c.shadowColor = "rgba(0,0,0,0.55)";
        c.shadowBlur = settings.tSize * 0.12;
        c.shadowOffsetY = settings.tSize * 0.05;
      }

      // 제목
      c.font = `${settings.tSize}px "${settings.tFont}"`;
      let y = yTop;
      for (const line of titleLines) {
        if (settings.tStroke) {
          c.lineWidth = Math.max(2, settings.tSize * 0.08);
          c.lineJoin = "round";
          c.strokeStyle = settings.tStrokeColor;
          c.strokeText(line, x, y);
        }
        c.fillStyle = settings.tColor;
        c.fillText(line, x, y);
        y += tLH;
      }

      // 부제목
      if (sub) {
        y += gap;
        c.font = `${settings.sSize}px "${settings.sFont}"`;
        c.fillStyle = settings.sColor;
        c.fillText(sub, x, y);
      }
      c.restore();
    }
  }

  // 뱃지
  const bText = settings.bText.trim();
  if (bText) {
    c.save();
    const fs = settings.bSize;
    c.font = `700 ${fs}px "Noto Sans KR"`;
    const tw = c.measureText(bText).width;
    const px = fs * 0.7, py = fs * 0.42;
    const bw = tw + px * 2, bh = fs + py * 2;
    const m = Math.round(W * 0.035);
    let bx = settings.bPos.includes("right") ? W - m - bw : m;
    let by = settings.bPos.includes("bottom") ? H - m - bh : m;

    c.fillStyle = settings.bBg;
    c.beginPath();
    c.roundRect(bx, by, bw, bh, bh / 4);
    c.fill();
    c.fillStyle = settings.bColor;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(bText, bx + bw / 2, by + bh / 2 + fs * 0.05);
    c.restore();
  }
}

function renderPreview() {
  const item = selected();
  canvas.width = settings.w;
  canvas.height = settings.h;
  canvas.classList.toggle("on", !!item);
  $("#emptyMsg").hidden = !!item;
  $("#textInputs").hidden = !item;
  $("#canvasTools").hidden = !item;
  $("#exportOne").disabled = !item;
  $("#exportAll").disabled = state.images.length === 0;
  $("#clearAll").hidden = state.images.length === 0;
  if (item) render(canvas, item);
}

// ---------- 이미지 목록 ----------
function renderList() {
  const ul = $("#list");
  ul.innerHTML = "";
  state.images.forEach((it, i) => {
    const li = document.createElement("li");
    li.className = i === state.sel ? "sel" : "";
    const im = document.createElement("img");
    im.src = it.url;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = it.title.replace(/\n/g, " ") || it.name;
    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "✕";
    del.title = "삭제";
    del.onclick = (e) => { e.stopPropagation(); removeImage(i); };
    li.append(im, name, del);
    li.onclick = () => selectImage(i);
    ul.appendChild(li);
  });
}

function selectImage(i) {
  state.sel = i;
  const it = selected();
  $("#title").value = it ? it.title : "";
  $("#subtitle").value = it ? it.subtitle : "";
  $("#zoom").value = it ? it.zoom : 1;
  renderList();
  renderPreview();
}

function removeImage(i) {
  URL.revokeObjectURL(state.images[i].url);
  state.images.splice(i, 1);
  if (state.sel >= state.images.length) state.sel = state.images.length - 1;
  selectImage(state.sel);
}

let nextId = 1;
async function addFiles(files) {
  const imgFiles = [...files].filter((f) => f.type.startsWith("image/"));
  for (const f of imgFiles) {
    const url = URL.createObjectURL(f);
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; })
      .catch(() => URL.revokeObjectURL(url));
    if (!img.width) continue;
    state.images.push({
      id: nextId++,
      name: f.name.replace(/\.[^.]+$/, ""),
      img, url,
      title: "", subtitle: "",
      zoom: 1, offsetX: 0, offsetY: 0,
    });
  }
  if (state.sel < 0 && state.images.length) selectImage(0);
  else { renderList(); renderPreview(); }
}

// ---------- 내보내기 ----------
function mimeOf(fmt) {
  return fmt === "png" ? "image/png" : fmt === "webp" ? "image/webp" : "image/jpeg";
}
function extOf(fmt) {
  return fmt === "jpeg" ? "jpg" : fmt;
}
function sanitize(s) {
  return s.replace(/[\\/:*?"<>|\n]+/g, " ").trim().slice(0, 60);
}

async function renderBlob(item) {
  const cv = document.createElement("canvas");
  cv.width = settings.w;
  cv.height = settings.h;
  render(cv, item);
  return new Promise((res) => cv.toBlob(res, mimeOf(settings.format), settings.quality));
}

function download(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function fileNameFor(item, i) {
  const base = sanitize(item.title) || item.name || `image-${i + 1}`;
  const prefix = settings.prefix.trim();
  return `${prefix ? prefix + "_" : ""}${String(i + 1).padStart(2, "0")}_${base}.${extOf(settings.format)}`;
}

$("#exportOne").onclick = async () => {
  const it = selected();
  if (!it) return;
  await ensureFonts();
  const blob = await renderBlob(it);
  download(blob, fileNameFor(it, state.sel));
};

$("#exportAll").onclick = async () => {
  if (!state.images.length) return;
  const btn = $("#exportAll");
  btn.disabled = true;
  const orig = btn.textContent;
  try {
    await ensureFonts();
    const zip = new JSZip();
    for (let i = 0; i < state.images.length; i++) {
      btn.textContent = `생성 중... (${i + 1}/${state.images.length})`;
      const blob = await renderBlob(state.images[i]);
      zip.file(fileNameFor(state.images[i], i), blob);
    }
    btn.textContent = "압축 중...";
    const blob = await zip.generateAsync({ type: "blob" });
    download(blob, "thumbnails.zip");
  } finally {
    btn.textContent = orig;
    btn.disabled = false;
  }
};

// ---------- 업로드 이벤트 ----------
const dz = $("#dropzone");
dz.onclick = () => $("#file").click();
$("#file").onchange = (e) => { addFiles(e.target.files); e.target.value = ""; };
dz.ondragover = (e) => { e.preventDefault(); dz.classList.add("drag"); };
dz.ondragleave = () => dz.classList.remove("drag");
dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove("drag"); addFiles(e.dataTransfer.files); };
// 페이지 전체 드롭도 허용
document.body.addEventListener("dragover", (e) => e.preventDefault());
document.body.addEventListener("drop", (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });

$("#clearAll").onclick = () => {
  state.images.forEach((it) => URL.revokeObjectURL(it.url));
  state.images = [];
  state.sel = -1;
  selectImage(-1);
};

// ---------- 텍스트 입력 ----------
$("#title").oninput = (e) => {
  const it = selected();
  if (!it) return;
  it.title = e.target.value;
  renderList();
  renderPreview();
};
$("#subtitle").oninput = (e) => {
  const it = selected();
  if (!it) return;
  it.subtitle = e.target.value;
  renderPreview();
};

// ---------- 캔버스 팬/줌 ----------
$("#zoom").oninput = (e) => {
  const it = selected();
  if (!it) return;
  it.zoom = parseFloat(e.target.value);
  renderPreview();
};
$("#resetPos").onclick = () => {
  const it = selected();
  if (!it) return;
  it.zoom = 1; it.offsetX = 0; it.offsetY = 0;
  $("#zoom").value = 1;
  renderPreview();
};

let dragging = null;
canvas.addEventListener("pointerdown", (e) => {
  const it = selected();
  if (!it) return;
  dragging = { x: e.clientX, y: e.clientY, ox: it.offsetX, oy: it.offsetY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  const it = selected();
  if (!dragging || !it) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = canvas.width / rect.width;
  it.offsetX = dragging.ox + (e.clientX - dragging.x) * ratio;
  it.offsetY = dragging.oy + (e.clientY - dragging.y) * ratio;
  renderPreview();
});
canvas.addEventListener("pointerup", () => { dragging = null; });

// ---------- 설정 컨트롤 바인딩 ----------
function bind(id, key, { number = false, float = false, check = false } = {}) {
  const el = $(id);
  const ev = el.type === "color" || el.type === "range" ? "input" : "change";
  el.addEventListener(ev, () => {
    settings[key] = check ? el.checked : float ? parseFloat(el.value) : number ? parseInt(el.value, 10) || 0 : el.value;
    renderPreview();
  });
  // 텍스트/숫자류는 input에도 반응
  if (["text", "number"].includes(el.type) || el.tagName === "TEXTAREA") {
    el.addEventListener("input", () => {
      settings[key] = number ? parseInt(el.value, 10) || 0 : el.value;
      renderPreview();
    });
  }
}

$("#preset").onchange = (e) => {
  const v = e.target.value;
  $("#customSize").hidden = v !== "custom";
  if (v !== "custom") {
    const [w, h] = v.split("x").map(Number);
    settings.w = w; settings.h = h;
    $("#w").value = w; $("#h").value = h;
    renderPreview();
  }
};
$("#w").oninput = (e) => { settings.w = Math.max(50, parseInt(e.target.value, 10) || 800); renderPreview(); };
$("#h").oninput = (e) => { settings.h = Math.max(50, parseInt(e.target.value, 10) || 800); renderPreview(); };

bind("#bg", "bg");
bind("#overlayType", "overlayType");
bind("#overlayColor", "overlayColor");
bind("#overlayOpacity", "overlayOpacity", { float: true });
bind("#tFont", "tFont");
bind("#tSize", "tSize", { number: true });
bind("#tColor", "tColor");
bind("#tAlign", "tAlign");
bind("#tVpos", "tVpos");
bind("#tOffset", "tOffset", { number: true });
bind("#tShadow", "tShadow", { check: true });
bind("#tStroke", "tStroke", { check: true });
bind("#tStrokeColor", "tStrokeColor");
bind("#sFont", "sFont");
bind("#sSize", "sSize", { number: true });
bind("#sColor", "sColor");
bind("#bText", "bText");
bind("#bBg", "bBg");
bind("#bColor", "bColor");
bind("#bPos", "bPos");
bind("#bSize", "bSize", { number: true });
bind("#format", "format");
bind("#quality", "quality", { float: true });
bind("#prefix", "prefix");

// 폰트 로드 후 다시 그려서 미리보기에 반영
ensureFonts().then(renderPreview);
renderPreview();
