const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const hpUI = document.getElementById('hp');
const killsUI = document.getElementById('kills');
const levelUI = document.getElementById('level');
const gameoverUI = document.getElementById('gameover');
const w1UI = document.getElementById('w1');
const w2UI = document.getElementById('w2');
const w3UI = document.getElementById('w3');
const w4UI = document.getElementById('w4');
const ammo1UI = document.getElementById('ammo1');
const ammo2UI = document.getElementById('ammo2');
const ammo3UI = document.getElementById('ammo3');

const keys = { w: false, a: false, s: false, d: false };
const mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };

window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = true;
    if (e.key === '1') player.changeWeapon(0);
    if (e.key === '2') player.changeWeapon(1);
    if (e.key === '3') player.changeWeapon(2); 
    if (e.key === '4') player.changeWeapon(3); 
    if (e.key === ' ' && gameState === 'gameover') resetGame();
});

window.addEventListener('keyup', e => {
    if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = false;
});

window.addEventListener('mousemove', e => { 
    mouse.x = e.clientX; 
    mouse.y = e.clientY; 
});

window.addEventListener('mousedown', () => mouse.down = true);
window.addEventListener('mouseup', () => mouse.down = false);
window.addEventListener('contextmenu', e => e.preventDefault());

let gameState = 'playing';
let bullets = [];
let enemies = [];
let particles = [];
let items = [];
let explosions = [];
let kills = 0;
let level = 1;

const WEAPONS = [
    { name: 'Pistola', damage: 25, speed: 12, fireRate: 400, color: '#aaa', type: 'range' },
    { name: 'Fuzil', damage: 15, speed: 15, fireRate: 100, color: '#f39c12', type: 'range' },
    { name: 'Bazooka', damage: 100, speed: 4, fireRate: 1000, color: '#2ecc71', type: 'range' }, 
    { name: 'Faca', damage: 100, range: 65, fireRate: 600, color: '#ddd', type: 'melee' }
];

const walls = [
    { x: canvas.width * 0.2, y: canvas.height * 0.2, w: 200, h: 50 },
    { x: canvas.width * 0.7, y: canvas.height * 0.3, w: 50, h: 300 },
    { x: canvas.width * 0.4, y: canvas.height * 0.6, w: 300, h: 50 },
    { x: canvas.width * 0.1, y: canvas.height * 0.7, w: 150, h: 150 },
    { x: canvas.width * 0.5, y: canvas.height * 0.1, w: 50, h: 200 },
    { x: canvas.width * 0.8, y: canvas.height * 0.8, w: 200, h: 50 },
    { x: canvas.width * 0.2, y: canvas.height * 0.5, w: 50, h: 100 }
];

const chocolateImg = new Image();
chocolateImg.src = 'barra.png';

const raioImg = new Image();
raioImg.src = 'raio.png';

const balaImg = new Image();
balaImg.src = 'bala.png';

class Item {
    constructor(x, y, type = 'heal') {
        this.x = x;
        this.y = y;
        this.type = type; // Pode ser 'heal' (vida) ou 'ammo' (munição)
        this.radius = 15;
        this.active = true;
    }
    update() {
        if (Math.hypot(player.x - this.x, player.y - this.y) < player.radius + this.radius) {
            if (this.type === 'heal') {
                player.hp = Math.min(100, player.hp + 40);
                createParticles(this.x, this.y, '#2ecc71', 15);
            } else if (this.type === 'ammo') {
                // Recarrega TODAS as armas de fogo do jogador de uma vez só
                for (let i = 0; i < player.ammo.length; i++) {
                    player.ammo[i] = player.maxAmmo[i];
                }
                createParticles(this.x, this.y, '#f1c40f', 15); // Partículas douradas/amarelas
            }
            this.active = false;
        }
    }
    draw() {
        if (this.type === 'heal') {
            if (chocolateImg.complete && chocolateImg.naturalHeight !== 0) {
                ctx.drawImage(chocolateImg, this.x - 15, this.y - 15, 30, 30);
            } else {
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(this.x - 10, this.y - 10, 20, 20);
                ctx.fillStyle = '#fff';
                ctx.font = '10px Arial';
                ctx.fillText('barra.png', this.x - 22, this.y - 15);
            }
        } else if (this.type === 'ammo') {
            if (balaImg.complete && balaImg.naturalHeight !== 0) {
                ctx.drawImage(balaImg, this.x - 15, this.y - 15, 30, 30);
            } else {
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath();
                ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = '10px Arial';
                ctx.fillText('bala.png', this.x - 20, this.y - 15);
            }
        }
    }
}

