import { C, slider, segmented, readouts, makeCanvas, onPointer, text, clamp, num } from '../lib.js';

const MAX = 12;

export default {
  id: 'pythagoras',
  subject: 'math',
  icon: '📐',
  title: "Pythagoras' Theorem",
  bn: 'পিথাগোরাসের উপপাদ্য',
  summary: 'Drag the corners of a right triangle and watch the squares add up.',
  concept: `
    <p>In a <b>right-angled triangle</b>, the longest side, opposite the right angle, is called the <b>hypotenuse</b> <span class="bn">(অতিভুজ)</span>.</p>
    <div class="formula">a² + b² = c²</div>
    <p>If you draw a square on each side, the two smaller squares together have <b>exactly the same area</b> as the big square on the hypotenuse. Count the little unit squares to check!</p>
    <p>Whole-number answers like <b>3, 4, 5</b> are called <b>Pythagorean triples</b>. Builders use 3-4-5 to make perfect right angles.</p>`,
  tasks: [
    { id: '345', text: 'Build the famous 3-4-5 triangle.', test: (s) => (s.a === 3 && s.b === 4) || (s.a === 4 && s.b === 3) },
    { id: 'triple', text: 'Find a different triangle where c is also a whole number.', test: (s) => Number.isInteger(s.c) && !((s.a === 3 && s.b === 4) || (s.a === 4 && s.b === 3)) },
    { id: 'c50', text: 'Make a triangle where c² = 50.', test: (s) => s.a * s.a + s.b * s.b === 50 },
  ],
  quiz: [
    { q: 'What is the longest side of a right-angled triangle called?', options: ['Base', 'Height', 'Hypotenuse', 'Median'], answer: 2, explain: 'The hypotenuse is always opposite the right angle.' },
    { q: 'If a = 6 and b = 8, what is c?', options: ['10', '14', '12', '48'], answer: 0, explain: '36 + 64 = 100, and √100 = 10.' },
    { q: 'Which statement is Pythagoras\' theorem?', options: ['a + b = c', 'a² + b² = c²', 'a² − b² = c', 'a × b = c²'], answer: 1, explain: 'The squares on the two shorter sides add up to the square on the hypotenuse.' },
  ],

  mount({ stage, controls, readouts: box }, report) {
    const s = { a: 2, b: 5, c: 0, grid: true };
    const out = readouts(box, [
      { key: 'a', label: 'a²' },
      { key: 'b', label: 'b²' },
      { key: 'sum', label: 'a² + b² = c²' },
      { key: 'c', label: 'Hypotenuse c' },
    ]);
    const update = () => {
      s.c = Math.sqrt(s.a * s.a + s.b * s.b);
      out.set('a', `${s.a}² = ${s.a * s.a}`);
      out.set('b', `${s.b}² = ${s.b * s.b}`);
      out.set('sum', `${s.a * s.a} + ${s.b * s.b} = ${s.a * s.a + s.b * s.b}`);
      out.set('c', Number.isInteger(s.c) ? `${s.c} (whole number!)` : `√${s.a * s.a + s.b * s.b} ≈ ${num(s.c)}`);
      report(s);
    };
    const sa = slider({ label: 'Side a (base)', bn: 'ভূমি', min: 1, max: MAX, value: s.a, onInput: (v) => { s.a = v; update(); } });
    const sb = slider({ label: 'Side b (height)', bn: 'লম্ব', min: 1, max: MAX, value: s.b, onInput: (v) => { s.b = v; update(); } });
    controls.append(
      sa.el,
      sb.el,
      segmented({ label: 'Unit squares', bn: 'একক বর্গ', value: true, options: [{ value: true, label: 'Show' }, { value: false, label: 'Hide' }], onChange: (v) => { s.grid = v; } }).el,
      Object.assign(document.createElement('p'), { className: 'hint', textContent: 'Tip: you can also drag the gold corner dots.' }),
    );
    update();

    // Maths coordinates: right angle at the origin, a along +x, b along +y.
    let tf = null; // current maths→screen transform
    let frozen = null; // transform held still while dragging
    let drag = null;

    const toScreen = (t, x, y) => [t.ox + (x - t.minX) * t.sc, t.oy + (t.maxY - y) * t.sc];

    const view = makeCanvas(stage, (ctx, w, h) => {
      const { a, b, c } = s;
      const A = [a, 0];
      const B = [0, b];
      const n = [b, a]; // outward normal of the hypotenuse, length c
      const sqA = [[0, 0], [a, 0], [a, -a], [0, -a]];
      const sqB = [[0, 0], [0, b], [-b, b], [-b, 0]];
      const sqC = [A, B, [B[0] + n[0], B[1] + n[1]], [A[0] + n[0], A[1] + n[1]]];

      if (!frozen) {
        const pts = [...sqA, ...sqB, ...sqC];
        const minX = Math.min(...pts.map((p) => p[0]));
        const maxX = Math.max(...pts.map((p) => p[0]));
        const minY = Math.min(...pts.map((p) => p[1]));
        const maxY = Math.max(...pts.map((p) => p[1]));
        const pad = 36;
        const sc = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
        tf = { sc, minX, maxY, ox: (w - (maxX - minX) * sc) / 2, oy: (h - (maxY - minY) * sc) / 2 };
      } else {
        tf = frozen;
      }
      const P = (x, y) => toScreen(tf, x, y);

      const poly = (pts, fill, stroke) => {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(...P(x, y)) : ctx.moveTo(...P(x, y))));
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      };

      // Unit-square grid inside a square given its corner, and its two edge directions (unit vectors).
      const grid = (origin, u, v, size, color) => {
        if (!s.grid) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        for (let k = 1; k < size; k++) {
          for (const [d1, d2] of [[u, v], [v, u]]) {
            const p1 = [origin[0] + d1[0] * k, origin[1] + d1[1] * k];
            const p2 = [p1[0] + d2[0] * size, p1[1] + d2[1] * size];
            ctx.beginPath();
            ctx.moveTo(...P(...p1));
            ctx.lineTo(...P(...p2));
            ctx.stroke();
          }
        }
      };

      poly(sqA, 'rgba(212,175,55,0.28)', C.gold);
      grid([0, 0], [1, 0], [0, -1], a, 'rgba(212,175,55,0.35)');
      poly(sqB, 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.8)');
      grid([0, 0], [0, 1], [-1, 0], b, 'rgba(255,255,255,0.25)');
      poly(sqC, 'rgba(242,210,122,0.16)', C.goldLight);
      const u = [(B[0] - A[0]) / c, (B[1] - A[1]) / c];
      const v = [n[0] / c, n[1] / c];
      if (s.grid) {
        // Clip the hypotenuse grid to its square: c is often not a whole number.
        ctx.save();
        ctx.beginPath();
        sqC.forEach(([x, y], i) => (i ? ctx.lineTo(...P(x, y)) : ctx.moveTo(...P(x, y))));
        ctx.clip();
        grid(A, u, v, Math.ceil(c), 'rgba(242,210,122,0.3)');
        ctx.restore();
      }

      poly([[0, 0], A, B], C.wineLight, C.white);
      const m = Math.min(a, b) * 0.18;
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(...P(m, 0));
      ctx.lineTo(...P(m, m));
      ctx.lineTo(...P(0, m));
      ctx.stroke();

      const label = (x, y, str, color, size = 16) => text(ctx, str, ...P(x, y), { align: 'center', baseline: 'middle', color, size, weight: 600 });
      const fit = (side) => clamp(side * tf.sc * 0.22, 10, 22);
      label(a / 2, -a / 2, `a² = ${a * a}`, C.goldLight, fit(a));
      label(-b / 2, b / 2, `b² = ${b * b}`, C.white, fit(b));
      label(A[0] / 2 + B[0] / 2 + n[0] / 2, A[1] / 2 + B[1] / 2 + n[1] / 2, `c² = ${a * a + b * b}`, C.goldLight, fit(c));
      label(a / 2, 0.45, 'a', C.white, 14);
      label(-0.45, b / 2, 'b', C.white, 14);
      label(a / 2 - 0.35, b / 2 - 0.35, 'c', C.white, 14);

      for (const [x, y] of [A, B]) {
        const [px, py] = P(x, y);
        ctx.fillStyle = C.gold;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });

    const canvas = view.canvas;
    canvas.style.touchAction = 'none';
    const near = (p, x, y) => {
      const [px, py] = toScreen(tf, x, y);
      return Math.hypot(p.x - px, p.y - py) < 22;
    };
    onPointer(canvas, {
      down: (p) => {
        if (!tf) return false;
        drag = near(p, s.a, 0) ? 'a' : near(p, 0, s.b) ? 'b' : null;
        if (!drag) return false;
        frozen = tf;
      },
      move: (p) => {
        if (!drag) {
          canvas.style.cursor = tf && (near(p, s.a, 0) || near(p, 0, s.b)) ? 'grab' : 'default';
          return;
        }
        if (drag === 'a') {
          s.a = clamp(Math.round((p.x - frozen.ox) / frozen.sc + frozen.minX), 1, MAX);
          sa.set(s.a);
        } else {
          s.b = clamp(Math.round(frozen.maxY - (p.y - frozen.oy) / frozen.sc), 1, MAX);
          sb.set(s.b);
        }
        update();
      },
      up: () => { drag = null; frozen = null; },
    });

    return () => view.destroy();
  },
};
