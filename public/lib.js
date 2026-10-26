// Shared helpers used by every simulation.

export const C = {
  bg: '#1a0610',
  bg2: '#2b0a17',
  wine: '#4a0f24',
  wineLight: '#6b1a33',
  gold: '#d4af37',
  goldLight: '#f2d27a',
  white: '#ffffff',
  cream: '#f6ead7',
  muted: '#c8a3ad',
  line: 'rgba(212, 175, 55, 0.25)',
};

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// Format a number with up to `d` decimals, dropping trailing zeros and using a real minus sign.
export function num(n, d = 2) {
  const s = (+n.toFixed(d)).toString();
  return s.startsWith('-') ? '−' + s.slice(1) : s;
}

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c != null) node.append(c);
  return node;
}

export function button(label, onclick, cls = 'btn') {
  return el('button', { type: 'button', class: cls, onclick }, label);
}

export function slider({ label, bn, min, max, step = 1, value, unit = '', format = (v) => v, onInput }) {
  const out = el('output', { class: 'slider-value' });
  const input = el('input', { type: 'range', min, max, step, value, 'aria-label': label });
  const show = () => { out.textContent = format(+input.value) + (unit ? ' ' + unit : ''); };
  input.addEventListener('input', () => { show(); onInput(+input.value); });
  show();
  return {
    el: el('label', { class: 'slider' }, [
      el('div', { class: 'slider-head' }, [el('span', {}, [label, bn ? el('small', {}, ' · ' + bn) : null]), out]),
      input,
    ]),
    get value() { return +input.value; },
    set(v) { input.value = v; show(); },
  };
}

export function segmented({ label, bn, options, value, onChange }) {
  const buttons = options.map((o) => el('button', { type: 'button' }, o.label));
  const set = (v) => buttons.forEach((b, i) => b.classList.toggle('active', options[i].value === v));
  buttons.forEach((b, i) => b.addEventListener('click', () => { set(options[i].value); onChange(options[i].value); }));
  set(value);
  return {
    el: el('div', {}, [
      label ? el('div', { class: 'seg-label' }, [label, bn ? el('small', {}, ' · ' + bn) : null]) : null,
      el('div', { class: 'seg' }, buttons),
    ]),
    set,
  };
}

export function readouts(container, items) {
  const cells = {};
  for (const { key, label } of items) {
    cells[key] = el('b', {}, '—');
    container.append(el('div', { class: 'readout' }, [el('span', {}, label), cells[key]]));
  }
  return { set: (key, value) => { cells[key].textContent = value; } };
}

// Creates a canvas that fills `container`, keeps it sharp on retina screens, and calls
// draw(ctx, width, height, dt, time) every animation frame.
export function makeCanvas(container, draw) {
  const canvas = el('canvas');
  container.append(canvas);
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    w = container.clientWidth;
    h = container.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  let running = true;
  let last = performance.now();
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h, dt, now / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    canvas,
    destroy() { running = false; observer.disconnect(); },
  };
}

// Pointer events in canvas (CSS pixel) coordinates. Return false from `down` to ignore a press.
export function onPointer(canvas, { down, move, up }) {
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (down && down(pos(e), e) !== false) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => move && move(pos(e), e));
  const end = (e) => up && up(pos(e), e);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

export function text(ctx, str, x, y, { size = 14, color = C.cream, align = 'left', baseline = 'alphabetic', weight = 500, family = 'Poppins, "Hind Siliguri", sans-serif' } = {}) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
}

export function arrow(ctx, x1, y1, x2, y2, { color = C.gold, width = 2, head = 9 } = {}) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(a) * head * 0.8, y2 - Math.sin(a) * head * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45));
  ctx.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
