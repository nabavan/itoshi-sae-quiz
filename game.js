/* ==========================================================================
   BLUE LOCK // ITOSHI SAE AMBIENT FORMULA FX & ADOFAI RIN VS SAE DUEL
   ========================================================================== */
'use strict';

class SaeAmbientFX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.flowMode = false;
    this.tokens = ['0°', 'π/2', 'f(x)', '№10', 'Δθ', 'XI', '99%', 'cos θ', '∂y/∂x', '∞'];
    this.particles = [];
    this.rafId = null;
    this.dpr = 1;
    this.reducedMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.mouse = { x: window.innerWidth * 0.65, y: window.innerHeight * 0.35, active: false };

    if (!this.canvas || !this.ctx || this.reducedMotion) return;

    this.resize();
    this.seed();

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.resize();
        this.seed();
      }, 120);
    }, { passive: true });

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.mouse.active = true;
      }
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      } else if (!document.hidden && !this.rafId && !this.reducedMotion) {
        this.loop();
      }
    });

    this.loop();
  }

  resize() {
    if (!this.canvas || !this.ctx) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  seed() {
    const count = this.w < 760 ? 18 : 30;
    this.particles = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * (this.w || 1200),
      y: Math.random() * (this.h || 800),
      vx: (Math.random() - 0.5) * 0.38,
      vy: -0.16 - Math.random() * 0.36,
      r: 1.2 + Math.random() * 2.0,
      token: i % 3 === 0 ? this.tokens[i % this.tokens.length] : null,
      alpha: 0.16 + Math.random() * 0.36,
      phase: Math.random() * Math.PI * 2
    }));
  }

  setFlowMode(active) {
    this.flowMode = Boolean(active);
  }

  drawFieldLines(ctx, isFlow) {
    // Thin Metavision tactical field lines & pitch arcs reacting slightly to cursor
    const lineRgb = isFlow ? '255, 42, 95' : '0, 229, 195';
    const goldRgb = '234, 179, 8';
    const shiftX = this.mouse.active ? ((this.mouse.x / Math.max(1, this.w)) - 0.5) * 18 : 0;
    const shiftY = this.mouse.active ? ((this.mouse.y / Math.max(1, this.h)) - 0.5) * 14 : 0;

    ctx.save();
    ctx.strokeStyle = `rgba(${lineRgb}, ${isFlow ? 0.075 : 0.05})`;
    ctx.lineWidth = 0.85;

    // Pitch center line & circle
    const midY = this.h * 0.5 + shiftY * 0.4;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(this.w, midY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.w * 0.5 + shiftX, midY, Math.min(this.w, this.h) * 0.19, 0, Math.PI * 2);
    ctx.stroke();

    // Fine diagonal Metavision calculation vector
    ctx.strokeStyle = `rgba(${goldRgb}, ${isFlow ? 0.06 : 0.038})`;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.moveTo(0, this.h * 0.82 - shiftY * 0.6);
    ctx.lineTo(this.w, this.h * 0.18 + shiftY * 0.6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawFrame(t) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const isFlow = this.flowMode || document.body.classList.contains('flow-mode-active');
    ctx.clearRect(0, 0, this.w, this.h);

    this.drawFieldLines(ctx, isFlow);

    const primaryRgb = isFlow ? '255, 42, 95' : '225, 29, 72';
    const secondaryRgb = isFlow ? '0, 229, 195' : '234, 179, 8';
    const metavisionRgb = isFlow ? '255, 42, 95' : '0, 229, 195';

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.phase += isFlow ? 0.022 : 0.015;
      p.x += p.vx * (isFlow ? 1.45 : 1) + Math.sin(p.phase) * 0.16;
      p.y += p.vy * (isFlow ? 1.45 : 1);

      if (p.y < -20) {
        p.y = this.h + 20;
        p.x = Math.random() * this.w;
      }
      if (p.x < -20) p.x = this.w + 20;
      if (p.x > this.w + 20) p.x = -20;

      // Metavision geometric trajectory links to cursor node
      if (this.mouse.active) {
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 28900) {
          const dist = Math.sqrt(distSq);
          const op = (1 - dist / 170) * (isFlow ? 0.3 : 0.22);
          ctx.strokeStyle = `rgba(${metavisionRgb}, ${op})`;
          ctx.lineWidth = isFlow ? 1.05 : 0.85;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(this.mouse.x, this.mouse.y);
          ctx.stroke();
        }
      }

      // Geometric trajectory chords between nearby particles
      for (let j = i + 1; j < this.particles.length; j++) {
        const q = this.particles[j];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 18225) {
          const lineA = (1 - Math.sqrt(distSq) / 135) * (isFlow ? 0.14 : 0.085);
          ctx.strokeStyle = `rgba(${i % 2 === 0 ? primaryRgb : secondaryRgb}, ${lineA})`;
          ctx.lineWidth = 0.75;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }

      const pulse = 0.75 + 0.25 * Math.sin(t * 0.002 + p.phase);
      const a = Math.min(0.68, p.alpha * pulse * (isFlow ? 1.3 : 0.95));

      if (p.token) {
        ctx.font = '700 11px "Exo 2", sans-serif';
        ctx.fillStyle = `rgba(${i % 3 === 0 ? primaryRgb : secondaryRgb}, ${a})`;
        ctx.fillText(p.token, p.x, p.y);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${secondaryRgb}, ${a})`;
        ctx.fill();
      }
    }

    if (this.mouse.active) {
      ctx.beginPath();
      ctx.arc(this.mouse.x, this.mouse.y, 16, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${metavisionRgb}, 0.22)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  loop(t = 0) {
    this.drawFrame(t);
    this.rafId = requestAnimationFrame((now) => this.loop(now));
  }
}

const ADOFAI_DIFFICULTIES = [
  {
    id: 0,
    code: 'LVL 01 · 108 BPM',
    name: 'Розминка U-20 (Простий)',
    brief: 'LVL 01 // Розминка U-20 (108 BPM, 32 кроки) — Рівний ритм для контролю темпу. Бот Сае грає паралельно в нижній доріжці.',
    bpm: 108,
    stepCount: 32,
    perfectMs: 74,
    goodMs: 140,
    hitWindowMs: 185,
    allowFastCorners: false,
    botProfile: { perfectProb: 0.72, goodProb: 0.24, missProb: 0.04, perfectJitterMs: 30, goodMinMs: 78, goodMaxMs: 122 },
    seed: 101
  },
  {
    id: 1,
    code: 'LVL 02 · 136 BPM',
    name: 'Центр поля (Середній)',
    brief: 'LVL 02 // Центр поля (136 BPM, 44 кроки) — Прискорені повороти W/S/D у стилі дуелі півзахисту U-20. Точність Сае зростає.',
    bpm: 136,
    stepCount: 44,
    perfectMs: 58,
    goodMs: 115,
    hitWindowMs: 160,
    allowFastCorners: true,
    botProfile: { perfectProb: 0.86, goodProb: 0.12, missProb: 0.02, perfectJitterMs: 22, goodMinMs: 62, goodMaxMs: 96 },
    seed: 202
  },
  {
    id: 2,
    code: 'LVL 03 · 164 BPM',
    name: 'Flow: Фінальна дуель (Складний)',
    brief: 'LVL 03 // Flow Ch. 147 (164 BPM, 56 кроків) — Швидкі каскади без права на збій проти пробудженого World XI Сае.',
    bpm: 164,
    stepCount: 56,
    perfectMs: 48,
    goodMs: 95,
    hitWindowMs: 138,
    allowFastCorners: true,
    botProfile: { perfectProb: 0.94, goodProb: 0.06, missProb: 0.0, perfectJitterMs: 14, goodMinMs: 50, goodMaxMs: 78 },
    seed: 303
  }
];

const DIR_META = {
  D: { dx: 1, dy: 0, angle: 0, label: 'D' },
  S: { dx: 0, dy: 1, angle: Math.PI / 2, label: 'S' },
  A: { dx: -1, dy: 0, angle: Math.PI, label: 'A' },
  W: { dx: 0, dy: -1, angle: -Math.PI / 2, label: 'W' }
};

function normAngle(rad) {
  let a = rad % (Math.PI * 2);
  if (a <= -Math.PI) a += Math.PI * 2;
  if (a > Math.PI) a -= Math.PI * 2;
  return a;
}

function posMod(v, mod) {
  return ((v % mod) + mod) % mod;
}

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

class SaeRinAdofaiDuel {
  constructor(canvas, sfx, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.sfx = sfx;
    this.callbacks = callbacks;

    this.W = 1080;
    this.H = 540;
    this.laneHeight = 264;
    this.tileSize = 72;
    this.planetDist = this.tileSize;

    this.diffIndex = 0;
    this.state = 'idle'; // 'idle' | 'countdown' | 'playing' | 'finished'
    this.startPerfMs = 0;
    this.lastBeatTickIndex = -1;
    this.rafId = null;

    this.chart = null;
    this.botPlan = [];
    this.botCursor = 0;
    this.botStats = null;

    this.playerCursor = 0;
    this.playerVisualSegStart = 0;
    this.playerStats = null;

    this.particles = [];
    this.popups = [];
    this.keyFlash = { W: 0, S: 0, A: 0, D: 0 };
    this.botKeyFlash = { key: null, until: 0 };

    this.playerCam = { x: 0, y: 0 };
    this.botCam = { x: 0, y: 0 };

    this.cacheDom();
    this.loadDifficulty(0);
    this.bindEvents();
    this.startLoop();
  }

  cacheDom() {
    this.dom = {
      diffPills: document.querySelectorAll('.diff-pill'),
      brief: document.getElementById('gameScenarioBrief'),
      playerAcc: document.getElementById('playerAccVal'),
      playerCombo: document.getElementById('playerComboVal'),
      playerPerf: document.getElementById('playerPerfVal'),
      botAcc: document.getElementById('botAccVal'),
      botCombo: document.getElementById('botComboVal'),
      botPerf: document.getElementById('botPerfVal'),
      deltaBadge: document.getElementById('duelDeltaBadge'),
      progressFill: document.getElementById('duelProgressFill'),
      stepLabel: document.getElementById('duelStepLabel'),
      bpmBadge: document.getElementById('duelBpmBadge'),
      overlayHint: document.getElementById('gameOverlayText'),
      startBtn: document.getElementById('duelStartBtn'),
      resetBtn: document.getElementById('duelResetBtn'),
      nextDirBadge: document.getElementById('duelNextDirBadge'),
      wsdaBtns: document.querySelectorAll('.wsda-key-btn'),
      verdictOverlay: document.getElementById('duelVerdictOverlay'),
      verdictKicker: document.getElementById('verdictKicker'),
      verdictTitle: document.getElementById('verdictTitle'),
      verdictQuote: document.getElementById('verdictQuote'),
      verdictPlayerAcc: document.getElementById('verdictPlayerAcc'),
      verdictPlayerDetail: document.getElementById('verdictPlayerDetail'),
      verdictBotAcc: document.getElementById('verdictBotAcc'),
      verdictBotDetail: document.getElementById('verdictBotDetail'),
      verdictRetryBtn: document.getElementById('verdictRetryBtn'),
      verdictToCallBtn: document.getElementById('verdictToCallBtn'),
      backToCallBtn: document.getElementById('backToCallBtn')
    };
  }

  bindEvents() {
    this.dom.diffPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const idx = Number(pill.dataset.diff);
        if (!Number.isNaN(idx)) {
          this.sfx?.playClick();
          this.loadDifficulty(idx);
        }
      });
    });

    if (this.dom.startBtn) {
      this.dom.startBtn.addEventListener('click', () => this.startDuel());
    }
    if (this.dom.resetBtn) {
      this.dom.resetBtn.addEventListener('click', () => this.loadDifficulty(this.diffIndex));
    }
    if (this.dom.verdictRetryBtn) {
      this.dom.verdictRetryBtn.addEventListener('click', () => {
        this.loadDifficulty(this.diffIndex);
        this.startDuel();
      });
    }
    if (this.dom.verdictToCallBtn) {
      this.dom.verdictToCallBtn.addEventListener('click', () => this.requestReturnToCall(true));
    }
    if (this.dom.backToCallBtn) {
      this.dom.backToCallBtn.addEventListener('click', () => this.requestReturnToCall(false));
    }

    this.dom.wsdaBtns.forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const key = btn.dataset.key;
        if (key) this.handleDirectionInput(key);
      });
    });

    window.addEventListener('keydown', (e) => {
      const gameSection = document.getElementById('gameSection');
      if (!gameSection || !gameSection.classList.contains('active')) return;
      if (e.repeat) return;

      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      const keyMap = {
        KeyW: 'W', ArrowUp: 'W',
        KeyS: 'S', ArrowDown: 'S',
        KeyA: 'A', ArrowLeft: 'A',
        KeyD: 'D', ArrowRight: 'D'
      };

      const mapped = keyMap[e.code];
      if (mapped) {
        e.preventDefault();
        this.handleDirectionInput(mapped);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (this.state === 'idle' || this.state === 'finished') {
          if (this.state === 'finished') this.loadDifficulty(this.diffIndex);
          this.startDuel();
        }
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        this.loadDifficulty(this.diffIndex);
      }
    });
  }

  requestReturnToCall(fromVerdict) {
    this.sfx?.playClick();
    const completed = Boolean(fromVerdict || this.state === 'finished' || (this.chart && this.playerCursor >= this.chart.steps.length));
    if (this.state === 'playing' || this.state === 'countdown') {
      this.state = 'idle';
    }
    if (typeof this.callbacks.onReturnToCall === 'function') {
      const diff = ADOFAI_DIFFICULTIES[this.diffIndex];
      this.callbacks.onReturnToCall({
        completed,
        difficultyName: diff.name,
        playerAcc: this.getAccuracy(this.playerStats),
        botAcc: this.getAccuracy(this.botStats),
        playerCombo: this.playerStats.maxCombo,
        botCombo: this.botStats.maxCombo
      });
    }
  }

  buildChart(diff) {
    const rng = createRng(diff.seed);
    const beatMs = 60000 / diff.bpm;
    const countInMs = 4 * beatMs;

    const easyMotifs = [
      ['D', 'D', 'W', 'D'],
      ['D', 'D', 'S', 'D'],
      ['D', 'W', 'D', 'D', 'S', 'D'],
      ['D', 'S', 'D', 'D', 'W', 'D'],
      ['D', 'D', 'D', 'D']
    ];
    const medMotifs = [
      ['D', 'W', 'D', 'S', 'D'],
      ['D', 'W', 'W', 'D', 'S', 'D'],
      ['D', 'S', 'S', 'D', 'W', 'D'],
      ['D', 'W', 'A', 'W', 'D', 'D'],
      ['D', 'S', 'A', 'S', 'D', 'D']
    ];
    const hardMotifs = [
      ['D', 'W', 'D', 'S', 'D', 'W', 'D'],
      ['D', 'W', 'A', 'W', 'D', 'S', 'S', 'D'],
      ['D', 'S', 'A', 'S', 'D', 'W', 'W', 'D'],
      ['D', 'W', 'D', 'W', 'D', 'S', 'D', 'S', 'D']
    ];

    const pool = diff.id === 0 ? easyMotifs : (diff.id === 1 ? medMotifs : hardMotifs);
    const dirList = [];
    while (dirList.length < diff.stepCount) {
      const motif = pool[Math.floor(rng() * pool.length)];
      for (const d of motif) {
        if (dirList.length < diff.stepCount) dirList.push(d);
      }
    }

    const tiles = [{ gx: 0, gy: 0, x: 0, y: 0, dirIn: null, dirOut: dirList[0] }];
    const occupied = new Set(['0,0']);
    let gx = 0;
    let gy = 0;
    const verifiedDirs = [];

    for (let i = 0; i < diff.stepCount; i++) {
      let chosen = dirList[i];
      let vec = DIR_META[chosen];
      let nx = gx + vec.dx;
      let ny = gy + vec.dy;
      const prevDir = verifiedDirs[i - 1] || null;
      const isReverse = prevDir && (DIR_META[prevDir].dx === -vec.dx && DIR_META[prevDir].dy === -vec.dy);

      if (occupied.has(`${nx},${ny}`) || isReverse || ny > 3 || ny < -3) {
        chosen = 'D';
        vec = DIR_META.D;
        nx = gx + vec.dx;
        ny = gy + vec.dy;
      }

      verifiedDirs.push(chosen);
      occupied.add(`${nx},${ny}`);
      tiles[i].dirOut = chosen;
      gx = nx;
      gy = ny;
      tiles.push({
        gx,
        gy,
        x: gx * this.tileSize,
        y: gy * this.tileSize,
        dirIn: chosen,
        dirOut: null
      });
    }

    const steps = [];
    let cumTime = countInMs;
    let currentCW = 1;

    for (let i = 0; i < verifiedDirs.length; i++) {
      const dir = verifiedDirs[i];
      const outAngle = DIR_META[dir].angle;
      const fromAngle = i === 0
        ? normAngle(outAngle + Math.PI)
        : normAngle(DIR_META[verifiedDirs[i - 1]].angle + Math.PI);

      const cwSweep = posMod(outAngle - fromAngle, Math.PI * 2) || Math.PI * 2;
      const ccwSweep = posMod(fromAngle - outAngle, Math.PI * 2) || Math.PI * 2;

      let chosenCW = currentCW;
      let sweep = chosenCW > 0 ? cwSweep : -ccwSweep;

      if (!diff.allowFastCorners && Math.abs(sweep) < Math.PI * 0.75) {
        chosenCW = -chosenCW;
        sweep = chosenCW > 0 ? cwSweep : -ccwSweep;
      } else if (diff.id === 2 && rng() < 0.28) {
        chosenCW = -chosenCW;
        sweep = chosenCW > 0 ? cwSweep : -ccwSweep;
      }
      currentCW = chosenCW;

      const stepBeats = Math.abs(sweep) / Math.PI;
      const stepDurationMs = stepBeats * beatMs;
      if (i > 0) cumTime += stepDurationMs;

      steps.push({
        index: i,
        dir,
        fromAngle,
        outAngle,
        cw: chosenCW,
        sweep,
        stepBeats,
        durationMs: i === 0 ? beatMs : stepDurationMs,
        targetMs: cumTime
      });
    }

    return {
      diff,
      beatMs,
      countInMs,
      tiles,
      steps
    };
  }

  buildBotPlan(chart) {
    const { diff, steps } = chart;
    const rng = createRng(diff.seed + Math.floor(Math.random() * 900) + 17);
    const prof = diff.botProfile;

    return steps.map((step) => {
      const roll = rng();
      let grade = 'perfect';
      let offsetMs = 0;

      if (roll < prof.perfectProb) {
        grade = 'perfect';
        offsetMs = (rng() * 2 - 1) * prof.perfectJitterMs;
      } else if (roll < prof.perfectProb + prof.goodProb) {
        grade = 'good';
        const mag = prof.goodMinMs + rng() * (prof.goodMaxMs - prof.goodMinMs);
        offsetMs = (rng() < 0.5 ? -1 : 1) * mag;
      } else {
        grade = 'miss';
        offsetMs = diff.hitWindowMs - 6;
      }

      return {
        stepIndex: step.index,
        dir: step.dir,
        grade,
        offsetMs,
        triggerMs: step.targetMs + offsetMs
      };
    });
  }

  createEmptyStats(totalSteps) {
    return {
      totalSteps,
      judged: 0,
      perfect: 0,
      good: 0,
      miss: 0,
      faults: 0,
      points: 0,
      combo: 0,
      maxCombo: 0
    };
  }

  getAccuracy(stats) {
    if (!stats) return 100;
    const denom = stats.judged + stats.faults;
    if (denom <= 0) return 100;
    return Math.max(0, Math.min(100, (stats.points / denom) * 100));
  }

  loadDifficulty(index) {
    this.diffIndex = Math.max(0, Math.min(ADOFAI_DIFFICULTIES.length - 1, index));
    const diff = ADOFAI_DIFFICULTIES[this.diffIndex];
    this.chart = this.buildChart(diff);
    this.botPlan = this.buildBotPlan(this.chart);

    this.state = 'idle';
    this.playerCursor = 0;
    this.botCursor = 0;
    this.playerVisualSegStart = 0;
    this.lastBeatTickIndex = -1;
    this.playerStats = this.createEmptyStats(diff.stepCount);
    this.botStats = this.createEmptyStats(diff.stepCount);
    this.particles = [];
    this.popups = [];

    this.playerCam = { x: this.chart.tiles[0].x, y: this.chart.tiles[0].y };
    this.botCam = { x: this.chart.tiles[0].x, y: this.chart.tiles[0].y };

    this.dom.diffPills.forEach((pill) => {
      const active = Number(pill.dataset.diff) === this.diffIndex;
      pill.classList.toggle('active', active);
      pill.setAttribute('aria-selected', String(active));
    });

    if (this.dom.brief) this.dom.brief.textContent = diff.brief;
    if (this.dom.bpmBadge) this.dom.bpmBadge.textContent = `${diff.bpm} BPM`;
    if (this.dom.verdictOverlay) this.dom.verdictOverlay.hidden = true;
    if (this.dom.startBtn) {
      this.dom.startBtn.textContent = '▶ СТАРТ ДУЕЛІ [ПРОБІЛ]';
      this.dom.startBtn.classList.remove('is-armed');
    }
    if (this.dom.overlayHint) {
      this.dom.overlayHint.textContent = 'НАТИСНИ «СТАРТ ДУЕЛІ» АБО [ПРОБІЛ] · КЕРУВАННЯ: W / S / A / D';
      this.dom.overlayHint.style.display = 'block';
    }

    this.syncHud();
    this.updateNextKeyHighlight();
  }

  startDuel() {
    this.sfx?.resume();
    this.sfx?.playClick();
    if (this.state === 'finished') {
      this.loadDifficulty(this.diffIndex);
    }
    if (this.state === 'playing' || this.state === 'countdown') return;

    this.botPlan = this.buildBotPlan(this.chart);
    this.playerCursor = 0;
    this.botCursor = 0;
    this.playerStats = this.createEmptyStats(this.chart.steps.length);
    this.botStats = this.createEmptyStats(this.chart.steps.length);
    this.particles = [];
    this.popups = [];
    this.lastBeatTickIndex = -1;

    this.state = 'countdown';
    this.startPerfMs = performance.now();
    this.playerVisualSegStart = 0;

    if (this.dom.verdictOverlay) this.dom.verdictOverlay.hidden = true;
    if (this.dom.startBtn) {
      this.dom.startBtn.textContent = '● МАТЧ ТРИВАЄ...';
      this.dom.startBtn.classList.add('is-armed');
    }
    if (this.dom.overlayHint) {
      this.dom.overlayHint.textContent = 'ПРИГОТУЙСЯ: СЛУХАЙ МЕТРОНОМ І НАТИСКАЙ W / S / A / D НА БІТ!';
    }
    this.syncHud();
    this.updateNextKeyHighlight();
  }

  handleDirectionInput(key) {
    this.keyFlash[key] = performance.now() + 140;
    this.flashPadKey(key, 'is-pressed');

    if (this.state === 'idle') return;
    if (this.state !== 'countdown' && this.state !== 'playing') return;
    if (this.playerCursor >= this.chart.steps.length) return;

    const elapsedMs = performance.now() - this.startPerfMs;
    const step = this.chart.steps[this.playerCursor];
    const diff = this.chart.diff;
    const deltaMs = elapsedMs - step.targetMs;
    const absErr = Math.abs(deltaMs);

    if (absErr > diff.hitWindowMs) {
      if (elapsedMs > this.chart.countInMs - diff.beatMs * 0.5) {
        this.playerStats.faults += 1;
        this.playerStats.combo = 0;
        this.sfx?.playHit?.('miss');
        this.flashPadKey(key, 'is-miss');
        const pTile = this.chart.tiles[this.playerCursor];
        this.addPopup('top', pTile.x, pTile.y - 36, 'РАНО!', '#f87171');
        this.syncHud();
      }
      return;
    }

    if (key !== step.dir) {
      this.judgePlayerStep(step, 'miss', elapsedMs, 'ХИБНА!');
      return;
    }

    if (absErr <= diff.perfectMs) {
      this.judgePlayerStep(step, 'perfect', elapsedMs, 'ІДЕАЛЬНО!');
    } else if (absErr <= diff.goodMs) {
      const tag = deltaMs < 0 ? 'ДОБРЕ (РАНО)' : 'ДОБРЕ (ПІЗНО)';
      this.judgePlayerStep(step, 'good', elapsedMs, tag);
    } else {
      const tag = deltaMs < 0 ? 'РАНО' : 'ПІЗНО';
      this.judgePlayerStep(step, 'miss', elapsedMs, tag);
    }
  }

  judgePlayerStep(step, grade, elapsedMs, label) {
    const st = this.playerStats;
    st.judged += 1;
    if (grade === 'perfect') {
      st.perfect += 1;
      st.points += 1;
      st.combo += 1;
    } else if (grade === 'good') {
      st.good += 1;
      st.points += 0.65;
      st.combo += 1;
    } else {
      st.miss += 1;
      st.combo = 0;
    }
    if (st.combo > st.maxCombo) st.maxCombo = st.combo;

    this.sfx?.playHit?.(grade);
    const tile = this.chart.tiles[step.index + 1];
    const color = grade === 'perfect' ? '#00ffc8' : (grade === 'good' ? '#eab308' : '#ff2a5f');
    this.addPopup('top', tile.x, tile.y - 38, label, color);
    this.spawnBurst('top', tile.x, tile.y, color, grade === 'perfect' ? 14 : 8);

    this.playerCursor += 1;
    this.playerVisualSegStart = Math.max(elapsedMs, step.targetMs - 10);
    this.updateNextKeyHighlight();
    this.syncHud();
  }

  triggerBotStep(entry) {
    const st = this.botStats;
    st.judged += 1;
    if (entry.grade === 'perfect') {
      st.perfect += 1;
      st.points += 1;
      st.combo += 1;
    } else if (entry.grade === 'good') {
      st.good += 1;
      st.points += 0.65;
      st.combo += 1;
    } else {
      st.miss += 1;
      st.combo = 0;
    }
    if (st.combo > st.maxCombo) st.maxCombo = st.combo;

    const tile = this.chart.tiles[entry.stepIndex + 1];
    const label = entry.grade === 'perfect' ? 'ІДЕАЛЬНО!' : (entry.grade === 'good' ? 'ДОБРЕ' : 'МІМО');
    const color = entry.grade === 'perfect' ? '#eab308' : (entry.grade === 'good' ? '#fb923c' : '#f43f5e');
    this.addPopup('bot', tile.x, tile.y - 38, label, color);
    this.spawnBurst('bot', tile.x, tile.y, color, entry.grade === 'perfect' ? 12 : 7);

    this.botKeyFlash = { key: entry.dir, until: performance.now() + 140 };
    this.botCursor += 1;
    this.syncHud();
  }

  flashPadKey(key, cls) {
    this.dom.wsdaBtns.forEach((btn) => {
      if (btn.dataset.key === key) {
        btn.classList.add(cls);
        setTimeout(() => btn.classList.remove(cls), 145);
      }
    });
  }

  updateNextKeyHighlight() {
    const nextStep = this.chart?.steps[this.playerCursor];
    const dir = nextStep ? nextStep.dir : null;
    if (this.dom.nextDirBadge) {
      this.dom.nextDirBadge.textContent = dir ? `НАСТУПНИЙ: [${dir}]` : 'ФІНІШ!';
    }
    this.dom.wsdaBtns.forEach((btn) => {
      btn.classList.toggle('is-target', btn.dataset.key === dir);
    });
  }

  addPopup(lane, x, y, text, color) {
    this.popups.push({ lane, x, y, text, color, life: 0.65, maxLife: 0.65 });
  }

  spawnBurst(lane, x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 70 + Math.random() * 140;
      this.particles.push({
        lane,
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        r: 2 + Math.random() * 2.8,
        color,
        life: 0.42,
        maxLife: 0.42
      });
    }
  }

  syncHud() {
    const pAcc = this.getAccuracy(this.playerStats);
    const bAcc = this.getAccuracy(this.botStats);
    const total = this.chart ? this.chart.steps.length : 32;

    if (this.dom.playerAcc) this.dom.playerAcc.textContent = `${pAcc.toFixed(1)}%`;
    if (this.dom.playerCombo) this.dom.playerCombo.textContent = `${this.playerStats.combo}x`;
    if (this.dom.playerPerf) {
      this.dom.playerPerf.textContent = `${this.playerStats.perfect} / ${this.playerStats.miss + this.playerStats.faults}`;
    }

    if (this.dom.botAcc) this.dom.botAcc.textContent = `${bAcc.toFixed(1)}%`;
    if (this.dom.botCombo) this.dom.botCombo.textContent = `${this.botStats.combo}x`;
    if (this.dom.botPerf) this.dom.botPerf.textContent = `${this.botStats.perfect} / ${this.botStats.miss}`;

    const delta = pAcc - bAcc;
    if (this.dom.deltaBadge) {
      this.dom.deltaBadge.classList.remove('is-rin-lead', 'is-sae-lead', 'is-tie');
      if (Math.abs(delta) < 0.05) {
        this.dom.deltaBadge.classList.add('is-tie');
        this.dom.deltaBadge.textContent = 'НІЧИЯ 0.0%';
      } else if (delta > 0) {
        this.dom.deltaBadge.classList.add('is-rin-lead');
        this.dom.deltaBadge.textContent = `РІН +${delta.toFixed(1)}%`;
      } else {
        this.dom.deltaBadge.classList.add('is-sae-lead');
        this.dom.deltaBadge.textContent = `САЕ +${Math.abs(delta).toFixed(1)}%`;
      }
    }

    const doneSteps = Math.max(this.playerCursor, this.botCursor);
    const pct = Math.min(100, (doneSteps / total) * 100);
    if (this.dom.progressFill) this.dom.progressFill.style.width = `${pct.toFixed(1)}%`;
    if (this.dom.stepLabel) this.dom.stepLabel.textContent = `КРОК ${Math.min(doneSteps, total)} / ${total}`;
  }

  finishDuel() {
    this.state = 'finished';
    if (this.dom.startBtn) {
      this.dom.startBtn.textContent = '↻ ЗІГРАТИ ЩЕ РАЗ [ПРОБІЛ]';
      this.dom.startBtn.classList.remove('is-armed');
    }

    const pAcc = this.getAccuracy(this.playerStats);
    const bAcc = this.getAccuracy(this.botStats);
    const won = pAcc > bAcc + 0.05;
    const tie = Math.abs(pAcc - bAcc) <= 0.05;

    if (won || tie) {
      this.sfx?.playVictory?.();
    }

    if (this.dom.verdictKicker) {
      this.dom.verdictKicker.textContent = won
        ? '// BLUE LOCK OVERRIDE · ПЕРЕМОГА РІНА'
        : (tie ? '// EQUILIBRIUM · ІДЕАЛЬНИЙ ПАРИТЕТ' : '// NEW GEN WORLD XI DOMINANCE');
    }
    if (this.dom.verdictTitle) {
      this.dom.verdictTitle.textContent = won
        ? 'ТИ ПЕРЕГРАВ ІТОШІ САЕ ЗА ТОЧНІСТЮ!'
        : (tie ? 'АБСОЛЮТНА НІЧИЯ БРАТІВ!' : 'ІТОШІ САЕ ТРИМАЄ ВИЩУ ТОЧНІСТЬ');
    }
    if (this.dom.verdictQuote) {
      this.dom.verdictQuote.textContent = won
        ? '«Непогано, Ріне… ти нарешті бачиш ритм гри, не прив’язаний до моєї тіні.»'
        : (tie
          ? '«Рівні цифри на табло? Тоді в наступному підході я підніму темп ще вище.»'
          : '«Занадто шумно й нерівно. Підтягни таймінг, якщо хочеш знищити мене на полі U-20.»');
    }
    if (this.dom.verdictPlayerAcc) this.dom.verdictPlayerAcc.textContent = `${pAcc.toFixed(1)}%`;
    if (this.dom.verdictBotAcc) this.dom.verdictBotAcc.textContent = `${bAcc.toFixed(1)}%`;
    if (this.dom.verdictPlayerDetail) {
      this.dom.verdictPlayerDetail.textContent = `${this.playerStats.perfect} ідеал · ${this.playerStats.good} добре · макс комбо ${this.playerStats.maxCombo}x`;
    }
    if (this.dom.verdictBotDetail) {
      this.dom.verdictBotDetail.textContent = `${this.botStats.perfect} ідеал · ${this.botStats.good} добре · макс комбо ${this.botStats.maxCombo}x`;
    }

    if (this.dom.verdictOverlay) this.dom.verdictOverlay.hidden = false;
    this.syncHud();
  }

  update(now, dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 28 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }

    if (this.state === 'countdown' || this.state === 'playing') {
      const elapsedMs = now - this.startPerfMs;

      const beatIdx = Math.floor(elapsedMs / this.chart.beatMs);
      if (beatIdx > this.lastBeatTickIndex) {
        this.lastBeatTickIndex = beatIdx;
        this.sfx?.playBeatTick?.(beatIdx < 4 || beatIdx % 4 === 0);
      }

      if (this.state === 'countdown' && elapsedMs >= this.chart.countInMs - this.chart.diff.hitWindowMs) {
        this.state = 'playing';
        if (this.dom.overlayHint) {
          this.dom.overlayHint.textContent = 'РУХ! W (▲) · S (▼) · A (◀) · D (▶) — ТРИМАЙ РИТМ ТОЧНІШЕ ЗА САЕ';
        }
      }

      while (
        this.playerCursor < this.chart.steps.length &&
        elapsedMs > this.chart.steps[this.playerCursor].targetMs + this.chart.diff.hitWindowMs
      ) {
        const missedStep = this.chart.steps[this.playerCursor];
        this.judgePlayerStep(missedStep, 'miss', elapsedMs, 'МІМО!');
      }

      while (
        this.botCursor < this.botPlan.length &&
        elapsedMs >= this.botPlan[this.botCursor].triggerMs
      ) {
        this.triggerBotStep(this.botPlan[this.botCursor]);
      }

      if (
        this.playerCursor >= this.chart.steps.length &&
        this.botCursor >= this.botPlan.length
      ) {
        this.finishDuel();
      }
    }

    const pPivot = this.chart.tiles[Math.min(this.playerCursor, this.chart.tiles.length - 1)];
    const bPivot = this.chart.tiles[Math.min(this.botCursor, this.chart.tiles.length - 1)];
    const camLerp = 1 - Math.exp(-10 * dt);
    this.playerCam.x += (pPivot.x - this.playerCam.x) * camLerp;
    this.playerCam.y += (pPivot.y - this.playerCam.y) * camLerp;
    this.botCam.x += (bPivot.x - this.botCam.x) * camLerp;
    this.botCam.y += (bPivot.y - this.botCam.y) * camLerp;
  }

  getPlanetAngle(cursor, elapsedMs, segStartOverride = null) {
    const steps = this.chart.steps;
    if (cursor >= steps.length) {
      return steps[steps.length - 1].outAngle;
    }
    const step = steps[cursor];
    if (this.state === 'idle' || this.state === 'finished') {
      return step.fromAngle;
    }

    if (cursor === 0) {
      const remainingMs = step.targetMs - elapsedMs;
      const radPerMs = Math.PI / this.chart.beatMs;
      return step.outAngle - step.cw * remainingMs * radPerMs;
    }

    const segStart = segStartOverride ?? steps[cursor - 1].targetMs;
    const totalDur = Math.max(40, step.targetMs - segStart);
    const prog = Math.max(0, Math.min(1.25, (elapsedMs - segStart) / totalDur));
    return step.fromAngle + step.sweep * prog;
  }

  drawLane(opts) {
    const { laneKey, topY, height, cam, cursor, planetAngle, elapsedMs, theme } = opts;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, topY, this.W, height);
    ctx.clip();

    const bg = ctx.createLinearGradient(0, topY, 0, topY + height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, topY, this.W, height);

    const centerX = this.W * 0.36;
    const centerY = topY + height * 0.54;
    const offsetX = centerX - cam.x;
    const offsetY = centerY - cam.y;

    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 1;
    const stepGrid = this.tileSize;
    const startGx = Math.floor(-offsetX / stepGrid) * stepGrid + offsetX;
    const startGy = Math.floor((topY - offsetY) / stepGrid) * stepGrid + offsetY;
    for (let x = startGx; x < this.W; x += stepGrid) {
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, topY + height);
      ctx.stroke();
    }
    for (let y = startGy; y < topY + height; y += stepGrid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.W, y);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(offsetX, offsetY);

    const tiles = this.chart.tiles;
    ctx.beginPath();
    for (let i = 0; i < tiles.length; i++) {
      if (i === 0) ctx.moveTo(tiles[i].x, tiles[i].y);
      else ctx.lineTo(tiles[i].x, tiles[i].y);
    }
    ctx.strokeStyle = theme.connectorColor;
    ctx.lineWidth = 16;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (Math.abs(tile.x + offsetX - centerX) > 780) continue;

      const isPivot = i === cursor;
      const isNextTarget = i === cursor + 1;
      const isDone = i < cursor;
      const stepForTile = i > 0 ? this.chart.steps[i - 1] : null;

      ctx.save();
      ctx.translate(tile.x, tile.y);

      const boxSize = isNextTarget ? 54 : (isPivot ? 50 : 44);
      const half = boxSize / 2;

      ctx.fillStyle = isDone
        ? theme.tileDoneFill
        : (isNextTarget ? theme.tileTargetFill : (isPivot ? theme.tilePivotFill : theme.tileIdleFill));
      ctx.strokeStyle = isDone
        ? theme.tileDoneStroke
        : (isNextTarget ? theme.tileTargetStroke : (isPivot ? theme.tilePivotStroke : theme.tileIdleStroke));
      ctx.lineWidth = isNextTarget ? 3 : 2;

      ctx.beginPath();
      ctx.roundRect(-half, -half, boxSize, boxSize, 10);
      ctx.fill();
      ctx.stroke();

      if (isNextTarget && (this.state === 'playing' || this.state === 'countdown') && stepForTile) {
        const timeLeft = stepForTile.targetMs - elapsedMs;
        const windowNorm = Math.max(0, Math.min(1, timeLeft / (this.chart.beatMs * 1.15)));
        const ringR = 26 + windowNorm * 32;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = timeLeft < this.chart.diff.perfectMs && timeLeft > -this.chart.diff.perfectMs
          ? '#ffffff'
          : theme.planetB;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.78;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (i > cursor && i <= cursor + 10 && stepForTile) {
        ctx.fillStyle = isNextTarget ? '#ffffff' : 'rgba(241, 245, 249, 0.78)';
        ctx.font = isNextTarget ? '900 19px "Orbitron", sans-serif' : '700 15px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stepForTile.dir, 0, 1);
      } else if (i === tiles.length - 1) {
        ctx.fillStyle = '#eab308';
        ctx.font = '800 13px "Exo 2", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', 0, 1);
      }

      ctx.restore();
    }

    const pivot = tiles[Math.min(cursor, tiles.length - 1)];
    const orbX = pivot.x + Math.cos(planetAngle) * this.planetDist;
    const orbY = pivot.y + Math.sin(planetAngle) * this.planetDist;

    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, this.planetDist, 0, Math.PI * 2);
    ctx.strokeStyle = theme.orbitGuide;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(orbX, orbY);
    ctx.strokeStyle = theme.beamColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, 13, 0, Math.PI * 2);
    ctx.fillStyle = theme.planetA;
    ctx.shadowColor = theme.planetA;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(orbX, orbY, 13, 0, Math.PI * 2);
    ctx.fillStyle = theme.planetB;
    ctx.shadowColor = theme.planetB;
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;

    for (const p of this.particles) {
      if (p.lane !== laneKey) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (const pop of this.popups) {
      if (pop.lane !== laneKey) continue;
      ctx.globalAlpha = Math.max(0, pop.life / pop.maxLife);
      ctx.font = '800 15px "Exo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    ctx.fillStyle = 'rgba(6, 4, 12, 0.78)';
    ctx.beginPath();
    ctx.roundRect(14, topY + 10, 340, 32, 6);
    ctx.fill();
    ctx.strokeStyle = theme.badgeStroke;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '800 12px "Exo 2", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.badgeText;
    ctx.fillText(theme.laneTitle, 26, topY + 26);

    if (laneKey === 'bot' && this.botKeyFlash.until > performance.now() && this.botKeyFlash.key) {
      ctx.fillStyle = 'rgba(225, 29, 72, 0.85)';
      ctx.beginPath();
      ctx.roundRect(this.W - 148, topY + 10, 132, 32, 6);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.font = '800 12px "Exo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`САЕ НАТИСНУВ: ${this.botKeyFlash.key}`, this.W - 82, topY + 26);
    }

    ctx.restore();
  }

  drawFrame(now) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    const elapsedMs = (this.state === 'playing' || this.state === 'countdown')
      ? now - this.startPerfMs
      : 0;

    const pAngle = this.getPlanetAngle(
      this.playerCursor,
      elapsedMs,
      this.playerCursor > 0 ? this.playerVisualSegStart : null
    );
    const bSegStart = this.botCursor > 0 ? this.botPlan[this.botCursor - 1]?.triggerMs : null;
    const bAngle = this.getPlanetAngle(this.botCursor, elapsedMs, bSegStart);

    this.drawLane({
      laneKey: 'top',
      topY: 0,
      height: this.laneHeight,
      cam: this.playerCam,
      cursor: this.playerCursor,
      planetAngle: pAngle,
      elapsedMs,
      theme: {
        bgTop: '#04121b',
        bgBottom: '#071b26',
        gridColor: 'rgba(0, 229, 195, 0.08)',
        connectorColor: 'rgba(0, 229, 195, 0.22)',
        tileDoneFill: 'rgba(0, 229, 195, 0.2)',
        tileDoneStroke: 'rgba(0, 229, 195, 0.55)',
        tilePivotFill: 'rgba(0, 229, 195, 0.35)',
        tilePivotStroke: '#00ffc8',
        tileTargetFill: 'rgba(34, 211, 238, 0.3)',
        tileTargetStroke: '#ffffff',
        tileIdleFill: 'rgba(15, 23, 42, 0.85)',
        tileIdleStroke: 'rgba(56, 189, 248, 0.45)',
        orbitGuide: 'rgba(34, 211, 238, 0.28)',
        beamColor: 'rgba(0, 255, 200, 0.55)',
        planetA: '#00ffc8',
        planetB: '#38bdf8',
        badgeStroke: 'rgba(0, 229, 195, 0.55)',
        badgeText: '#00ffc8',
        laneTitle: 'BLUE LOCK XI #10 · ІТОШІ РІН (ТИ // WSDA)'
      }
    });

    const divGrad = ctx.createLinearGradient(0, 0, this.W, 0);
    divGrad.addColorStop(0, '#00e5c3');
    divGrad.addColorStop(0.5, '#eab308');
    divGrad.addColorStop(1, '#ff2a5f');
    ctx.fillStyle = '#09060f';
    ctx.fillRect(0, this.laneHeight, this.W, 12);
    ctx.fillStyle = divGrad;
    ctx.fillRect(0, this.laneHeight + 4, this.W, 4);

    this.drawLane({
      laneKey: 'bot',
      topY: this.laneHeight + 12,
      height: this.H - (this.laneHeight + 12),
      cam: this.botCam,
      cursor: this.botCursor,
      planetAngle: bAngle,
      elapsedMs,
      theme: {
        bgTop: '#16060d',
        bgBottom: '#1f0914',
        gridColor: 'rgba(255, 42, 95, 0.09)',
        connectorColor: 'rgba(234, 179, 8, 0.22)',
        tileDoneFill: 'rgba(255, 42, 95, 0.22)',
        tileDoneStroke: 'rgba(234, 179, 8, 0.6)',
        tilePivotFill: 'rgba(255, 42, 95, 0.38)',
        tilePivotStroke: '#eab308',
        tileTargetFill: 'rgba(234, 179, 8, 0.28)',
        tileTargetStroke: '#ffffff',
        tileIdleFill: 'rgba(24, 10, 18, 0.88)',
        tileIdleStroke: 'rgba(255, 42, 95, 0.48)',
        orbitGuide: 'rgba(234, 179, 8, 0.28)',
        beamColor: 'rgba(255, 42, 95, 0.58)',
        planetA: '#ff2a5f',
        planetB: '#eab308',
        badgeStroke: 'rgba(255, 42, 95, 0.6)',
        badgeText: '#fda4af',
        laneTitle: 'JAPAN U-20 #10 · БОТ ІТОШІ САЕ (LIVE AI)'
      }
    });

    if (this.state === 'countdown') {
      const beatProgress = Math.floor(elapsedMs / this.chart.beatMs);
      const countText = beatProgress < 3 ? String(3 - beatProgress) : 'ГОУ!';
      ctx.save();
      ctx.fillStyle = 'rgba(6, 4, 12, 0.72)';
      ctx.beginPath();
      ctx.roundRect(this.W / 2 - 90, this.laneHeight - 30, 180, 72, 12);
      ctx.fill();
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '900 34px "Orbitron", sans-serif';
      ctx.fillStyle = beatProgress >= 3 ? '#00ffc8' : '#eab308';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(countText, this.W / 2, this.laneHeight + 6);
      ctx.restore();
    }
  }

  startLoop() {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      this.update(now, dt);
      this.drawFrame(now);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
