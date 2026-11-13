/* ==========================================================================
   BLUE LOCK // ITOSHI SAE APPLICATION CONTROLLER
   Audio, Theme Switcher, Dossier Radar, Weapons, Timeline, Gallery, Call, Quiz
   ========================================================================== */
'use strict';

class SoundManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  ensureCtx() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  tone(freq, dur = 0.08, type = 'sine', gainVal = 0.06, slideTo = null) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.01);
    } catch {
      // Ignore audio gesture restrictions
    }
  }

  playClick() { this.tone(620, 0.05, 'triangle', 0.045, 780); }
  resume() { this.ensureCtx(); }
  playBeatTick(accent = false) {
    this.tone(accent ? 880 : 540, 0.035, 'triangle', accent ? 0.05 : 0.032);
  }
  playHit(grade) {
    if (grade === 'perfect') {
      this.tone(740, 0.08, 'sine', 0.065, 980);
    } else if (grade === 'good') {
      this.tone(520, 0.08, 'triangle', 0.05, 580);
    } else {
      this.tone(160, 0.12, 'sawtooth', 0.055, 95);
    }
  }
  playVictory() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      setTimeout(() => this.tone(f, 0.14, 'triangle', 0.06), idx * 75);
    });
  }
  playKick() { this.tone(190, 0.12, 'sawtooth', 0.075, 58); }
  playPower() {
    this.tone(330, 0.14, 'sine', 0.06, 660);
    setTimeout(() => this.tone(660, 0.18, 'triangle', 0.055, 880), 80);
  }
  playCorrect() {
    [440, 554.37, 659.25].forEach((f, idx) => {
      setTimeout(() => this.tone(f, 0.1, 'sine', 0.055), idx * 55);
    });
  }
  playWrong() { this.tone(185, 0.16, 'sawtooth', 0.05, 110); }
}

class ThemeMusicManager {
  constructor() {
    this.targetVolume = 0.28;
    this.fadeDurationMs = 450;
    this.enabled = true;
    this.userPaused = false;
    this.mode = 'normal'; // 'normal' | 'flow'
    this.fadeTimer = null;
    this.playSeq = 0;
    this.onStateChange = null;

    this.tracks = {
      normal: this.createAudio('assets/audio/sae_theme_normal.mp3'),
      flow: this.createAudio('assets/audio/sae_theme_flow.mp3')
    };

    const unlock = () => {
      if (this.enabled && !this.userPaused && !this.isPlaying()) {
        this.playCurrent(false);
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  createAudio(src) {
    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    return audio;
  }

  isPlaying() {
    const active = this.tracks[this.mode];
    return Boolean(active && !active.paused && this.enabled && !this.userPaused);
  }

  emitState() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange({
        mode: this.mode,
        enabled: this.enabled,
        userPaused: this.userPaused,
        playing: this.isPlaying()
      });
    }
  }

  cancelFade() {
    if (this.fadeTimer !== null) {
      cancelAnimationFrame(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  crossfade(fromAudio, toAudio) {
    this.cancelFade();
    const startFrom = fromAudio ? Math.max(0, Math.min(1, fromAudio.volume)) : 0;
    const startTo = toAudio ? Math.max(0, Math.min(1, toAudio.volume)) : 0;
    const targetTo = toAudio ? Math.max(0, Math.min(1, this.targetVolume)) : 0;
    const t0 = performance.now();

    const step = (now) => {
      const elapsed = Math.max(0, now - t0);
      const progress = Math.max(0, Math.min(1, elapsed / this.fadeDurationMs));

      if (fromAudio) {
        fromAudio.volume = Math.max(0, Math.min(1, startFrom * (1 - progress)));
      }
      if (toAudio) {
        toAudio.volume = Math.max(0, Math.min(this.targetVolume, startTo + (targetTo - startTo) * progress));
      }

      if (progress < 1) {
        this.fadeTimer = requestAnimationFrame(step);
      } else {
        this.fadeTimer = null;
        if (fromAudio && fromAudio !== toAudio) {
          fromAudio.pause();
          fromAudio.volume = 0;
        }
        this.emitState();
      }
    };

    this.fadeTimer = requestAnimationFrame(step);
  }

  async playCurrent(resetToStart = false) {
    if (!this.enabled || this.userPaused) {
      this.emitState();
      return false;
    }
    const seq = ++this.playSeq;
    const incoming = this.tracks[this.mode];
    const outgoing = this.tracks[this.mode === 'flow' ? 'normal' : 'flow'];

    if (resetToStart && incoming.paused) {
      incoming.currentTime = 0;
    }
    try {
      await incoming.play();
      if (seq !== this.playSeq) return false;
      this.crossfade(outgoing && !outgoing.paused ? outgoing : null, incoming);
      this.emitState();
      return true;
    } catch {
      this.emitState();
      return false;
    }
  }

  setMode(newMode) {
    this.mode = newMode === 'flow' ? 'flow' : 'normal';
    if (!this.userPaused && this.enabled) {
      this.playCurrent(false);
    } else {
      this.emitState();
    }
  }

  togglePlayPause() {
    if (this.userPaused || !this.isPlaying()) {
      this.userPaused = false;
      this.enabled = true;
      this.playCurrent(false);
      return true;
    } else {
      this.userPaused = true;
      const active = this.tracks[this.mode];
      const other = this.tracks[this.mode === 'flow' ? 'normal' : 'flow'];
      if (other) { other.pause(); other.volume = 0; }
      this.crossfade(active, null);
      this.emitState();
      return false;
    }
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class SaeCallController {
  constructor(sfx, callbacks = {}) {
    this.sfx = sfx;
    this.callbacks = callbacks;
    this.respect = 32;
    this.seconds = 0;
    this.timerInterval = null;
    this.typingTimer = null;
    this.duelLaunchTimer = null;
    this.activeLayer = 'A';
    this.currentEmotion = 'neutral';
    this.fullReplyText = '';
    this.history = [];
    this.unknownCursor = 0;

    this.unknownFallbacks = [
      {
        emotion: 'focused',
        text: 'Зрозумів напрямок твоєї думки, але формулюй точніше. На полі в мене немає зайвої секунди розшифровувати натяки — питай про тактику, Re Al, Ріна чи ЧС U-20.'
      },
      {
        emotion: 'intrigued',
        text: 'Цікава змінна. Якщо розкласти це на позиційну гру, будь-яке рішення без кінцевої мети гола — зайвий шум. Спробуй конкретніше.'
      },
      {
        emotion: 'annoyed',
        text: 'Це не наближає нас до результату. Не розпилюй увагу на дрібниці — перевір свої знання в Его-аудиті або повертайся з точним питанням.'
      }
    ];

    this.elSection = document.getElementById('callSection');
    this.elStage = document.getElementById('callMainStage');
    this.elTimer = document.getElementById('callTimer');
    this.elWave = document.getElementById('callWaveform');
    this.elRank = document.getElementById('callRespectRank');
    this.elBar = document.getElementById('callRespectBar');
    this.elEmotionLabel = document.getElementById('callEmotionLabel');
    this.elLayerA = document.getElementById('saePortraitLayerA');
    this.elLayerB = document.getElementById('saePortraitLayerB');
    this.elDialogue = document.getElementById('saeDialogueText');
    this.elTyping = document.getElementById('callTypingIndicator');
    this.elSkip = document.getElementById('callSkipTypingBtn');
    this.elSourceTag = document.getElementById('callReplySourceTag');
    this.elInput = document.getElementById('callUserInput');
    this.elForm = document.getElementById('callMessageForm');
    this.elHistoryModal = document.getElementById('callHistoryModal');
    this.elHistoryList = document.getElementById('callHistoryList');
    this.elLaunchDuelBtn = document.getElementById('launchDuelNowBtn');

    this.bindEvents();
    this.resetCall(false);
  }

  bindEvents() {
    this.elLaunchDuelBtn?.addEventListener('click', () => {
      this.sfx?.playPower();
      this.callbacks.onTriggerEvaluationDuel?.();
    });
    this.elForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = (this.elInput?.value || '').trim();
      if (!msg) return;
      this.elInput.value = '';
      this.handleUserMessage(msg);
    });

    document.querySelectorAll('#callQuickTopics .topic-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt') || '';
        if (prompt) this.handleUserMessage(prompt);
      });
    });

    this.elSkip?.addEventListener('click', () => this.finishTypingNow());
    document.getElementById('callResetBtn')?.addEventListener('click', () => {
      this.resetCall(true);
      this.sfx?.playClick();
    });
    document.getElementById('callHistoryBtn')?.addEventListener('click', () => this.openHistory());
    document.getElementById('closeCallHistoryBtn')?.addEventListener('click', () => this.closeHistory());
    document.getElementById('callHistoryBackdrop')?.addEventListener('click', () => this.closeHistory());
  }

