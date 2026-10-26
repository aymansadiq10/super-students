import { C, segmented, readouts, button, el, makeCanvas, text, roundRect, clamp, lerp } from '../lib.js';

const DROP_MOL = 5e-5; // one 1 mL drop of 0.05 M acid or base
const KW = 1e-14;
const START_ML = 100;
const MAX_ML = 250;

const SUBSTANCES = [
  { name: 'Lemon juice', bn: 'লেবুর রস', ph: 2.2 },
  { name: 'Vinegar', bn: 'সিরকা', ph: 2.9 },
  { name: 'Milk', bn: 'দুধ', ph: 6.6 },
  { name: 'Pure water', bn: 'বিশুদ্ধ পানি', ph: 7 },
  { name: 'Baking soda', bn: 'খাবার সোডা', ph: 8.4 },
  { name: 'Soap water', bn: 'সাবান পানি', ph: 10 },
  { name: 'Lime water', bn: 'চুনের পানি', ph: 12.4 },
];

const UNIVERSAL = [[0, [200, 30, 45]], [2, [235, 70, 45]], [4, [245, 160, 40]], [6, [235, 215, 60]], [7, [80, 180, 90]], [8, [40, 160, 140]], [10, [50, 100, 200]], [12, [80, 50, 170]], [14, [110, 30, 130]]];

function universal(ph) {
  for (let i = 1; i < UNIVERSAL.length; i++) {
    const [p1, c1] = UNIVERSAL[i];
    const [p0, c0] = UNIVERSAL[i - 1];
    if (ph <= p1) {
      const t = clamp((ph - p0) / (p1 - p0), 0, 1);
      return c0.map((v, k) => Math.round(lerp(v, c1[k], t)));
    }
  }
  return UNIVERSAL[UNIVERSAL.length - 1][1];
}

// Colour of the liquid as [r, g, b, alpha] for the chosen indicator.
function liquidColor(ph, indicator) {
  if (indicator === 'universal') return [...universal(ph), 0.85];
  if (indicator === 'litmus') return ph < 4.5 ? [220, 60, 70, 0.8] : ph > 8.3 ? [60, 100, 220, 0.8] : [140, 90, 180, 0.8];
  if (indicator === 'phenolphthalein') {
    const t = clamp((ph - 8.2) / 1.8, 0, 1);
    return ph < 8.2 ? [215, 230, 245, 0.3] : [255, 80, 160, 0.3 + 0.55 * t];
  }
  return [200, 225, 255, 0.3];
}

// pH from the excess moles of H⁺ (negative = excess OH⁻), including water's own ions.
function phOf(net, ml) {
  const c = net / (ml / 1000);
  const root = Math.sqrt(c * c + 4 * KW);
  const h = c >= 0 ? (c + root) / 2 : KW / ((-c + root) / 2);
  return -Math.log10(h);
}

function netFromPh(ph, ml) {
  const h = 10 ** -ph;
  return (h - KW / h) * (ml / 1000);
}

function describe(ph) {
  if (ph < 3) return 'Strongly acidic · তীব্র অম্ল';
  if (ph < 6.5) return 'Acidic · অম্লীয়';
  if (ph <= 7.5) return 'Neutral · নিরপেক্ষ';
  if (ph <= 11) return 'Basic · ক্ষারীয়';
  return 'Strongly basic · তীব্র ক্ষার';
}

