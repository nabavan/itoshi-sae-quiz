/* ==========================================================================
   BLUE LOCK // ITOSHI SAE METAVISION LAB & PLAYMAKER TELEMETRY PROFILE
   ========================================================================== */
'use strict';

class PlaymakerProfileManager {
  constructor() {
    this.storageKey = 'sae_playmaker_profile_v1';
    this.data = this.load();
  }

  load() {
    const base = {
      quizBestScore: 0,
      quizBestTotal: 20,
      duelBestAcc: 0,
      duelWins: 0,
      voicesPlayedIds: [],
      labSolvedIds: []
    };
    try {
      const raw = window.localStorage?.getItem(this.storageKey);
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      return {
        quizBestScore: Number(parsed.quizBestScore) || 0,
        quizBestTotal: Number(parsed.quizBestTotal) || 20,
        duelBestAcc: Number(parsed.duelBestAcc) || 0,
        duelWins: Number(parsed.duelWins) || 0,
        voicesPlayedIds: Array.isArray(parsed.voicesPlayedIds) ? [...new Set(parsed.voicesPlayedIds)] : [],
        labSolvedIds: Array.isArray(parsed.labSolvedIds) ? [...new Set(parsed.labSolvedIds)] : []
      };
    } catch {
      return base;
    }
  }

  save() {
    try {
      window.localStorage?.setItem(this.storageKey, JSON.stringify(this.data));
    } catch {
      // Ignore private-mode storage restrictions gracefully
    }
  }

  recordQuiz(score, total = 20) {
    if (score >= this.data.quizBestScore) {
      this.data.quizBestScore = score;
      this.data.quizBestTotal = total;
    }
    this.save();
    this.renderHud();
  }

  recordDuel(accPct, won) {
    const cleanAcc = Math.max(0, Math.min(100, Number(accPct) || 0));
    if (cleanAcc > this.data.duelBestAcc) {
      this.data.duelBestAcc = cleanAcc;
    }
    if (won) {
      this.data.duelWins += 1;
    }
    this.save();
    this.renderHud();
  }

  recordVoice(voiceId) {
    if (!voiceId) return;
    if (!this.data.voicesPlayedIds.includes(voiceId)) {
      this.data.voicesPlayedIds.push(voiceId);
      this.save();
      this.renderHud();
    }
  }

  recordLabSolve(scenarioId) {
    if (!scenarioId || scenarioId === 'lab04_sandbox') return;
    if (!this.data.labSolvedIds.includes(scenarioId)) {
      this.data.labSolvedIds.push(scenarioId);
      this.save();
      this.renderHud();
    }
  }

  getClearanceStats() {
    const voiceTotal = typeof SAE_VOICE_CLIPS !== 'undefined' ? SAE_VOICE_CLIPS.length : 7;
    const labTotal = 3;
    const quizPct = this.data.quizBestTotal > 0 ? this.data.quizBestScore / this.data.quizBestTotal : 0;
    const duelPct = this.data.duelWins > 0 ? Math.max(0.6, this.data.duelBestAcc / 100) : (this.data.duelBestAcc / 120);
    const voicePct = Math.min(1, this.data.voicesPlayedIds.length / voiceTotal);
    const labPct = Math.min(1, this.data.labSolvedIds.length / labTotal);

    const syncPct = Math.round((quizPct * 0.30 + Math.min(1, duelPct) * 0.25 + voicePct * 0.15 + labPct * 0.30) * 100);

    let rank = 'ACADEMY OBSERVER';
    if (syncPct >= 90) rank = 'NEW GEN WORLD XI // PERFECT';
    else if (syncPct >= 65) rank = 'RE AL PLAYMAKER CORE';
    else if (syncPct >= 35) rank = 'U-20 TACTICAL STARTER';
    else if (syncPct > 0) rank = 'BLUE LOCK CHALLENGER';

    return {
      syncPct,
      rank,
      quizLabel: this.data.quizBestScore > 0 ? `${this.data.quizBestScore} / ${this.data.quizBestTotal}` : 'НЕ ПРОЙДЕНО',
      duelLabel: this.data.duelWins > 0
        ? `${this.data.duelBestAcc.toFixed(1)}% · ${this.data.duelWins} W`
        : (this.data.duelBestAcc > 0 ? `${this.data.duelBestAcc.toFixed(1)}%` : 'Через Дзвінок'),
      voicesLabel: `${this.data.voicesPlayedIds.length} / ${voiceTotal}`,
      labLabel: `${this.data.labSolvedIds.length} / ${labTotal}`
    };
  }

