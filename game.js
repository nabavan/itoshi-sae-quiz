/* ==========================================================================
   BLUE LOCK // ITOSHI SAE AMBIENT FORMULA FX & 2D TACTICAL ARENA
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
    this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (this.canvas && this.ctx) {
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.seed();
      if (!this.reducedMotion) {
        this.loop();
      } else {
        this.drawFrame(0);
      }
    }
  }

  resize() {
    if (!this.canvas) return;
    this.w = this.canvas.width = window.innerWidth;
    this.h = this.canvas.height = window.innerHeight;
  }

  seed() {
    const count = Math.min(34, Math.max(16, Math.floor((window.innerWidth * window.innerHeight) / 48000)));
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * (this.w || 1200),
        y: Math.random() * (this.h || 800),
        vx: (Math.random() - 0.5) * 0.42,
        vy: -0.15 - Math.random() * 0.35,
        r: 1.5 + Math.random() * 2.2,
        token: i % 2 === 0 ? this.tokens[i % this.tokens.length] : null,
        alpha: 0.16 + Math.random() * 0.32,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  setFlowMode(active) {
    this.flowMode = Boolean(active);
    if (this.reducedMotion) this.drawFrame(0);
  }

  drawFrame(t) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    const primaryRgb = this.flowMode ? '255, 42, 95' : '225, 29, 72';
    const secondaryRgb = this.flowMode ? '0, 229, 195' : '234, 179, 8';

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!this.reducedMotion) {
        p.x += p.vx * (this.flowMode ? 1.65 : 1);
        p.y += p.vy * (this.flowMode ? 1.65 : 1);
        if (p.y < -30) { p.y = this.h + 20; p.x = Math.random() * this.w; }
        if (p.x < -30) p.x = this.w + 20;
        if (p.x > this.w + 30) p.x = -20;
      }

      const pulse = 0.75 + 0.25 * Math.sin(t * 0.002 + p.phase);
      const a = p.alpha * pulse * (this.flowMode ? 1.35 : 0.9);

      if (p.token) {
        ctx.font = '700 11px "Exo 2", sans-serif';
        ctx.fillStyle = `rgba(${i % 3 === 0 ? primaryRgb : secondaryRgb}, ${Math.min(0.62, a)})`;
        ctx.fillText(p.token, p.x, p.y);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${secondaryRgb}, ${Math.min(0.55, a)})`;
        ctx.fill();
      }

      for (let j = i + 1; j < this.particles.length; j++) {
        const q = this.particles[j];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 21000) {
          const lineA = (1 - distSq / 21000) * (this.flowMode ? 0.16 : 0.08);
          ctx.strokeStyle = `rgba(${primaryRgb}, ${lineA})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }
  }

  loop(t = 0) {
    this.drawFrame(t);
    this.rafId = requestAnimationFrame((now) => this.loop(now));
  }
}

class SaePlaymakerArena {
  constructor(canvas, sfx) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.sfx = sfx;

    this.W = 1080;
    this.H = 720;
    this.goalY = 74;
    this.goalW = 296;
    this.goalLeft = (this.W - this.goalW) / 2;
    this.goalRight = this.goalLeft + this.goalW;
    this.netDepth = 44;
    this.maxPull = 148;

    this.storageBestKey = 'sae_arena_best_v1';
    this.scenarioIndex = 0;
    this.endlessWave = 1;
    this.score = 0;
    this.streak = 0;
    this.bestScore = this.readInt(this.storageBestKey, 0);
    this.flowCharge = 100;
    this.flowActive = false;

    this.currentSpin = -26;
    this.isDragging = false;
    this.activePointerId = null;
    this.dragPull = { dx: 0, dy: 0, powerPct: 0, angleDeg: 0 };

    this.spawnPos = { x: 840, y: 430 };
    this.ball = {
      x: this.spawnPos.x,
      y: this.spawnPos.y,
      vx: 0,
      vy: 0,
      radius: 12,
      spin: 0,
      rotAngle: 0,
      inFlight: false,
      resultHandled: false,
      hitTargetZone: false,
      trail: []
    };

    this.gk = {
      x: this.W * 0.5,
      y: this.goalY + 26,
      w: 48,
      h: 22,
      minX: this.goalLeft + 32,
      maxX: this.goalRight - 32,
      speed: 195,
      dir: 1,
      stunTimer: 0
    };

    this.defenders = [];
    this.passZone = null;
    this.particles = [];
    this.shockwaves = [];
    this.banner = null;
    this.simTime = 0;
    this.lastFrame = performance.now();
    this.resetRoundTimer = null;

    this.formulas = ['f(θ)=r·cos(t)', 'Δv=9.8m/s', 'NG-XI', '0°', 'λ=0.98', 'ReAl-10'];

    this.bindElements();
    if (this.canvas && this.ctx) {
      this.loadScenario(0);
      this.attachEvents();
      this.loop(performance.now());
    }
  }

  readInt(key, fallback) {
    try {
      const val = parseInt(localStorage.getItem(key) || '', 10);
      return Number.isFinite(val) ? val : fallback;
    } catch {
      return fallback;
    }
  }

  writeInt(key, val) {
    try {
      localStorage.setItem(key, String(val));
    } catch {
      // Ignore storage failures
    }
  }

  bindElements() {
    this.wrapperEl = document.querySelector('#gameSection .game-wrapper');
    this.overlayHint = document.getElementById('gameOverlayText');
    this.scenarioBriefEl = document.getElementById('gameScenarioBrief');
    this.scenarioPills = document.querySelectorAll('.scenario-pill[data-scenario]');

    this.hudScoreVal = document.getElementById('hudScoreVal');
    this.hudStreakVal = document.getElementById('hudStreakVal');
    this.hudBestVal = document.getElementById('hudBestVal');
    this.hudFlowPct = document.getElementById('hudFlowPct');
    this.hudFlowFill = document.getElementById('hudFlowFill');
    this.hudPowerAngle = document.getElementById('hudPowerAngle');

    this.spinSlider = document.getElementById('spinRangeSlider');
    this.spinMeter = document.getElementById('spinMeterDisplay');
    this.spinLeftBtn = document.getElementById('spinLeftBtn');
    this.spinZeroBtn = document.getElementById('spinZeroBtn');
    this.spinRightBtn = document.getElementById('spinRightBtn');
    this.triggerFlowBtn = document.getElementById('triggerFlowBtn');
    this.resetShotBtn = document.getElementById('resetShotBtn');
  }

  attachEvents() {
    this.scenarioPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const idx = parseInt(pill.getAttribute('data-scenario') || '0', 10);
        this.loadScenario(idx);
        this.sfx?.playClick();
      });
    });

    if (this.spinSlider) {
      this.spinSlider.value = String(this.currentSpin);
      this.spinSlider.addEventListener('input', () => {
        this.setSpin(parseInt(this.spinSlider.value, 10));
      });
    }
    this.spinLeftBtn?.addEventListener('click', () => this.adjustSpin(-14));
    this.spinRightBtn?.addEventListener('click', () => this.adjustSpin(14));
    this.spinZeroBtn?.addEventListener('click', () => this.setSpin(0));
    this.triggerFlowBtn?.addEventListener('click', () => this.toggleFlow());
    this.resetShotBtn?.addEventListener('click', () => {
      this.resetBall();
      this.sfx?.playClick();
    });

    const toCanvasCoords = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * this.W,
        y: ((e.clientY - rect.top) / rect.height) * this.H
      };
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.ball.inFlight) return;
      const pos = toCanvasCoords(e);
      const dx = pos.x - this.ball.x;
      const dy = pos.y - this.ball.y;
      if (Math.hypot(dx, dy) <= 95) {
        this.isDragging = true;
        this.activePointerId = e.pointerId;
        this.canvas.setPointerCapture?.(e.pointerId);
        this.updateDrag(pos);
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging || (this.activePointerId !== null && e.pointerId !== this.activePointerId)) return;
      this.updateDrag(toCanvasCoords(e));
    });

    const endDrag = (e) => {
      if (!this.isDragging || (this.activePointerId !== null && e.pointerId !== this.activePointerId)) return;
      this.isDragging = false;
      this.activePointerId = null;
      if (this.dragPull.powerPct >= 14) {
        this.fireBall();
      } else {
        this.dragPull = { dx: 0, dy: 0, powerPct: 0, angleDeg: 0 };
        this.updateHud();
      }
    };

    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    window.addEventListener('keydown', (e) => {
      const activeSec = document.getElementById('gameSection');
      if (!activeSec || !activeSec.classList.contains('active')) return;
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const key = e.key.toLowerCase();
      if (key === 'a' || key === 'q') {
        this.adjustSpin(-10);
      } else if (key === 'd' || key === 'e') {
        this.adjustSpin(10);
      } else if (key === 'r') {
        this.resetBall();
      } else if (key === 'f' || e.code === 'Space') {
        e.preventDefault();
        this.toggleFlow();
      }
    });
  }

  adjustSpin(delta) {
    this.setSpin(this.currentSpin + delta);
    this.sfx?.playClick();
  }

  setSpin(val) {
    this.currentSpin = Math.max(-100, Math.min(100, Math.round(val)));
    if (this.spinSlider) this.spinSlider.value = String(this.currentSpin);
    this.updateHud();
  }

  toggleFlow() {
    if (this.flowActive) {
      this.flowActive = false;
      this.updateHud();
      return;
    }
    if (this.flowCharge < 100) {
      this.showBanner('FLOW НЕ ЗАРЯЖЕНИЙ', 'Забийте або віддайте точний пас (+34%)', '#fbbf24');
      return;
    }
    this.flowActive = true;
    this.sfx?.playPower?.();
    this.showBanner('FLOW: ПРЕКРАСНЕ РУЙНУВАННЯ', 'Точність дуги й пробиття на максимумі', '#00e5c3');
    this.updateHud();
  }

  loadScenario(idx) {
    this.scenarioIndex = Math.max(0, Math.min(4, idx));
    this.scenarioPills.forEach((p) => {
      const active = parseInt(p.getAttribute('data-scenario') || '0', 10) === this.scenarioIndex;
      p.classList.toggle('active', active);
      p.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    const briefs = [
      'STAGE 01 // Нульовий кут (Ch. 115): закрути м’яч лівою ногою з правого флангу в дальній кут.',
      'STAGE 02 // Ювелірний простріл: проведи пас крізь коридор захисників у золоту зону забігання Шідо або прямо у створ.',
      'STAGE 03 // Еластіко + Тривела: обігни подвійну стінку різким боковим крученням.',
      'STAGE 04 // Flow «Прекрасне руйнування»: прорви математично щільну оборону на максимальному темпі.',
      'ENDLESS // Академія Re Al XI: серія прогресивних хвиль з рухомим пресингом.'
    ];
    if (this.scenarioBriefEl) this.scenarioBriefEl.textContent = briefs[this.scenarioIndex];

    this.setupWaveEntities();
    this.resetBall();
  }

  setupWaveEntities() {
    this.defenders = [];
    this.passZone = null;

    if (this.scenarioIndex === 0) {
      // Zero-angle right flank; plenty of bottom/right clearance so 148px pull stays completely inside canvas
      this.spawnPos = { x: 840, y: 425 };
      this.setSpin(-42);
      this.gk.speed = 195;
      this.defenders = [
        { x: 740, y: 245, r: 19, baseX: 740, amp: 38, freq: 1.5, phase: 0, label: 'DF #2' },
        { x: 645, y: 195, r: 19, baseX: 645, amp: 45, freq: 1.8, phase: 1.4, label: 'DF #5' }
      ];
    } else if (this.scenarioIndex === 1) {
      this.spawnPos = { x: 540, y: 495 };
      this.setSpin(24);
      this.gk.speed = 215;
      this.passZone = { x: 660, y: 190, r: 44, label: 'SHIDOU ZONE (+150)' };
      this.defenders = [
        { x: 470, y: 310, r: 20, baseX: 470, amp: 65, freq: 2.0, phase: 0, label: 'MF #4' },
        { x: 615, y: 310, r: 20, baseX: 615, amp: 65, freq: 2.0, phase: Math.PI, label: 'MF #8' }
      ];
    } else if (this.scenarioIndex === 2) {
      this.spawnPos = { x: 315, y: 455 };
      this.setSpin(46);
      this.gk.speed = 235;
      this.defenders = [
        { x: 410, y: 270, r: 20, baseX: 410, amp: 42, freq: 2.1, phase: 0.4, label: 'BL #10' },
        { x: 515, y: 235, r: 20, baseX: 515, amp: 46, freq: 2.3, phase: 1.9, label: 'CB #19' },
        { x: 590, y: 295, r: 19, baseX: 590, amp: 35, freq: 1.7, phase: 0.9, label: 'CDM' }
      ];
    } else if (this.scenarioIndex === 3) {
      this.spawnPos = { x: 760, y: 465 };
      this.setSpin(-38);
      this.gk.speed = 260;
      this.passZone = { x: 420, y: 185, r: 38, label: 'FLOW APEX (+200)' };
      this.defenders = [
        { x: 650, y: 290, r: 20, baseX: 650, amp: 52, freq: 2.4, phase: 0, label: 'HIORI' },
        { x: 540, y: 245, r: 21, baseX: 540, amp: 68, freq: 2.1, phase: 1.1, label: 'ISAGI' },
        { x: 445, y: 280, r: 20, baseX: 445, amp: 50, freq: 2.5, phase: 2.2, label: 'KARASU' }
      ];
    } else {
      const wave = this.endlessWave;
      const sx = 240 + ((wave * 173) % 600);
      const sy = 420 + ((wave * 47) % 85);
      this.spawnPos = { x: sx, y: sy };
      this.gk.speed = Math.min(340, 200 + wave * 14);
      const defCount = Math.min(5, 2 + Math.floor(wave / 2));
      for (let i = 0; i < defCount; i++) {
        const bx = 320 + ((i + 0.5) * 440) / defCount;
        const by = 215 + (i % 2) * 65;
        this.defenders.push({
          x: bx,
          y: by,
          r: 19,
          baseX: bx,
          amp: 42 + (wave % 3) * 14,
          freq: 1.8 + i * 0.35,
          phase: i * 1.3,
          label: `RE AL D${i + 1}`
        });
      }
      if (wave % 2 === 0) {
        this.passZone = { x: this.W - sx * 0.72 + 120, y: 185, r: 40, label: 'TARGET RUN' };
      }
    }
  }

  resetBall() {
    clearTimeout(this.resetRoundTimer);
    this.isDragging = false;
    this.activePointerId = null;
    this.ball.x = this.spawnPos.x;
    this.ball.y = this.spawnPos.y;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.spin = this.currentSpin;
    this.ball.inFlight = false;
    this.ball.resultHandled = false;
    this.ball.hitTargetZone = false;
    this.ball.trail = [];
    this.dragPull = { dx: 0, dy: 0, powerPct: 0, angleDeg: 0 };
    if (this.overlayHint) {
      this.overlayHint.textContent = 'ТЯГНИ ВІД М’ЯЧА НАЗАД ДЛЯ ПРИЦІЛУ (ІНДИКАТОР 100% ЗАВЖДИ В МЕЖАХ ПОЛЯ)';
      this.overlayHint.style.opacity = '1';
    }
    this.updateHud();
  }

  updateDrag(pos) {
    // Pull backward relative to ball: shot fires opposite to pull vector
    let pdx = pos.x - this.ball.x;
    let pdy = pos.y - this.ball.y;
    const rawDist = Math.hypot(pdx, pdy);
    if (rawDist > this.maxPull) {
      const k = this.maxPull / rawDist;
      pdx *= k;
      pdy *= k;
    }
    const clampedDist = Math.min(rawDist, this.maxPull);
    const powerPct = Math.round((clampedDist / this.maxPull) * 100);
    const angleDeg = Math.round((Math.atan2(-pdy, -pdx) * 180) / Math.PI);

    this.dragPull = { dx: pdx, dy: pdy, powerPct, angleDeg };
    this.updateHud();
  }

  fireBall() {
    const speedScale = this.flowActive ? 1140 : 940;
    const mag = Math.max(0.14, this.dragPull.powerPct / 100);
    const pullLen = Math.hypot(this.dragPull.dx, this.dragPull.dy) || 1;
    const dirX = -this.dragPull.dx / pullLen;
    const dirY = -this.dragPull.dy / pullLen;

    this.ball.vx = dirX * speedScale * mag;
    this.ball.vy = dirY * speedScale * mag;
    this.ball.spin = this.currentSpin;
    this.ball.inFlight = true;
    this.ball.resultHandled = false;
    this.ball.trail = [];
    if (this.overlayHint) this.overlayHint.style.opacity = '0';
    this.sfx?.playKick?.();
  }

  updateHud() {
    if (this.hudScoreVal) this.hudScoreVal.textContent = String(this.score);
    if (this.hudStreakVal) this.hudStreakVal.textContent = `${this.streak}x`;
    if (this.hudBestVal) this.hudBestVal.textContent = String(this.bestScore);
    if (this.hudFlowPct) this.hudFlowPct.textContent = `${this.flowCharge}%`;
    if (this.hudFlowFill) this.hudFlowFill.style.width = `${this.flowCharge}%`;

    const rpm = this.currentSpin * 28;
    if (this.spinMeter) {
      this.spinMeter.textContent = `${rpm > 0 ? '+' : ''}${rpm} RPM`;
    }
    if (this.hudPowerAngle) {
      this.hudPowerAngle.textContent = this.isDragging
        ? `СИЛА ${this.dragPull.powerPct}% // КРУТ ${this.currentSpin > 0 ? '+' : ''}${this.currentSpin}%`
        : `ЗАКРУТКА ${this.currentSpin > 0 ? '+' : ''}${this.currentSpin}%`;
    }
    if (this.triggerFlowBtn) {
      this.triggerFlowBtn.classList.toggle('is-armed', this.flowActive);
      this.triggerFlowBtn.textContent = this.flowActive
        ? 'FLOW АКТИВНИЙ: ПРЕКРАСНЕ РУЙНУВАННЯ'
        : 'АКТИВУВАТИ FLOW [F / ПРОБІЛ]';
    }
  }

  showBanner(title, sub, color) {
    this.banner = { title, sub, color, timer: 2.2 };
  }

  spawnExplosion(x, y, color, count = 24) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 260;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.75 + Math.random() * 0.45,
        maxLife: 1.2,
        r: 2 + Math.random() * 3.5,
        color
      });
    }
    this.shockwaves.push({ x, y, r: 8, maxR: 115, color, alpha: 0.9 });
  }

  resolveRound(success, points, title, sub, color) {
    if (this.ball.resultHandled) return;
    this.ball.resultHandled = true;
    this.ball.inFlight = false;

    if (success) {
      this.streak += 1;
      const bonus = this.flowActive ? Math.round(points * 1.5) : points;
      this.score += bonus + this.streak * 25;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        this.writeInt(this.storageBestKey, this.bestScore);
      }
      this.flowCharge = Math.min(100, this.flowCharge + 34);
      if (this.flowActive) {
        this.flowActive = false;
        this.flowCharge = 0;
      }
      if (this.scenarioIndex === 4) this.endlessWave += 1;
      this.spawnExplosion(this.ball.x, this.ball.y, color, 30);
      this.sfx?.playCorrect?.();
    } else {
      this.streak = 0;
      this.flowCharge = Math.min(100, this.flowCharge + 14);
      this.sfx?.playWrong?.();
    }

    this.showBanner(title, sub, color);
    this.updateHud();
    this.resetRoundTimer = setTimeout(() => {
      if (this.scenarioIndex === 4) this.setupWaveEntities();
      this.resetBall();
    }, 1450);
  }

  stepPhysics(dt) {
    this.simTime += dt;

    // Move GK
    this.gk.x += this.gk.speed * this.gk.dir * dt;
    if (this.gk.x > this.gk.maxX) { this.gk.x = this.gk.maxX; this.gk.dir = -1; }
    if (this.gk.x < this.gk.minX) { this.gk.x = this.gk.minX; this.gk.dir = 1; }

    // Move Defenders
    for (const d of this.defenders) {
      d.x = d.baseX + Math.sin(this.simTime * d.freq + d.phase) * d.amp;
    }

    // Banner & particles
    if (this.banner) {
      this.banner.timer -= dt;
      if (this.banner.timer <= 0) this.banner = null;
    }
    this.particles = this.particles.filter((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
      return p.life > 0;
    });
    this.shockwaves = this.shockwaves.filter((s) => {
      s.r += 260 * dt;
      s.alpha -= 1.8 * dt;
      return s.alpha > 0;
    });

    if (!this.ball.inFlight || this.ball.resultHandled) return;

    // Sub-steps for accurate collisions
    const steps = 3;
    const subDt = dt / steps;
    const spinAccel = this.ball.spin * (this.flowActive ? 14.2 : 11.4);

    for (let s = 0; s < steps; s++) {
      // Perpendicular Magnus acceleration relative to velocity vector
      const spd = Math.hypot(this.ball.vx, this.ball.vy) || 1;
      const nx = -this.ball.vy / spd;
      const ny = this.ball.vx / spd;
      this.ball.vx += nx * spinAccel * subDt;
      this.ball.vy += ny * spinAccel * subDt;

      // Air drag
      const drag = Math.pow(0.992, subDt * 60);
      this.ball.vx *= drag;
      this.ball.vy *= drag;

      this.ball.x += this.ball.vx * subDt;
      this.ball.y += this.ball.vy * subDt;
      this.ball.rotAngle += this.ball.spin * 0.14 * subDt;

      // Pass Target Zone Bonus (Stage 02 / Flow / Endless)
      if (this.passZone && !this.ball.hitTargetZone) {
        if (Math.hypot(this.ball.x - this.passZone.x, this.ball.y - this.passZone.y) <= this.passZone.r + this.ball.radius) {
          this.ball.hitTargetZone = true;
          this.spawnExplosion(this.passZone.x, this.passZone.y, '#00e5c3', 18);
          this.resolveRound(true, 260, 'ІДЕАЛЬНИЙ ПРОСТРІЛ!', 'М’яч розрізав пресинг прямо у вікно атаки', '#00e5c3');
          return;
        }
      }

      // Goal Net Check
      if (
        this.ball.y <= this.goalY &&
        this.ball.y >= this.goalY - this.netDepth - 8 &&
        this.ball.x >= this.goalLeft + this.ball.radius &&
        this.ball.x <= this.goalRight - this.ball.radius
      ) {
        const cornerDist = Math.min(this.ball.x - this.goalLeft, this.goalRight - this.ball.x);
        const isTopCorner = cornerDist < 68;
        this.resolveRound(
          true,
          isTopCorner ? 300 : 200,
          isTopCorner ? 'ШЕДЕВР У ДЕВ’ЯТКУ!' : 'ГОЛ RE AL № 10!',
          isTopCorner ? 'Траєкторія ідеально лягла під саму стійку' : 'Воротар безсилий проти підкрутки Сае',
          '#eab308'
        );
        return;
      }

      // Goal Posts Bounce
      const posts = [{ x: this.goalLeft, y: this.goalY }, { x: this.goalRight, y: this.goalY }];
      for (const post of posts) {
        const dx = this.ball.x - post.x;
        const dy = this.ball.y - post.y;
        const dist = Math.hypot(dx, dy);
        if (dist < this.ball.radius + 7 && dist > 0) {
          const ux = dx / dist;
          const uy = dy / dist;
          const dot = this.ball.vx * ux + this.ball.vy * uy;
          this.ball.vx -= 1.8 * dot * ux;
          this.ball.vy -= 1.8 * dot * uy;
          this.ball.x = post.x + ux * (this.ball.radius + 8);
          this.ball.y = post.y + uy * (this.ball.radius + 8);
        }
      }

      // GK Interception (Flow empowers shot to curve past near edges more forgivingly)
      const gkHalfW = this.gk.w * 0.5;
      const gkHalfH = this.gk.h * 0.5;
      if (
        Math.abs(this.ball.x - this.gk.x) < gkHalfW + this.ball.radius * 0.85 &&
        Math.abs(this.ball.y - this.gk.y) < gkHalfH + this.ball.radius * 0.85
      ) {
        this.resolveRound(false, 0, 'СЕЙВ ВОРОТАРЯ', 'Закрути сильніше у вільний кут', '#ff2a5f');
        return;
      }

      // Defenders Interception
      for (const d of this.defenders) {
        if (Math.hypot(this.ball.x - d.x, this.ball.y - d.y) < d.r + this.ball.radius - 2) {
          this.resolveRound(false, 0, 'ПЕРЕХОПЛЕННЯ ЗАХИСТОМ', 'Обігни стінку тривелою або зміни кут', '#ff2a5f');
          return;
        }
      }

      // Out of Bounds / Stopped
      if (
        this.ball.x < -25 || this.ball.x > this.W + 25 ||
        this.ball.y < -30 || this.ball.y > this.H + 30 ||
        spd < 42
      ) {
        this.resolveRound(false, 0, 'МІМО СТВОРУ', 'Спробуй скоригувати силу та обертання RPM', '#94a3b8');
        return;
      }
    }

    this.ball.trail.push({ x: this.ball.x, y: this.ball.y });
    if (this.ball.trail.length > 34) this.ball.trail.shift();
  }

  predictTrajectory() {
    const speedScale = this.flowActive ? 1140 : 940;
    const mag = Math.max(0.14, this.dragPull.powerPct / 100);
    const pullLen = Math.hypot(this.dragPull.dx, this.dragPull.dy) || 1;
    let vx = (-this.dragPull.dx / pullLen) * speedScale * mag;
    let vy = (-this.dragPull.dy / pullLen) * speedScale * mag;
    let px = this.ball.x;
    let py = this.ball.y;
    const spinAccel = this.currentSpin * (this.flowActive ? 14.2 : 11.4);
    const pts = [];
    const dt = 0.032;

    for (let i = 0; i < 20; i++) {
      const spd = Math.hypot(vx, vy) || 1;
      vx += (-vy / spd) * spinAccel * dt;
      vy += (vx / spd) * spinAccel * dt;
      px += vx * dt;
      py += vy * dt;
      if (px < 12 || px > this.W - 12 || py < 12 || py > this.H - 12) break;
      pts.push({ x: px, y: py });
    }
    return pts;
  }

  drawPitch() {
    const ctx = this.ctx;
    ctx.fillStyle = this.flowActive ? '#0c0512' : '#06090e';
    ctx.fillRect(0, 0, this.W, this.H);

    // Subtle pitch grid
    ctx.strokeStyle = this.flowActive ? 'rgba(255, 42, 95, 0.12)' : 'rgba(0, 229, 195, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H); ctx.stroke();
    }
    for (let y = 0; y <= this.H; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
    }

    // Floating mathematical numbers on pitch in Flow
    if (this.flowActive) {
      ctx.font = '700 13px "Exo 2", sans-serif';
      ctx.fillStyle = 'rgba(0, 229, 195, 0.22)';
      this.formulas.forEach((f, idx) => {
        const fx = 90 + ((idx * 175 + Math.sin(this.simTime + idx) * 28) % 900);
        const fy = 150 + ((idx * 95) % 450);
        ctx.fillText(f, fx, fy);
      });
    }

    // Penalty Box & Touchlines
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, this.goalY, this.W - 48, this.H - this.goalY - 24);
    ctx.strokeRect(this.W * 0.5 - 270, this.goalY, 540, 220);

    // Goal Net
    ctx.fillStyle = 'rgba(225, 29, 72, 0.14)';
    ctx.fillRect(this.goalLeft, this.goalY - this.netDepth, this.goalW, this.netDepth);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.goalLeft, this.goalY - this.netDepth, this.goalW, this.netDepth);
  }

  drawEntities() {
    const ctx = this.ctx;

    // Pass Target Zone
    if (this.passZone) {
      const pulse = 1 + 0.08 * Math.sin(this.simTime * 5);
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.passZone.x, this.passZone.y, this.passZone.r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 229, 195, 0.14)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = '#00e5c3';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '800 11px "Exo 2", sans-serif';
      ctx.fillStyle = '#99f6e4';
      ctx.textAlign = 'center';
      ctx.fillText(this.passZone.label, this.passZone.x, this.passZone.y - this.passZone.r - 10);
      ctx.restore();
    }

    // GK
    ctx.fillStyle = '#eab308';
    ctx.fillRect(this.gk.x - this.gk.w / 2, this.gk.y - this.gk.h / 2, this.gk.w, this.gk.h);
    ctx.strokeStyle = '#060409';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.gk.x - this.gk.w / 2, this.gk.y - this.gk.h / 2, this.gk.w, this.gk.h);

    // Defenders
    for (const d of this.defenders) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ff2a5f';
      ctx.stroke();
      ctx.font = '700 10px "Exo 2", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, d.x, d.y + 4);
    }

    // Drag Aiming Ring + Trajectory Preview (CLAMPED cleanly inside canvas!)
    if (this.isDragging && this.dragPull.powerPct > 0) {
      const pts = this.predictTrajectory();
      pts.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2, 4.5 - i * 0.14), 0, Math.PI * 2);
        ctx.fillStyle = this.flowActive
          ? `rgba(0, 229, 195, ${0.85 - i * 0.035})`
          : `rgba(234, 179, 8, ${0.85 - i * 0.035})`;
        ctx.fill();
      });

      const hx = Math.max(28, Math.min(this.W - 28, this.ball.x + this.dragPull.dx));
      const hy = Math.max(28, Math.min(this.H - 28, this.ball.y + this.dragPull.dy));

      ctx.strokeStyle = '#00e5c3';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(this.ball.x, this.ball.y);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      // Clamped Handle Circle
      ctx.beginPath();
      ctx.arc(hx, hy, 12, 0, Math.PI * 2);
      ctx.fillStyle = this.dragPull.powerPct >= 95 ? '#ff2a5f' : '#00e5c3';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Power Pill inside safe canvas viewport margin
      const labelX = Math.max(76, Math.min(this.W - 76, hx));
      const labelY = hy > this.H - 58 ? hy - 26 : hy + 28;
      ctx.fillStyle = 'rgba(8, 5, 12, 0.92)';
      ctx.fillRect(labelX - 56, labelY - 12, 112, 22);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1;
      ctx.strokeRect(labelX - 56, labelY - 12, 112, 22);
      ctx.font = '800 12px "Exo 2", sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText(`СИЛА: ${this.dragPull.powerPct}%`, labelX, labelY + 3);
    }

    // Ball Trail
    for (let i = 1; i < this.ball.trail.length; i++) {
      const p0 = this.ball.trail[i - 1];
      const p1 = this.ball.trail[i];
      const t = i / this.ball.trail.length;
      ctx.strokeStyle = this.flowActive
        ? `rgba(255, 42, 95, ${t * 0.85})`
        : `rgba(0, 229, 195, ${t * 0.78})`;
      ctx.lineWidth = 2 + t * 8;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    // Ball
    ctx.save();
    ctx.translate(this.ball.x, this.ball.y);
    ctx.rotate(this.ball.rotAngle);
    ctx.beginPath();
    ctx.arc(0, 0, this.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.flowActive ? '#ff2a5f' : '#00e5c3';
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();

    // Shockwaves & Particles
    for (const sw of this.shockwaves) {
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = Math.max(0, sw.alpha);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Result Banner
    if (this.banner) {
      ctx.fillStyle = 'rgba(8, 5, 12, 0.9)';
      ctx.fillRect(this.W / 2 - 220, this.H / 2 - 44, 440, 88);
      ctx.strokeStyle = this.banner.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(this.W / 2 - 220, this.H / 2 - 44, 440, 88);
      ctx.textAlign = 'center';
      ctx.font = '800 22px "Unbounded", sans-serif';
      ctx.fillStyle = this.banner.color;
      ctx.fillText(this.banner.title, this.W / 2, this.H / 2 - 4);
      ctx.font = '600 13px "Exo 2", sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(this.banner.sub, this.W / 2, this.H / 2 + 24);
    }
  }

  loop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.stepPhysics(dt);
    this.drawPitch();
    this.drawEntities();
    requestAnimationFrame((t) => this.loop(t));
  }
}