  startTimerIfNeeded() {
    if (this.timerInterval) return;
    this.timerInterval = setInterval(() => {
      if (!this.elSection?.classList.contains('active')) return;
      this.seconds += 1;
      const mm = String(Math.floor(this.seconds / 60)).padStart(2, '0');
      const ss = String(this.seconds % 60).padStart(2, '0');
      if (this.elTimer) this.elTimer.textContent = `${mm}:${ss}`;
    }, 1000);
  }

  setEmotion(emotionKey) {
    const safeKey = SAE_CALL_EMOTIONS[emotionKey] ? emotionKey : 'neutral';
    const emotionChanged = this.currentEmotion !== safeKey;
    this.currentEmotion = safeKey;
    const meta = SAE_CALL_EMOTIONS[safeKey];

    this.elSection?.setAttribute('data-emotion', safeKey);
    this.elStage?.setAttribute('data-emotion', safeKey);
    if (this.elEmotionLabel) this.elEmotionLabel.textContent = meta.label;

    const showA = this.activeLayer !== 'A';
    const nextImg = showA ? this.elLayerA : this.elLayerB;
    const prevImg = showA ? this.elLayerB : this.elLayerA;
    if (nextImg && prevImg) {
      nextImg.src = meta.img;
      nextImg.classList.add('is-visible');
      prevImg.classList.remove('is-visible');
      this.activeLayer = showA ? 'A' : 'B';
    }

    if (emotionChanged && this.elStage) {
      clearTimeout(this._emotionPulseTimer);
      this.elStage.classList.remove('is-emotion-pulse');
      void this.elStage.offsetWidth;
      this.elStage.classList.add('is-emotion-pulse');
      this._emotionPulseTimer = setTimeout(() => {
        this.elStage?.classList.remove('is-emotion-pulse');
      }, 420);
    }
  }

  updateRespect(delta) {
    this.respect = Math.max(0, Math.min(100, this.respect + delta));
    if (this.elBar) this.elBar.style.width = `${this.respect}%`;
    let rank = 'ХОЛОДНИЙ ІГНОР';
    if (this.respect >= 80) rank = 'ГІДНИЙ ФОРВАРД';
    else if (this.respect >= 60) rank = 'ТАКТИЧНИЙ ІНТЕРЕС';
    else if (this.respect >= 42) rank = 'НЕЙТРАЛЬНА УВАГА';
    else if (this.respect < 20) rank = 'ПОВНЕ ЗНЕЦІНЕННЯ';
    if (this.elRank) this.elRank.textContent = rank;
  }