  renderHud() {
    const st = this.getClearanceStats();
    document.querySelectorAll('[data-profile-rank]').forEach((el) => { el.textContent = st.rank; });
    document.querySelectorAll('[data-profile-sync]').forEach((el) => { el.textContent = `${st.syncPct}%`; });
    document.querySelectorAll('[data-profile-quiz]').forEach((el) => { el.textContent = st.quizLabel; });
    document.querySelectorAll('[data-profile-duel]').forEach((el) => { el.textContent = st.duelLabel; });
    document.querySelectorAll('[data-profile-voices]').forEach((el) => { el.textContent = st.voicesLabel; });
    document.querySelectorAll('[data-profile-lab]').forEach((el) => { el.textContent = st.labLabel; });
    document.querySelectorAll('[data-profile-bar]').forEach((el) => { el.style.width = `${Math.max(4, st.syncPct)}%`; });
  }
}

class MetavisionPitchLab {
  constructor(canvas, sfx, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.sfx = sfx;
    this.callbacks = callbacks;

    this.logicalW = 1000;
    this.logicalH = 560;
    this.scenarios = typeof SAE_LAB_SCENARIOS !== 'undefined' ? SAE_LAB_SCENARIOS : [];
    this.activeScenario = this.scenarios[0] || null;
    this.defenders = [];
    this.aim = { x: 944, y: 292 };
    this.curve = -0.15;
    this.power = 68;

    this.dragTarget = null;
    this.animating = false;
    this.simStartMs = 0;
    this.simResult = null;
    this.rafId = null;
    this.isActiveSection = false;
    this.pulsePhase = 0;
    this.reducedMotion = Boolean(
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    this.els = {
      tabs: document.getElementById('labScenarioTabs'),
      code: document.getElementById('labCaseCode'),
      title: document.getElementById('labCaseTitle'),
      subtitle: document.getElementById('labCaseSubtitle'),
      hint: document.getElementById('labCaseHint'),
      curveInput: document.getElementById('labCurveInput'),
      curveVal: document.getElementById('labCurveVal'),
      powerInput: document.getElementById('labPowerInput'),
      powerVal: document.getElementById('labPowerVal'),
      mAngle: document.getElementById('labMetricAngle'),
      mLen: document.getElementById('labMetricLen'),
      mClear: document.getElementById('labMetricClearance'),
      mXg: document.getElementById('labMetricXg'),
      execBtn: document.getElementById('labExecuteBtn'),
      optBtn: document.getElementById('labOptimalBtn'),
      resetBtn: document.getElementById('labResetBtn'),
      verdictBox: document.getElementById('labVerdictBox'),
      verdictBadge: document.getElementById('labVerdictBadge'),
      verdictText: document.getElementById('labVerdictText')
    };

    if (this.canvas && this.ctx && this.activeScenario) {
      this.initControls();
      this.loadScenario(this.activeScenario.id, false);
      this.syncCanvasDpr();
    }
  }

  syncCanvasDpr() {
    if (!this.canvas || !this.ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const targetW = Math.round(this.logicalW * dpr);
    const targetH = Math.round(this.logicalH * dpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  initControls() {
    if (this.els.tabs) {
      this.els.tabs.textContent = '';
      this.scenarios.forEach((sc, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `lab-case-btn${idx === 0 ? ' active' : ''}`;
        btn.setAttribute('data-lab-id', sc.id);
        btn.innerHTML = `<span class="lab-case-code">${sc.code}</span><strong>${sc.title}</strong>`;
        btn.addEventListener('click', () => {
          this.sfx?.playClick();
          this.loadScenario(sc.id, true);
        });
        this.els.tabs.appendChild(btn);
      });
    }

    this.els.curveInput?.addEventListener('input', () => {
      this.curve = parseFloat(this.els.curveInput.value) || 0;
      this.animating = false;
      this.simResult = null;
      this.updateLiveReadout();
      this.drawFrame(0);
    });

    this.els.powerInput?.addEventListener('input', () => {
      this.power = parseFloat(this.els.powerInput.value) || 75;
      this.animating = false;
      this.simResult = null;
      this.updateLiveReadout();
      this.drawFrame(0);
    });

    this.els.execBtn?.addEventListener('click', () => this.executeSimulation());
    this.els.optBtn?.addEventListener('click', () => this.applyOptimalSetup());
    this.els.resetBtn?.addEventListener('click', () => {
      if (this.activeScenario) this.loadScenario(this.activeScenario.id, true);
    });

    const getCanvasCoords = (evt) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: Math.max(40, Math.min(970, ((evt.clientX - rect.left) / rect.width) * this.logicalW)),
        y: Math.max(36, Math.min(524, ((evt.clientY - rect.top) / rect.height) * this.logicalH))
      };
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      const pt = getCanvasCoords(e);
      if (this.activeScenario?.mode === 'sandbox') {
        const hitDef = this.defenders.find((d) => Math.hypot(d.x - pt.x, d.y - pt.y) <= d.r + 16);
        if (hitDef) {
          this.dragTarget = { type: 'def', def: hitDef };
          this.canvas.setPointerCapture?.(e.pointerId);
          return;
        }
      }
      this.dragTarget = { type: 'aim' };
      this.aim.x = pt.x;
      this.aim.y = pt.y;
      this.animating = false;
      this.simResult = null;
      this.canvas.setPointerCapture?.(e.pointerId);
      this.updateLiveReadout();
      this.drawFrame(0);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.dragTarget) return;
      const pt = getCanvasCoords(e);
      if (this.dragTarget.type === 'def' && this.dragTarget.def) {
        this.dragTarget.def.x = Math.max(240, Math.min(900, pt.x));
        this.dragTarget.def.y = Math.max(70, Math.min(490, pt.y));
      } else {
        this.aim.x = pt.x;
        this.aim.y = pt.y;
      }
      this.updateLiveReadout();
      this.drawFrame(0);
    });

    const release = (e) => {
      if (this.dragTarget) {
        this.dragTarget = null;
        this.canvas.releasePointerCapture?.(e.pointerId);
      }
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
  }

  loadScenario(id, playSfx = false) {
    const sc = this.scenarios.find((s) => s.id === id) || this.scenarios[0];
    if (!sc) return;
    if (playSfx) this.sfx?.playClick();
    this.activeScenario = sc;
    this.defenders = sc.defenders.map((d) => ({ ...d }));
    this.aim = { x: sc.defaultAim.x, y: sc.defaultAim.y };
    this.curve = sc.defaultCurve;
    this.power = sc.defaultPower;
    this.animating = false;
    this.simResult = null;

    if (this.els.curveInput) this.els.curveInput.value = String(this.curve);
    if (this.els.powerInput) this.els.powerInput.value = String(this.power);

    this.els.tabs?.querySelectorAll('.lab-case-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lab-id') === sc.id);
    });

    if (this.els.code) this.els.code.textContent = sc.code;
    if (this.els.title) this.els.title.textContent = sc.title;
    if (this.els.subtitle) this.els.subtitle.textContent = sc.subtitle;
    if (this.els.hint) this.els.hint.textContent = sc.hint;
    if (this.els.verdictBox) {
      this.els.verdictBox.className = 'lab-verdict-box is-idle';
      this.els.verdictBadge.textContent = 'READY // ОЧІКУВАННЯ ЗАПУСКУ';
      this.els.verdictText.textContent = 'Налаштуй точку прицілу та параметри підкрутки й натисни «Запустити траєкторію».';
    }

    this.updateLiveReadout();
    this.drawFrame(0);
  }

  applyOptimalSetup() {
    if (!this.activeScenario?.optimalSolution) return;
    const opt = this.activeScenario.optimalSolution;
    this.aim = { x: opt.aimX, y: opt.aimY };
    this.curve = opt.curve;
    this.power = opt.power;
    if (this.els.curveInput) this.els.curveInput.value = String(this.curve);
    if (this.els.powerInput) this.els.powerInput.value = String(this.power);
    this.sfx?.playPower?.();
    this.updateLiveReadout();
    this.executeSimulation();
  }

  computeControlPoint(p0, p2, curveVal) {
    const dx = p2.x - p0.x;
    const dy = p2.y - p0.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / dist;
    const ny = dx / dist;
    const bend = curveVal * Math.min(210, dist * 0.45);
    return {
      x: (p0.x + p2.x) * 0.5 + nx * bend,
      y: (p0.y + p2.y) * 0.5 + ny * bend,
      dist
    };
  }

  evalBezier(p0, p1, p2, t) {
    const inv = 1 - t;
    return {
      x: inv * inv * p0.x + 2 * inv * t * p1.x + t * t * p2.x,
      y: inv * inv * p0.y + 2 * inv * t * p1.y + t * t * p2.y
    };
  }

  evaluateTrajectory(curve = this.curve, power = this.power, aim = this.aim) {
    const sc = this.activeScenario;
    if (!sc) return null;
    const p0 = sc.saePos;
    const p2 = aim;
    const p1 = this.computeControlPoint(p0, p2, curve);

    const samples = [];
    let arcLen = 0;
    let prev = p0;
    const steps = 60;
    let minDefMargin = 999;
    let blockedAtT = null;
    let blockedBy = null;
    let outOfBounds = false;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pt = this.evalBezier(p0, p1, p2, t);
      arcLen += Math.hypot(pt.x - prev.x, pt.y - prev.y);
      prev = pt;
      samples.push({ t, x: pt.x, y: pt.y });

      if (t > 0.05 && t < 0.99 && (pt.x > 955 || pt.x < 35 || pt.y < 32 || pt.y > 528)) {
        outOfBounds = true;
      }

      for (const df of this.defenders) {
        const margin = Math.hypot(pt.x - df.x, pt.y - df.y) - df.r;
        if (margin < minDefMargin) minDefMargin = margin;
        if (margin < 0 && blockedAtT === null) {
          blockedAtT = t;
          blockedBy = df.label;
        }
      }

      if (sc.gk) {
        const gkMargin = Math.hypot(pt.x - sc.gk.x, pt.y - sc.gk.y) - sc.gk.reach;
        if (gkMargin < 0 && (sc.mode === 'shot' || sc.mode === 'sandbox') && blockedAtT === null) {
          blockedAtT = t;
          blockedBy = sc.gk.label;
        }
        if (gkMargin < minDefMargin) minDefMargin = gkMargin;
      }
    }

    const ballSpeed = 300 + power * 2.2;
    const flightSec = arcLen / Math.max(120, ballSpeed);

    let runnerEnd = null;
    let runnerDist = 999;
    if (sc.runner) {
      runnerEnd = {
        x: Math.min(930, sc.runner.startX + sc.runner.vx * flightSec),
        y: Math.max(50, Math.min(510, sc.runner.startY + sc.runner.vy * flightSec))
      };
      runnerDist = Math.hypot(p2.x - runnerEnd.x, p2.y - runnerEnd.y);
    }

    const inGoalY = p2.y >= sc.goal.topY + 4 && p2.y <= sc.goal.botY - 4;
    const inGoalX = p2.x >= sc.goal.x - 10;
    const inGoal = inGoalX && inGoalY;

    let passed = false;
    let reason = '';
    if (outOfBounds) {
      passed = false;
      reason = 'Траєкторія виходить за межі поля — зменш кут відхилення або силу закрутки.';
    } else if (blockedAtT !== null) {
      passed = false;
      reason = `М’яч перехоплює ${blockedBy} на ${(blockedAtT * 100).toFixed(0)}% траєкторії. Обігни його зону перехоплення.`;
    } else if (sc.mode === 'shot') {
      if (!inGoal) {
        passed = false;
        reason = 'Удар йде повз площину воріт (орієнтуй ціль у дальню сітку x ≥ 940, y ∈ [218..342]).';
      } else {
        passed = true;
        reason = 'Бездоганна тривела/кручений удар в обхід стінки й рукавиць Ґаґамару — гол із нульового кута!';
      }
    } else if (sc.mode === 'pass') {
      if (runnerDist > sc.runner.catchRadius) {
        passed = false;
        reason = `${sc.runner.label} не встигає на м’яч (відхилення ${Math.round(runnerDist)}px) — веди пас у точку його майбутнього ривка.`;
      } else {
        passed = true;
        reason = `Ідеальне синхронування з ривком ${sc.runner.label} — пас у «найкраще майбутнє» вирізає оборону!`;
      }
    } else {
      passed = blockedAtT === null && !outOfBounds && (inGoal || runnerDist <= (sc.runner?.catchRadius || 45));
      reason = passed
        ? 'Чистий розрахунковий коридор Metavision підтверджено.'
        : 'Коридор вільний, або поціль у рамку/нападника для фіксації гольового xG.';
    }

    // Compute tactical xG %
    const clearScore = Math.max(0, Math.min(1, (minDefMargin + 12) / 52));
    const speedScore = Math.max(0.35, Math.min(1, power / 90));
    let targetScore = 0.55;
    if (sc.mode === 'shot') {
      const postDist = inGoal ? Math.max(Math.abs(p2.y - sc.gk.y) / 90, 0.55) : 0.08;
      targetScore = Math.min(1, postDist);
    } else if (sc.runner) {
      targetScore = Math.max(0.1, Math.min(1, 1 - Math.max(0, runnerDist - 12) / 140));
    }
    const xgPct = Math.max(4, Math.min(98, Math.round((blockedAtT !== null || outOfBounds ? 0.14 : 1) * clearScore * 44 + targetScore * 38 + speedScore * 16)));

    const launchAngleRad = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const launchDeg = Math.round((launchAngleRad * 180) / Math.PI);

    return {
      p0, p1, p2,
      samples,
      arcLen: Math.round(arcLen),
      flightSec,
      minDefMargin: Math.round(minDefMargin),
      blockedAtT,
      blockedBy,
      outOfBounds,
      runnerEnd,
      runnerDist: Math.round(runnerDist),
      passed,
      xgPct,
      launchDeg,
      reason
    };
  }

  updateLiveReadout() {
    const evalData = this.evaluateTrajectory();
    if (!evalData) return;
    if (this.els.curveVal) {
      const sign = this.curve > 0.02 ? '+' : '';
      this.els.curveVal.textContent = `${sign}${this.curve.toFixed(2)}`;
    }
    if (this.els.powerVal) this.els.powerVal.textContent = `${Math.round(this.power)}%`;
    if (this.els.mAngle) this.els.mAngle.textContent = `${evalData.launchDeg}°`;
    if (this.els.mLen) this.els.mLen.textContent = `${(evalData.arcLen * 0.045).toFixed(1)} м`;
    if (this.els.mClear) {
      const c = evalData.minDefMargin;
      this.els.mClear.textContent = c >= 0 ? `+${c} cm CLEAN` : `${c} cm RISK`;
      this.els.mClear.style.color = c >= 8 ? '#00e5c3' : (c >= 0 ? '#fde047' : '#ff4d6d');
    }
    if (this.els.mXg) {
      this.els.mXg.textContent = `${evalData.xgPct}%`;
      this.els.mXg.style.color = evalData.xgPct >= 70 ? '#00e5c3' : (evalData.xgPct >= 40 ? '#fde047' : '#ff4d6d');
    }
  }

  executeSimulation() {
    if (!this.activeScenario) return;
    this.syncCanvasDpr();
    this.simResult = this.evaluateTrajectory();
    this.animating = true;
    this.simStartMs = performance.now();
    this.sfx?.playPower?.();

    if (this.reducedMotion) {
      this.finishSimulation(this.simResult);
      this.drawFrame(1);
      return;
    }

    if (!this.rafId) {
      this.startLoop();
    }
  }

  finishSimulation(evalData) {
    this.animating = false;
    if (!evalData || !this.activeScenario) return;
    if (this.els.verdictBox) {
      this.els.verdictBox.className = `lab-verdict-box ${evalData.passed ? 'is-pass' : 'is-fail'}`;
      this.els.verdictBadge.textContent = evalData.passed
        ? `METAVISION SOLVED · xG ${evalData.xgPct}%`
        : `INTERCEPTED / MISS · xG ${evalData.xgPct}%`;
      this.els.verdictText.textContent = evalData.reason;
    }
    if (evalData.passed) {
      this.sfx?.playCorrect?.();
      this.callbacks.onScenarioSolved?.(this.activeScenario.id, evalData.xgPct);
    } else {
      this.sfx?.playWrong?.();
    }
  }

  onActivate() {
    this.isActiveSection = true;
    this.syncCanvasDpr();
    this.drawFrame(this.animating ? 0.5 : 0);
    if (!this.reducedMotion && !this.rafId) {
      this.startLoop();
    }
  }

  onDeactivate() {
    this.isActiveSection = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  startLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    const tick = (now) => {
      if (!this.isActiveSection && !this.animating) {
        this.rafId = null;
        return;
      }
      this.pulsePhase += 0.032;
      let animT = 0;
      if (this.animating && this.simResult) {
        const elapsedSec = (now - this.simStartMs) / 1000;
        const duration = Math.max(0.65, this.simResult.flightSec);
        animT = Math.min(1, elapsedSec / duration);
        const stopT = this.simResult.blockedAtT !== null ? this.simResult.blockedAtT : 1;
        const clampedT = Math.min(stopT, animT);
        this.drawFrame(clampedT);
        if (animT >= stopT) {
          this.finishSimulation(this.simResult);
          this.drawFrame(stopT);
        }
      } else {
        this.drawFrame(this.simResult ? (this.simResult.blockedAtT ?? 1) : 0);
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  drawFrame(ballProgress = 0) {
    if (!this.ctx || !this.activeScenario) return;
    const ctx = this.ctx;
    const W = this.logicalW;
    const H = this.logicalH;
    const sc = this.activeScenario;
    const ev = this.evaluateTrajectory();

    ctx.clearRect(0, 0, W, H);

    // Background tactical pitch
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#040a11');
    bgGrad.addColorStop(0.55, '#07141d');
    bgGrad.addColorStop(1, '#0d0914');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle tactical grid
    ctx.strokeStyle = 'rgba(0, 229, 195, 0.06)';
    ctx.lineWidth = 1;
    for (let gx = 40; gx <= 960; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 32); ctx.lineTo(gx, H - 32); ctx.stroke();
    }
    for (let gy = 32; gy <= H - 32; gy += 40) {
      ctx.beginPath(); ctx.moveTo(40, gy); ctx.lineTo(948, gy); ctx.stroke();
    }

    // Outer boundary & markings
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.34)';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 32, 908, H - 64);

    // Penalty box & 6-yard box & penalty arc
    ctx.strokeRect(760, 118, 188, 324);
    ctx.strokeRect(884, 188, 64, 184);
    ctx.beginPath();
    ctx.arc(822, 280, 74, Math.PI * 0.65, Math.PI * 1.35);
    ctx.stroke();

    // Goal frame & net
    ctx.fillStyle = 'rgba(0, 229, 195, 0.08)';
    ctx.fillRect(948, sc.goal.topY, 24, sc.goal.botY - sc.goal.topY);
    ctx.strokeStyle = '#00e5c3';
    ctx.lineWidth = 3;
    ctx.strokeRect(948, sc.goal.topY, 24, sc.goal.botY - sc.goal.topY);

    // Trajectory geometric sightlines (Metavision triangles)
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sc.saePos.x, sc.saePos.y);
    ctx.lineTo(ev.p1.x, ev.p1.y);
    ctx.lineTo(ev.p2.x, ev.p2.y);
    ctx.stroke();
    ctx.restore();

    // Predicted trajectory Bezier
    ctx.save();
    const laneGood = ev.blockedAtT === null && !ev.outOfBounds && (sc.mode !== 'shot' || ev.passed);
    ctx.strokeStyle = laneGood ? 'rgba(0, 229, 195, 0.85)' : 'rgba(244, 63, 94, 0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(sc.saePos.x, sc.saePos.y);
    ctx.quadraticCurveTo(ev.p1.x, ev.p1.y, ev.p2.x, ev.p2.y);
    ctx.stroke();
    ctx.restore();

    // Defender radar & nodes
    this.defenders.forEach((df) => {
      // Interception radius
      ctx.beginPath();
      ctx.arc(df.x, df.y, df.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(225, 29, 72, 0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Player core dot
      ctx.beginPath();
      ctx.arc(df.x, df.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#9f1239';
      ctx.fill();
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '800 10px "Exo 2", sans-serif';
      ctx.fillStyle = '#ffe4e6';
      ctx.textAlign = 'center';
      ctx.fillText(df.label, df.x, df.y - 18);
    });

    // Goalkeeper
    if (sc.gk) {
      ctx.beginPath();
      ctx.arc(sc.gk.x, sc.gk.y, sc.gk.reach, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(234, 179, 8, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sc.gk.x, sc.gk.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#ca8a04';
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '800 10px "Exo 2", sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText(sc.gk.label, sc.gk.x - 16, sc.gk.y - 18);
    }

    // Runner teammate (future pocket projection + current position)
    if (sc.runner && ev.runnerEnd) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(0, 229, 195, 0.55)';
      ctx.beginPath();
      ctx.moveTo(sc.runner.startX, sc.runner.startY);
      ctx.lineTo(ev.runnerEnd.x, ev.runnerEnd.y);
      ctx.stroke();
      ctx.restore();

      // Ghost catch zone
      ctx.beginPath();
      ctx.arc(ev.runnerEnd.x, ev.runnerEnd.y, sc.runner.catchRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 229, 195, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const tMove = this.animating || this.simResult ? ballProgress : 0;
      const rx = sc.runner.startX + (ev.runnerEnd.x - sc.runner.startX) * (this.animating || this.simResult ? tMove / Math.max(0.01, ev.blockedAtT ?? 1) : 0);
      const ry = sc.runner.startY + (ev.runnerEnd.y - sc.runner.startY) * (this.animating || this.simResult ? tMove / Math.max(0.01, ev.blockedAtT ?? 1) : 0);
      const drawRx = (this.animating || this.simResult) ? Math.min(930, rx) : sc.runner.startX;
      const drawRy = (this.animating || this.simResult) ? ry : sc.runner.startY;

      ctx.beginPath();
      ctx.arc(drawRx, drawRy, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#0f766e';
      ctx.fill();
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '800 10px "Exo 2", sans-serif';
      ctx.fillStyle = '#99f6e4';
      ctx.textAlign = 'center';
      ctx.fillText(sc.runner.label, drawRx, drawRy - 18);
    }

    // Target aim reticle
    const pulseR = 12 + (this.reducedMotion ? 0 : Math.sin(this.pulsePhase * 2) * 2.5);
    ctx.beginPath();
    ctx.arc(ev.p2.x, ev.p2.y, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ev.p2.x, ev.p2.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fde047';
    ctx.fill();

    // Intersection marker if blocked
    if (ev.blockedAtT !== null) {
      const bPt = this.evalBezier(ev.p0, ev.p1, ev.p2, ev.blockedAtT);
      ctx.strokeStyle = '#ff2a5f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bPt.x - 8, bPt.y - 8); ctx.lineTo(bPt.x + 8, bPt.y + 8);
      ctx.moveTo(bPt.x + 8, bPt.y - 8); ctx.lineTo(bPt.x - 8, bPt.y + 8);
      ctx.stroke();
    }

    // Sae origin marker & Metavision ring
    ctx.beginPath();
    ctx.arc(sc.saePos.x, sc.saePos.y, 26, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 229, 195, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(sc.saePos.x, sc.saePos.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#e11d48';
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = '800 11px "Exo 2", sans-serif';
    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.fillText(sc.saePos.label, sc.saePos.x, sc.saePos.y + 29);

    // Ball position + luminous trail
    const ballT = ballProgress > 0 ? ballProgress : 0;
    if (ballT > 0.01) {
      ctx.strokeStyle = ev.passed || ballT < (ev.blockedAtT ?? 2) ? '#00e5c3' : '#ff2a5f';
      ctx.lineWidth = 5;
      ctx.beginPath();
      const segs = 32;
      for (let i = 0; i <= segs; i++) {
        const st = (i / segs) * ballT;
        const pt = this.evalBezier(ev.p0, ev.p1, ev.p2, st);
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }

    const ballPos = this.evalBezier(ev.p0, ev.p1, ev.p2, ballT);
    ctx.beginPath();
    ctx.arc(ballPos.x, ballPos.y, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#00e5c3';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Live formula HUD on top-left
    ctx.font = '700 11px "Exo 2", sans-serif';
    ctx.fillStyle = 'rgba(153, 246, 228, 0.88)';
    ctx.textAlign = 'left';
    ctx.fillText(
      `METAVISION VECTOR // θ=${ev.launchDeg}° · MAGNUS=${this.curve.toFixed(2)} · VEL=${Math.round(this.power)}% · xG=${ev.xgPct}%`,
      54,
      22
    );
  }
}

window.PlaymakerProfileManager = PlaymakerProfileManager;
window.MetavisionPitchLab = MetavisionPitchLab;
