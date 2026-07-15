"use strict";

const $ = (s) => document.querySelector(s);

// ---------- 상태 ----------
const state = {
  images: [], // { id, name, img, url, title, subtitle, zoom, offsetX, offsetY }
  sel: -1,
};

const settings = {
  w: 800, h: 800, bg: "#222222",
  // 이미지 보정
  adjBright: 100, adjContrast: 100, adjSat: 100,
  // 오버레이
  overlayType: "dim", overlayColor: "#000000", overlayOpacity: 0.35,
  // 제목
  tFont: "Black Han Sans", tSize: 64, tColor: "#ffffff",
  tAutoFit: true, tWrap: true, tWrapChars: 8,
  tAlign: "center", tVpos: "middle", tOffset: 0,
  tShadow: true, tStroke: false, tStrokeColor: "#000000",
  // 글자 배경 박스
  tBoxType: "none", tBoxColor: "#000000", tBoxOpacity: 0.6,
  // 부제목
  sFont: "Noto Sans KR", sSize: 30, sColor: "#f1f1f1",
  // 뱃지
  bText: "", bBg: "#03c75a", bColor: "#ffffff", bPos: "top-left", bSize: 26,
  // 시리즈 번호
  numOn: false, numStart: 1, numPos: "bottom-right", numSize: 56,
  numBg: "#03c75a", numColor: "#ffffff",
  // 로고/워터마크
  logoPos: "top-right", logoSize: 18, logoOpacity: 1,
  // 테두리
  borderType: "none", borderColor: "#ffffff", borderWidth: 12, borderInset: 24,
  // 내보내기
  format: "jpeg", quality: 0.92, prefix: "thumb",
};

let logoImg = null; // 업로드된 로고 Image 객체

const canvas = $("#canvas");

// ---------- 유틸 ----------
function selected() {
  return state.sel >= 0 ? state.images[state.sel] : null;
}

async function ensureFonts() {
  const families = ["Black Han Sans", "Noto Sans KR", "Noto Serif KR", "Jua", "Do Hyeon", "Gugi", "Nanum Gothic", "Nanum Pen Script"];
  await Promise.all(families.map((f) => document.fonts.load(`700 40px "${f}"`, "가나다 ABC")));
  await document.fonts.ready;
}