  typeReply(text, sourceLabel = 'RE AL LINE') {
    clearInterval(this.typingTimer);
    this.fullReplyText = text;
    if (this.elSourceTag) this.elSourceTag.textContent = sourceLabel;
    if (this.elDialogue) {
      this.elDialogue.textContent = '';
      this.elDialogue.classList.add('is-typing');
    }
    this.elWave?.classList.add('is-speaking');
    this.elTyping?.classList.add('is-active');
    if (this.elSkip) this.elSkip.hidden = false;

    let idx = 0;
    this.typingTimer = setInterval(() => {
      idx += 2;
      if (idx >= this.fullReplyText.length) {
        this.finishTypingNow();
      } else if (this.elDialogue) {
        this.elDialogue.textContent = this.fullReplyText.slice(0, idx);
      }
    }, 18);
  }

  finishTypingNow() {
    clearInterval(this.typingTimer);
    this.typingTimer = null;
    if (this.elDialogue) {
      this.elDialogue.textContent = this.fullReplyText;
      this.elDialogue.classList.remove('is-typing');
    }
    this.elWave?.classList.remove('is-speaking');
    this.elTyping?.classList.remove('is-active');
    if (this.elSkip) this.elSkip.hidden = true;
  }

  handleUserMessage(text) {
    this.startTimerIfNeeded();
    this.sfx?.playClick();
    this.history.push({ who: 'user', text, emotion: this.currentEmotion });

    let matched = null;
    for (const rule of SAE_LOCAL_KB) {
      if (rule.patterns.some((re) => re.test(text))) {
        matched = rule;
        break;
      }
    }

    let replyText;
    let nextEmotion;
    let delta = 0;

    if (matched) {
      nextEmotion = matched.emotion;
      delta = matched.respectDelta;
      replyText = matched.replies[Math.floor(Math.random() * matched.replies.length)];
    } else {
      const fb = this.unknownFallbacks[this.unknownCursor % this.unknownFallbacks.length];
      this.unknownCursor += 1;
      nextEmotion = fb.emotion;
      replyText = fb.text;
    }

    this.setEmotion(nextEmotion);
    this.updateRespect(delta);
    this.history.push({ who: 'sae', text: replyText, emotion: nextEmotion });
    this.typeReply(replyText, nextEmotion === 'flow' ? 'FLOW LINK' : 'RE AL LINE');

    if (matched?.triggersDuel) {
      if (this.elLaunchDuelBtn) this.elLaunchDuelBtn.hidden = false;
      clearTimeout(this.duelLaunchTimer);
      this.duelLaunchTimer = setTimeout(() => {
        this.finishTypingNow();
        this.callbacks.onTriggerEvaluationDuel?.();
      }, 1050);
    }
  }

  reportDuelResult(result) {
    if (!result) return;
    let emotion = 'smirk';
    let delta = 0;
    let reply = '';

    if (!result.completed) {
      emotion = 'annoyed';
      delta = -4;
      reply = 'Зійшов з поля посеред ритм-дуелі? Без витримки навіть проти напівсили не встоїш. Повертайся у симуляцію, коли зберешся.';
    } else if (result.playerAcc > result.botAcc + 0.05) {
      emotion = 'flow';
      delta = 14;
      reply = `${result.playerAcc.toFixed(1)}% проти моїх ${result.botAcc.toFixed(1)}% на режимі «${result.difficultyName}»… Дивно. Ти не просто копіював темп — ти справді зламав ритм на полі.`;
    } else if (Math.abs(result.playerAcc - result.botAcc) <= 0.05) {
      emotion = 'intrigued';
      delta = 8;
      reply = `Абсолютний паритет (${result.playerAcc.toFixed(1)}% vs ${result.botAcc.toFixed(1)}%). Для спарингу U-20 непогано — підвищ складність, якщо хочеш випередити мене.`;
    } else {
      emotion = 'smirk';
      delta = 3;
      reply = `${result.playerAcc.toFixed(1)}% проти моїх ${result.botAcc.toFixed(1)}% на «${result.difficultyName}». Різниця очевидна: твоя точність ще гуляє під тиском темпу. Тренуйся ще.`;
    }

    this.setEmotion(emotion);
    this.updateRespect(delta);
    this.history.push({ who: 'sae', text: reply, emotion });
    this.typeReply(reply, emotion === 'flow' ? 'FLOW VERDICT' : 'MATCH VERDICT');
  }

  resetCall(playSound = false) {
    clearTimeout(this.duelLaunchTimer);
    if (this.elLaunchDuelBtn) this.elLaunchDuelBtn.hidden = true;
    this.respect = 32;
    this.seconds = 0;
    this.history = [];
    if (this.elTimer) this.elTimer.textContent = '00:00';
    this.updateRespect(0);
    this.setEmotion('neutral');
    const opening = 'Лінія відкрита. Говори по суті — чи є в тобі хоч крихта футбольного мозку, варта розмови з півзахисником Re Al?';
    this.history.push({ who: 'sae', text: opening, emotion: 'neutral' });
    this.typeReply(opening, 'RE AL LINE');
    if (playSound) this.sfx?.playClick();
  }

  openHistory() {
    if (!this.elHistoryModal || !this.elHistoryList) return;
    this.elHistoryList.textContent = '';
    this.history.forEach((item) => {
      const div = document.createElement('div');
      div.className = `history-entry ${item.who === 'user' ? 'is-user' : ''}`;
      const meta = document.createElement('div');
      meta.className = 'history-entry-meta';
      const emLabel = SAE_CALL_EMOTIONS[item.emotion]?.label || '';
      meta.textContent = item.who === 'user' ? 'ТИ // ПОВІДОМЛЕННЯ' : `ІТОШІ САЕ // ${emLabel}`;
      const body = document.createElement('p');
      body.textContent = item.text;
      div.appendChild(meta);
      div.appendChild(body);
      this.elHistoryList.appendChild(div);
    });
    this.elHistoryModal.hidden = false;
    this.elHistoryModal.setAttribute('aria-hidden', 'false');
    this.elHistoryModal.classList.add('is-open');
  }