class Explosion {
    constructor(x, y, radius, owner) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.owner = owner;
        this.life = 1.0;
        this.active = true;

        let explosionDamage = 50;
        
        let distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
        if (distToPlayer < this.radius + player.radius) {
            player.takeDamage(explosionDamage);
        }

        enemies.forEach(enemy => {
            let distToEnemy = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (distToEnemy < this.radius + enemy.radius) {
                enemy.takeDamage(explosionDamage);
            }
        });
    }
    update() {
        this.life -= 0.04;
        if (this.life <= 0) this.active = false;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        if (raioImg.complete && raioImg.naturalHeight !== 0) {
            ctx.drawImage(raioImg, this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        } else {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * (1 - this.life * 0.5), 0, Math.PI * 2);
            ctx.strokeStyle = '#2ecc71';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.fillStyle = '#2ecc71';
            ctx.font = '14px Courier New';
            ctx.fillText('raio.png', this.x - 30, this.y);
        }
        ctx.restore();
    }
}

class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 15;
        this.speed = 4;
        this.hp = 100;
        this.weaponIndex = 0;
        this.lastShot = 0;
        
        this.maxAmmo = [25, 100, 1, Infinity];
        this.ammo = [25, 100, 1, Infinity];
    }

    update() {
        let dx = 0, dy = 0;
        if (keys.w) dy -= this.speed;
        if (keys.s) dy += this.speed; 
        if (keys.a) dx -= this.speed;
        if (keys.d) dx += this.speed;

        let newX = this.x + dx;
        let newY = this.y + dy;
        
        if (!isCollidingWithWall(newX, this.y, this.radius)) this.x = newX;
        if (!isCollidingWithWall(this.x, newY, this.radius)) this.y = newY;

        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        this.shoot();
        this.updateUI();
    }

    changeWeapon(index) {
        this.weaponIndex = index;
    }

    shoot() {
        if (!mouse.down) return;
        const now = Date.now();
        const weapon = WEAPONS[this.weaponIndex];
        
        if (weapon.type === 'range' && this.ammo[this.weaponIndex] <= 0) return;

        if (now - this.lastShot >= weapon.fireRate) {
            let angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
            
            if (weapon.type === 'range') {
                let isBazooka = (weapon.name === 'Bazooka');
                bullets.push(new Bullet(this.x, this.y, angle, weapon.speed, weapon.damage, 'player', weapon.color, isBazooka));
                this.ammo[this.weaponIndex]--;
            } else {
                let hitX = this.x + Math.cos(angle) * weapon.range;
                let hitY = this.y + Math.sin(angle) * weapon.range;
                createParticles(hitX, hitY, '#ddd', 5);
                
                enemies.forEach(enemy => {
                    let dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                    if (dist < weapon.range + enemy.radius) {
                        enemy.takeDamage(weapon.damage);
                    }
                });
            }
            this.lastShot = now;
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            gameState = 'gameover';
            gameoverUI.style.display = 'block';
        }
    }

    updateUI() {
        hpUI.innerText = this.hp;
        killsUI.innerText = kills;
        levelUI.innerText = level;
        
        ammo1UI.innerText = `(${this.ammo[0]})`;
        ammo2UI.innerText = `(${this.ammo[1]})`;
        ammo3UI.innerText = `(${this.ammo[2]})`;

        w1UI.innerHTML = this.weaponIndex === 0 ? ' <span class="weapon-active">&lt;--</span>' : '';
        w2UI.innerHTML = this.weaponIndex === 1 ? ' <span class="weapon-active">&lt;--</span>' : '';
        w3UI.innerHTML = this.weaponIndex === 2 ? ' <span class="weapon-active">&lt;--</span>' : '';
        w4UI.innerHTML = this.weaponIndex === 3 ? ' <span class="weapon-active">&lt;--</span>' : '';
    }

    draw() {
        ctx.fillStyle = WEAPONS[this.weaponIndex].name === 'Bazooka' ? '#2ecc71' : '#3498db';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        let angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(angle) * 20, this.y + Math.sin(angle) * 20);
        ctx.stroke();
    }
}

