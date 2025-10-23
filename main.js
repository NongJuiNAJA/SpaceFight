function startSpaceFight(mode) {
  let canvas = document.getElementById("game");
  let ctx = canvas.getContext("2d");

  let WIDTH = window.innerWidth;
  let HEIGHT = window.innerHeight;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const MAP_SIZE = 2600;
  const STAR_COUNT = 400;
  const COMET_COUNT = 6;
  let stars = [], comets = [];

  function initBackground() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) stars.push({
      x: Math.random() * MAP_SIZE,
      y: Math.random() * MAP_SIZE,
      size: Math.random() * 2 + 0.2,
      alpha: Math.random(),
      speed: Math.random() * 0.02 + 0.005
    });
    comets = [];
    for (let i = 0; i < COMET_COUNT; i++) comets.push({
      x: Math.random() * MAP_SIZE,
      y: Math.random() * MAP_SIZE,
      dx: Math.random() * 2 - 1,
      dy: Math.random() * 2 - 1,
      len: 80 + Math.random() * 120,
      alpha: Math.random() * 0.5 + 0.3
    });
  }

  function updateBackground() {
    for (let s of stars)
      s.alpha = Math.max(0.2, Math.min(1, s.alpha + s.speed * (Math.random() > 0.5 ? 1 : -1)));
    for (let c of comets) {
      c.x += c.dx * 1.2; c.y += c.dy * 1.2;
      if (c.x < 0 || c.x > MAP_SIZE || c.y < 0 || c.y > MAP_SIZE) {
        c.x = Math.random() * MAP_SIZE;
        c.y = Math.random() * MAP_SIZE;
      }
    }
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, "#000010");
    grad.addColorStop(1, "#000000");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let s of stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(s.x - camera.x, s.y - camera.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let c of comets) {
      const x1 = c.x - camera.x, y1 = c.y - camera.y;
      const x2 = x1 - c.dx * c.len, y2 = y1 - c.dy * c.len;
      const cometGrad = ctx.createLinearGradient(x1, y1, x2, y2);
      cometGrad.addColorStop(0, `rgba(255,255,255,${c.alpha})`);
      cometGrad.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.strokeStyle = cometGrad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  // Assets
  const assets = {
    player: "assets/player.png",
    enemy1: "assets/enemy_1.png",
    enemy2: "assets/enemy_2.png",
    enemy3: "assets/enemy_3.png",
    boss: "assets/Boss.png",
    dash: "assets/dash.png"
  };
  let images = {};
  for (let k in assets) { const img = new Image(); img.src = assets[k]; images[k] = img; }

  // Game State
  let player, enemies, bulletsEnemy, wave, score, camera, gameOver, startTime, stopTime;
  let mouse = { x: WIDTH / 2, y: HEIGHT / 2 };
  let canShoot = true;
  let keys = {};

  // Dash
  const DASH_SPEED = 15, DASH_DURATION = 10, DASH_COOLDOWN_MAX = 120;
  let dashFrames = 0, dashCooldown = 0;
  const dashIcon = images.dash;

  function initGame() {
    player = { x: MAP_SIZE / 2, y: MAP_SIZE / 2, w: 48, h: 48, speed: 4, hp: 100, maxHp: 100, bullets: [], angle: 0 };
    enemies = []; bulletsEnemy = []; wave = 1; score = 0;
    camera = { x: 0, y: 0 }; gameOver = false; startTime = Date.now(); stopTime = 0; canShoot = true;
    dashFrames = 0; dashCooldown = 0;
    initBackground(); spawnEnemies();
  }

  function spawnEnemies() {
    enemies = [];
    const num = 3 * wave;
    for (let i = 0; i < num; i++)
      enemies.push({ x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE, type: Math.ceil(Math.random() * 3), hp: 30 + wave * 10, angle: 0, shootCooldown: Math.random() * 100 });
    if (wave % 3 === 0)
      enemies.push({ x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE, type: "boss", hp: 200 + wave * 50, angle: 0, shootCooldown: Math.random() * 100 });
  }

  function shootPlayer() {
    if (gameOver || !canShoot) return;
    player.bullets.push({ x: player.x, y: player.y, dx: Math.cos(player.angle) * 10, dy: Math.sin(player.angle) * 10, trail: [] });
    canShoot = false;
  }

  function startDash() {
    if (dashFrames === 0 && dashCooldown === 0 && !gameOver) { dashFrames = DASH_DURATION; dashCooldown = DASH_COOLDOWN_MAX; }
  }

  function updatePlayer() {
    let dx = 0, dy = 0;
    if (keys["w"] || keys["arrowup"]) dy -= 1;
    if (keys["s"] || keys["arrowdown"]) dy += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;

    if (dashFrames > 0) {
      player.x += Math.cos(player.angle) * DASH_SPEED;
      player.y += Math.sin(player.angle) * DASH_SPEED;
      dashFrames--;
    } else if (dx !== 0 || dy !== 0) {
      const moveAngle = Math.atan2(dy, dx);
      player.x += Math.cos(moveAngle) * player.speed;
      player.y += Math.sin(moveAngle) * player.speed;
    }

    player.x = Math.max(0, Math.min(MAP_SIZE, player.x));
    player.y = Math.max(0, Math.min(MAP_SIZE, player.y));

    const targetAngle = Math.atan2(mouse.y - HEIGHT / 2, mouse.x - WIDTH / 2);
    player.angle += (targetAngle - player.angle) * 0.2;

    if (dashCooldown > 0) dashCooldown--;
  }

  function updateEnemies() {
    for (let e of enemies) {
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const targetAngle = Math.atan2(dy, dx);

      let delta = targetAngle - e.angle;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      e.angle += delta * 0.1;

      if (Math.hypot(dx, dy) > 50) {
        e.x += Math.cos(e.angle) * 1.5;
        e.y += Math.sin(e.angle) * 1.5;
      }

      e.shootCooldown--;
      if (e.shootCooldown <= 0) {
        e.shootCooldown = 60 + Math.random() * 60;
        let speed = 5;
        switch (e.type) {
          case 1: speed = 5; bulletsEnemy.push({ x: e.x, y: e.y, dx: Math.cos(e.angle) * speed, dy: Math.sin(e.angle) * speed, trail: [] }); break;
          case 2: speed = 7; bulletsEnemy.push({ x: e.x, y: e.y, dx: Math.cos(e.angle) * speed, dy: Math.sin(e.angle) * speed, trail: [] }); break;
          case 3: for (let a = -0.3; a <= 0.3; a += 0.3) bulletsEnemy.push({ x: e.x, y: e.y, dx: Math.cos(e.angle + a) * 6, dy: Math.sin(e.angle + a) * 6, trail: [] }); break;
          case "boss": for (let i = 0; i < 5; i++) { const ang = e.angle + i * 0.4 - 0.8; bulletsEnemy.push({ x: e.x, y: e.y, dx: Math.cos(ang) * 6, dy: Math.sin(ang) * 6, trail: [] }); } break;
        }
      }

      if (Math.hypot(e.x - player.x, e.y - player.y) < 32) {
        player.hp -= (e.type === "boss" ? 20 : 10);
        e.x -= Math.cos(e.angle) * 10;
        e.y -= Math.sin(e.angle) * 10;
      }
    }
  }

  function updateBullets() {
    player.bullets.forEach((b, i) => {
      b.x += b.dx; b.y += b.dy;
      b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 5) b.trail.shift();
      enemies.forEach(e => { if (Math.hypot(b.x - e.x, b.y - e.y) < 24) { e.hp -= 20; player.bullets.splice(i, 1); } });
    });
    enemies = enemies.filter(e => { if (e.hp <= 0) { score += (e.type === "boss" ? 50 : 10); return false; } return true; });
    bulletsEnemy.forEach((b, i) => {
      b.x += b.dx; b.y += b.dy; b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 8) b.trail.shift();
      if (Math.hypot(b.x - player.x, b.y - player.y) < 24) { player.hp -= 10; bulletsEnemy.splice(i, 1); }
    });
  }

  function drawRotatedImage(img, x, y, angle, w, h) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
  }

  function drawBullets() {
    player.bullets.forEach(b => {
      for (let i = 0; i < b.trail.length; i++) {
        ctx.globalAlpha = i / 5; ctx.fillStyle = "yellow"; ctx.beginPath();
        ctx.arc(b.trail[i].x - camera.x, b.trail[i].y - camera.y, 5 * (i / 5 + 0.2), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.fillStyle = "yellow"; ctx.beginPath();
      ctx.arc(b.x - camera.x, b.y - camera.y, 5, 0, Math.PI * 2); ctx.fill();
    });
    bulletsEnemy.forEach(b => {
      for (let i = 0; i < b.trail.length; i++) {
        ctx.globalAlpha = i / 8; ctx.fillStyle = "orange"; ctx.beginPath();
        ctx.arc(b.trail[i].x - camera.x, b.trail[i].y - camera.y, 5 * (i / 8 + 0.2), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.fillStyle = "orange"; ctx.beginPath();
      ctx.arc(b.x - camera.x, b.y - camera.y, 5, 0, Math.PI * 2); ctx.fill();
    });
  }

  function drawUI() {
    ctx.fillStyle = "red"; ctx.fillRect(20, 20, 200, 20);
    ctx.fillStyle = "green"; ctx.fillRect(20, 20, 200 * (player.hp / player.maxHp), 20);
    ctx.strokeStyle = "white"; ctx.strokeRect(20, 20, 200, 20);
    ctx.fillStyle = "white"; ctx.font = "20px Arial";
    ctx.fillText("Score: " + score, WIDTH - 120, 40);
    ctx.fillText("Wave: " + wave, WIDTH - 120, 70);
    enemies.forEach(e => {
      ctx.fillStyle = "red"; ctx.fillRect(e.x - camera.x - 24, e.y - camera.y - 40, 48, 6);
      ctx.fillStyle = "green"; ctx.fillRect(e.x - camera.x - 24, e.y - camera.y - 40, 48 * (e.hp / (e.type === "boss" ? 200 + wave * 50 : 30 + wave * 10)), 6);
      ctx.strokeStyle = "white"; ctx.strokeRect(e.x - camera.x - 24, e.y - camera.y - 40, 48, 6);
    });
    if (gameOver) {
      const survivedTime = Math.floor((stopTime - startTime) / 1000);
      ctx.fillStyle = "white"; ctx.font = "40px Arial";
      ctx.fillText("GAME OVER", WIDTH / 2 - 150, HEIGHT / 2 - 40);
      ctx.fillText("Score: " + score, WIDTH / 2 - 100, HEIGHT / 2);
      ctx.fillText("Wave: " + wave, WIDTH / 2 - 80, HEIGHT / 2 + 40);
      ctx.fillText("Time survived: " + survivedTime + "s", WIDTH / 2 - 140, HEIGHT / 2 + 80);
      ctx.fillText("Click to Restart", WIDTH / 2 - 140, HEIGHT / 2 + 140);
    }
  }

  function drawDashUI() {
    const size = 64; const x = WIDTH / 2 - size / 2; const y = HEIGHT - 100;
    ctx.globalAlpha = 0.6; ctx.drawImage(dashIcon, x, y, size, size); ctx.globalAlpha = 1;
    if (dashCooldown > 0) { ctx.fillStyle = "rgba(0,0,0,0.6)"; const height = (dashCooldown / DASH_COOLDOWN_MAX) * size; ctx.fillRect(x, y + size - height, size, height); }
  }

  function loop() {
    WIDTH = canvas.width; HEIGHT = canvas.height;
    if (!gameOver) {
      updateBackground(); updatePlayer(); updateEnemies(); updateBullets();
      if (enemies.length === 0) { wave++; spawnEnemies(); }
      camera.x = player.x - WIDTH / 2; camera.y = player.y - HEIGHT / 2;
      drawBackground();
      drawRotatedImage(images.player, player.x - camera.x, player.y - camera.y, player.angle, player.w, player.h);
      const ENEMY_OFFSET = Math.PI / 2;
      enemies.forEach(e => {
        const img = e.type === "boss" ? images.boss : images["enemy" + e.type];
        drawRotatedImage(img, e.x - camera.x, e.y - camera.y, e.angle + ENEMY_OFFSET, 48, 48);
      });

      drawBullets(); drawUI(); drawDashUI();
      if (player.hp <= 0) { gameOver = true; stopTime = Date.now(); canvas.addEventListener("click", () => { initGame(); }, { once: true }); }
    } else { drawUI(); }
    requestAnimationFrame(loop);
  }

  // Input PC
  if (mode !== "mobile") {
    document.addEventListener("keydown", e => { keys[e.key.toLowerCase()] = true; if (e.key === " ") startDash(); });
    document.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; canShoot = true; });
    document.addEventListener("mousemove", e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    document.addEventListener("mousedown", shootPlayer);
  }

  // Input Mobile
  if (mode === "mobile") {
    const btnDash = document.getElementById("btnDash");
    const joystick = document.querySelector(".joystick");
    const stick = document.getElementById("stick");

    let center = { x: 0, y: 0 };
    let moving = false;
    let shootingAngle = null;

    // Dash
    if (btnDash) {
      btnDash.addEventListener("touchstart", e => { e.preventDefault(); startDash(); });
      btnDash.addEventListener("mousedown", startDash);
    }

    if (joystick && stick) {
      joystick.addEventListener("touchstart", e => {
        e.preventDefault();
        const rect = joystick.getBoundingClientRect();
        const touch = e.touches[0];
        center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        moving = true;
      });

      joystick.addEventListener("touchmove", e => {
        if (!moving) return;
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - center.x;
        const dy = touch.clientY - center.y;
        const distance = Math.min(Math.sqrt(dx * dx + dy * dy), 40);
        const angle = Math.atan2(dy, dx);
        stick.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;

        keys["w"] = dy < -10;
        keys["s"] = dy > 10;
        keys["a"] = dx < -10;
        keys["d"] = dx > 10;

        shootingAngle = angle;
      });

      joystick.addEventListener("touchend", () => {
        moving = false;
        stick.style.transform = "translate(0,0)";
        keys["w"] = keys["a"] = keys["s"] = keys["d"] = false;
        shootingAngle = null;
      });
    }

    // ยิงอัตโนมัติ Mobile
    const originalLoop = loop;
    loop = function() {
      if (shootingAngle) {
        player.bullets.push({
          x: player.x,
          y: player.y,
          dx: Math.cos(shootingAngle) * 10,
          dy: Math.sin(shootingAngle) * 10,
          trail: []
        });
      }
      originalLoop();
    };
  }

  window.addEventListener("resize", () => { WIDTH = window.innerWidth; HEIGHT = window.innerHeight; canvas.width = WIDTH; canvas.height = HEIGHT; });

  initGame();
  loop();
}