  closeHistory() {
    if (!this.elHistoryModal) return;
    this.elHistoryModal.classList.remove('is-open');
    this.elHistoryModal.setAttribute('aria-hidden', 'true');
    this.elHistoryModal.hidden = true;
  }
}

class SaeQuizApp {
  constructor(sfx) {
    this.sfx = sfx;
    this.currentIdx = 0;
    this.score = 0;
    this.streak = 0;
    this.answers = [];

    this.startPanel = document.getElementById('quizStartPanel');
    this.activePanel = document.getElementById('quizActivePanel');
    this.resultPanel = document.getElementById('quizResultPanel');

    this.qBlockBadge = document.getElementById('qBlockBadge');
    this.qCounterText = document.getElementById('qCounterText');
    this.qScoreVal = document.getElementById('qScoreVal');
    this.qStreakVal = document.getElementById('qStreakVal');
    this.qProgressBar = document.getElementById('qProgressBar');
    this.qQuestionText = document.getElementById('qQuestionText');
    this.qOptionsGrid = document.getElementById('qOptionsGrid');
    this.qFeedbackBox = document.getElementById('qFeedbackBox');
    this.qFeedbackTitle = document.getElementById('qFeedbackTitle');
    this.qFeedbackExplain = document.getElementById('qFeedbackExplain');
    this.qNextBtn = document.getElementById('qNextBtn');

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('startQuizBtn')?.addEventListener('click', () => this.start());
    document.getElementById('restartQuizBtn')?.addEventListener('click', () => this.start());
    this.qNextBtn?.addEventListener('click', () => {
      this.sfx?.playClick();
      this.currentIdx += 1;
      if (this.currentIdx >= SAE_QUIZ_DATA.length) {
        this.showResults();
      } else {
        this.renderQuestion();
      }
    });
    document.getElementById('toggleReviewBtn')?.addEventListener('click', () => {
      const list = document.getElementById('resultReviewList');
      const btn = document.getElementById('toggleReviewBtn');
      if (!list) return;
      list.hidden = !list.hidden;
      if (btn) btn.textContent = list.hidden ? 'ПОКАЗАТИ РОЗБІР ВІДПОВІДЕЙ' : 'СХОВАТИ РОЗБІР ВІДПОВІДЕЙ';
    });
  }

  showPanel(panel) {
    [this.startPanel, this.activePanel, this.resultPanel].forEach((p) => p?.classList.remove('active'));
    panel?.classList.add('active');
  }

  start() {
    this.sfx?.playPower();
    this.currentIdx = 0;
    this.score = 0;
    this.streak = 0;
    this.answers = [];
    this.showPanel(this.activePanel);
    this.renderQuestion();
  }

  renderQuestion() {
    const q = SAE_QUIZ_DATA[this.currentIdx];
    const total = SAE_QUIZ_DATA.length;
    if (this.qBlockBadge) this.qBlockBadge.textContent = q.block;
    if (this.qCounterText) this.qCounterText.textContent = `ПИТАННЯ ${this.currentIdx + 1} / ${total}`;
    if (this.qScoreVal) this.qScoreVal.textContent = String(this.score);
    if (this.qStreakVal) this.qStreakVal.textContent = `СЕРІЯ: ${this.streak}`;
    if (this.qProgressBar) this.qProgressBar.style.width = `${((this.currentIdx + 1) / total) * 100}%`;
    if (this.qQuestionText) this.qQuestionText.textContent = q.question;
    if (this.qFeedbackBox) this.qFeedbackBox.hidden = true;
    if (this.qNextBtn) this.qNextBtn.textContent = this.currentIdx === total - 1 ? 'ПІДСУМОК АУДИТУ ▶' : 'НАСТУПНЕ ПИТАННЯ ▶';

    const letters = ['A', 'B', 'C', 'D'];
    if (this.qOptionsGrid) {
      this.qOptionsGrid.textContent = '';
      q.options.forEach((optText, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'q-option-btn';
        const lSpan = document.createElement('span');
        lSpan.className = 'q-opt-letter';
        lSpan.textContent = letters[idx];
        const tSpan = document.createElement('span');
        tSpan.textContent = optText;
        btn.appendChild(lSpan);
        btn.appendChild(tSpan);
        btn.addEventListener('click', () => this.selectOption(idx));
        this.qOptionsGrid.appendChild(btn);
      });
    }
  }

  selectOption(selectedIdx) {
    if (this.answers[this.currentIdx]) return;
    const q = SAE_QUIZ_DATA[this.currentIdx];
    const isCorrect = selectedIdx === q.correctIndex;
    if (isCorrect) {
      this.score += 1;
      this.streak += 1;
      this.sfx?.playCorrect();
    } else {
      this.streak = 0;
      this.sfx?.playWrong();
    }
    this.answers[this.currentIdx] = { selectedIdx, isCorrect };

    const btns = this.qOptionsGrid?.querySelectorAll('.q-option-btn') || [];
    btns.forEach((b, idx) => {
      b.disabled = true;
      if (idx === q.correctIndex) b.classList.add('is-correct');
      else if (idx === selectedIdx && !isCorrect) b.classList.add('is-wrong');
    });

    if (this.qScoreVal) this.qScoreVal.textContent = String(this.score);
    if (this.qStreakVal) this.qStreakVal.textContent = `СЕРІЯ: ${this.streak}`;
    if (this.qFeedbackTitle) {
      this.qFeedbackTitle.textContent = isCorrect ? '✓ ТОЧНЕ ПОПАДАННЯ' : '✕ ПОМИЛКА ТРАЄКТОРІЇ';
      this.qFeedbackTitle.style.color = isCorrect ? '#00e5c3' : '#ff2a5f';
    }
    if (this.qFeedbackExplain) this.qFeedbackExplain.textContent = q.explain;
    if (this.qFeedbackBox) this.qFeedbackBox.hidden = false;
  }

