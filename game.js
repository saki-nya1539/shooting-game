const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const healthEl = document.getElementById("health");
const stageEl = document.getElementById("stage");
const powerEl = document.getElementById("power");
const powerProgressEl = document.getElementById("powerProgress");
const powerFillEl = document.getElementById("powerFill");
const statusEl = document.getElementById("status");
const overlay = document.getElementById("overlay");

const keys = {};
let gameState = "ready";
let lastTime = 0;
let shootHeld = false;
let spawnTimer = 0;
let itemSpawnTimer = 0;
let timeSurvived = 0;
let score = 0;
let health = 100;
let stage = 1;
let powerLevel = 1;
let powerProgress = 0;
let message = "";
let messageTimer = 0;
let audioContext = null;
let bgmOscillator = null;
let bgmSecondOscillator = null;
let bgmGainNode = null;
let bgmTimer = 0;
let bgmStep = 0;
let boss = null;
let bossBullets = [];
let enemyBullets = [];
let stageTransitionTimer = 0;
let bossBattleTimer = 0;
let masterVolume = 0.8;
let cameraShake = 0;
let cameraShakeTimer = 0;

const MAX_BULLETS = 220;
const MAX_ENEMY_BULLETS = 220;
const MAX_BOSS_BULLETS = 220;
const MAX_PARTICLES = 500;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPowerRequirement(levelValue = powerLevel) {
  const requirements = [4, 8, 14, 22];
  return levelValue >= 5 ? 0 : requirements[levelValue - 1] || 999;
}

function getStageTheme(stageValue = stage) {
  const index = ((stageValue - 1) % 5 + 5) % 5;
  const themes = [
    { top: "#040717", bottom: "#070b18", grid: "#3d4a6d", accent: "#72d2ff", starR: 255, starG: 255, starB: 255 },
    { top: "#140b2f", bottom: "#08041e", grid: "#564b7d", accent: "#a78bfa", starR: 214, starG: 176, starB: 255 },
    { top: "#261116", bottom: "#0f0507", grid: "#7c3f4b", accent: "#ff6b6b", starR: 255, starG: 191, starB: 154 },
    { top: "#062c2b", bottom: "#041a19", grid: "#1f6e6b", accent: "#34d399", starR: 184, starG: 255, starB: 230 },
    { top: "#2a1203", bottom: "#120701", grid: "#8a4f16", accent: "#fb923c", starR: 255, starG: 214, starB: 153 },
  ];
  return themes[index];
}

function applyPowerGain(amount = 1) {
  if (powerLevel >= 5) {
    powerProgress = 0;
    return;
  }

  powerProgress += amount;
  const requirement = getPowerRequirement(powerLevel);
  if (powerProgress >= requirement) {
    powerLevel = Math.min(5, powerLevel + 1);
    powerProgress = 0;
    message = `パワー ${powerLevel}x へ上昇`;
    messageTimer = 1.8;
    triggerShake(12, 0.2);
    playPowerSound();
    createExplosion(player.x, player.y - 20, "#72d2ff", 60, 270);
    createExplosion(player.x, player.y - 20, "#ffffff", 24, 140);
    for (let i = 0; i < 7; i += 1) {
      particles.push({
        x: player.x,
        y: player.y - 20,
        vx: (Math.random() - 0.5) * 360,
        vy: (Math.random() - 0.5) * 360 - 140,
        life: 1.2 + Math.random() * 0.6,
        color: i % 2 === 0 ? "#7dd3fc" : "#fef3c7",
        size: 3 + Math.random() * 2.8,
      });
    }
  }
}

const player = {
  x: canvas.width / 2,
  y: canvas.height - 80,
  radius: 20,
  speed: 420,
  cooldown: 0,
  maxHealth: 100,
  damage: 1,
};

const bullets = [];
const enemies = [];
const items = [];
const particles = [];
const stars = [];
const leaderboardKey = "starfall-defender-rankings";
const saveKey = "starfall-defender-save";

function initStars() {
  stars.length = 0;
  for (let i = 0; i < 140; i += 1) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 40 + 20,
      alpha: Math.random() * 0.7 + 0.3,
    });
  }
}

function ensureAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      audioContext = new AudioCtx();
    }
  }
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playTone(frequency, duration, type = "sine", gain = 0.03) {
  if (!audioContext) {
    ensureAudioContext();
  }
  if (!audioContext) {
    return;
  }
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gainNode.gain.value = clamp(gain * masterVolume, 0.0001, 1);
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function setMasterVolume(value) {
  masterVolume = clamp(value, 0, 1);
  if (bgmGainNode) {
    const targetGain = gameState === "running" ? 0.008 * masterVolume : 0.001 * masterVolume;
    bgmGainNode.gain.setTargetAtTime(targetGain, audioContext.currentTime, 0.2);
  }
}

function triggerShake(strength, duration = 0.16) {
  cameraShake = Math.max(cameraShake, strength);
  cameraShakeTimer = Math.max(cameraShakeTimer, duration);
}

function updateCameraShake(dt) {
  if (cameraShakeTimer > 0) {
    cameraShakeTimer = Math.max(0, cameraShakeTimer - dt);
    cameraShake = Math.max(0, cameraShake - dt * 80);
  } else {
    cameraShake = 0;
  }
}

function playShootSound() {
  playTone(740, 0.06, "square", 0.025);
}

function playHitSound() {
  playTone(220, 0.08, "triangle", 0.03);
}

function playPowerSound() {
  playTone(520, 0.12, "sine", 0.03);
}

function playBossSound() {
  playTone(180, 0.14, "sawtooth", 0.035);
}

function startBgm() {
  ensureAudioContext();
  if (bgmOscillator && bgmGainNode) {
    return;
  }

  const masterGain = audioContext.createGain();
  masterGain.gain.value = 0.004 * masterVolume;
  masterGain.connect(audioContext.destination);

  const osc1 = audioContext.createOscillator();
  osc1.type = "triangle";
  osc1.frequency.value = 220;
  osc1.connect(masterGain);
  osc1.start();

  const osc2 = audioContext.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = 330;
  osc2.connect(masterGain);
  osc2.start();

  bgmGainNode = masterGain;
  bgmOscillator = osc1;
  bgmSecondOscillator = osc2;
  bgmTimer = 0;
  bgmStep = 0;
}

function stopBgm() {
  if (bgmOscillator) {
    bgmOscillator.stop();
    bgmOscillator.disconnect();
  }
  if (bgmSecondOscillator) {
    bgmSecondOscillator.stop();
    bgmSecondOscillator.disconnect();
  }
  if (bgmGainNode) {
    bgmGainNode.disconnect();
  }
  bgmOscillator = null;
  bgmSecondOscillator = null;
  bgmGainNode = null;
}

function updateBgm(dt) {
  if (!bgmGainNode || !bgmOscillator || !bgmSecondOscillator) {
    return;
  }

  bgmTimer -= dt;
  if (bgmTimer <= 0) {
    const notes = [220, 260, 330, 390];
    bgmStep = (bgmStep + 1) % notes.length;
    const current = notes[bgmStep];
    const next = notes[(bgmStep + 1) % notes.length] * 0.8;
    bgmOscillator.frequency.setValueAtTime(current, audioContext.currentTime);
    bgmSecondOscillator.frequency.setValueAtTime(next, audioContext.currentTime);
    bgmTimer = 0.7;
  }

  const targetGain = gameState === "running" ? 0.008 * masterVolume : 0.001 * masterVolume;
  bgmGainNode.gain.setTargetAtTime(targetGain, audioContext.currentTime, 0.2);
}

function resetGame() {
  bullets.length = 0;
  enemies.length = 0;
  items.length = 0;
  particles.length = 0;
  bossBullets.length = 0;
  enemyBullets.length = 0;
  boss = null;
  score = 0;
  health = player.maxHealth;
  stage = 1;
  powerLevel = 1;
  powerProgress = 0;
  timeSurvived = 0;
  spawnTimer = 0.8;
  itemSpawnTimer = 4;
  message = "";
  messageTimer = 0;
  stageTransitionTimer = 0;
  bossBattleTimer = 0;
  cameraShake = 0;
  cameraShakeTimer = 0;
  player.x = canvas.width / 2;
  player.y = canvas.height - 80;
  player.cooldown = 0;
  updateHUD();
}

function startGame() {
  ensureAudioContext();
  startBgm();
  resetGame();
  gameState = "running";
  overlay.classList.add("hidden");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getLeaderboard() {
  try {
    const stored = localStorage.getItem(leaderboardKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(entries) {
  localStorage.setItem(leaderboardKey, JSON.stringify(entries));
}

function addScoreToLeaderboard(name, scoreValue, stageValue) {
  const entries = getLeaderboard();
  entries.push({
    name: name || "Player",
    score: scoreValue,
    stage: stageValue,
  });
  entries.sort((a, b) => b.score - a.score || b.stage - a.stage);
  const trimmed = entries.slice(0, 5);
  saveLeaderboard(trimmed);
  return trimmed;
}

function saveGame() {
  if (gameState !== "running") {
    return;
  }

  const saveData = {
    score,
    health,
    stage,
    powerLevel,
    timeSurvived,
    playerX: player.x,
    playerY: player.y,
    playerCooldown: player.cooldown,
    message,
    messageTimer,
    boss: boss
      ? {
          x: boss.x,
          y: boss.y,
          hp: boss.hp,
          maxHp: boss.maxHp,
          radius: boss.radius,
          shotTimer: boss.shotTimer,
          drift: boss.drift,
          color: boss.color,
          phase: boss.phase,
        }
      : null,
  };

  localStorage.setItem(saveKey, JSON.stringify(saveData));
  message = "セーブしました";
  messageTimer = 1.6;
  updateHUD();
}

function loadGame() {
  const stored = localStorage.getItem(saveKey);
  if (!stored) {
    message = "セーブデータがありません";
    messageTimer = 1.6;
    updateHUD();
    return;
  }

  const data = JSON.parse(stored);
  resetGame();
  score = data.score || 0;
  health = data.health || player.maxHealth;
  stage = data.stage || 1;
  powerLevel = data.powerLevel || 1;
  timeSurvived = data.timeSurvived || 0;
  player.x = data.playerX || canvas.width / 2;
  player.y = data.playerY || canvas.height - 80;
  player.cooldown = data.playerCooldown || 0;
  message = data.message || "ロードしました";
  messageTimer = data.messageTimer || 1.6;

  if (data.boss) {
    boss = {
      x: data.boss.x,
      y: data.boss.y,
      hp: data.boss.hp,
      maxHp: data.boss.maxHp,
      radius: data.boss.radius,
      shotTimer: data.boss.shotTimer,
      drift: data.boss.drift,
      color: data.boss.color,
      phase: data.boss.phase || "phase1",
    };
  }

  ensureAudioContext();
  startBgm();
  gameState = "running";
  overlay.classList.add("hidden");
  updateHUD();
}

function renderLeaderboard(entries) {
  if (!entries.length) {
    return '<p class="leaderboard-empty">まだランキングはありません。</p>';
  }

  return `
    <div class="leaderboard">
      <h3>トップ5ランキング</h3>
      <ol>
        ${entries
          .map(
            (entry, index) => `
              <li>
                <span>${index + 1}. ${escapeHtml(entry.name)}</span>
                <strong>${entry.score}点</strong>
                <small>Stage ${entry.stage}</small>
              </li>
            `
          )
          .join("")}
      </ol>
    </div>
  `;
}

function renderStartOverlay() {
  overlay.classList.remove("hidden");
  overlay.innerHTML = `
    <div class="overlay-card">
      <div class="hero-badge">🚀</div>
      <h1>Starfall Defender</h1>
      <p>宇宙の侵略者を撃ち落とし、要塞のシールドを守り抜け。回復アイテム・パワーアップ・ボス戦を駆使して、最深部の防衛線を突破しよう。</p>
      <div class="volume-row">
        <label for="volumeSlider">音量</label>
        <input id="volumeSlider" type="range" min="0" max="1" step="0.05" value="${masterVolume}" />
        <span id="volumeValue">${Math.round(masterVolume * 100)}%</span>
      </div>
      <div class="button-row">
        <button id="startButton" type="button">ゲーム開始</button>
        <button id="loadButton" class="secondary" type="button">ロード</button>
      </div>
      <div class="controls">
        <div>移動: WASD / 矢印キー</div>
        <div>射撃: スペース / クリック</div>
        <div>セーブ: S / ロード: L / 再スタート: R</div>
      </div>
      <span class="status-pill">ボスフェーズ切替・体力ゲージ・画面揺れ付き</span>
      ${renderLeaderboard(getLeaderboard())}
    </div>
  `;
  const volumeSlider = document.getElementById("volumeSlider");
  const volumeValue = document.getElementById("volumeValue");
  volumeSlider.addEventListener("input", (event) => {
    setMasterVolume(Number(event.target.value));
    volumeValue.textContent = `${Math.round(masterVolume * 100)}%`;
  });
  document.getElementById("startButton").addEventListener("click", startGame);
  document.getElementById("loadButton").addEventListener("click", loadGame);
}

function showGameOverOverlay(rankings) {
  overlay.classList.remove("hidden");
  overlay.innerHTML = `
    <div class="overlay-card">
      <h1>ゲームオーバー</h1>
      <p>最終スコア: ${score}点。ステージ ${stage} まで進みました。</p>
      <form id="scoreForm" class="score-form">
        <input id="playerNameInput" class="name-input" maxlength="12" placeholder="ランキングに名前を入力" autocomplete="off" />
        <div class="button-row">
          <button type="submit">登録する</button>
          <button type="button" id="skipScoreButton" class="secondary">スキップ</button>
        </div>
      </form>
      <div class="volume-row">
        <label for="volumeSlider">音量</label>
        <input id="volumeSlider" type="range" min="0" max="1" step="0.05" value="${masterVolume}" />
        <span id="volumeValue">${Math.round(masterVolume * 100)}%</span>
      </div>
      <div class="button-row">
        <button id="restartButton" type="button">もう一度プレイ</button>
      </div>
      ${renderLeaderboard(rankings)}
    </div>
  `;
  const scoreForm = document.getElementById("scoreForm");
  const volumeSlider = document.getElementById("volumeSlider");
  const volumeValue = document.getElementById("volumeValue");
  scoreForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("playerNameInput").value.trim() || "Player";
    const updatedRankings = addScoreToLeaderboard(name, score, stage);
    showGameOverOverlay(updatedRankings);
  });
  volumeSlider.addEventListener("input", (event) => {
    setMasterVolume(Number(event.target.value));
    volumeValue.textContent = `${Math.round(masterVolume * 100)}%`;
  });
  document.getElementById("skipScoreButton").addEventListener("click", () => {
    showGameOverOverlay(addScoreToLeaderboard("Player", score, stage));
  });
  document.getElementById("restartButton").addEventListener("click", startGame);
}

function endGame() {
  if (gameState === "over") {
    return;
  }

  gameState = "over";
  showGameOverOverlay(getLeaderboard());
  playBossSound();
}

function updateHUD() {
  scoreEl.textContent = score;
  healthEl.textContent = `${Math.max(0, Math.round(health))}%`;
  stageEl.textContent = stage;
  powerEl.textContent = `${powerLevel}x`;
  const requirement = getPowerRequirement(powerLevel);
  if (powerProgressEl) {
    powerProgressEl.textContent = powerLevel >= 5 ? "MAX" : `${powerProgress}/${requirement}`;
  }
  if (powerFillEl) {
    const percent = powerLevel >= 5 ? 100 : Math.min(100, (powerProgress / requirement) * 100);
    powerFillEl.style.width = `${Number.isFinite(percent) ? percent : 0}%`;
  }
  statusEl.textContent = boss
    ? (bossBattleTimer > 0 ? `ボス戦 ${bossBattleTimer.toFixed(1)}s` : "ボス戦")
    : (messageTimer > 0 ? "警戒" : "通常");
}

function fireBullet() {
  if (player.cooldown > 0) return;

  const pattern = powerLevel === 1 ? [0] : powerLevel === 2 ? [-8, 8] : [-13, 0, 13];
  const baseSpeed = 760 + (powerLevel - 1) * 70;
  const damage = 1 + Math.floor((powerLevel - 1) / 2);

  pattern.forEach((offset) => {
    bullets.push({
      x: player.x + offset,
      y: player.y - 20,
      radius: 5 + (powerLevel > 2 ? 1 : 0),
      speed: baseSpeed,
      vx: offset * 0.35,
      vy: -baseSpeed,
      damage,
    });
  });

  player.cooldown = Math.max(0.06, 0.18 - (powerLevel - 1) * 0.03);
  playShootSound();
}

function spawnEnemy() {
  const roll = Math.random();
  let type = "basic";
  let radius = 22;
  let hp = 2 + Math.floor(stage / 3);
  let speed = 110 + stage * 4;
  let color = "#ff6b6b";

  if (roll < 0.5) {
    type = "basic";
    radius = 22;
    hp = 2 + Math.floor(stage / 3);
    speed = 110 + stage * 4;
    color = "#ff6b6b";
  } else if (roll < 0.82) {
    type = "swift";
    radius = 16;
    hp = 1 + Math.floor(stage / 4);
    speed = 190 + stage * 5;
    color = "#ffd166";
  } else {
    type = "heavy";
    radius = 30;
    hp = 4 + Math.floor(stage / 2);
    speed = 70 + stage * 3;
    color = "#8d7bff";
  }

  enemies.push({
    x: Math.random() * (canvas.width - 60) + 30,
    y: -radius - 20,
    radius,
    hp,
    speed,
    color,
    type,
    drift: Math.random() * Math.PI * 2,
    barrageTimer: Math.random() * 2 + 1.2,
  });
}

function spawnBoss() {
  boss = {
    x: canvas.width / 2,
    y: 110,
    radius: 50,
    hp: 90 + stage * 18,
    maxHp: 90 + stage * 18,
    color: "#ff6b6b",
    shotTimer: 0.9,
    drift: Math.random() * Math.PI * 2,
    attackTimer: 0.7,
    phase: "phase1",
  };
  message = `ボス出現！10秒以内に倒せ`;
  messageTimer = 2.4;
  bossBattleTimer = 10;
  playBossSound();
}

function spawnItem(x, y) {
  const type = Math.random() < 0.6 ? "heal" : "power";
  items.push({
    x,
    y,
    radius: 12,
    type,
    vy: 100 + Math.random() * 70,
  });
}

function createParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 180,
      vy: (Math.random() - 0.5) * 180,
      life: 0.7 + Math.random() * 0.4,
      color,
      size: 2.2 + Math.random() * 1.2,
    });
  }
}