class Enemy {
    constructor() {
        let margin = 30; // Margem para o bot não nascer colado na borda
        do {
            this.x = margin + Math.random() * (canvas.width - margin * 2);
            this.y = margin + Math.random() * (canvas.height - margin * 2);
        } while (Math.hypot(this.x - player.x, this.y - player.y) < 400 || isCollidingWithWall(this.x, this.y, 15));

        this.radius = 15;
        this.hp = 100;
        this.lastShot = 0;
        this.weaponIndex = Math.floor(Math.random() * WEAPONS.length);
        const weapon = WEAPONS[this.weaponIndex];
        
        this.speed = 1.5 + Math.random();
        this.fireRate = weapon.fireRate;

        if (weapon.name === 'Faca') {
            this.speed += 2.0;
        } else if (weapon.name === 'Fuzil') {
            this.fireRate = 250; 
        } else if (weapon.name === 'Bazooka') {
            this.fireRate = 2000; 
        }
    }

    update() {
        let dist = Math.hypot(player.x - this.x, player.y - this.y);
        let canSeePlayer = !hasWallBetween(this.x, this.y, player.x, player.y);

        if (canSeePlayer) {
            let angle = Math.atan2(player.y - this.y, player.x - this.x);
            const weapon = WEAPONS[this.weaponIndex];
            let stopDist = weapon.type === 'melee' ? weapon.range - 10 : 150;
            
            if (dist > stopDist) {
                let dx = Math.cos(angle) * this.speed;
                let dy = Math.sin(angle) * this.speed;
                
                if (!isCollidingWithWall(this.x + dx, this.y, this.radius)) this.x += dx;
                if (!isCollidingWithWall(this.x, this.y + dy, this.radius)) this.y += dy;
            }

            const now = Date.now();
            if (now - this.lastShot >= this.fireRate) {
                if (weapon.type === 'range') {
                    let isBazooka = (weapon.name === 'Bazooka');
                    let spread = isBazooka ? 0 : (Math.random() - 0.5) * 0.2;
                    bullets.push(new Bullet(this.x, this.y, angle + spread, weapon.speed, weapon.damage, 'enemy', weapon.color, isBazooka));
                } else {
                    if (dist <= weapon.range + player.radius) {
                        player.takeDamage(weapon.damage);
                        createParticles(player.x, player.y, '#e74c3c', 5);
                    }
                }
                this.lastShot = now;
            }
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        createParticles(this.x, this.y, '#e74c3c', 3);
        if (this.hp <= 0) {
            kills++;
            createParticles(this.x, this.y, '#e74c3c', 15);
            let index = enemies.indexOf(this);
            if (index > -1) enemies.splice(index, 1);
        }
    }

    draw() {
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 25, 30 * (this.hp / 100), 4);
    }
}