  showResults() {
    this.showPanel(this.resultPanel);
    const total = SAE_QUIZ_DATA.length;
    let title = 'АМАТОР БЕЗ METAVISION';
    let quote = '«Твій кругозір занадто вузький навіть для лави запасних у Японії. Повертайся, коли навчишся дивитися на поле.»';
    if (this.score >= 18) {
      title = 'NEW GENERATION WORLD XI // РІВНИЙ УМ';
      quote = '«Ти бачиш гру майже на тому ж рівні точності, що й я. З таким баченням уже можна будувати атаку проти світу.»';
    } else if (this.score >= 14) {
      title = 'РЕЙТИНГ RE AL // КАНДИДАТ У ПІВЗАХИСТ';
      quote = '«Непоганий розрахунок траєкторій. Залишилося прибрати дрібні прогалини на великих швидкостях.»';
    } else if (this.score >= 9) {
      title = 'ПОТЕНЦІАЛ BLUE LOCK';
      quote = '«Інстинкт є, але в деталях ще плаваєш. Без холодної точності на світовій сцені робити нічого.»';
    }

    document.getElementById('resultRankTitle').textContent = title;
    document.getElementById('resultScoreNum').textContent = String(this.score);
    document.getElementById('resultRankQuote').textContent = quote;

    // Block breakdown (5 per block)
    const blockNames = [
      'Блок 1 · Біографія',
      'Блок 2 · Зброя й Flow',
      'Блок 3 · Re Al і U-20',
      'Блок 4 · Психологія і світ'
    ];
    const grid = document.getElementById('resultBlocksGrid');
    if (grid) {
      grid.textContent = '';
      blockNames.forEach((bName, bIdx) => {
        let hits = 0;
        for (let i = bIdx * 5; i < bIdx * 5 + 5; i++) {
          if (this.answers[i]?.isCorrect) hits += 1;
        }
        const card = document.createElement('div');
        card.className = 'result-block-card';
        const left = document.createElement('span');
        left.textContent = bName;
        const right = document.createElement('strong');
        right.textContent = `${hits} / 5`;
        right.style.color = '#00e5c3';
        card.appendChild(left);
        card.appendChild(right);
        grid.appendChild(card);
      });
    }

    const reviewList = document.getElementById('resultReviewList');
    if (reviewList) {
      reviewList.hidden = true;
      reviewList.textContent = '';
      const letters = ['A', 'B', 'C', 'D'];
      SAE_QUIZ_DATA.forEach((q, idx) => {
        const ua = this.answers[idx];
        const div = document.createElement('div');
        div.className = `review-item ${ua?.isCorrect ? '' : 'is-bad'}`;
        const h = document.createElement('strong');
        h.textContent = `${idx + 1}. ${q.question}`;
        const p = document.createElement('p');
        const userL = ua ? letters[ua.selectedIdx] : '—';
        const corrL = letters[q.correctIndex];
        p.textContent = `Твоя відповідь: ${userL} · Правильна: ${corrL} (${q.options[q.correctIndex]}) — ${q.explain}`;
        p.style.fontSize = '0.86rem';
        p.style.color = '#cbd5e1';
        p.style.marginTop = '0.35rem';
        div.appendChild(h);
        div.appendChild(p);
        reviewList.appendChild(div);
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const sfx = new SoundManager();
  const bgm = new ThemeMusicManager();
  const ambient = new SaeAmbientFX(document.getElementById('saeAmbientCanvas'));
  let isDuelGameUnlocked = false;
  let arena = null;

  const callCtrl = new SaeCallController(sfx, {
    onTriggerEvaluationDuel: () => {
      isDuelGameUnlocked = true;
      activateSection('gameSection');
      showToast('Активовано приховану дуель U-20: Рін vs Сае');
    }
  });

  arena = new SaeRinAdofaiDuel(document.getElementById('gameCanvas'), sfx, {
    onReturnToCall: (result) => {
      activateSection('callSection');
      callCtrl.reportDuelResult(result);
    }
  });
  const quizApp = new SaeQuizApp(sfx);

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('saeHudToast');
    if (!el) return;
    el.textContent = msg;
    el.setAttribute('aria-hidden', 'false');
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('is-visible');
      el.setAttribute('aria-hidden', 'true');
    }, 3200);
  }

  // Audio UI Sync
  const bgmBtn = document.getElementById('bgmToggleBtn');
  const emblemBtn = document.getElementById('saeEmblemBtn');
  const brandSub = document.getElementById('brandSubText');

  bgm.onStateChange = (state) => {
    if (bgmBtn) {
      bgmBtn.setAttribute('aria-pressed', state.playing ? 'true' : 'false');
      bgmBtn.classList.toggle('is-playing', state.playing);
      bgmBtn.classList.toggle('is-paused', !state.playing);
      const lbl = bgmBtn.querySelector('.bgm-label');
      if (lbl) lbl.textContent = state.playing ? (state.mode === 'flow' ? 'FLOW: ON' : 'ТЕМА: SAE') : 'МУЗИКА: ПАУЗА';
    }
  };

  bgmBtn?.addEventListener('click', () => {
    const playing = bgm.togglePlayPause();
    showToast(playing ? 'Фонова тема активна' : 'Фонова музика на паузі');
  });

  emblemBtn?.addEventListener('click', () => {
    const isFlow = !document.body.classList.contains('flow-mode-active');
    document.body.classList.toggle('flow-mode-active', isFlow);
    emblemBtn.classList.toggle('is-flow-armed', isFlow);
    emblemBtn.setAttribute('aria-pressed', isFlow ? 'true' : 'false');
    if (brandSub) brandSub.textContent = isFlow ? 'FLOW // BEAUTIFUL DESTRUCTION' : '糸師 冴 // RE AL · № 10';
    ambient.setFlowMode(isFlow);
    bgm.setMode(isFlow ? 'flow' : 'normal');
    sfx.playPower();
    showToast(isFlow ? 'Активовано режим FLOW: Прекрасне руйнування' : 'Повернуто холодний режим Playmaker');
  });

  const soundBtn = document.getElementById('soundToggleBtn');
  soundBtn?.addEventListener('click', () => {
    const on = sfx.toggle();
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.querySelector('.sound-icon').textContent = on ? '🔊' : '🔇';
    soundBtn.querySelector('.sound-label').textContent = on ? 'SFX: ON' : 'SFX: OFF';
    if (on) sfx.playClick();
  });

  // Multi-Level Scroll Reveal System (analog of RinAmbientFX/refreshScrollReveals)
  document.documentElement.classList.add('js-reveal-ready');
  const reduceMotionQuery = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  const autoRevealRules = [
    { selector: '#heroSection .hero-pillar-card', anim: 'reveal-scale-up', stagger: 2 },
    { selector: '#heroSection .hero-cat-card', anim: 'reveal-on-scroll', alternateLR: true, stagger: 4 },
    { selector: '#heroSection .hero-activity-card', anim: 'reveal-on-scroll', alternateLR: true, stagger: 2 },
    { selector: '#dossierSection .dossier-grid > *', anim: 'reveal-on-scroll', alternateLR: true, stagger: 3 },
    { selector: '#timelineSection .timeline-item', anim: 'reveal-on-scroll', alternateLR: true, stagger: 3 },
    { selector: '#weaponsSection .weapon-card', anim: 'reveal-scale-up', stagger: 3 },
    { selector: '#weaponsSection #weaponDetailPanel', anim: 'reveal-scale-up', delay: 2 },
    { selector: '#gallerySection .gallery-card', anim: 'reveal-scale-up', stagger: 3 },
    { selector: '#callSection .call-terminal-shell', anim: 'reveal-scale-up', delay: 1 },
    { selector: '#gameSection .duel-arena-shell', anim: 'reveal-scale-up', delay: 1 },
    { selector: '#quizContainerSection .quiz-box', anim: 'reveal-scale-up', delay: 1 },
    { selector: '.site-footer', anim: 'reveal-scale-up', delay: 1 }
  ];

  function applyAutoRevealClasses(scopeEl = document) {
    autoRevealRules.forEach((rule) => {
      const nodes = scopeEl.querySelectorAll(rule.selector);
      nodes.forEach((el, idx) => {
        if (!el.classList.contains('reveal-on-scroll')) {
          el.classList.add('reveal-on-scroll');
          if (rule.alternateLR) {
            el.classList.add(idx % 2 === 0 ? 'reveal-from-left' : 'reveal-from-right');
          } else if (rule.anim && rule.anim !== 'reveal-on-scroll') {
            el.classList.add(rule.anim);
          }
          const delayStep = rule.delay || (rule.stagger ? (idx % rule.stagger) + 1 : 0);
          if (delayStep >= 1 && delayStep <= 4) {
            el.classList.add(`reveal-delay-${delayStep}`);
          }
        }
      });
    });
  }

  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -36px 0px' })
    : null;

  function refreshScrollReveals(scopeEl = document) {
    applyAutoRevealClasses(document);
    const root = scopeEl || document;
    const vh = window.innerHeight || document.documentElement.clientHeight || 900;
    const skipMotion = reduceMotionQuery && reduceMotionQuery.matches;

    root.querySelectorAll('.reveal-on-scroll').forEach((el) => {
      if (skipMotion || !revealObserver) {
        el.classList.add('is-visible');
        return;
      }
      revealObserver.observe(el);
      const rect = el.getBoundingClientRect();
      if (rect.top < vh * 0.92 && rect.bottom > 0) {
        el.classList.add('is-visible');
      } else if (rect.top >= vh * 0.96) {
        el.classList.remove('is-visible');
      }
    });
  }

  let scrollResetTicking = false;
  window.addEventListener('scroll', () => {
    if (scrollResetTicking) return;
    scrollResetTicking = true;
    requestAnimationFrame(() => {
      scrollResetTicking = false;
      const vh = window.innerHeight || document.documentElement.clientHeight || 900;
      const activeSection = document.querySelector('.content-section.active');
      if (!activeSection) return;
      activeSection.querySelectorAll('.reveal-on-scroll.is-visible').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top > vh * 1.04) {
          el.classList.remove('is-visible');
        }
      });
    });
  }, { passive: true });

  // Animate Dossier Stat Bars & Radar
  function drawSaeRadar() {
    const c = document.getElementById('saeRadarCanvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    const cx = c.width / 2;
    const cy = c.height / 2;
    const maxR = 104;
    const stats = [
      { label: 'ПАС 99', v: 0.99 },
      { label: 'METAVISION 99', v: 0.99 },
      { label: 'КОНТРОЛЬ 98', v: 0.98 },
      { label: 'ДРІБЛІНГ 97', v: 0.97 },
      { label: 'УДАР 93', v: 0.93 },
      { label: 'РИВОК 90', v: 0.90 }
    ];
    ctx.clearRect(0, 0, c.width, c.height);

    for (let ring = 1; ring <= 4; ring++) {
      const r = (maxR * ring) / 4;
      ctx.beginPath();
      stats.forEach((_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / stats.length;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();
    }

    ctx.beginPath();
    stats.forEach((st, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / stats.length;
      const x = cx + Math.cos(a) * maxR * st.v;
      const y = cy + Math.sin(a) * maxR * st.v;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(225, 29, 72, 0.28)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#00e5c3';
    ctx.stroke();

    ctx.font = '700 10px "Exo 2", sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    stats.forEach((st, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / stats.length;
      const lx = cx + Math.cos(a) * (maxR + 24);
      const ly = cy + Math.sin(a) * (maxR + 18) + 4;
      ctx.fillText(st.label, lx, ly);
    });
  }

  function animateDossierBars() {
    document.querySelectorAll('#dossierSection .stat-bar[data-width]').forEach((bar) => {
      bar.style.width = `${bar.getAttribute('data-width')}%`;
    });
  }

  // Navigation Controller
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.content-section');

  function activateSection(targetId) {
    if (targetId === 'gameSection' && !isDuelGameUnlocked) {
      showToast('Міні-гра відкривається лише через «Оціни мене» у Дзвінку Сае');
      activateSection('callSection');
      return;
    }
    sections.forEach((sec) => sec.classList.toggle('active', sec.id === targetId));
    navLinks.forEach((btn) => btn.classList.toggle('active', btn.getAttribute('data-target') === targetId));
    window.scrollTo({ top: 0, behavior: 'auto' });
    const activeEl = document.getElementById(targetId);
    const skipMotion = reduceMotionQuery && reduceMotionQuery.matches;
    if (activeEl && !skipMotion) {
      applyAutoRevealClasses(document);
      activeEl.querySelectorAll('.reveal-on-scroll').forEach((el) => el.classList.remove('is-visible'));
      void activeEl.offsetHeight;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        refreshScrollReveals(activeEl || document);
        refreshScrollReveals(document.querySelector('.site-footer'));
      });
    });
    if (targetId === 'dossierSection') {
      drawSaeRadar();
      animateDossierBars();
    }
    if (targetId === 'callSection') callCtrl.startTimerIfNeeded();
  }

  navLinks.forEach((btn) => {
    btn.addEventListener('click', () => {
      sfx.playClick();
      activateSection(btn.getAttribute('data-target'));
    });
  });

  document.getElementById('brandHomeBtn')?.addEventListener('click', () => {
    sfx.playClick();
    activateSection('heroSection');
  });

  document.querySelectorAll('[data-jump]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sfx.playClick();
      activateSection(btn.getAttribute('data-jump'));
    });
  });

  document.querySelectorAll('[data-scroll-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sfx.playClick();
      document.getElementById(btn.getAttribute('data-scroll-target'))?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Render Timeline
  const timelineContainer = document.getElementById('timelineContainer');
  function renderTimeline(filter = 'all') {
    if (!timelineContainer) return;
    timelineContainer.textContent = '';
    let renderedIdx = 0;
    SAE_TIMELINE_MILESTONES.forEach((m) => {
      if (filter !== 'all' && m.cat !== filter) return;
      const item = document.createElement('div');
      const dirClass = renderedIdx % 2 === 0 ? 'reveal-from-left' : 'reveal-from-right';
      const delayClass = `reveal-delay-${(renderedIdx % 3) + 1}`;
      item.className = `timeline-item reveal-on-scroll ${dirClass} ${delayClass}`;
      item.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-header-meta">
          <span class="timeline-phase-badge">${escapeHtml(m.phase)}</span>
          <span class="timeline-arc-tag">${escapeHtml(m.arc)}</span>
        </div>
        <div class="timeline-box">
          <h4 class="t-heading">${escapeHtml(m.title)}</h4>
          <p class="t-text">${escapeHtml(m.text)}</p>
          <p class="t-quote">${escapeHtml(m.quote)}</p>
        </div>
      `;
      timelineContainer.appendChild(item);
      renderedIdx += 1;
    });
    requestAnimationFrame(() => requestAnimationFrame(() => refreshScrollReveals(timelineContainer)));
  }

  document.querySelectorAll('.t-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      sfx.playClick();
      document.querySelectorAll('.t-filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderTimeline(btn.getAttribute('data-filter') || 'all');
    });
  });

  // Render Gallery & Modal
  const galleryGrid = document.getElementById('galleryGrid');
  const galleryModal = document.getElementById('galleryModal');
  let activeMomentIdx = 0;

  function renderGallery(filter = 'all') {
    if (!galleryGrid) return;
    galleryGrid.textContent = '';
    let renderedIdx = 0;
    SAE_GALLERY_MOMENTS.forEach((m, idx) => {
      if (filter !== 'all' && m.cat !== filter) return;
      const card = document.createElement('article');
      const delayClass = `reveal-delay-${(renderedIdx % 3) + 1}`;
      card.className = `gallery-card reveal-on-scroll reveal-scale-up ${delayClass}`;
      card.setAttribute('tabindex', '0');
      card.innerHTML = `
        <div class="card-media-box">
          <img src="${escapeHtml(m.img)}" alt="${escapeHtml(m.title)}" class="gallery-img" loading="lazy" decoding="async">
          <span class="moment-click-prompt">РОЗБІР ▶</span>
        </div>
        <div class="card-info">
          <div class="card-top-meta">
            <span class="card-tag">${escapeHtml(m.badge)}</span>
            <span class="card-ch-badge">${escapeHtml(m.canon)}</span>
          </div>
          <h3 class="card-title-sm">${escapeHtml(m.title)}</h3>
          <p class="card-excerpt">${escapeHtml(m.quote)}</p>
        </div>
      `;
      card.addEventListener('click', () => openMomentModal(idx));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMomentModal(idx); }
      });
      galleryGrid.appendChild(card);
      renderedIdx += 1;
    });
    requestAnimationFrame(() => requestAnimationFrame(() => refreshScrollReveals(galleryGrid)));
  }

  document.querySelectorAll('.g-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      sfx.playClick();
      document.querySelectorAll('.g-filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderGallery(btn.getAttribute('data-gfilter') || 'all');
    });
  });

  function renderMomentModal(idx) {
    activeMomentIdx = (idx + SAE_GALLERY_MOMENTS.length) % SAE_GALLERY_MOMENTS.length;
    const m = SAE_GALLERY_MOMENTS[activeMomentIdx];
    if (!m) return;
    const modalImg = document.getElementById('modalImg');
    if (modalImg) {
      modalImg.classList.remove('moment-switch-anim');
      void modalImg.offsetWidth;
      modalImg.src = m.img;
      modalImg.alt = m.title;
      modalImg.classList.add('moment-switch-anim');
    }
    document.getElementById('modalBadge').textContent = m.badge;
    document.getElementById('modalCanonTag').textContent = m.canon;
    document.getElementById('modalEgoBadge').textContent = m.egoBadge;
    document.getElementById('momentCounterText').textContent = `${activeMomentIdx + 1} / ${SAE_GALLERY_MOMENTS.length}`;
    document.getElementById('modalTitle').textContent = m.title;
    document.getElementById('modalQuoteText').textContent = m.quote;
    document.getElementById('modalQuoteContext').textContent = m.quoteCtx;
    document.getElementById('modalEventNarrative').textContent = m.narrative;
    document.getElementById('modalTacticalImpact').textContent = m.tacticalImpact;
    document.getElementById('modalChipEgo').textContent = m.chipEgo;
    document.getElementById('modalChipRival').textContent = m.chipRival;
  }

  function openMomentModal(idx) {
    if (!galleryModal) return;
    sfx.playClick();
    renderMomentModal(idx);
    galleryModal.hidden = false;
    galleryModal.setAttribute('aria-hidden', 'false');
    galleryModal.classList.add('is-open');
  }

  function closeMomentModal() {
    if (!galleryModal) return;
    galleryModal.classList.remove('is-open');
    galleryModal.setAttribute('aria-hidden', 'true');
    galleryModal.hidden = true;
  }

  document.getElementById('closeModalBtn')?.addEventListener('click', closeMomentModal);
  document.getElementById('modalBackdrop')?.addEventListener('click', closeMomentModal);
  document.getElementById('prevMomentBtn')?.addEventListener('click', () => renderMomentModal(activeMomentIdx - 1));
  document.getElementById('nextMomentBtn')?.addEventListener('click', () => renderMomentModal(activeMomentIdx + 1));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMomentModal();
      callCtrl.closeHistory();
    }
  });

  // Render Weapons Detail
  const weaponCards = document.querySelectorAll('.weapon-card');
  const weaponDetailPanel = document.getElementById('weaponDetailPanel');

  function renderWeaponDetail(id) {
    if (!weaponDetailPanel) return;
    const d = SAE_WEAPONS_DATA[id] || SAE_WEAPONS_DATA.counter;
    const mechHtml = d.mechanics.map((m) => `
      <div class="mech-item">
        <div class="mech-title">// ${escapeHtml(m.title)}</div>
        <div class="mech-desc">${escapeHtml(m.desc)}</div>
      </div>
    `).join('');

    const statsHtml = d.stats.map((s) => `
      <div class="stat-bar-group">
        <div class="stat-bar-header"><span>${escapeHtml(s.name)}</span><span class="stat-bar-val">${escapeHtml(s.val)}</span></div>
        <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${s.fill}%"></div></div>
      </div>
    `).join('');

    const momentsHtml = d.moments.map((mom) => `
      <div class="weapon-moment-card" data-gallery-idx="${mom.galleryIndex}">
        <div class="weapon-moment-img-wrap">
          <img src="${escapeHtml(mom.img)}" alt="${escapeHtml(mom.title)}" class="weapon-moment-img" decoding="async">
          <span class="weapon-moment-ch-tag">${escapeHtml(mom.canon)}</span>
        </div>
        <div class="weapon-moment-body">
          <div class="weapon-moment-name">${escapeHtml(mom.title)}</div>
          <div class="weapon-moment-narrative">${escapeHtml(mom.narrative)}</div>
          <div class="weapon-moment-quote">${escapeHtml(mom.quote)}</div>
          <button type="button" class="open-moment-in-gallery-btn" data-gallery-idx="${mom.galleryIndex}">🔍 ВІДКРИТИ У ГАЛЕРЕЇ</button>
        </div>
      </div>
    `).join('');

    weaponDetailPanel.classList.toggle('flow-theme', id === 'flow');
    weaponDetailPanel.style.animation = 'none';
    void weaponDetailPanel.offsetWidth;
    weaponDetailPanel.style.animation = 'weaponDetailReveal 0.48s cubic-bezier(0.16, 1, 0.3, 1) both';

    weaponDetailPanel.innerHTML = `
      <div class="weapon-detail-meta-bar">
        <span class="weapon-detail-hud-badge">${escapeHtml(d.hudBadge)}</span>
        <span class="weapon-active-pill">АКТИВНИЙ ПРОФІЛЬ</span>
      </div>
      <h3 class="weapon-detail-title">${escapeHtml(d.name)}</h3>
      <p class="weapon-detail-sub">${escapeHtml(d.sub)}</p>
      <div class="weapon-detail-quote">${escapeHtml(d.quote)}</div>
      <div class="weapon-tactical-grid">
        <div>${mechHtml}</div>
        <div>${statsHtml}</div>
      </div>
      <h4 class="weapon-moments-title">КАНОНІЧНІ КАДРИ ЗАСТОСУВАННЯ</h4>
      <div class="weapon-moments-grid">${momentsHtml}</div>
    `;
  }

  weaponDetailPanel?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-gallery-idx]');
    if (!target) return;
    const idx = parseInt(target.getAttribute('data-gallery-idx') || '0', 10);
    if (!Number.isNaN(idx)) openMomentModal(idx);
  });

  weaponCards.forEach((card) => {
    card.addEventListener('click', () => {
      weaponCards.forEach((c) => c.classList.remove('active-weapon'));
      card.classList.add('active-weapon');
      renderWeaponDetail(card.getAttribute('data-weapon-id'));
      sfx.playClick();
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });

  // Initial Renders
  renderTimeline('all');
  renderGallery('all');
  renderWeaponDetail('counter');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      refreshScrollReveals(document);
    });
  });
});