function createExplosion(x, y, color, count = 28, speed = 220) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
    const velocity = (Math.random() * 0.7 + 0.3) * speed;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: 0.8 + Math.random() * 0.7,
      color,
      size: 2.5 + Math.random() * 3.5,
    });
  }
  for (let i = 0; i < 10; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 120,
      vy: (Math.random() - 0.5) * 120,
      life: 0.9 + Math.random() * 0.5,
      color: "#ffffff",
      size: 1.6 + Math.random() * 2.2,
    });
  }
}

function trimArrays() {
  if (bullets.length > MAX_BULLETS) {
    bullets.splice(0, bullets.length - MAX_BULLETS);
  }
  if (enemyBullets.length > MAX_ENEMY_BULLETS) {
    enemyBullets.splice(0, enemyBullets.length - MAX_ENEMY_BULLETS);
  }
  if (bossBullets.length > MAX_BOSS_BULLETS) {
    bossBullets.splice(0, bossBullets.length - MAX_BOSS_BULLETS);
  }
  if (particles.length > MAX_PARTICLES) {
    particles.splice(0, particles.length - MAX_PARTICLES);
  }
}

function update(dt) {
  timeSurvived += dt;
  const desiredStage = 1 + Math.floor(timeSurvived / 18);
  if (desiredStage !== stage) {
    stage = desiredStage;
    stageTransitionTimer = 1.2;
    message = `ステージ ${stage} へ進行`;
    messageTimer = 1.6;
    if (stage > 1 && stage % 3 === 0) {
      spawnBoss();
    } else {
      playPowerSound();
    }
  }
  if (stageTransitionTimer > 0) {
    stageTransitionTimer = Math.max(0, stageTransitionTimer - dt);
  }
  updateHUD();
  updateBgm(dt);

  if (boss) {
    bossBattleTimer = Math.max(0, bossBattleTimer - dt);
    if (bossBattleTimer <= 0) {
      message = "タイムアップ！ボスを倒せませんでした";
      messageTimer = 2.2;
      endGame();
      return;
    }
  } else {
    bossBattleTimer = 0;
  }

  if (messageTimer > 0) {
    messageTimer = Math.max(0, messageTimer - dt);
  }

  updateCameraShake(dt);

  if (keys.KeyW || keys.ArrowUp) {
    player.y -= player.speed * dt;
  }
  if (keys.KeyS || keys.ArrowDown) {
    player.y += player.speed * dt;
  }
  if (keys.KeyA || keys.ArrowLeft) {
    player.x -= player.speed * dt;
  }
  if (keys.KeyD || keys.ArrowRight) {
    player.x += player.speed * dt;
  }

  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
  player.y = Math.max(player.radius + 20, Math.min(canvas.height - player.radius, player.y));

  player.cooldown = Math.max(0, player.cooldown - dt);

  if ((keys.Space || shootHeld) && player.cooldown <= 0) {
    fireBullet();
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0 && !boss && stageTransitionTimer <= 0) {
    spawnEnemy();
    spawnTimer = Math.max(0.3, 1.1 - stage * 0.05);
  }

  itemSpawnTimer -= dt;
  if (itemSpawnTimer <= 0 && stageTransitionTimer <= 0) {
    spawnItem(Math.random() * (canvas.width - 40) + 20, -12);
    itemSpawnTimer = 6 + Math.random() * 3;
  }

  bullets.forEach((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  });

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    if (bullet.y + bullet.radius < 0 || bullet.x < -30 || bullet.x > canvas.width + 30) {
      bullets.splice(i, 1);
    }
  }

  enemies.forEach((enemy) => {
    enemy.y += enemy.speed * dt;
    enemy.x += Math.sin(enemy.drift + timeSurvived * 0.8) * 40 * dt;
  });

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    if (enemy.y - enemy.radius > canvas.height + 20) {
      enemies.splice(i, 1);
      createParticles(enemy.x, enemy.y, "#4ade80", 10);
    }
  }

  items.forEach((item) => {
    item.y += item.vy * dt;
  });

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    const dist = Math.hypot(player.x - item.x, player.y - item.y);
    if (item.y > canvas.height + 20) {
      items.splice(i, 1);
    } else if (dist < player.radius + item.radius) {
      items.splice(i, 1);
      if (item.type === "heal") {
        health = Math.min(player.maxHealth, health + 25);
        createParticles(item.x, item.y, "#4ade80", 10);
        playPowerSound();
      } else {
        applyPowerGain(2);
        createParticles(item.x, item.y, "#72d2ff", 12);
      }
    }
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    if (boss) {
      const dist = Math.hypot(bullet.x - boss.x, bullet.y - boss.y);
      if (dist < bullet.radius + boss.radius) {
        bullets.splice(i, 1);
        boss.hp -= bullet.damage;
        createParticles(bullet.x, bullet.y, boss.color, 6);
        playHitSound();
        triggerShake(7, 0.1);
        if (boss.hp <= 0) {
          score += 500;
          createExplosion(boss.x, boss.y, "#ffd166", 48, 260);
          triggerShake(18, 0.25);
          boss = null;
          message = "ボス撃破！";
          messageTimer = 2.2;
          health = Math.min(player.maxHealth, health + 20);
          playPowerSound();
        }
      }
    }

    for (let j = enemies.length - 1; j >= 0; j -= 1) {
      const enemy = enemies[j];
      const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
      if (dist < bullet.radius + enemy.radius) {
        bullets.splice(i, 1);
        enemy.hp -= bullet.damage;
        createParticles(bullet.x, bullet.y, enemy.color, 4);
        triggerShake(3, 0.06);
        if (enemy.hp <= 0) {
          enemies.splice(j, 1);
          score += enemy.type === "heavy" ? 40 : enemy.type === "swift" ? 25 : 15;
          applyPowerGain(1);
          if (Math.random() < 0.3) {
            spawnItem(enemy.x, enemy.y);
          }
          createExplosion(enemy.x, enemy.y, enemy.color, 22, 180);
        }
        break;
      }
    }
  }

  if (boss) {
    boss.attackTimer -= dt;
    boss.shotTimer -= dt;
    boss.x += Math.sin(timeSurvived * 1.1 + boss.drift) * 120 * dt;
    boss.y = 110 + Math.sin(timeSurvived * 0.6 + boss.drift) * 18;
    const hpRatio = boss.hp / boss.maxHp;
    const nextPhase = hpRatio > 0.55 ? "phase1" : "phase2";
    if (boss.phase !== nextPhase) {
      boss.phase = nextPhase;
      boss.color = nextPhase === "phase2" ? "#ff8a00" : "#ff6b6b";
      boss.phaseTimer = 1.2;
      message = nextPhase === "phase2" ? "ボスが暴走した！" : "ボスが態勢を立て直した";
      messageTimer = 1.2;
      triggerShake(12, 0.2);
      createExplosion(boss.x, boss.y, nextPhase === "phase2" ? "#fb923c" : "#ffd166", 36, 240);
    }
    if (boss.phaseTimer > 0) {
      boss.phaseTimer = Math.max(0, boss.phaseTimer - dt);
    }
    if (boss.attackTimer <= 0 && bossBullets.length < MAX_BOSS_BULLETS) {
      const playerAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
      if (boss.phase === "phase1") {
        for (let i = 0; i < 6; i += 1) {
          const angle = playerAngle + (i - 3.5) * 0.35;
          bossBullets.push({
            x: boss.x,
            y: boss.y + 24,
            radius: 6,
            vx: Math.cos(angle) * 250,
            vy: Math.sin(angle) * 250,
            color: "#ff9f1c",
            life: 3,
          });
          const orbitAngle = timeSurvived * 1.2 + i * 0.5;
          bossBullets.push({
            x: boss.x,
            y: boss.y + 24,
            radius: 5,
            vx: Math.cos(orbitAngle) * 160 + Math.cos(playerAngle) * 70,
            vy: Math.sin(orbitAngle) * 160 + Math.sin(playerAngle) * 70,
            color: "#fbbf24",
            life: 2.6,
          });
        }
      } else {
        for (let i = 0; i < 10; i += 1) {
          const ringAngle = (i / 12) * Math.PI * 2 + timeSurvived * 0.8;
          bossBullets.push({
            x: boss.x,
            y: boss.y + 24,
            radius: 6,
            vx: Math.cos(ringAngle) * 180,
            vy: Math.sin(ringAngle) * 180,
            color: "#ef4444",
            life: 3.2,
          });
        }
        for (let i = 0; i < 3; i += 1) {
          const angle = playerAngle + (i - 1.5) * 0.2;
          bossBullets.push({
            x: boss.x,
            y: boss.y + 24,
            radius: 7,
            vx: Math.cos(angle) * 320,
            vy: Math.sin(angle) * 320,
            color: "#fb923c",
            life: 2.7,
          });
        }
      }
      boss.attackTimer = boss.phase === "phase1" ? 0.6 : 0.45;
      triggerShake(boss.phase === "phase1" ? 5 : 8, 0.12);
      playBossSound();
    }
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (dist < player.radius + enemy.radius) {
      enemies.splice(i, 1);
      health = Math.max(0, health - (enemy.type === "heavy" ? 25 : 12));
      createParticles(player.x, player.y, "#7dd3fc", 12);
      playHitSound();
      triggerShake(6, 0.12);
      if (health <= 0) {
        endGame();
        break;
      }
    }
  }

  particles.forEach((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    particle.vx *= 0.95;
    particle.vy *= 0.95;
  });

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    if (particles[i].life <= 0) {
      particles.splice(i, 1);
    }
  }

  stars.forEach((star) => {
    star.y += star.speed * dt;
    if (star.y > canvas.height + 4) {
      star.y = -4;
      star.x = Math.random() * canvas.width;
    }
  });

  trimArrays();
}