export default {
  id: 'ph',
  subject: 'chemistry',
  icon: '🧪',
  title: 'Acids, Bases & pH',
  bn: 'অম্ল, ক্ষারক ও pH',
  summary: 'Test lemon juice, soap and lime water. Add drops and neutralise them.',
  concept: `
    <p>The <b>pH scale</b> (0 to 14) tells us how acidic or basic a solution is.</p>
    <ul>
      <li><b>pH below 7</b>: acid <span class="bn">(অম্ল)</span>. Examples: lemon juice, vinegar.</li>
      <li><b>pH 7</b>: neutral <span class="bn">(নিরপেক্ষ)</span>. Example: pure water.</li>
      <li><b>pH above 7</b>: base <span class="bn">(ক্ষারক)</span>. Examples: soap, lime water (চুনের পানি).</li>
    </ul>
    <p>An <b>indicator</b> changes colour to show the pH. Litmus turns red in acid and blue in base. Phenolphthalein stays colourless in acid but turns pink in base.</p>
    <div class="formula">Acid + Base → Salt + Water</div>
    <p>This is called <b>neutralisation</b> <span class="bn">(প্রশমন)</span>. Notice how the pH jumps quickly near 7: just one drop can make a big change.</p>`,
  tasks: [
    { id: 'acid', text: 'Use the acid dropper to push the pH below 3.', test: (s) => s.acidDrops > 0 && s.ph < 3 },
    { id: 'base', text: 'Use the base dropper to push the pH above 11.', test: (s) => s.baseDrops > 0 && s.ph > 11 },
    { id: 'neutral', text: 'Neutralise an acid: start with something acidic, then add base until the pH reaches 7 or higher.', test: (s) => s.wasAcidic && s.baseDrops > 0 && s.ph >= 7 },
    { id: 'phenol', text: 'Test lime water with phenolphthalein. What colour does it turn?', test: (s) => s.substance === 'Lime water' && s.indicator === 'phenolphthalein' },
  ],
  quiz: [
    { q: 'What is the pH of pure water?', options: ['0', '7', '10', '14'], answer: 1, explain: 'Pure water is neutral: pH 7.' },
    { q: 'Lemon juice is…', options: ['a base', 'neutral', 'an acid', 'a salt'], answer: 2, explain: 'Lemon juice has a pH of about 2. It is acidic.' },
    { q: 'Acid + base gives…', options: ['salt + water', 'only gas', 'more acid', 'oxygen'], answer: 0, explain: 'That reaction is called neutralisation.' },
  ],

  mount({ stage, controls, readouts: box }, report) {
    const s = { net: 0, ml: START_ML, ph: 7, shownPh: 7, indicator: 'universal', substance: 'Pure water', acidDrops: 0, baseDrops: 0, wasAcidic: false };
    const drops = [];
    const ripples = [];
    let pending = 0;
    let message = '';
    let messageTime = 0;
    let geom = null; // beaker layout from the last frame, used to place falling drops

    const out = readouts(box, [
      { key: 'ph', label: 'pH' },
      { key: 'type', label: 'Type' },
      { key: 'vol', label: 'Volume' },
      { key: 'drops', label: 'Drops added' },
    ]);

    const update = () => {
      s.ph = phOf(s.net, s.ml);
      if (s.ph < 6) s.wasAcidic = true;
      out.set('ph', s.ph.toFixed(2));
      out.set('type', describe(s.ph));
      out.set('vol', `${s.ml} mL`);
      out.set('drops', `${s.acidDrops} acid · ${s.baseDrops} base`);
      report(s);
    };

    const pour = (sub) => {
      drops.length = 0;
      pending = 0;
      Object.assign(s, { ml: START_ML, net: netFromPh(sub.ph, START_ML), substance: sub.name, acidDrops: 0, baseDrops: 0, wasAcidic: false });
      update();
      s.shownPh = s.ph;
    };

    const addDrops = (kind, n) => {
      for (let k = 0; k < n; k++) {
        if (s.ml + pending >= MAX_ML) {
          message = 'The beaker is full. Pour a fresh one!';
          messageTime = 2.5;
          return;
        }
        pending++;
        drops.push({ kind, y: -k * 40, vy: 0 });
      }
    };

    const subButtons = SUBSTANCES.map((sub) => el('button', { type: 'button', class: 'btn', onclick: () => pour(sub) }, [sub.name, el('span', { class: 'bn' }, ` ${sub.bn}`)]));

    controls.append(
      el('div', {}, [el('div', { class: 'seg-label' }, ['Add drops', el('small', {}, ' · ফোঁটা যোগ করো')]), el('div', { class: 'btn-row' }, [
        button('🔴 Acid +1', () => addDrops('acid', 1)),
        button('+5', () => addDrops('acid', 5)),
        button('🔵 Base +1', () => addDrops('base', 1)),
        button('+5', () => addDrops('base', 5)),
      ])]),
      segmented({
        label: 'Indicator', bn: 'নির্দেশক', value: s.indicator,
        options: [{ value: 'universal', label: 'Universal' }, { value: 'litmus', label: 'Litmus' }, { value: 'phenolphthalein', label: 'Phenolphthalein' }, { value: 'none', label: 'None' }],
        onChange: (v) => { s.indicator = v; update(); },
      }).el,
      el('div', {}, [el('div', { class: 'seg-label' }, ['Pour a fresh beaker of', el('small', {}, ' · নতুন বিকারে নাও')]), el('div', { class: 'btn-row' }, subButtons)]),
    );
    update();

    const view = makeCanvas(stage, (ctx, w, h, dt) => {
      s.shownPh = lerp(s.shownPh, s.ph, 1 - Math.exp(-dt * 5));

      const bw = Math.min(w * 0.34, 230);
      const bx = w * 0.42 - bw / 2;
      const bottom = h * 0.9;
      const bh = h * 0.58;
      const top = bottom - bh;
      const surface = bottom - bh * (s.ml / 280);
      geom = { bx, bw, surface };

      // Liquid
      const [r, g, b, a] = liquidColor(s.shownPh, s.indicator);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      roundRect(ctx, bx + 4, surface, bw - 8, bottom - surface - 4, [0, 0, 14, 14]);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(bx + 4, surface, bw - 8, 3);

      // Ripples from landed drops
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.t += dt;
        if (rp.t > 0.6) { ripples.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(255,255,255,${0.6 - rp.t})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(rp.x, surface + 1, 6 + rp.t * 50, 2 + rp.t * 6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Beaker glass and volume marks
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx - 8, top);
      ctx.lineTo(bx, top + 8);
      ctx.lineTo(bx, bottom - 14);
      ctx.quadraticCurveTo(bx, bottom, bx + 14, bottom);
      ctx.lineTo(bx + bw - 14, bottom);
      ctx.quadraticCurveTo(bx + bw, bottom, bx + bw, bottom - 14);
      ctx.lineTo(bx + bw, top + 8);
      ctx.stroke();
      for (let ml = 50; ml <= 250; ml += 50) {
        const y = bottom - bh * (ml / 280);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + bw - 18, y);
        ctx.lineTo(bx + bw - 4, y);
        ctx.stroke();
        text(ctx, `${ml}`, bx + bw - 22, y + 4, { align: 'right', size: 10, color: 'rgba(255,255,255,0.55)' });
      }

      // Droppers
      const tipY = top - 30;
      for (const [kind, x, label, color] of [['acid', bx + bw * 0.28, 'Acid (HCl)', '#ff6b6b'], ['base', bx + bw * 0.72, 'Base (NaOH)', '#7fb2ff']]) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, x - 5, tipY - 50, 10, 50, [0, 0, 5, 5]);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color;
        roundRect(ctx, x - 12, tipY - 82, 24, 34, 10);
        ctx.fill();
        text(ctx, label, x, tipY - 90, { align: 'center', size: 12, color: C.cream, weight: 600 });
        drops.filter((d) => d.kind === kind).forEach((d) => { d.x = x; });
      }

      // Falling drops
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.vy += 900 * dt;
        d.y += d.vy * dt;
        const y = tipY + d.y;
        if (y >= surface) {
          drops.splice(i, 1);
          pending--;
          s.ml += 1;
          if (d.kind === 'acid') { s.net += DROP_MOL; s.acidDrops++; } else { s.net -= DROP_MOL; s.baseDrops++; }
          ripples.push({ x: d.x, t: 0 });
          update();
          continue;
        }
        if (y < tipY) continue;
        ctx.fillStyle = d.kind === 'acid' ? '#ff8a8a' : '#9cc4ff';
        ctx.beginPath();
        ctx.arc(d.x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // pH scale
      const sx = Math.min(w * 0.8, w - 70);
      const sTop = h * 0.12;
      const sBot = h * 0.88;
      const grad = ctx.createLinearGradient(0, sTop, 0, sBot);
      for (let p = 0; p <= 14; p++) grad.addColorStop(p / 14, `rgb(${universal(p).join(',')})`);
      ctx.fillStyle = grad;
      roundRect(ctx, sx, sTop, 20, sBot - sTop, 10);
      ctx.fill();
      for (const p of [0, 7, 14]) text(ctx, `${p}`, sx + 28, sTop + ((sBot - sTop) * p) / 14 + 4, { size: 12, color: C.cream });
      text(ctx, 'Acid', sx + 10, sTop - 10, { align: 'center', size: 12, color: '#ff8a8a', weight: 600 });
      text(ctx, 'Base', sx + 10, sBot + 20, { align: 'center', size: 12, color: '#9cc4ff', weight: 600 });
      const py = sTop + ((sBot - sTop) * clamp(s.shownPh, 0, 14)) / 14;
      ctx.fillStyle = C.goldLight;
      ctx.beginPath();
      ctx.moveTo(sx - 4, py);
      ctx.lineTo(sx - 16, py - 8);
      ctx.lineTo(sx - 16, py + 8);
      ctx.closePath();
      ctx.fill();

      // Headline
      text(ctx, `pH ${s.shownPh.toFixed(1)}`, 20, 38, { size: 28, weight: 600, color: C.goldLight });
      text(ctx, describe(s.ph), 20, 62, { size: 14, color: C.cream });
      const sub = SUBSTANCES.find((x) => x.name === s.substance);
      text(ctx, `${s.substance} · ${sub.bn}`, 20, 84, { size: 13, color: C.muted });
      if (messageTime > 0) {
        messageTime -= dt;
        text(ctx, message, w * 0.42, h * 0.97, { align: 'center', size: 13, color: C.goldLight, weight: 600 });
      }
    });

    return () => view.destroy();
  },
};
