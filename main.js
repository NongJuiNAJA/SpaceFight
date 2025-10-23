// ================= Firebase Config =================
const firebaseConfig = {
  databaseURL: "https://spacefight-27fe2-default-rtdb.asia-southeast1.firebasedatabase.app/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ================= Player Name Global =================
let playerNameGlobal = "";

// ================= Start Game Function =================
function startSpaceFight(mode, playerName) {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  let WIDTH = window.innerWidth;
  let HEIGHT = window.innerHeight;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const MAP_SIZE = 2600;
  const STAR_COUNT = 400;
  const COMET_COUNT = 6;

  let stars = [], comets = [];
  let player, enemies, bulletsEnemy, wave, score, camera, gameOver, startTime, stopTime;
  let mouse = { x: WIDTH / 2, y: HEIGHT / 2 };
  let keys = {}, canShoot = true;
  let dashFrames = 0, dashCooldown = 0;
  const DASH_SPEED = 15, DASH_DURATION = 10, DASH_COOLDOWN_MAX = 120;
  const joystick = { x: 0, y: 0, dx: 0, dy: 0 };
  const isMobile = mode === "mobile";

  // ================= Assets =================
  const assets = {
    player: "assets/player.png",
    enemy1: "assets/enemy_1.png",
    enemy2: "assets/enemy_2.png",
    enemy3: "assets/enemy_3.png",
    boss: "assets/Boss.png",
    dash: "assets/dash.png"
  };
  const images = {};
  for (let k in assets) {
    const img = new Image();
    img.src = assets[k];
    images[k] = img;
  }

  // ================= Background =================
  function initBackground() {
    stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * MAP_SIZE,
      y: Math.random() * MAP_SIZE,
      size: Math.random() * 2 + 0.2,
      alpha: Math.random(),
      speed: Math.random() * 0.02 + 0.005
    }));
    comets = Array.from({ length: COMET_COUNT }, () => ({
      x: Math.random() * MAP_SIZE,
      y: Math.random() * MAP_SIZE,
      dx: Math.random() * 2 - 1,
      dy: Math.random() * 2 - 1,
      len: 80 + Math.random() * 120,
      alpha: Math.random() * 0.5 + 0.3
    }));
  }

  function updateBackground() {
    stars.forEach(s => {
      s.alpha += s.speed * (Math.random() > 0.5 ? 1 : -1);
      s.alpha = Math.min(1, Math.max(0.2, s.alpha));
    });
    comets.forEach(c => {
      c.x += c.dx * 1.2; c.y += c.dy * 1.2;
      if (c.x < 0 || c.x > MAP_SIZE || c.y < 0 || c.y > MAP_SIZE) {
        c.x = Math.random() * MAP_SIZE;
        c.y = Math.random() * MAP_SIZE;
      }
    });
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, "#000010"); grad.addColorStop(1, "#000000");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, WIDTH, HEIGHT);

    stars.forEach(s => {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(s.x - camera.x, s.y - camera.y, s.size, 0, Math.PI*2);
      ctx.fill();
    });

    comets.forEach(c => {
      const x1 = c.x - camera.x, y1 = c.y - camera.y;
      const x2 = x1 - c.dx*c.len, y2 = y1 - c.dy*c.len;
      const gradC = ctx.createLinearGradient(x1, y1, x2, y2);
      gradC.addColorStop(0, `rgba(255,255,255,${c.alpha})`);
      gradC.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.strokeStyle = gradC;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  // ================= Game Init =================
  function initGame() {
    player = { x: MAP_SIZE/2, y: MAP_SIZE/2, w:48, h:48, speed:4, hp:100, maxHp:100, bullets:[], angle:-Math.PI/2 };
    enemies = []; bulletsEnemy = []; wave = 1; score = 0;
    camera = {x:0, y:0}; gameOver=false; startTime=Date.now(); stopTime=0;
    canShoot=true; dashFrames=0; dashCooldown=0;
    initBackground(); spawnEnemies(); updateLeaderboardUI();
  }

  function spawnEnemies() {
    enemies=[];
    const num = 3*wave;
    for(let i=0;i<num;i++){
      enemies.push({x:Math.random()*MAP_SIZE, y:Math.random()*MAP_SIZE, type:Math.ceil(Math.random()*3), hp:30+wave*10, angle:-Math.PI/2, shootCooldown:Math.random()*100});
    }
    if(wave%3===0){
      enemies.push({x:Math.random()*MAP_SIZE, y:Math.random()*MAP_SIZE, type:"boss", hp:200+wave*50, angle:-Math.PI/2, shootCooldown:Math.random()*100});
    }
  }

  function shootPlayer() {
    if(gameOver || !canShoot) return;
    const dx = Math.cos(player.angle)*10;
    const dy = Math.sin(player.angle)*10;
    player.bullets.push({x:player.x,y:player.y,dx,dy,trail:[]});
    canShoot=false;
  }

  function startDash() {
    if(dashFrames===0 && dashCooldown===0 && !gameOver){
      dashFrames=DASH_DURATION; dashCooldown=DASH_COOLDOWN_MAX;
    }
  }

  // ================= Leaderboard =================
  function saveScore(name, wave){
    const entryRef = db.ref("leaderboard/"+name);
    entryRef.get().then(snapshot=>{
      const data = snapshot.val();
      if(!data || wave>data.wave) entryRef.set({name,wave});
    });
  }

  function updateLeaderboardUI(){
    const list = document.getElementById("leaderboardList");
    db.ref("leaderboard").orderByChild("wave").limitToLast(10).on("value", snapshot=>{
      const data = snapshot.val();
      if(!data){ list.innerHTML="<li>No scores yet</li>"; return; }
      const sorted = Object.values(data).sort((a,b)=>b.wave - a.wave);
      list.innerHTML = sorted.map((entry,index)=>`<li>${index+1}. ${entry.name}: Wave ${entry.wave}</li>`).join("");
    });
  }

  // ================= Input =================
  if(!isMobile){
    document.addEventListener("keydown", e=>{ keys[e.key.toLowerCase()]=true; if(e.key===" ") startDash(); });
    document.addEventListener("keyup", e=>{ keys[e.key.toLowerCase()]=false; canShoot=true; });
    document.addEventListener("mousemove", e=>{ mouse.x=e.clientX; mouse.y=e.clientY; });
    document.addEventListener("mousedown", shootPlayer);
  } else {
    document.getElementById("btnShoot").addEventListener("touchstart", shootPlayer);
    document.getElementById("btnDash").addEventListener("touchstart", startDash);
    const stick = document.getElementById("stick");
    let dragging=false;
    stick.addEventListener("touchstart", e=>{ dragging=true; });
    stick.addEventListener("touchend", e=>{ dragging=false; joystick.dx=0; joystick.dy=0; stick.style.transform="translate(0,0)"; });
    stick.addEventListener("touchmove", e=>{
      if(!dragging) return;
      const touch=e.touches[0];
      const rect=stick.parentElement.getBoundingClientRect();
      let dx = touch.clientX-(rect.left+rect.width/2);
      let dy = touch.clientY-(rect.top+rect.height/2);
      const dist=Math.min(Math.hypot(dx,dy),50);
      const angle=Math.atan2(dy,dx);
      joystick.dx=Math.cos(angle)*dist/50; joystick.dy=Math.sin(angle)*dist/50;
      stick.style.transform=`translate(${joystick.dx*50}px,${joystick.dy*50}px)`;
      e.preventDefault();
    });
  }

  // ================= Game Logic =================
  function updatePlayer(){
    let dx=0, dy=0;
    if(isMobile){ dx=joystick.dx; dy=joystick.dy; }
    else {
      if(keys["w"]||keys["arrowup"]) dy-=1;
      if(keys["s"]||keys["arrowdown"]) dy+=1;
      if(keys["a"]||keys["arrowleft"]) dx-=1;
      if(keys["d"]||keys["arrowright"]) dx+=1;
    }

    if(dashFrames>0){
      player.x+=Math.cos(player.angle)*DASH_SPEED;
      player.y+=Math.sin(player.angle)*DASH_SPEED;
      dashFrames--;
    } else if(dx!==0||dy!==0){
      const moveAngle=Math.atan2(dy,dx);
      player.x+=Math.cos(moveAngle)*player.speed;
      player.y+=Math.sin(moveAngle)*player.speed;
      if(isMobile) player.angle=moveAngle;
    }

    player.x=Math.max(0,Math.min(MAP_SIZE,player.x));
    player.y=Math.max(0,Math.min(MAP_SIZE,player.y));

    if(!isMobile){
      const targetAngle=Math.atan2(mouse.y-HEIGHT/2, mouse.x-WIDTH/2);
      player.angle+=(targetAngle-player.angle)*0.2;
    }

    if(dashCooldown>0) dashCooldown--;
  }

  function updateEnemies(){
    enemies.forEach(e=>{
      const dx=player.x-e.x, dy=player.y-e.y;
      const targetAngle=Math.atan2(dy,dx);
      let delta = Math.atan2(Math.sin(targetAngle-e.angle), Math.cos(targetAngle-e.angle));
      e.angle+=delta*0.1;

      if(Math.hypot(dx,dy)>50){ e.x+=Math.cos(e.angle)*1.5; e.y+=Math.sin(e.angle)*1.5; }

      e.shootCooldown--;
      if(e.shootCooldown<=0){
        e.shootCooldown=60+Math.random()*60;
        switch(e.type){
          case 1: bulletsEnemy.push({x:e.x,y:e.y,dx:Math.cos(e.angle)*5,dy:Math.sin(e.angle)*5,trail:[]}); break;
          case 2: bulletsEnemy.push({x:e.x,y:e.y,dx:Math.cos(e.angle)*7,dy:Math.sin(e.angle)*7,trail:[]}); break;
          case 3: for(let a=-0.3;a<=0.3;a+=0.3) bulletsEnemy.push({x:e.x,y:e.y,dx:Math.cos(e.angle+a)*6,dy:Math.sin(e.angle+a)*6,trail:[]}); break;
          case "boss":
            for(let i=0;i<5;i++){
              const ang=e.angle+i*0.4-0.8;
              bulletsEnemy.push({x:e.x,y:e.y,dx:Math.cos(ang)*6,dy:Math.sin(ang)*6,trail:[]});
            }
            break;
        }
      }

      if(Math.hypot(e.x-player.x,e.y-player.y)<32){
        player.hp-=(e.type==="boss"?20:10);
        e.x-=Math.cos(e.angle)*10; e.y-=Math.sin(e.angle)*10;
      }
    });
  }

  function updateBullets(){
    // Player bullets
    for(let i=player.bullets.length-1;i>=0;i--){
      const b=player.bullets[i];
      b.x+=b.dx; b.y+=b.dy;
      b.trail.push({x:b.x,y:b.y}); if(b.trail.length>5) b.trail.shift();

      for(let j=enemies.length-1;j>=0;j--){
        const e=enemies[j];
        if(Math.hypot(b.x-e.x,b.y-e.y)<24){
          e.hp-=20;
          player.bullets.splice(i,1);
          if(e.hp<=0){
            score += (e.type==="boss"?50:10);
            enemies.splice(j,1);
          }
          break;
        }
      }
    }

    // Enemy bullets
    for(let i=bulletsEnemy.length-1;i>=0;i--){
      const b=bulletsEnemy[i];
      b.x+=b.dx; b.y+=b.dy;
      b.trail.push({x:b.x,y:b.y}); if(b.trail.length>8) b.trail.shift();

      if(Math.hypot(b.x-player.x, b.y-player.y)<24){
        player.hp-=10;
        bulletsEnemy.splice(i,1);
      }
    }
  }

  // ================= Draw Functions =================
  function drawRotatedImage(img,x,y,angle,w,h){
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.drawImage(img,-w/2,-h/2,w,h); ctx.restore();
  }

  function drawBullets(){
    player.bullets.forEach(b=>{
      b.trail.forEach((t,i)=>{
        ctx.globalAlpha=i/5; ctx.fillStyle="yellow";
        ctx.beginPath(); ctx.arc(t.x-camera.x,t.y-camera.y,5*(i/5+0.2),0,Math.PI*2); ctx.fill();
      });
      ctx.globalAlpha=1; ctx.fillStyle="yellow";
      ctx.beginPath(); ctx.arc(b.x-camera.x,b.y-camera.y,5,0,Math.PI*2); ctx.fill();
    });

    bulletsEnemy.forEach(b=>{
      b.trail.forEach((t,i)=>{
        ctx.globalAlpha=i/8; ctx.fillStyle="orange";
        ctx.beginPath(); ctx.arc(t.x-camera.x,t.y-camera.y,5*(i/8+0.2),0,Math.PI*2); ctx.fill();
      });
      ctx.globalAlpha=1; ctx.fillStyle="orange";
      ctx.beginPath(); ctx.arc(b.x-camera.x,b.y-camera.y,5,0,Math.PI*2); ctx.fill();
    });
  }

  function drawUI(){
    // Health Bar
    ctx.fillStyle="red"; ctx.fillRect(20,20,200,20);
    ctx.fillStyle="green"; ctx.fillRect(20,20,200*(player.hp/player.maxHp),20);
    ctx.strokeStyle="white"; ctx.strokeRect(20,20,200,20);

    // Score / Wave at top center
    ctx.fillStyle="white"; ctx.font="20px Arial";
    ctx.textAlign="center";
    ctx.fillText("Score: "+score+" | Wave: "+wave, WIDTH/2, 30);

    // Enemies HP
    enemies.forEach(e=>{
      ctx.fillStyle="red"; ctx.fillRect(e.x-camera.x-24,e.y-camera.y-40,48,6);
      ctx.fillStyle="green";
      ctx.fillRect(e.x-camera.x-24,e.y-camera.y-40,48*(e.hp/(e.type==="boss"?200+wave*50:30+wave*10)),6);
      ctx.strokeStyle="white"; ctx.strokeRect(e.x-camera.x-24,e.y-camera.y-40,48,6);
    });

    if(gameOver){
      const survivedTime = Math.floor((stopTime-startTime)/1000);
      ctx.fillStyle="white"; ctx.font="40px Arial"; ctx.textAlign="center";
      ctx.fillText("GAME OVER",WIDTH/2,HEIGHT/2-40);
      ctx.fillText("Score: "+score,WIDTH/2,HEIGHT/2);
      ctx.fillText("Wave: "+wave,WIDTH/2,HEIGHT/2+40);
      ctx.fillText("Time survived: "+survivedTime+"s",WIDTH/2,HEIGHT/2+80);
      ctx.fillText("Click to Restart",WIDTH/2,HEIGHT/2+140);
      saveScore(playerName, wave);
      updateLeaderboardUI();
      canvas.addEventListener("click",()=>{initGame();}, {once:true});
    }
  }

  function drawDashUI(){
    const size=64,x=WIDTH/2-size/2,y=HEIGHT-100;
    ctx.globalAlpha=0.6; ctx.drawImage(images.dash,x,y,size,size); ctx.globalAlpha=1;
    if(dashCooldown>0){
      ctx.fillStyle="rgba(0,0,0,0.6)";
      const height=(dashCooldown/DASH_COOLDOWN_MAX)*size;
      ctx.fillRect(x,y+size-height,size,height);
    }
  }

  // ================= Game Loop =================
  function loop(){
    WIDTH=canvas.width; HEIGHT=canvas.height;
    if(!gameOver){
      updateBackground(); updatePlayer(); updateEnemies(); updateBullets();
      if(enemies.length===0){ wave++; spawnEnemies(); }
      camera.x=player.x-WIDTH/2; camera.y=player.y-HEIGHT/2;

      drawBackground();
      drawRotatedImage(images.player,player.x-camera.x,player.y-camera.y,player.angle,player.w,player.h);
      enemies.forEach(e=>{
        const img = e.type==="boss"?images.boss:images["enemy"+e.type];
        drawRotatedImage(img,e.x-camera.x,e.y-camera.y,e.angle,48,48);
      });
      drawBullets(); drawUI(); drawDashUI();
      if(player.hp<=0 && !gameOver){ gameOver=true; stopTime=Date.now(); }
    } else drawUI();

    requestAnimationFrame(loop);
  }

  initGame(); loop();
}

// ================= Start Button =================
document.getElementById("btnStart").addEventListener("click", ()=>{
  const name = document.getElementById("inputName").value.trim();
  if(!name){ alert("Enter your name"); return; }
  playerNameGlobal = name;
  startSpaceFight("pc", playerNameGlobal);
});

document.getElementById("btnStartMobile").addEventListener("click", ()=>{
  const name = document.getElementById("inputName").value.trim();
  if(!name){ alert("Enter your name"); return; }
  playerNameGlobal = name;
  startSpaceFight("mobile", playerNameGlobal);
});
