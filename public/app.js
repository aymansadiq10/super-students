import { el } from './lib.js';
import pressure from './sims/pressure.js';
import ph from './sims/ph.js';
import pythagoras from './sims/pythagoras.js';

const SIMS = [pressure, ph, pythagoras];

const SUBJECTS = {
  physics: { label: 'Physics', bn: 'পদার্থবিজ্ঞান' },
  chemistry: { label: 'Chemistry', bn: 'রসায়ন' },
  math: { label: 'Math', bn: 'গণিত' },
};

const LEVELS = [
  { xp: 0, name: 'Curious Mind', bn: 'কৌতূহলী মন' },
  { xp: 80, name: 'Explorer', bn: 'অভিযাত্রী' },
  { xp: 180, name: 'Young Scientist', bn: 'তরুণ বিজ্ঞানী' },
  { xp: 270, name: 'Super Student', bn: 'সুপার স্টুডেন্ট' },
];

const TASK_XP = 20;
const QUIZ_XP = 10;
const STORE_KEY = 'super-students:v1';

const store = loadStore();
let filter = 'all';
let cleanup = null;

function loadStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && typeof saved.xp === 'number') return { tasks: {}, quiz: {}, ...saved };
  } catch {}
  return { xp: 0, tasks: {}, quiz: {} };
}

function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch {}
}

function levelFor(xp) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const next = LEVELS[i + 1];
  const pct = next ? (xp - LEVELS[i].xp) / (next.xp - LEVELS[i].xp) : 1;
  return { ...LEVELS[i], index: i, pct };
}

function renderXp() {
  const lv = levelFor(store.xp);
  document.getElementById('xp').replaceChildren(
    el('span', { class: 'xp-level' }, lv.name),
    el('div', { class: 'xp-bar' }, el('div', { class: 'xp-fill', style: `width:${Math.round(lv.pct * 100)}%` })),
    el('span', { class: 'xp-num' }, `${store.xp} XP`),
  );
}

function toast(title, sub) {
  const t = el('div', { class: 'toast' }, [title, sub ? el('small', {}, sub) : null]);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), 3200);
}

function award(xp, title) {
  const before = levelFor(store.xp).index;
  store.xp += xp;
  saveStore();
  renderXp();
  toast(title, `+${xp} XP`);
  const lv = levelFor(store.xp);
  if (lv.index > before) toast(`Level up! You are now a ${lv.name}`, lv.bn);
}

function progressOf(sim) {
  return { done: (store.tasks[sim.id] || []).length, total: sim.tasks.length };
}

function heading(title, bn, extra) {
  return el('h3', {}, [title, el('span', { class: 'bn' }, bn), extra]);
}

function block(title, bn, body, cls = '') {
  return el('div', { class: `block ${cls}` }, [heading(title, bn), body]);
}

/* ---------- Home ---------- */

function renderHome(app) {
  const lv = levelFor(store.xp);
  const mastered = SIMS.filter((s) => progressOf(s).done === s.tasks.length).length;
  const grid = el('div', { class: 'grid' });
  const chips = el('div', { class: 'filters' });

  const drawGrid = () => grid.replaceChildren(...SIMS.filter((s) => filter === 'all' || s.subject === filter).map(card));
  const drawChips = () => chips.replaceChildren(
    ...[['all', 'All topics', 'সব বিষয়'], ...Object.entries(SUBJECTS).map(([k, v]) => [k, v.label, v.bn])].map(([k, label, bn]) =>
      el('button', {
        class: 'chip' + (filter === k ? ' active' : ''),
        onclick: () => { filter = k; drawChips(); drawGrid(); },
      }, [label, ' · ', el('span', { class: 'bn' }, bn)])),
  );
  drawChips();
  drawGrid();

  app.append(
    el('section', { class: 'hero' }, [
      el('h1', {}, ['Super ', el('span', {}, 'Students')]),
      el('p', { class: 'tag' }, 'Class 8 science and math. Learn every topic by playing with a live simulation.'),
      el('p', { class: 'tag-bn' }, 'অষ্টম শ্রেণির বিজ্ঞান ও গণিত — সিমুলেশনে হাতে-কলমে শিখি'),
      el('div', { class: 'stats' }, [
        stat(lv.name, `Your level · ${lv.bn}`),
        stat(`${store.xp} XP`, 'Points earned'),
        stat(`${mastered} / ${SIMS.length}`, 'Topics mastered'),
      ]),
    ]),
    chips,
    grid,
  );
}

function stat(value, label) {
  return el('div', { class: 'stat' }, [el('b', {}, value), el('small', {}, label)]);
}

