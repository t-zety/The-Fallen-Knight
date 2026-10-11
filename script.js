
const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

const ui = {
  coins: document.getElementById("coins"),
  diamonds: document.getElementById("diamonds"),
  health: document.getElementById("health"),
  notice: document.getElementById("notice"),
  level: document.getElementById("level")
};

const keys = {};
const held = { left: false, right: false };

let W = 900, H = 450, ground = 370;
let camera = 0, coins = 0, diamonds = 0, health = 100;
let level = 1, lastTime = 0, noticeTimer = 0;
let sceneSeed = 12345;
let portalReady = false, gameOver = false;

const knight = {
  x: 100, y: 0, vx: 0, vy: 0,
  w: 30, h: 55, face: 1,
  grounded: false, attacking: 0,
  invulnerable: 0, step: 0
};

let treasures = [];
let monster = {};
let portal = {};

function message(text) {
  ui.notice.textContent = text;
  noticeTimer = 3;
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  W = rect.width;
  H = rect.height;
  ground = H * 0.79;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  knight.y = Math.min(knight.y || ground - knight.h,
                      ground - knight.h);
}

window.addEventListener("resize", resize);

function rand(seed) {
  const n = Math.sin(seed * 127.1 + sceneSeed * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function resetLevel() {
  sceneSeed = level * 9187 + 17;
  knight.x = 80;
  knight.y = ground - knight.h;
  knight.vx = 0;
  knight.vy = 0;
  knight.grounded = true;
  knight.attacking = 0;

  portalReady = false;

  monster = {
    x: W * 0.65,
    y: ground - 43,
    hp: Math.min(2 + Math.floor(level / 2), 8),
    alive: true,
    w: 42,
    h: 43,
    phase: 0
  };

  portal = { x: W * 0.88, pulse: 0 };

  treasures = [];

  for (let i = 0; i < 9; i++) {
    treasures.push({
      x: W * (0.18 + i * 0.075),
      y: ground - 65 - (i % 3) * 43,
      type: i % 4 === 0 ? "diamond" : "coin",
      taken: false,
      phase: rand(i + level) * 6
    });
  }

  ui.level.textContent =
    ["", "FOREST OF WHISPERS", "MOONLIT RUINS",
     "CRYSTAL ABYSS"][((level - 1) % 3) + 1] +
    " · LEVEL " + level;
}

function roundedRect(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawBackground(time) {
  let top, bottom;

  if (level % 3 === 1) {
    top = "#101a3b";
    bottom = "#37645c";
  } else if (level % 3 === 2) {
    top = "#321e50";
    bottom = "#85576c";
  } else {
    top = "#062a42";
    bottom = "#14717b";
  }

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, top);
  sky.addColorStop(1, bottom);

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Moon
  ctx.fillStyle = "#e0f8ff";
  ctx.shadowColor = "#83eaff";
  ctx.shadowBlur = 25;
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.19, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Stars
  for (let i = 0; i < 55; i++) {
    const sx = rand(i + 10) * W;
    const sy = rand(i + 80) * H * 0.65;
    const twinkle = 0.4 + Math.sin(time * 0.002 + i) * 0.35;

    ctx.globalAlpha = Math.max(0.15, twinkle);
    ctx.fillStyle = "#d9faff";
    ctx.fillRect(sx, sy, 2, 2);
  }

  ctx.globalAlpha = 1;

  // Distant forest silhouettes
  for (let i = 0; i < 15; i++) {
    const tx = i * (W / 10) - (camera * 0.15 % (W / 10));

    ctx.fillStyle = level % 3 === 2 ? "#38284e" : "#142b3c";
    ctx.beginPath();
    ctx.moveTo(tx - 55, ground);
    ctx.lineTo(tx, H * (0.25 + rand(i + 2) * 0.2));
    ctx.lineTo(tx + 65, ground);
    ctx.fill();

    ctx.fillStyle = level % 3 === 2 ? "#302544" : "#102b32";
    ctx.fillRect(tx - 8, ground - 75, 16, 75);
  }

  // Glowing plants
  for (let i = 0; i < 12; i++) {
    const px = ((i * 91 - camera * 0.5) % W + W) % W;
    const py = ground - 12 - rand(i + 9) * 30;

    ctx.fillStyle = "#62d9c5";
    ctx.shadowColor = "#5effde";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(px, py, 3 + rand(i + 4) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Natural ground, not floating blocks
  ctx.fillStyle = "#203d32";
  ctx.fillRect(0, ground, W, H - ground);

  ctx.fillStyle = "#537d4d";
  ctx.fillRect(0, ground, W, 7);

  for (let i = 0; i < W / 18 + 2; i++) {
    const gx = ((i * 18 - camera) % W + W) % W;
    ctx.strokeStyle = "#80a968";
    ctx.beginPath();
    ctx.moveTo(gx, ground + 5);
    ctx.lineTo(gx - 4, ground + 12);
    ctx.stroke();
  }
}

function drawKnight(time) {
  const x = knight.x - camera;
  const y = knight.y;

  const moving = Math.abs(knight.vx) > 0.5;
  const swing = moving ? Math.sin(knight.step) * 5 : 0;
  const bob = moving ? Math.abs(Math.sin(knight.step)) * 3 : 0;

  ctx.save();
  ctx.translate(x + knight.w / 2, y + bob + knight.h / 2);
  ctx.scale(knight.face, 1);

  // Cape
  ctx.fillStyle = "#633e96";
  ctx.beginPath();
  ctx.moveTo(-5, -5);
  ctx.lineTo(-19 - swing, 13);
  ctx.lineTo(-11, 21);
  ctx.lineTo(1, 6);
  ctx.fill();

  // Legs
  ctx.strokeStyle = "#d7d7e8";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(-5, 15);
  ctx.lineTo(-7 + swing, 25);
  ctx.moveTo(5, 15);
  ctx.lineTo(7 - swing, 25);
  ctx.stroke();

  // Boots
  ctx.strokeStyle = "#332c48";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-7 + swing, 25);
  ctx.lineTo(-2 + swing, 25);
  ctx.moveTo(7 - swing, 25);
  ctx.lineTo(12 - swing, 25);
  ctx.stroke();

  // Body armour
  roundedRect(-11, -7, 22, 25, 6, "#9b9ab9");
  roundedRect(-7, -3, 14, 17, 4, "#56567c");

  // Belt
  ctx.fillStyle = "#e4bd70";
  ctx.fillRect(-10, 9, 20, 3);

  // Head
  ctx.fillStyle = "#f0c7a2";
  ctx.beginPath();
  ctx.arc(0, -15, 11, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = "#302b43";
  ctx.beginPath();
  ctx.arc(-1, -20, 11, Math.PI, Math.PI * 2);
  ctx.lineTo(10, -13);
  ctx.lineTo(4, -17);
  ctx.lineTo(-5, -14);
  ctx.fill();

  // Eye
  ctx.fillStyle = "#24213a";
  ctx.fillRect(5, -16, 3, 3);

  // Knight's hood
  ctx.fillStyle = "#805bc1";
  ctx.beginPath();
  ctx.moveTo(-12, -19);
  ctx.lineTo(-5, -30);
  ctx.lineTo(8, -25);
  ctx.lineTo(12, -16);
  ctx.lineTo(3, -21);
  ctx.lineTo(-6, -17);
  ctx.fill();

  // Sword arm
  ctx.strokeStyle = "#e8c5a5";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(8, -4);
  ctx.lineTo(15, 3);
  ctx.stroke();

  ctx.strokeStyle = "#d7f8ff";
  ctx.lineWidth = 3;
  ctx.beginPath();

  if (knight.attacking > 0) {
    ctx.moveTo(14, 3);
    ctx.lineTo(34, -13);
  } else {
    ctx.moveTo(15, 3);
    ctx.lineTo(22, -8);
  }

  ctx.stroke();

  ctx.restore();

  if (knight.invulnerable > 0 && Math.floor(time / 90) % 2 === 0) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 3, y - 3, knight.w + 6, knight.h + 6);
    ctx.globalAlpha = 1;
  }
}

function drawMonster(time) {
  if (!monster.alive) return;

  const x = monster.x - camera;
  const bob = Math.sin(time * 0.004) * 4;

  ctx.save();
  ctx.translate(x, monster.y + bob);

  ctx.shadowColor = "#ff72dc";
  ctx.shadowBlur = 15;

  ctx.fillStyle = level % 2 ? "#9252a7" : "#417f99";
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 23, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Ears
  ctx.fillStyle = "#bc77c8";
  ctx.beginPath();
  ctx.moveTo(-16, -15);
  ctx.lineTo(-24, -30);
  ctx.lineTo(-7, -20);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(15, -15);
  ctx.lineTo(24, -29);
  ctx.lineTo(7, -20);
  ctx.fill();

  // Eyes
  ctx.fillStyle = "#fff4b0";
  ctx.beginPath();
  ctx.ellipse(-8, -5, 5, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(8, -5, 5, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#29213b";
  ctx.fillRect(-9, -7, 3, 5);
  ctx.fillRect(7, -7, 3, 5);

  // Mouth
  ctx.fillStyle = "#351d46";
  ctx.fillRect(-7, 7, 14, 4);

  // Health bar
  ctx.fillStyle = "#21152f";
  ctx.fillRect(-22, -39, 44, 5);
  ctx.fillStyle = "#ff8dc9";
  ctx.fillRect(-22, -39, 44 * monster.hp /
    Math.min(2 + Math.floor(level / 2), 8), 5);

  ctx.restore();
}

function drawTreasure(time) {
  treasures.forEach(t => {
    if (t.taken) return;

    const x = t.x - camera;
    const y = t.y + Math.sin(time * 0.003 + t.phase) * 5;

    ctx.save();
    ctx.translate(x, y);

    if (t.type === "coin") {
      ctx.shadowColor = "#ffe58a";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#ffd65d";
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#fff0ad";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#9c681a";
      ctx.font = "bold 10px Georgia";
      ctx.textAlign = "center";
      ctx.fillText("C", 0, 4);
    } else {
      ctx.shadowColor = "#72faff";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#73efff";
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(9, -3);
      ctx.lineTo(5, 10);
      ctx.lineTo(-5, 10);
      ctx.lineTo(-9, -3);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#d9ffff";
      ctx.stroke();
    }

    ctx.restore();
  });
}

function drawPortal(time) {
  const x = portal.x - camera;
  const y = ground - 48;
  const pulse = 1 + Math.sin(time * 0.004) * 0.06;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);

  ctx.shadowColor = portalReady ? "#fff2a0" : "#6ceaff";
  ctx.shadowBlur = portalReady ? 30 : 17;
  ctx.strokeStyle = portalReady ? "#fff0a3" : "#8deeff";
  ctx.lineWidth = 5;

  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 43, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#80baff33";
  ctx.beginPath();
  ctx.ellipse(0, 0, 19, 38, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.font = "19px Georgia";
  ctx.textAlign = "center";
  ctx.fillText("✦", 0, 5);

  ctx.restore();
}

function collectItems() {
  const px = knight.x + knight.w / 2;
  const py = knight.y + knight.h / 2;

  treasures.forEach(t => {
    if (t.taken) return;

    if (Math.abs(px - t.x) < 23 &&
        Math.abs(py - t.y) < 34) {
      t.taken = true;

      if (t.type === "coin") {
        coins++;
        message("Golden coin collected!");
      } else {
        diamonds++;
        message("Crystal diamond collected!");
      }

      updateUI();
    }
  });
}

function updateUI() {
  ui.coins.textContent = coins;
  ui.diamonds.textContent = diamonds;
  ui.health.textContent = health;
}

function attack() {
  if (gameOver) return;

  knight.attacking = 0.25;

  if (!monster.alive) return;

  const distance = monster.x - (knight.x + knight.w / 2);
  const close = Math.abs(distance) < 78;
  const correctSide = Math.sign(distance) === knight.face;

  if (close && correctSide) {
    monster.hp--;
    message("Your sword strikes the monster!");

    if (monster.hp <= 0) {
      monster.alive = false;
      portalReady = true;
      diamonds += Math.min(level, 5);
      updateUI();
      message("Monster defeated! Portal unlocked!");
    }
  } else {
    message("Move closer and face the monster.");
  }
}

function jump() {
  if (knight.grounded && !gameOver) {
    knight.vy = -470;
    knight.grounded = false;
  }
}

function nextLevel() {
  if (!portalReady) {
    message("Defeat the monster to unlock this portal.");
    return;
  }

  if (Math.abs(knight.x - portal.x) > 65) {
    message("Walk closer to the portal.");
    return;
  }

  if (level >= 30) {
    gameOver = true;
    message("You saved the enchanted realms! Congratulations!");
    return;
  }

  level++;
  resetLevel();
  updateUI();
  message("A new dimension awaits...");
}

function update(dt, time) {
  if (gameOver) return;

  const dir = (held.right || keys.ArrowRight || keys.KeyD ? 1 : 0) -
              (held.left || keys.ArrowLeft || keys.KeyA ? 1 : 0);

  knight.vx = dir * 220;

  if (dir !== 0) knight.face = dir;

  knight.x += knight.vx * dt;
  knight.x = Math.max(0, Math.min(W * 3 - 50, knight.x));

  knight.vy += 1250 * dt;
  knight.y += knight.vy * dt;

  if (knight.y + knight.h >= ground) {
    knight.y = ground - knight.h;
    knight.vy = 0;
    knight.grounded = true;
  }

  knight.step += Math.abs(knight.vx) * dt * 0.055;
  knight.attacking = Math.max(0, knight.attacking - dt);
  knight.invulnerable = Math.max(0, knight.invulnerable - dt);

  monster.phase += dt;

  // Monster patrols near its starting area
  if (monster.alive) {
    monster.x = W * 0.65 + Math.sin(time * 0.0007) * 35;
  }

  camera = Math.max(0, knight.x - W * 0.35);

  collectItems();

  if (monster.alive &&
      knight.invulnerable <= 0 &&
      Math.abs(knight.x - monster.x) < 32 &&
      knight.y + knight.h > monster.y - 20) {
    health = Math.max(0, health - 10);
    knight.invulnerable = 1;
    knight.vy = -220;
    updateUI();

    if (health <= 0) {
      gameOver = true;
      message("Your knight has fallen. Refresh to try again.");
    } else {
      message("The monster hit you! Watch your health.");
    }
  }

  if (Math.abs(knight.x - portal.x) < 38 &&
      Math.abs(knight.y + knight.h - ground) < 10) {
    if (portalReady) {
      nextLevel();
    } else if (!monster.alive) {
      portalReady = true;
    }
  }

  if (noticeTimer > 0) {
    noticeTimer -= dt;
  }
}

function draw(time) {
  drawBackground(time);
  drawTreasure(time);
  drawMonster(time);
  drawPortal(time);
  drawKnight(time);
}

function loop(time) {
  const dt = Math.min((time - lastTime) / 1000 || 0, 0.035);
  lastTime = time;

  update(dt, time);
  draw(time);

  requestAnimationFrame(loop);
}

function bindHold(id, key) {
  const button = document.getElementById(id);

  button.addEventListener("pointerdown", e => {
    e.preventDefault();
    held[key] = true;
    button.setPointerCapture(e.pointerId);
  });

  const release = () => held[key] = false;
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}

bindHold("left", "left");
bindHold("right", "right");

document.getElementById("jump").addEventListener("click", jump);
document.getElementById("attack").addEventListener("click", attack);

canvas.addEventListener("pointerdown", e => {
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left + camera;
  const py = e.clientY - rect.top;

  if (Math.abs(px - portal.x) < 45 &&
      Math.abs(py - (ground - 48)) < 55) {
    nextLevel();
  }
});

window.addEventListener("keydown", e => {
  keys[e.code] = true;

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(e.code)) {
    e.preventDefault();
  }

  if (e.code === "Space" || e.code === "ArrowUp") jump();
  if (e.code === "KeyJ" || e.code === "KeyK") attack();
});

window.addEventListener("keyup", e => {
  keys[e.code] = false;
});

resize();
resetLevel();
updateUI();
requestAnimationFrame(loop);
