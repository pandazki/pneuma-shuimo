import { lay, rng, clamp } from './brush.js';
import { Paper } from './paper.js';
import { validate, initialState } from './script.js';
import { compose, CIRCLE, SHEET, ringDef, dotDef, tallyDef, strokeMs } from './layout.js';

/*
 * 播放器。Takes a script that passed validate() and plays it on a sheet: from the circle one stroke is drawn, and
 * along it the title, the rows, the little painting and the place for the seal are written, in the script's order and
 * time. What is written can be used at once. Pressing the circle dries it all back into the circle (fold); pressing it
 * again writes it out again. Pressing the seal keeps it.
 *
 * Ink is only ever written and dried. Nothing moves, turns, stretches or scales.
 *
 *   const sheet = mount(container, script, { state, kept, onState, onKeep, onFold });
 *   sheet.fold(); sheet.unfold(); sheet.destroy();
 */

const ease = (u) => { const v = clamp(u); return v < 0.5 ? 2 * v * v : 1 - ((-2 * v + 2) ** 2) / 2; };
const today = () => new Date().toLocaleDateString('sv');
/** The Monday this week began on. */
const thisWeek = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return `w${d.toLocaleDateString('sv')}`; };

export function mount(container, script, options = {}) {
  const checked = validate(script);
  if (!checked.ok) throw new Error(`脚本没有通过校验：\n${checked.errors.join('\n')}`);
  const plan = compose(script);
  const instant = options.at !== undefined || options.instant === true || (options.instant === undefined && globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true);
  const random = rng(options.seed ?? (Math.random() * 0x7fffffff) | 0);
  const seed = () => 1 + Math.floor(random() * 0x7ffffffe);

  // State: the script's keys at their empty values, then whatever the host kept; a daily script starts over each day.
  let state = { ...initialState(script), ...(options.state ?? {}) };
  const period = script.resets === 'daily' ? today() : script.resets === 'weekly' ? thisWeek() : null;
  if (period !== null && state._day !== period) state = { ...initialState(script), _day: period };
  let kept = options.kept === true;
  const emit = () => options.onState?.(structuredClone(state));

  const root = document.createElement('div');
  root.className = `shuimo${instant ? ' is-instant' : ''}`;
  root.style.width = `${plan.width}px`;
  root.style.height = `${plan.height}px`;
  const canvas = document.createElement('canvas');
  canvas.className = 'shuimo-paper';
  root.append(canvas);
  container.append(root);
  const paper = new Paper(canvas);
  paper.resize(plan.width, plan.height);
  const css = getComputedStyle(root);
  const INK = css.color || '#1f1d1a';

  // ── the clock: every stroke being written or drying is an animation; frames run only while there are any ──
  const anims = new Set();
  let frame = 0;
  const tick = (now) => {
    frame = 0;
    for (const a of anims) {
      const u = a.dur <= 0 ? 1 : (now - a.t0) / a.dur;
      if (u < 0) continue;
      a.step(clamp(u));
      if (u >= 1) { anims.delete(a); a.done?.(); }
    }
    paper.draw();
    if (anims.size > 0) frame = requestAnimationFrame(tick);
  };
  // Stillness: with `at` the sheet is shown as it stands that many ms into its unfolding, and no clock runs (for
  // looking at a script's order without watching it); `instant` is the whole of it at once.
  let still = options.at !== undefined ? options.at : instant ? Infinity : null;
  const run = (delay, dur, step, done) => {
    if (still !== null) {
      if (still < delay) return;
      const u = dur <= 0 ? 1 : clamp((still - delay) / dur);
      step(u); if (u >= 1) done?.();
      paper.draw(); return;
    }
    anims.add({ t0: performance.now() + delay, dur, step, done });
    if (frame === 0) frame = requestAnimationFrame(tick);
  };
  const timers = new Set();
  const later = (ms, fn) => {
    if (still !== null) { if (still >= ms) fn(); return; }
    if (ms <= 0) { fn(); return; }
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  };

  /** Writes a stroke after `delay`; returns its mark. */
  const writeStroke = (def, delay = 0, dur = strokeMs(def, plan.pace)) => {
    const mark = paper.add(lay(def, seed()), INK);
    run(delay, dur, (u) => { mark.written = Math.max(mark.written, ease(u)); });
    return mark;
  };
  /** Dries a mark away and takes it off the paper. */
  const dryMark = (mark, delay = 0, dur = 480) => {
    const from = mark.opacity;
    run(delay, dur, (u) => { mark.opacity = from * (1 - u); }, () => paper.remove(mark));
  };
  /** Text as characters that are written one after another. */
  const chars = (el, text, delay, per) => {
    [...text].forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'shuimo-ch';
      span.textContent = ch;
      el.append(span);
      later(delay + i * per, () => span.classList.add('is-written'));
    });
  };
  const appear = (el, delay) => { el.classList.add('shuimo-fade'); later(delay, () => el.classList.add('is-written')); };

  // ── the circle: always there. Folding ends on it; it is written again each time, never the same twice ──
  let circle = paper.add(lay(CIRCLE, seed()), INK);
  circle.written = 1;
  const rewriteCircle = () => {
    const old = circle;
    run(0, 300, (u) => { old.opacity = 1 - 0.75 * u; });
    circle = writeStroke(CIRCLE, 120, 620);
    dryMark(old, 620, 500);
  };
  const circleButton = document.createElement('button');
  circleButton.className = 'shuimo-circle';
  circleButton.type = 'button';
  root.append(circleButton);

  // ── the sheet: everything below is built on unfold and removed on fold ──
  let open = false;
  let busy = false;
  let content = [];   // DOM nodes
  let marks = [];     // ink on the paper, in the order written
  const put = (el) => { content.push(el); root.append(el); return el; };
  const ink = (def, delay, dur) => { const m = writeStroke(def, delay, dur); marks.push(m); return m; };

  function buildCheck(top, label, isDone, toggle, delay, per) {
    const row = put(document.createElement('div'));
    row.className = 'shuimo-row is-check';
    row.style.top = `${top}px`;
    const button = document.createElement('button');
    button.className = 'shuimo-check';
    button.type = 'button';
    button.setAttribute('role', 'checkbox');
    const text = document.createElement('span');
    text.className = 'shuimo-label';
    button.append(text);
    row.append(button);
    chars(text, label, delay, per);
    let dot = null;
    const show = (done, wait = 0) => {
      button.setAttribute('aria-checked', String(done));
      if (done && !dot) dot = ink(dotDef(top), wait);
      if (!done && dot) { marks = marks.filter((m) => m !== dot); dryMark(dot, 0, 360); dot = null; }
    };
    button.addEventListener('click', () => show(toggle()));
    return { show, remove() { show(false); content = content.filter((n) => n !== row); row.classList.add('shuimo-gone'); setTimeout(() => row.remove(), 320); } };
  }

  function unfold({ replay = false } = {}) {
    if (open || busy) return;
    open = true;
    root.classList.remove('is-drying');
    const k = replay ? 0.45 : 1; // written out again, it comes quicker: the owner has seen it before
    const at = (t) => t * k;
    const per = 62 * plan.pace * k;
    const rowEls = new Map();
    const rowEl = (i, cls) => {
      if (rowEls.has(i)) return rowEls.get(i);
      const el = put(document.createElement('div'));
      el.className = `shuimo-row ${cls}`;
      el.style.top = `${plan.rows[i].top}px`;
      rowEls.set(i, el);
      return el;
    };
    for (const beat of plan.beats) {
      const row = beat.row === undefined ? null : plan.rows[beat.row];
      if (beat.type === 'stroke') {
        if (beat.role !== 'ring') ink(beat.def, at(beat.t), beat.dur * k);
        else {
          ink(beat.def, at(beat.t), beat.dur * k);
          const label = plan.beats.find((b) => b.role === 'label' && b.row === beat.row);
          const check = buildCheck(row.top, row.label, state[row.key] === true, () => { state[row.key] = !state[row.key]; emit(); return state[row.key]; }, at(label.t), per);
          check.show(state[row.key] === true, at(label.t + label.dur));
        }
      } else if (beat.type === 'seal') {
        const seal = put(document.createElement('button'));
        seal.className = 'shuimo-seal';
        seal.type = 'button';
        seal.textContent = plan.seal.text;
        seal.style.left = `${plan.seal.x}px`;
        seal.style.top = `${plan.seal.y}px`;
        const label = () => { seal.setAttribute('aria-pressed', String(kept)); seal.setAttribute('aria-label', kept ? '已留下，点一下取消' : '钤印，把它留下'); seal.title = kept ? '已留下' : '钤印留下'; };
        label();
        seal.addEventListener('click', () => { kept = !kept; label(); options.onKeep?.(kept); });
        later(at(beat.t), () => seal.classList.add('is-written'));
      } else if (beat.role === 'title') {
        const h = put(document.createElement('h2'));
        h.className = 'shuimo-title';
        chars(h, beat.text, at(beat.t), per);
      } else if (beat.role === 'text') {
        const el = rowEl(beat.row, `is-text${row.tone === 'faint' ? ' is-faint' : ''}`);
        chars(el, beat.text, at(beat.t), per);
      } else if (beat.role === 'label' && row.kind === 'tally') {
        const el = rowEl(beat.row, 'is-tally');
        const label = document.createElement('span');
        chars(label, beat.text, at(beat.t), per);
        el.append(label);
        buildTally(el, row, at(beat.t + beat.dur));
      } else if (beat.role === 'placeholder') {
        buildEntry(rowEl(beat.row, 'is-entry'), row, at(beat.t), per);
      }
    }
    busy = true;
    later(at(plan.total), () => { busy = false; });
    if (still !== null) { busy = false; still = Infinity; } // whatever the owner does next happens at once
  }

  function buildTally(el, row, delay) {
    const strokes = [];
    const add = document.createElement('button');
    add.className = 'shuimo-tally';
    add.type = 'button';
    add.style.left = `${row.marksLeft - SHEET.left - 4}px`;
    add.style.width = `${Math.max(row.slots * 21, 78) + 8}px`;
    const count = document.createElement('div');
    count.className = 'shuimo-count';
    count.style.left = `${row.countLeft - SHEET.left}px`;
    const number = document.createElement('span');
    const undo = document.createElement('button');
    undo.className = 'shuimo-undo';
    undo.type = 'button';
    undo.textContent = '减';
    undo.setAttribute('aria-label', `${row.label}减一`);
    count.append(number, undo);
    // An empty tally shows where to press; the hint dries for good with the first stroke.
    const hint = document.createElement('span');
    hint.className = 'shuimo-hint';
    hint.textContent = '点此添一笔';
    add.append(hint);
    el.append(add, count);
    appear(count, delay);
    appear(hint, delay);
    const show = () => {
      const n = state[row.key];
      number.textContent = `${n}${row.goal ? `／${row.goal}` : ''}${row.unit ? ` ${row.unit}` : ''}`;
      add.setAttribute('aria-label', `${row.label}：${n}${row.unit ?? ''}，点一下添一笔`);
      undo.hidden = n === 0;
      hint.hidden = n > 0;
    };
    const cap = row.slots * 5;
    state[row.key] = clamp(state[row.key] | 0, 0, cap);
    for (let i = 0; i < state[row.key]; i += 1) strokes.push(ink(tallyDef(row, i), delay + i * 70, 150));
    show();
    add.addEventListener('click', () => {
      if (state[row.key] >= cap) return;
      strokes.push(ink(tallyDef(row, state[row.key])));
      state[row.key] += 1; show(); emit();
    });
    undo.addEventListener('click', () => {
      const last = strokes.pop();
      if (!last) return;
      marks = marks.filter((m) => m !== last);
      dryMark(last, 0, 320);
      state[row.key] -= 1; show(); emit();
    });
  }

  function buildEntry(el, row, delay, per) {
    const input = document.createElement('input');
    input.className = 'shuimo-input shuimo-fade';
    input.type = 'text';
    input.maxLength = 24;
    input.setAttribute('aria-label', row.placeholder);
    el.append(input);
    later(delay, () => input.classList.add('is-written'));
    const items = state[row.key];
    const lines = [];
    const top = (i) => row.top + (i + 1) * SHEET.row;
    const write = (i, wait) => {
      const item = items[i];
      const ring = ink(ringDef(top(i)), wait);
      const check = buildCheck(top(i), item.text, item.done, () => { item.done = !item.done; room(); emit(); return item.done; }, wait + 80, per);
      check.show(item.done, wait + 200);
      lines[i] = { ring, check };
    };
    items.forEach((_, i) => write(i, delay + 200 + i * 160));
    // Full, with something already done: the next one takes the place of the oldest done one. Full of things still
    // to do: nothing more fits.
    const room = () => {
      const full = items.length >= row.max;
      input.disabled = full && !items.some((item) => item.done);
      input.placeholder = input.disabled ? '写满了，点掉一条再添' : row.placeholder;
    };
    room();
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      const text = input.value.trim();
      if (text === '') return;
      let i = items.length;
      if (i >= row.max) {
        i = items.findIndex((item) => item.done);
        if (i < 0) return;
        const old = lines[i];
        marks = marks.filter((m) => m !== old.ring);
        dryMark(old.ring, 0, 300);
        old.check.remove();
      }
      items[i] = { text, done: false };
      input.value = '';
      write(i, i < row.max && lines[i] ? 320 : 0);
      room(); emit();
    });
  }

  /** 色归空：everything dries, last written first, and the circle is written again. */
  function fold() {
    if (!open) return;
    open = false;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    busy = true;
    root.classList.add('is-drying');
    const gone = marks;
    marks = [];
    const n = gone.length;
    gone.forEach((mark, i) => dryMark(mark, ((n - 1 - i) / Math.max(1, n)) * 320, 460));
    const nodes = content;
    content = [];
    rewriteCircle();
    later(820, () => { for (const el of nodes) el.remove(); busy = false; options.onFold?.(); });
  }

  let seen = false;
  const label = () => circleButton.setAttribute('aria-label', open ? `收起「${script.title}」` : `展开「${script.title}」`);
  circleButton.addEventListener('click', () => {
    if (busy && !open) return;
    if (open) fold(); else { unfold({ replay: seen }); }
    seen = true;
    label();
  });
  label();
  paper.draw();
  if (options.autoplay !== false) { unfold(); seen = true; label(); }

  return {
    el: root,
    plan,
    get state() { return structuredClone(state); },
    get kept() { return kept; },
    get open() { return open; },
    unfold: () => { unfold({ replay: seen }); seen = true; label(); },
    fold: () => { fold(); label(); },
    destroy() {
      for (const id of timers) clearTimeout(id);
      if (frame) cancelAnimationFrame(frame);
      anims.clear(); paper.clear(); root.remove();
    },
  };
}
