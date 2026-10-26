import { C, slider, readouts, makeCanvas, arrow, text, roundRect, clamp, lerp } from '../lib.js';

export default {
  id: 'pressure',
  subject: 'physics',
  icon: '🧱',
  title: 'Force & Pressure',
  bn: 'বল ও চাপ',
  summary: 'Push a block into sand and discover how area changes pressure.',
  concept: `
    <p><b>Pressure</b> is how much force pushes on each square metre of a surface. <span class="bn">একক ক্ষেত্রফলে লম্বভাবে প্রযুক্ত বলই চাপ।</span></p>
    <div class="formula">P = F ÷ A</div>
    <ul>
      <li><b>P</b> = pressure, in pascals (Pa). 1 Pa = 1 N/m²</li>
      <li><b>F</b> = force, in newtons (N)</li>
      <li><b>A</b> = area, in square metres (m²)</li>
    </ul>
    <p>The same force on a <b>smaller area</b> makes <b>more pressure</b>. That's why a knife edge cuts, a nail tip goes into wood, and a camel's wide feet don't sink into desert sand.</p>`,
  tasks: [
    { id: 'p2000', text: 'Make the pressure exactly 2000 Pa.', test: (s) => Math.abs(s.p - 2000) < 0.5 },
    { id: 'wide', text: 'Push with 500 N or more, but keep the pressure under 1000 Pa. Don\'t sink!', test: (s) => s.f >= 500 && s.p < 1000 },
    { id: 'deep', text: 'Sink the block deep: make the pressure more than 15000 Pa.', test: (s) => s.p > 15000 },
  ],
  quiz: [
    { q: 'Why does a sharp knife cut better than a blunt one?', options: ['Its edge has a smaller area, so the pressure is higher', 'It is heavier', 'Sharp metal pushes with more force by itself', 'Sharp metal is softer'], answer: 0, explain: 'Same force ÷ tiny area = very high pressure.' },
    { q: 'What is the SI unit of pressure?', options: ['Newton (N)', 'Pascal (Pa)', 'Joule (J)', 'Watt (W)'], answer: 1, explain: '1 pascal = 1 newton per square metre.' },
    { q: 'If the force doubles and the area stays the same, the pressure…', options: ['halves', 'stays the same', 'doubles', 'becomes zero'], answer: 2, explain: 'P = F ÷ A, so P grows in step with F.' },
  ],

  mount({ stage, controls, readouts: box }, report) {
    const s = { f: 400, a: 0.4, p: 1000 };
    const out = readouts(box, [
      { key: 'f', label: 'Force (F)' },
      { key: 'a', label: 'Area (A)' },
      { key: 'p', label: 'Pressure (F ÷ A)' },
      { key: 'feel', label: 'The sand' },
    ]);
    const update = () => {
      s.p = s.f / s.a;
      out.set('f', `${s.f} N`);
      out.set('a', `${s.a.toFixed(2)} m²`);
      out.set('p', `${Math.round(s.p).toLocaleString()} Pa`);
      out.set('feel', s.p < 1000 ? 'Barely a dent' : s.p < 5000 ? 'Sinking a little' : s.p < 12000 ? 'Sinking deep' : 'Plunging in!');
      report(s);
    };
    controls.append(
      slider({ label: 'Force', bn: 'বল', min: 50, max: 1000, step: 10, value: s.f, unit: 'N', onInput: (v) => { s.f = v; update(); } }).el,
      slider({ label: 'Contact area', bn: 'ক্ষেত্রফল', min: 0.05, max: 1, step: 0.05, value: s.a, unit: 'm²', format: (v) => v.toFixed(2), onInput: (v) => { s.a = v; update(); } }).el,
    );
    update();

    const grains = Array.from({ length: 240 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.4 }));
    let depth = 0;

    const view = makeCanvas(stage, (ctx, w, h, dt) => {
      const ground = h * 0.62;
      depth = lerp(depth, clamp(s.p / 20000, 0, 1) * h * 0.2, 1 - Math.exp(-dt * 6));
      const bw = 50 + s.a * w * 0.5;
      const bh = Math.min(h * 0.2, 110);
      const bx = (w - bw) / 2;
      const by = ground + depth - bh;

      // Sand, with a dent under the block and raised lips at its edges
      const sand = ctx.createLinearGradient(0, ground, 0, h);
      sand.addColorStop(0, '#d9b47a');
      sand.addColorStop(1, '#8a6436');
      ctx.fillStyle = sand;
      ctx.beginPath();
      ctx.moveTo(0, ground);
      ctx.lineTo(bx - 34, ground);
      ctx.quadraticCurveTo(bx - 12, ground - depth * 0.35, bx, ground + depth);
      ctx.lineTo(bx + bw, ground + depth);
      ctx.quadraticCurveTo(bx + bw + 12, ground - depth * 0.35, bx + bw + 34, ground);
      ctx.lineTo(w, ground);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(90, 60, 25, 0.5)';
      for (const g of grains) {
        const gx = g.x * w;
        const gy = ground + 6 + g.y * (h - ground - 6);
        if (gx > bx - 34 && gx < bx + bw + 34 && gy < ground + depth + 4) continue;
        ctx.beginPath();
        ctx.arc(gx, gy, g.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pressure arrows pushing into the sand: denser when pressure is higher
      const spacing = clamp(70 - s.p / 300, 10, 70);
      for (let x = bx + spacing / 2; x < bx + bw; x += spacing) {
        arrow(ctx, x, ground + depth + 4, x, ground + depth + 22, { color: 'rgba(255,255,255,0.85)', width: 1.5, head: 6 });
      }

      // Block
      const g = ctx.createLinearGradient(bx, by, bx, by + bh);
      g.addColorStop(0, C.goldLight);
      g.addColorStop(1, C.gold);
      ctx.fillStyle = g;
      roundRect(ctx, bx, by, bw, bh, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, bw > 120 ? `A = ${s.a.toFixed(2)} m²` : `${s.a.toFixed(2)} m²`, bx + bw / 2, by + bh / 2, { align: 'center', baseline: 'middle', color: C.bg, weight: 600, size: 14 });

      // Force arrows pushing down on the block
      const n = clamp(Math.min(Math.round(s.f / 200) + 1, Math.floor(bw / 22)), 1, 6);
      const len = 30 + (s.f / 1000) * 70;
      for (let k = 0; k < n; k++) {
        const x = bx + (bw * (k + 0.5)) / n;
        arrow(ctx, x, by - len - 8, x, by - 6, { color: C.white, width: 3, head: 12 });
      }
      text(ctx, `F = ${s.f} N`, w / 2, by - len - 18, { align: 'center', color: C.white, weight: 600, size: 16 });

      text(ctx, `P = ${Math.round(s.p).toLocaleString()} Pa`, 20, 34, { color: C.goldLight, weight: 600, size: 22 });
      text(ctx, 'চাপ = বল ÷ ক্ষেত্রফল', 20, 58, { color: C.muted, size: 14 });
      text(ctx, 'Sand · বালি', 16, h - 14, { color: 'rgba(43,10,23,0.7)', size: 13, weight: 600 });
    });

    return () => view.destroy();
  },
};