// 자동 줄바꿈: 수동 줄바꿈(\n)은 유지하고, 긴 줄은 maxChars 단위로 나눔
function wrapLines(text) {
  const out = [];
  const maxChars = Math.max(3, settings.tWrapChars);
  for (const seg of (text || "").split("\n")) {
    const s = seg.trim();
    if (!s) continue;
    if (!settings.tWrap || s.length <= maxChars) { out.push(s); continue; }
    const words = s.split(" ");
    let cur = "";
    for (let w of words) {
      while (w.length > maxChars) {
        if (cur) { out.push(cur); cur = ""; }
        out.push(w.slice(0, maxChars));
        w = w.slice(maxChars);
      }
      if (!w) continue;
      if (!cur) cur = w;
      else if ((cur + " " + w).length <= maxChars) cur += " " + w;
      else { out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
  }
  return out;
}

// ---------- 렌더링 ----------
function render(cv, item, idx = 0) {
  const c = cv.getContext("2d");
  const W = cv.width, H = cv.height;

  // 배경
  c.fillStyle = settings.bg;
  c.fillRect(0, 0, W, H);

  // 이미지 (cover + 줌 + 팬 + 보정 필터)
  if (item && item.img) {
    const img = item.img;
    const scale = Math.max(W / img.width, H / img.height) * item.zoom;
    const dw = img.width * scale, dh = img.height * scale;
    const dx = (W - dw) / 2 + item.offsetX;
    const dy = (H - dh) / 2 + item.offsetY;
    c.save();
    if (settings.adjBright !== 100 || settings.adjContrast !== 100 || settings.adjSat !== 100) {
      c.filter = `brightness(${settings.adjBright}%) contrast(${settings.adjContrast}%) saturate(${settings.adjSat}%)`;
    }
    c.drawImage(img, dx, dy, dw, dh);
    c.restore();
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
  if (item) drawTexts(c, W, H, item);

  // 뱃지
  drawBadge(c, W, H);

  // 로고/워터마크
  drawLogo(c, W, H);

  // 시리즈 번호
  drawSeriesNumber(c, W, H, idx);

  // 테두리 (맨 위)
  drawBorder(c, W, H);
}

function drawTexts(c, W, H, item) {
  const titleLines = wrapLines(item.title);
  const sub = (item.subtitle || "").trim();
  const pad = Math.round(W * 0.06);

  // 가로폭 자동 크기: 가장 긴 줄이 캔버스 폭에 꽉 차도록
  let tSize = settings.tSize;
  if (settings.tAutoFit && titleLines.length) {
    const avail = W - pad * 2;
    c.font = `100px "${settings.tFont}"`;
    let best = Infinity;
    for (const line of titleLines) {
      const lw = c.measureText(line).width;
      if (lw > 0) best = Math.min(best, (100 * avail) / lw);
    }
    if (isFinite(best)) tSize = Math.max(20, Math.min(best, H * 0.3));
  }

  const tLH = tSize * 1.25;
  const sLH = settings.sSize * 1.3;
  const gap = titleLines.length && sub ? tSize * 0.4 : 0;
  const blockH = titleLines.length * tLH + gap + (sub ? sLH : 0);
  if (blockH <= 0) return;

  const align = settings.tAlign;
  let x;
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
  c.font = `${tSize}px "${settings.tFont}"`;

  // 글자 배경 박스 (그림자 없이 먼저 그림)
  if (settings.tBoxType !== "none" && titleLines.length) {
    const padX = tSize * 0.32, padY = tSize * 0.16;
    const rad = tSize * 0.18;
    c.save();
    c.globalAlpha = settings.tBoxOpacity;
    c.fillStyle = settings.tBoxColor;
    const boxX = (lw) => align === "left" ? x - padX : align === "right" ? x - lw - padX : x - lw / 2 - padX;
    if (settings.tBoxType === "block") {
      let maxW = 0;
      for (const line of titleLines) maxW = Math.max(maxW, c.measureText(line).width);
      const bh = (titleLines.length - 1) * tLH + tSize + padY * 2;
      c.beginPath();
      c.roundRect(boxX(maxW), yTop - padY, maxW + padX * 2, bh, rad);
      c.fill();
    } else {
      let y = yTop;
      for (const line of titleLines) {
        const lw = c.measureText(line).width;
        c.beginPath();
        c.roundRect(boxX(lw), y - padY, lw + padX * 2, tSize + padY * 2, rad);
        c.fill();
        y += tLH;
      }
    }
    c.restore();
  }

  if (settings.tShadow) {
    c.shadowColor = "rgba(0,0,0,0.55)";
    c.shadowBlur = tSize * 0.12;
    c.shadowOffsetY = tSize * 0.05;
  }

  // 제목
  let y = yTop;
  for (const line of titleLines) {
    if (settings.tStroke) {
      c.lineWidth = Math.max(2, tSize * 0.08);
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

function drawBadge(c, W, H) {
  const bText = settings.bText.trim();
  if (!bText) return;
  c.save();
  const fs = settings.bSize;
  c.font = `700 ${fs}px "Noto Sans KR"`;
  const tw = c.measureText(bText).width;
  const px = fs * 0.7, py = fs * 0.42;
  const bw = tw + px * 2, bh = fs + py * 2;
  const m = Math.round(W * 0.035);
  const bx = settings.bPos.includes("right") ? W - m - bw : m;
  const by = settings.bPos.includes("bottom") ? H - m - bh : m;
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

function drawLogo(c, W, H) {
  if (!logoImg) return;
  c.save();
  const lw = W * settings.logoSize / 100;
  const lh = lw * logoImg.height / logoImg.width;
  const m = Math.round(W * 0.035);
  const lx = settings.logoPos.includes("right") ? W - m - lw : m;
  const ly = settings.logoPos.includes("bottom") ? H - m - lh : m;
  c.globalAlpha = settings.logoOpacity;
  c.drawImage(logoImg, lx, ly, lw, lh);
  c.restore();
}

function drawSeriesNumber(c, W, H, idx) {
  if (!settings.numOn) return;
  const n = settings.numStart + idx;
  const fs = settings.numSize;
  const rad = fs * 0.8;
  const m = Math.round(Math.min(W, H) * 0.05);
  const cx = settings.numPos.includes("right") ? W - m - rad : m + rad;
  const cy = settings.numPos.includes("bottom") ? H - m - rad : m + rad;
  c.save();
  c.fillStyle = settings.numBg;
  c.beginPath();
  c.arc(cx, cy, rad, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = settings.numColor;
  c.font = `700 ${fs}px "Noto Sans KR"`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(String(n), cx, cy + fs * 0.06);
  c.restore();
}

function drawBorder(c, W, H) {
  const t = settings.borderType;
  if (t === "none") return;
  const bw = Math.max(1, settings.borderWidth);
  c.save();
  c.strokeStyle = settings.borderColor;

  if (t === "solid") {
    c.lineWidth = bw;
    c.strokeRect(bw / 2, bw / 2, W - bw, H - bw);
  } else if (t === "inset") {
    const m = settings.borderInset;
    c.lineWidth = bw;
    c.strokeRect(m, m, W - m * 2, H - m * 2);
  } else if (t === "double") {
    c.lineWidth = bw;
    c.strokeRect(bw / 2, bw / 2, W - bw, H - bw);
    const gap = bw * 2.2;
    c.lineWidth = Math.max(1, bw * 0.5);
    c.strokeRect(gap, gap, W - gap * 2, H - gap * 2);
  } else if (t === "corners") {
    const m = settings.borderInset;
    const len = Math.min(W, H) * 0.12;
    c.lineWidth = bw;
    c.lineCap = "square";
    const corner = (x, y, dx, dy) => {
      c.beginPath();
      c.moveTo(x + dx * len, y);
      c.lineTo(x, y);
      c.lineTo(x, y + dy * len);
      c.stroke();
    };
    corner(m, m, 1, 1);
    corner(W - m, m, -1, 1);
    corner(m, H - m, 1, -1);
    corner(W - m, H - m, -1, -1);
  } else if (t === "dashed") {
    const m = settings.borderInset;
    c.lineWidth = bw;
    c.setLineDash([bw * 2.5, bw * 1.8]);
    c.strokeRect(m, m, W - m * 2, H - m * 2);
  }
  c.restore();
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
  $("#copyClip").disabled = !item;
  $("#exportAll").disabled = state.images.length === 0;
  $("#clearAll").hidden = state.images.length === 0;
  if (item) render(canvas, item, state.sel);
  persist();
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

async function renderBlob(item, idx, forceMime) {
  const cv = document.createElement("canvas");
  cv.width = settings.w;
  cv.height = settings.h;
  render(cv, item, idx);
  return new Promise((res) => cv.toBlob(res, forceMime || mimeOf(settings.format), settings.quality));
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
  const blob = await renderBlob(it, state.sel);
  download(blob, fileNameFor(it, state.sel));
};

// 클립보드 복사 (블로그 에디터에 Ctrl+V로 바로 붙여넣기) — 클립보드는 PNG만 지원
$("#copyClip").onclick = async () => {
  const it = selected();
  if (!it) return;
  const btn = $("#copyClip");
  const orig = "📋 클립보드 복사";
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error("unsupported");
    await ensureFonts();
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": renderBlob(it, state.sel, "image/png") }),
    ]);
    btn.textContent = "✅ 복사됨! 블로그에 Ctrl+V";
  } catch (e) {
    btn.textContent = "❌ 복사 실패";
    alert("클립보드 복사에 실패했습니다.\n브라우저가 이미지 복사를 지원하지 않으면 '선택 이미지 저장'으로 파일을 받아서 올려주세요.");
  }
  setTimeout(() => { btn.textContent = orig; }, 2500);
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
      const blob = await renderBlob(state.images[i], i);
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

// ---------- 리본탭 전환 ----------
document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tab-page").forEach((p) => p.classList.toggle("active", p.id === "tab-" + btn.dataset.tab));
  };
});

// ---------- 설정 컨트롤 바인딩 ----------
function bind(id, key, { number = false, float = false, check = false } = {}) {
  const el = $(id);
  const ev = el.type === "color" || el.type === "range" ? "input" : "change";
  el.addEventListener(ev, () => {
    settings[key] = check ? el.checked : float ? parseFloat(el.value) : number ? parseInt(el.value, 10) || 0 : el.value;
    renderPreview();
  });
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
bind("#adjBright", "adjBright", { number: true });
bind("#adjContrast", "adjContrast", { number: true });
bind("#adjSat", "adjSat", { number: true });
bind("#overlayType", "overlayType");
bind("#overlayColor", "overlayColor");
bind("#overlayOpacity", "overlayOpacity", { float: true });
bind("#tFont", "tFont");
bind("#tSize", "tSize", { number: true });
bind("#tAutoFit", "tAutoFit", { check: true });
bind("#tWrap", "tWrap", { check: true });
bind("#tWrapChars", "tWrapChars", { number: true });
bind("#tColor", "tColor");
bind("#tAlign", "tAlign");
bind("#tVpos", "tVpos");
bind("#tOffset", "tOffset", { number: true });
bind("#tShadow", "tShadow", { check: true });
bind("#tStroke", "tStroke", { check: true });
bind("#tStrokeColor", "tStrokeColor");
bind("#tBoxType", "tBoxType");
bind("#tBoxColor", "tBoxColor");
bind("#tBoxOpacity", "tBoxOpacity", { float: true });
bind("#sFont", "sFont");
bind("#sSize", "sSize", { number: true });
bind("#sColor", "sColor");
bind("#bText", "bText");
bind("#bBg", "bBg");
bind("#bColor", "bColor");
bind("#bPos", "bPos");
bind("#bSize", "bSize", { number: true });
bind("#numOn", "numOn", { check: true });
bind("#numStart", "numStart", { number: true });
bind("#numSize", "numSize", { number: true });
bind("#numPos", "numPos");
bind("#numBg", "numBg");
bind("#numColor", "numColor");
bind("#logoPos", "logoPos");
bind("#logoSize", "logoSize", { number: true });
bind("#logoOpacity", "logoOpacity", { float: true });
bind("#borderType", "borderType");
bind("#borderColor", "borderColor");
bind("#borderWidth", "borderWidth", { number: true });
bind("#borderInset", "borderInset", { number: true });
bind("#format", "format");
bind("#quality", "quality", { float: true });
bind("#prefix", "prefix");

$("#adjReset").onclick = () => {
  settings.adjBright = 100;
  settings.adjContrast = 100;
  settings.adjSat = 100;
  syncControls();
  renderPreview();
};

// ---------- 로고/워터마크 ----------
const LS_LOGO = "ts_logo_v1";

function setLogo(dataUrl) {
  if (!dataUrl) {
    logoImg = null;
    try { localStorage.removeItem(LS_LOGO); } catch (e) {}
    renderPreview();
    return;
  }
  const img = new Image();
  img.onload = () => {
    logoImg = img;
    try { localStorage.setItem(LS_LOGO, dataUrl); } catch (e) {} // 용량 초과 시 저장만 생략
    renderPreview();
  };
  img.src = dataUrl;
}

$("#logoFile").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => setLogo(r.result);
  r.readAsDataURL(f);
  e.target.value = "";
};
$("#logoRemove").onclick = () => setLogo(null);

// ---------- 기본 스타일 프리셋 ----------
const BUILTIN_PRESETS = [
  {
    name: "임팩트 블랙", emoji: "⬛",
    s: { overlayType: "dim", overlayColor: "#000000", overlayOpacity: 0.45, tFont: "Black Han Sans", tColor: "#ffffff", tShadow: true, tStroke: false, tBoxType: "none", borderType: "none", sColor: "#e8e8e8" },
  },
  {
    name: "화이트 박스", emoji: "⬜",
    s: { overlayType: "none", overlayOpacity: 0.35, tFont: "Noto Sans KR", tColor: "#111111", tShadow: false, tStroke: false, tBoxType: "line", tBoxColor: "#ffffff", tBoxOpacity: 0.92, borderType: "none", sColor: "#f1f1f1" },
  },
  {
    name: "모서리 프레임", emoji: "🔲",
    s: { overlayType: "dim", overlayColor: "#000000", overlayOpacity: 0.35, tFont: "Black Han Sans", tColor: "#ffffff", tShadow: true, tStroke: false, tBoxType: "none", borderType: "corners", borderColor: "#ffffff", borderWidth: 10, borderInset: 36 },
  },
  {
    name: "클래식 명조", emoji: "📜",
    s: { overlayType: "gradBottom", overlayColor: "#000000", overlayOpacity: 0.75, tFont: "Noto Serif KR", tColor: "#ffffff", tVpos: "bottom", tShadow: false, tStroke: false, tBoxType: "none", borderType: "inset", borderColor: "#ffffff", borderWidth: 3, borderInset: 20 },
  },
  {
    name: "팝 옐로우", emoji: "🍋",
    s: { overlayType: "none", overlayOpacity: 0.35, tFont: "Jua", tColor: "#111111", tShadow: false, tStroke: false, tBoxType: "line", tBoxColor: "#ffe14d", tBoxOpacity: 1, borderType: "none" },
  },
  {
    name: "감성 그린", emoji: "🌿",
    s: { overlayType: "dim", overlayColor: "#0c2e1e", overlayOpacity: 0.55, tFont: "Do Hyeon", tColor: "#ffffff", tShadow: true, tStroke: false, tBoxType: "none", borderType: "dashed", borderColor: "#ffffff", borderWidth: 4, borderInset: 28 },
  },
];

function renderPresetGrid() {
  const grid = $("#presetGrid");
  grid.innerHTML = "";
  for (const p of BUILTIN_PRESETS) {
    const b = document.createElement("button");
    b.className = "preset-card";
    b.innerHTML = `<span class="pico">${p.emoji}</span><span>${p.name}</span>`;
    b.onclick = () => {
      Object.assign(settings, p.s);
      syncControls();
      renderPreview();
    };
    grid.appendChild(b);
  }
}

// ---------- 설정 저장/복원 (localStorage) ----------
const LS_SESSION = "ts_session_v1";
const LS_TEMPLATES = "ts_templates_v1";

// settings 값을 화면 컨트롤에 반영
function syncControls() {
  for (const [key, val] of Object.entries(settings)) {
    const el = $(`#${key}`);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = !!val;
    else el.value = val;
  }
  const presetEl = $("#preset");
  const match = [...presetEl.options].find((o) => o.value === `${settings.w}x${settings.h}`);
  presetEl.value = match ? match.value : "custom";
  $("#customSize").hidden = presetEl.value !== "custom";
  $("#w").value = settings.w;
  $("#h").value = settings.h;
}

let persistTimer = null;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try { localStorage.setItem(LS_SESSION, JSON.stringify(settings)); } catch (e) {}
  }, 300);
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(LS_SESSION);
    if (raw) Object.assign(settings, JSON.parse(raw));
    const logo = localStorage.getItem(LS_LOGO);
    if (logo) {
      const img = new Image();
      img.onload = () => { logoImg = img; renderPreview(); };
      img.src = logo;
    }
    syncControls();
  } catch (e) {}
}