class Bullet {
    constructor(x, y, angle, speed, damage, owner, color, isBazooka = false) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.damage = damage;
        this.owner = owner;
        this.color = color;
        this.isBazooka = isBazooka;
        this.radius = isBazooka ? 9 : 3;
        this.active = true;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            this.active = false;
            if (this.isBazooka) explosions.push(new Explosion(this.x, this.y, 200, this.owner));
            return;
        }

        for (let wall of walls) {
            if (this.x > wall.x && this.x < wall.x + wall.w &&
                this.y > wall.y && this.y < wall.y + wall.h) {
                this.active = false;
                createParticles(this.x, this.y, '#95a5a6', 4);
                if (this.isBazooka) explosions.push(new Explosion(this.x, this.y, 200, this.owner));
                return;
            }
        }

        if (this.owner === 'player') {
            for (let enemy of enemies) {
                if (Math.hypot(enemy.x - this.x, enemy.y - this.y) < enemy.radius + this.radius) {
                    enemy.takeDamage(this.damage); 
                    this.active = false;
                    if (this.isBazooka) explosions.push(new Explosion(this.x, this.y, 200, this.owner));
                    return;
                }
            }
        }

        if (this.owner === 'enemy') {
            if (Math.hypot(player.x - this.x, player.y - this.y) < player.radius + this.radius) {
                player.takeDamage(this.damage); 
                this.active = false;
                if (this.isBazooka) explosions.push(new Explosion(this.x, this.y, 200, this.owner));
                return;
            }
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5;
        this.life = 1.0;
        this.color = color;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.04;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function isCollidingWithWall(x, y, radius) {
    for (let wall of walls) {
        let testX = x;
        let testY = y;
        
        if (x < wall.x) testX = wall.x;
        else if (x > wall.x + wall.w) testX = wall.x + wall.w;
        
        if (y < wall.y) testY = wall.y;
        else if (y > wall.y + wall.h) testY = wall.y + wall.h;
        
        let distX = x - testX;
        let distY = y - testY;
        let distance = Math.sqrt((distX * distX) + (distY * distY));
        
        if (distance <= radius) return true;
    }
    return false;
}

function hasWallBetween(x1, y1, x2, y2) {
    for (let wall of walls) {
        if (lineIntersectsRect(x1, y1, x2, y2, wall.x, wall.y, wall.w, wall.h)) {
            return true;
        }
    }
    return false;
}

function lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    let left = lineLine(x1, y1, x2, y2, rx, ry, rx, ry + rh);
    let right = lineLine(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh);
    let top = lineLine(x1, y1, x2, y2, rx, ry, rx + rw, ry);
    let bottom = lineLine(x1, y1, x2, y2, rx, ry + rh, rx + rw, ry + rh);
    return left || right || top || bottom;
}

function lineLine(x1, y1, x2, y2, x3, y3, x4, y4) {
    let uA = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
    let uB = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
    return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1);
}

function createParticles(x, y, color, amount) {
    for (let i = 0; i < amount; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function startNextLevel() {
    let enemiesToSpawn = Math.floor(Math.random() * 4) + 1;
    
    for(let i = 0; i < enemiesToSpawn; i++) {
        enemies.push(new Enemy());
    }

    let margin = 30; // Margem para os itens não nascerem cortados na tela

    // Drop randômico da barra de chocolate (original)
    if (Math.random() > 0.3) {
        let cx, cy;
        do {
            cx = margin + Math.random() * (canvas.width - margin * 2);
            cy = margin + Math.random() * (canvas.height - margin * 2);
        } while (isCollidingWithWall(cx, cy, 15));
        items.push(new Item(cx, cy, 'heal'));
    }

    // Drop da bala apenas a cada 2 níveis (Nível 2, 4, 6, 8...)
    if (level % 2 === 0) {
        let bx, by;
        do {
            bx = margin + Math.random() * (canvas.width - margin * 2);
            by = margin + Math.random() * (canvas.height - margin * 2);
        } while (isCollidingWithWall(bx, by, 15));
        items.push(new Item(bx, by, 'ammo'));
    }
}

function resetGame() {
    player = new Player();
    bullets = [];
    enemies = [];
    particles = [];
    items = [];
    explosions = [];
    kills = 0;
    level = 1;
    
    gameState = 'playing';
    gameoverUI.style.display = 'none';
    
    startNextLevel();
}

let player = new Player();
startNextLevel();

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#7f8c8d';
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 4;
    for (let wall of walls) {
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    }

    if (gameState === 'playing') {
        player.update();
        if (enemies.length === 0) {
            level++;
            startNextLevel();
        }
    }

    for (let i = items.length - 1; i >= 0; i--) {
        let item = items[i];
        if (gameState === 'playing') item.update();
        item.draw();
        if (!item.active) items.splice(i, 1);
    }

    for (let i = explosions.length - 1; i >= 0; i--) {
        let exp = explosions[i];
        if (gameState === 'playing') exp.update();
        exp.draw();
        if (!exp.active) explosions.splice(i, 1);
    }

    player.draw();

    enemies.forEach(enemy => {
        if (gameState === 'playing') enemy.update();
        enemy.draw();
    });

    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        if (gameState === 'playing') b.update();
        b.draw();
        if (!b.active) bullets.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        if (gameState === 'playing') p.update();
        p.draw();
        if (p.life <= 0) particles.splice(i, 1);
    }

    requestAnimationFrame(gameLoop);
}

gameLoop();

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
