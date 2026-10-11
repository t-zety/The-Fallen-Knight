
const scene = document.getElementById("scene");
const player = document.getElementById("player");
const monster = document.getElementById("monster");
const portal = document.getElementById("portal");
const collectibles = document.getElementById("collectibles");

const coinsDisplay = document.getElementById("coins");
const diamondsDisplay = document.getElementById("diamonds");
const strengthDisplay = document.getElementById("strength");
const message = document.getElementById("message");

let x = 10;
let y = 0;
let velocityY = 0;
let coins = 0;
let diamonds = 0;
let strength = 100;
let monsterHP = 3;
let facing = 1;
let level = 1;
let defeated = false;
let jumping = false;
let attacking = false;
let portalUnlocked = false;
let keys = {};
let lastAttack = 0;

const treasures = [];
const gravity = 0.65;
const jumpPower = 12;
const groundHeight = 73;

function showMessage(text) {
  message.textContent = text;
}

function updateStats() {
  coinsDisplay.textContent = coins;
  diamondsDisplay.textContent = diamonds;
  strengthDisplay.textContent = strength;
}

function makeTreasures() {
  collectibles.innerHTML = "";
  treasures.length = 0;

  const sceneWidth = scene.clientWidth;

  for (let i = 0; i < 6; i++) {
    const item = document.createElement("span");
    const isDiamond = i % 3 === 0;

    item.className = "treasure";
    item.textContent = isDiamond ? "💎" : "🪙";
    item.style.left = (15 + i * 13) + "%";
    item.style.bottom = (95 + (i % 2) * 55) + "px";

    collectibles.appendChild(item);

    treasures.push({
      element: item,
      x: sceneWidth * (0.15 + i * 0.13),
      y: 95 + (i % 2) * 55,
      type: isDiamond ? "diamond" : "coin",
      collected: false
    });
  }
}

function updatePlayer() {
  player.style.left = x + "%";
  player.style.bottom = (groundHeight + y) + "px";

  if (facing === -1) {
    player.classList.add("facing-left");
  } else {
    player.classList.remove("facing-left");
  }

  if (jumping) {
    player.classList.add("jumping");
  } else {
    player.classList.remove("jumping");
  }
}

function moveLeft() {
  x = Math.max(0, x - 2);
  facing = -1;
  updatePlayer();
}

function moveRight() {
  x = Math.min(94, x + 2);
  facing = 1;
  updatePlayer();
}

function jump() {
  if (jumping) return;

  jumping = true;
  velocityY = jumpPower;
  showMessage("Jump! ✨");
  updatePlayer();
}

function attack() {
  const now = Date.now();

  if (now - lastAttack < 500) return;
  lastAttack = now;

  attacking = true;
  player.classList.add("attacking");

  setTimeout(() => {
    attacking = false;
    player.classList.remove("attacking");
  }, 250);

  const distance = Math.abs(x - monster.offsetLeft /
    scene.clientWidth * 100);

  if (!defeated && distance < 18) {
    monsterHP--;

    if (monsterHP <= 0) {
      defeatMonster();
    } else {
      showMessage("Monster hit! HP: " + monsterHP);
    }
  } else {
    showMessage("Swing! Get closer to the monster.");
  }
}

function defeatMonster() {
  defeated = true;
  monster.style.display = "none";

  const reward = Math.min(level, 5);
  diamonds += reward;
  updateStats();

  portalUnlocked = true;
  portal.style.filter = "brightness(1.7)";
  portal.style.boxShadow = "0 0 35px #a6ffff";

  showMessage("Monster defeated! +" + reward +
    " diamonds. Portal unlocked! 💎");
}

function collectTreasures() {
  const sceneWidth = scene.clientWidth;
  const playerX = x / 100 * sceneWidth;
  const playerY = groundHeight + y + 35;

  treasures.forEach(item => {
    if (item.collected) return;

    const distanceX = Math.abs(playerX - item.x);
    const distanceY = Math.abs(playerY - item.y);

    if (distanceX < 38 && distanceY < 90) {
      item.collected = true;
      item.element.style.display = "none";

      if (item.type === "coin") {
        coins += 1;
        showMessage("+1 golden coin! 🪙");
      } else {
        diamonds += 1;
        showMessage("+1 diamond! 💎");
      }

      updateStats();
    }
  });
}

function enterPortal() {
  if (!portalUnlocked) {
    showMessage("Defeat the monster to unlock the portal!");
    return;
  }

  level++;

  if (level > 30) {
    showMessage("You completed all 30 levels! Félicitations!");
    level = 30;
    return;
  }

  const dimension = level % 3;

  scene.classList.remove(
    "dimension-two",
    "dimension-three"
  );

  if (dimension === 1) {
    scene.classList.add("dimension-two");
  } else if (dimension === 2) {
    scene.classList.add("dimension-three");
  }

  x = 10;
  y = 0;
  velocityY = 0;
  jumping = false;

  defeated = false;
  portalUnlocked = false;
  monsterHP = Math.min(3 + level, 10);
  monster.style.display = "block";
  monster.textContent = level % 2 === 0 ? "👹" : "👾";
  monster.style.left = (45 + Math.random() * 25) + "%";

  portal.style.filter = "";
  portal.style.boxShadow = "";

  makeTreasures();
  updatePlayer();

  showMessage("Dimension " + level +
    "! A stronger monster awaits...");
}

function update() {
  if (keys.ArrowLeft || keys.KeyA) moveLeft();
  if (keys.ArrowRight || keys.KeyD) moveRight();

  if (jumping) {
    y += velocityY;
    velocityY -= gravity;

    if (y <= 0) {
      y = 0;
      velocityY = 0;
      jumping = false;
    }
  }

  updatePlayer();
  collectTreasures();

  if (Math.abs(x - portal.offsetLeft /
      scene.clientWidth * 100) < 7) {
    if (portalUnlocked) {
      showMessage("Portal ready! Move into it.");
    }
  }

  requestAnimationFrame(update);
}

document.getElementById("leftBtn").addEventListener(
  "pointerdown", () => {
    keys.ArrowLeft = true;
  }
);

document.getElementById("leftBtn").addEventListener(
  "pointerup", () => {
    keys.ArrowLeft = false;
  }
);

document.getElementById("leftBtn").addEventListener(
  "pointerleave", () => {
    keys.ArrowLeft = false;
  }
);

document.getElementById("rightBtn").addEventListener(
  "pointerdown", () => {
    keys.ArrowRight = true;
  }
);

document.getElementById("rightBtn").addEventListener(
  "pointerup", () => {
    keys.ArrowRight = false;
  }
);

document.getElementById("rightBtn").addEventListener(
  "pointerleave", () => {
    keys.ArrowRight = false;
  }
);

document.getElementById("jumpBtn").addEventListener(
  "click", jump
);

document.getElementById("attackBtn").addEventListener(
  "click", attack
);

portal.addEventListener("click", enterPortal);

document.addEventListener("keydown", event => {
  keys[event.code] = true;

  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    jump();
  }

  if (event.code === "KeyJ") {
    attack();
  }
});

document.addEventListener("keyup", event => {
  keys[event.code] = false;
});

makeTreasures();
updateStats();
updatePlayer();
update();