// ---------- 내 템플릿 ----------
function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(LS_TEMPLATES)) || {}; }
  catch (e) { return {}; }
}
function saveTemplates(obj) {
  localStorage.setItem(LS_TEMPLATES, JSON.stringify(obj));
}
function refreshTemplateList() {
  const sel = $("#tplList");
  const names = Object.keys(loadTemplates());
  sel.innerHTML = '<option value="">— 선택 —</option>' +
    names.map((n) => `<option value="${n.replace(/"/g, "&quot;")}">${n}</option>`).join("");
}

$("#tplSave").onclick = () => {
  const name = $("#tplName").value.trim();
  if (!name) { $("#tplName").focus(); return; }
  const tpls = loadTemplates();
  tpls[name] = { ...settings };
  saveTemplates(tpls);
  refreshTemplateList();
  $("#tplList").value = name;
  $("#tplName").value = "";
};

$("#tplApply").onclick = () => {
  const name = $("#tplList").value;
  if (!name) return;
  const tpl = loadTemplates()[name];
  if (!tpl) return;
  Object.assign(settings, tpl);
  syncControls();
  renderPreview();
};

$("#tplDelete").onclick = () => {
  const name = $("#tplList").value;
  if (!name) return;
  const tpls = loadTemplates();
  delete tpls[name];
  saveTemplates(tpls);
  refreshTemplateList();
};

// ---------- 초기화 ----------
restoreSession();
refreshTemplateList();
renderPresetGrid();
ensureFonts().then(renderPreview);
renderPreview();