function drawBackground() {
  const theme = getStageTheme(stage);
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, theme.top);
  gradient.addColorStop(1, theme.bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  const patternSpacing = stage % 2 === 0 ? 48 : 60;
  for (let x = -patternSpacing; x <= canvas.width + patternSpacing; x += patternSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + patternSpacing * 0.4, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += patternSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y + (stage % 3 === 0 ? 24 : 0));
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = stage > 3 ? 0.18 : 0.08;
  const orbitGradient = ctx.createRadialGradient(canvas.width * 0.7, canvas.height * 0.2, 40, canvas.width * 0.7, canvas.height * 0.2, 220);
  orbitGradient.addColorStop(0, theme.accent);
  orbitGradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = orbitGradient;
  ctx.beginPath();
  ctx.arc(canvas.width * 0.7, canvas.height * 0.2, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  stars.forEach((star) => {
    ctx.beginPath();
    const starTheme = getStageTheme(stage);
    ctx.fillStyle = `rgba(${starTheme.starR},${starTheme.starG},${starTheme.starB},${star.alpha})`;
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.strokeStyle = "#9eeeff";
  ctx.lineWidth = 2;
  ctx.fillStyle = "#1f7cff";
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(16, 18);
  ctx.lineTo(8, 12);
  ctx.lineTo(0, 20);
  ctx.lineTo(-8, 12);
  ctx.lineTo(-16, 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#7dd3fc";
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(-6, 24);
  ctx.lineTo(0, 20);
  ctx.lineTo(6, 24);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawBullets() {
  bullets.forEach((bullet) => {
    ctx.beginPath();
    ctx.fillStyle = "#fef3c7";
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawEnemies() {
  enemies.forEach((enemy) => {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.fillStyle = enemy.color;

    if (enemy.type === "swift") {
      ctx.beginPath();
      ctx.moveTo(0, -enemy.radius);
      ctx.lineTo(enemy.radius, 0);
      ctx.lineTo(0, enemy.radius);
      ctx.lineTo(-enemy.radius, 0);
      ctx.closePath();
    } else if (enemy.type === "heavy") {
      ctx.beginPath();
      ctx.moveTo(0, -enemy.radius);
      ctx.lineTo(enemy.radius * 0.8, -enemy.radius * 0.4);
      ctx.lineTo(enemy.radius, enemy.radius * 0.4);
      ctx.lineTo(0, enemy.radius);
      ctx.lineTo(-enemy.radius, enemy.radius * 0.4);
      ctx.lineTo(-enemy.radius * 0.8, -enemy.radius * 0.4);
      ctx.closePath();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -enemy.radius);
      ctx.lineTo(enemy.radius, enemy.radius * 0.5);
      ctx.lineTo(enemy.radius * 0.4, enemy.radius);
      ctx.lineTo(0, enemy.radius * 0.7);
      ctx.lineTo(-enemy.radius * 0.4, enemy.radius);
      ctx.lineTo(-enemy.radius, enemy.radius * 0.5);
      ctx.closePath();
    }

    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}

function drawItems() {
  items.forEach((item) => {
    ctx.save();
    ctx.translate(item.x, item.y);
    if (item.type === "heal") {
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-4, -6, 8, 12);
      ctx.fillRect(-6, -4, 12, 8);
    } else {
      ctx.fillStyle = "#72d2ff";
      ctx.beginPath();
      ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-4, -8, 8, 16);
    }
    ctx.restore();
  });
}

function drawBoss() {
  if (!boss) return;
  ctx.save();
  const theme = getStageTheme(stage);
  if (boss.phaseTimer > 0) {
    ctx.globalAlpha = 0.45 + (boss.phaseTimer / 1.2) * 0.35;
    ctx.beginPath();
    ctx.strokeStyle = boss.phase === "phase2" ? "#fb923c" : theme.accent;
    ctx.lineWidth = 4;
    ctx.arc(0, 0, 78 + (1 - boss.phaseTimer / 1.2) * 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.translate(boss.x, boss.y);
  ctx.strokeStyle = "#fff3b0";
  ctx.lineWidth = 3;
  ctx.fillStyle = boss.color;
  ctx.beginPath();
  ctx.moveTo(0, -boss.radius);
  ctx.lineTo(38, -12);
  ctx.lineTo(24, 24);
  ctx.lineTo(0, boss.radius);
  ctx.lineTo(-24, 24);
  ctx.lineTo(-38, -12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-12, -4, 5, 0, Math.PI * 2);
  ctx.arc(12, -4, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#4b5563";
  ctx.fillRect(-10, 8, 20, 8);
  ctx.restore();

  const hpRatio = boss.hp / boss.maxHp;
  const barWidth = 220;
  const barHeight = 12;
  const x = canvas.width / 2 - barWidth / 2;
  const y = 26;
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = boss.phase === "phase2" ? "#ff8a00" : "#ef4444";
  ctx.fillRect(x, y, barWidth * hpRatio, barHeight);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(x, y, barWidth, barHeight);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`BOSS ${boss.phase === "phase2" ? "PHASE 2" : "PHASE 1"}`, canvas.width / 2, 18);
}

function drawParticles() {
  particles.forEach((particle) => {
    ctx.beginPath();
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.arc(particle.x, particle.y, particle.size || 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawMessage() {
  if (messageTimer <= 0) return;
  const theme = getStageTheme(stage);
  ctx.save();
  ctx.fillStyle = "rgba(8, 12, 24, 0.8)";
  ctx.fillRect(canvas.width / 2 - 160, 24, 320, 42);
  ctx.fillStyle = theme.accent;
  ctx.textAlign = "center";
  ctx.font = "18px sans-serif";
  ctx.fillText(message, canvas.width / 2, 52);
  ctx.restore();
}

function render() {
  ctx.save();
  const shakeX = (Math.random() - 0.5) * cameraShake;
  const shakeY = (Math.random() - 0.5) * cameraShake;
  ctx.translate(shakeX, shakeY);
  drawBackground();
  drawParticles();
  drawBullets();
  drawEnemies();
  drawItems();
  drawBoss();
  drawPlayer();
  drawMessage();
  ctx.restore();
}

function loop(timestamp) {
  if (!lastTime) {
    lastTime = timestamp;
  }
  const dt = Math.min(0.03, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  if (gameState === "running") {
    update(dt);
  }

  render();
  requestAnimationFrame(loop);
}

canvas.addEventListener("pointerdown", () => {
  shootHeld = true;
  if (gameState === "ready") {
    startGame();
  }
  fireBullet();
});

canvas.addEventListener("pointerup", () => {
  shootHeld = false;
});

canvas.addEventListener("pointerleave", () => {
  shootHeld = false;
});

window.addEventListener("keydown", (event) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
    event.preventDefault();
  }
  keys[event.code] = true;

  if (event.code === "KeyR") {
    startGame();
  }
  if (event.code === "KeyS") {
    saveGame();
  }
  if (event.code === "KeyL") {
    loadGame();
  }
  if (event.code === "Space" && gameState === "ready") {
    startGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

window.addEventListener("resize", () => {
  initStars();
});

initStars();
resetGame();
updateHUD();
renderStartOverlay();
requestAnimationFrame(loop);