function card(sim) {
  const { done, total } = progressOf(sim);
  return el('a', { href: `#/sim/${sim.id}`, class: 'card' + (done === total ? ' complete' : '') }, [
    el('div', { class: 'card-icon' }, sim.icon),
    el('div', { class: 'subject' }, SUBJECTS[sim.subject].label),
    el('h3', {}, sim.title),
    el('div', { class: 'bn' }, sim.bn),
    el('p', {}, sim.summary),
    el('div', { class: 'progress' }, el('div', { style: `width:${(done / total) * 100}%` })),
    el('div', { class: 'card-foot' }, [
      el('span', {}, `${done}/${total} missions`),
      el('span', {}, done === total ? 'Replay →' : done ? 'Continue →' : 'Start →'),
    ]),
  ]);
}

/* ---------- Simulation page ---------- */

function renderSim(app, sim) {
  const done = new Set(store.tasks[sim.id] || []);
  const stage = el('div', { class: 'stage' });
  const controls = el('div', { class: 'controls' });
  const readoutBox = el('div', { class: 'readouts' });
  const count = el('span', { class: 'count' });
  const items = sim.tasks.map((t) => el('li', { class: done.has(t.id) ? 'done' : '' }, t.text));
  const updateCount = () => { count.textContent = `${done.size}/${sim.tasks.length}`; };
  updateCount();

  function report(state) {
    sim.tasks.forEach((t, i) => {
      if (done.has(t.id) || !t.test(state)) return;
      done.add(t.id);
      store.tasks[sim.id] = [...done];
      items[i].classList.add('done', 'just-done');
      updateCount();
      award(TASK_XP, 'Mission complete!');
      if (done.size === sim.tasks.length) toast(`${sim.title} mastered!`, 'সব মিশন সম্পন্ন ★');
    });
  }

  const subject = SUBJECTS[sim.subject];
  app.append(el('section', { class: 'sim' }, [
    el('div', { class: 'sim-head' }, [
      el('a', { href: '#/', class: 'back' }, '← All topics'),
      el('div', {}, [
        el('div', { class: 'subject' }, `${subject.label} · ${subject.bn}`),
        el('h1', {}, `${sim.icon} ${sim.title}`),
        el('div', { class: 'bn' }, sim.bn),
      ]),
    ]),
    el('div', { class: 'sim-grid' }, [
      stage,
      el('aside', { class: 'side' }, [
        block('Controls', 'নিয়ন্ত্রণ', controls),
        block('Live readings', 'পরিমাপ', readoutBox),
        el('div', { class: 'block missions' }, [heading('Missions', 'মিশন', count), el('ul', {}, items)]),
      ]),
      el('div', { class: 'learn' }, [
        block('The idea', 'মূল ধারণা', el('div', { class: 'concept', html: sim.concept })),
        quizBlock(sim),
      ]),
    ]),
  ]));

  // Mount after the stage is in the DOM so the canvas can measure itself.
  const destroy = sim.mount({ stage, controls, readouts: readoutBox }, report);
  return () => destroy && destroy();
}

function quizBlock(sim) {
  const solved = new Set(store.quiz[sim.id] || []);
  const questions = sim.quiz.map((q, qi) => {
    const explain = el('div', { class: 'explain' });
    const reveal = () => {
      buttons.forEach((b, j) => { b.disabled = true; if (j === q.answer) b.classList.add('correct'); });
      explain.textContent = '✓ ' + q.explain;
    };
    const answer = (oi) => {
      if (oi === q.answer) {
        reveal();
        if (!solved.has(qi)) {
          solved.add(qi);
          store.quiz[sim.id] = [...solved];
          award(QUIZ_XP, 'Correct answer!');
        }
        return;
      }
      const b = buttons[oi];
      b.classList.remove('wrong');
      void b.offsetWidth; // restart the shake animation
      b.classList.add('wrong');
      explain.textContent = 'Not quite. Look at the simulation again and try another answer.';
    };
    const buttons = q.options.map((opt, oi) => el('button', { type: 'button', class: 'option', onclick: () => answer(oi) }, opt));
    if (solved.has(qi)) reveal();
    return el('div', { class: 'quiz-q' }, [el('p', {}, `${qi + 1}. ${q.q}`), el('div', { class: 'options' }, buttons), explain]);
  });
  return block('Quick check', 'যাচাই করো', el('div', {}, questions));
}

/* ---------- Router ---------- */

function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  const app = document.getElementById('app');
  app.replaceChildren();
  const match = location.hash.match(/^#\/sim\/([\w-]+)/);
  const sim = match && SIMS.find((s) => s.id === match[1]);
  if (sim) cleanup = renderSim(app, sim);
  else renderHome(app);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
renderXp();
route();
