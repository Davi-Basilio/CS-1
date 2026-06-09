const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const hpUI = document.getElementById('hp');
const killsUI = document.getElementById('kills');
const gameoverUI = document.getElementById('gameover');
const w1UI = document.getElementById('w1');
const w2UI = document.getElementById('w2');
const w3UI = document.getElementById('w3');

const keys = { w: false, a: false, s: false, d: false };
const mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };

window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = true;
    if (e.key === '1') player.changeWeapon(0);
    if (e.key === '2') player.changeWeapon(1);
    if (e.key === '3') player.changeWeapon(2);
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
let kills = 0;
let enemyMaxLimit = 2;
let firstGameAfterDeath = false;

const WEAPONS = [
    { name: 'Pistola', damage: 25, speed: 12, fireRate: 400, color: '#aaa', type: 'range' },
    { name: 'Fuzil', damage: 15, speed: 15, fireRate: 100, color: '#f39c12', type: 'range' },
    { name: 'Faca', damage: 100, range: 40, fireRate: 600, color: '#ddd', type: 'melee' }
];

const walls = [
    { x: canvas.width * 0.2, y: canvas.height * 0.2, w: 200, h: 50 },
    { x: canvas.width * 0.7, y: canvas.height * 0.3, w: 50, h: 300 },
    { x: canvas.width * 0.4, y: canvas.height * 0.6, w: 300, h: 50 },
    { x: canvas.width * 0.1, y: canvas.height * 0.7, w: 150, h: 150 }
];

class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 15;
        this.speed = 4;
        this.hp = 100;
        this.weaponIndex = 0;
        this.lastShot = 0;
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
        
        if (now - this.lastShot >= weapon.fireRate) {
            let angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
            
            if (weapon.type === 'range') {
                bullets.push(new Bullet(this.x, this.y, angle, weapon.speed, weapon.damage, 'player', weapon.color));
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
        w1UI.innerHTML = this.weaponIndex === 0 ? ' <span class="weapon-active">&lt;--</span>' : '';
        w2UI.innerHTML = this.weaponIndex === 1 ? ' <span class="weapon-active">&lt;--</span>' : '';
        w3UI.innerHTML = this.weaponIndex === 2 ? ' <span class="weapon-active">&lt;--</span>' : '';
    }

    draw() {
        ctx.fillStyle = '#3498db';
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
        do {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
        } while (Math.hypot(this.x - player.x, this.y - player.y) < 300 || isCollidingWithWall(this.x, this.y, 15));

        this.radius = 15;
        this.speed = 1.5 + Math.random();
        this.hp = 100;
        this.lastShot = 0;
        this.weaponIndex = Math.floor(Math.random() * WEAPONS.length);
        this.fireRate = WEAPONS[this.weaponIndex].fireRate;
    }

    update() {
        let dist = Math.hypot(player.x - this.x, player.y - this.y);
        let canSeePlayer = !hasWallBetween(this.x, this.y, player.x, player.y);

        if (canSeePlayer) {
            let angle = Math.atan2(player.y - this.y, player.x - this.x);
            const weapon = WEAPONS[this.weaponIndex];
            let stopDist = weapon.type === 'melee' ? weapon.range - 5 : 120;
            
            if (dist > stopDist) {
                let dx = Math.cos(angle) * this.speed;
                let dy = Math.sin(angle) * this.speed;
                
                if (!isCollidingWithWall(this.x + dx, this.y, this.radius)) this.x += dx;
                if (!isCollidingWithWall(this.x, this.y + dy, this.radius)) this.y += dy;
            }

            const now = Date.now();
            if (now - this.lastShot >= this.fireRate) {
                if (weapon.type === 'range') {
                    let spread = (Math.random() - 0.5) * 0.2;
                    bullets.push(new Bullet(this.x, this.y, angle + spread, weapon.speed, weapon.damage, 'enemy', weapon.color));
                } else {
                    if (dist < weapon.range + player.radius) {
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
    constructor(x, y, angle, speed, damage, owner, color) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.damage = damage;
        this.owner = owner;
        this.color = color;
        this.radius = 3;
        this.active = true;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            this.active = false;
            return;
        }

        for (let wall of walls) {
            if (this.x > wall.x && this.x < wall.x + wall.w &&
                this.y > wall.y && this.y < wall.y + wall.h) {
                this.active = false;
                createParticles(this.x, this.y, '#95a5a6', 4);
                return;
            }
        }

        if (this.owner === 'player') {
            for (let enemy of enemies) {
                if (Math.hypot(enemy.x - this.x, enemy.y - this.y) < enemy.radius + this.radius) {
                    enemy.takeDamage(this.damage);
                    this.active = false;
                    return;
                }
            }
        }

        if (this.owner === 'enemy') {
            if (Math.hypot(player.x - this.x, player.y - this.y) < player.radius + this.radius) {
                player.takeDamage(this.damage);
                this.active = false;
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

// Gerenciamento e Ciclo do Jogo
function spawnEnemies() {
    if (enemies.length < enemyMaxLimit) {
        enemies.push(new Enemy());
    }
}

function resetGame() {
    player = new Player();
    bullets = [];
    enemies = [];
    particles = [];
    kills = 0;
    
    if (!firstGameAfterDeath) {
        enemyMaxLimit = 1;
        firstGameAfterDeath = true;
    } else {
        enemyMaxLimit = 2;
    }
    
    gameState = 'playing';
    gameoverUI.style.display = 'none';
}

let player = new Player();

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
        spawnEnemies();
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
