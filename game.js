const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ARENA = { width: 950, height: 650, x: 0, y: 0 };

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ARENA.x = (canvas.width - ARENA.width) / 2;
    ARENA.y = (canvas.height - ARENA.height) / 2;
}
window.addEventListener('resize', resize);
resize();

const ICONS = { ORC: "👹", BOSS: "👹🔥", WARRIOR: "🛡️", ROGUE: "🗡️", MAGE: "🪄", PRIEST: "✨", ROCK: "🪨" };

class Projectile {
    constructor(x, y, target, damage, color) {
        this.x = x; this.y = y;
        this.target = target;
        this.damage = damage;
        this.color = color;
        this.speed = 12;
        this.active = true;
    }
    update() {
        if (!this.target || this.target.hp <= 0) { this.active = false; return; }
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 20) {
            this.target.receiveDamage(this.damage);
            this.active = false;
        } else {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI * 2); ctx.fill();
    }
}

class Unit {
    constructor(x, y, role, team, game) {
        this.game = game;
        this.x = x; this.y = y;
        this.role = role; this.team = team;
        this.vx = 0; this.vy = 0;
        this.hp = (role === "BOSS") ? 3000 : (role === "ORC" ? 350 : (role === "WARRIOR" ? 200 : 45));
        if (role === "ROGUE") this.hp = 80;
        this.maxHp = this.hp;
        this.size = (role === "BOSS") ? 65 : 32;
        
        // Animaciones
        this.offX = 0; this.offY = 0; // Offset para animar estocadas
        this.shake = 0; // Para efectos de bloqueo
        this.isRanged = (role === "MAGE" || role === "PRIEST");
        this.attackCooldown = this.isRanged ? 1600 : 800;
        this.lastAttack = 0;
    }

    receiveDamage(amount) {
        // Lógica de bloqueo para el Tanque
        if (this.role === "WARRIOR" && Math.random() < 0.4) {
            this.shake = 10; // Efecto visual de bloqueo
            amount *= 0.2; // Reduce el daño un 80%
        }
        this.hp -= amount;
        if (amount < 0) this.shieldPulse = 1.0; // Efecto de cura
    }

    update(units, obstacles) {
        const enemyTeam = (this.team === 0) ? 1 : 0;
        const nearestOrc = this.game.findNearest(this, 0);
        let target = (this.role === "PRIEST") ? this.game.findHurtAlly(this) : this.game.findNearest(this, enemyTeam);

        const moveSpeed = this.isRanged ? 0.11 : (this.role === "BOSS" ? 0.14 : 0.3);

        // KITING: Healers y Magos huyen si hay orcos cerca
        if (this.isRanged && nearestOrc && this.team === 1 && Math.hypot(nearestOrc.x - this.x, nearestOrc.y - this.y) < 220) {
            const dist = Math.hypot(nearestOrc.x - this.x, nearestOrc.y - this.y);
            this.vx -= (nearestOrc.x - this.x) / dist * moveSpeed * 3;
            this.vy -= (nearestOrc.y - this.y) / dist * moveSpeed * 3;
        } else if (target) {
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const dist = Math.hypot(dx, dy);
            const idealDist = this.isRanged ? 300 : (this.role === "BOSS" ? 80 : 40);

            if (dist > idealDist) {
                this.vx += (dx / dist) * moveSpeed;
                this.vy += (dy / dist) * moveSpeed;
            }

            if (dist < 450 && Date.now() - this.lastAttack > this.attackCooldown) {
                this.performAttack(target);
                this.lastAttack = Date.now();
            }
        }

        // Colisiones con Piedras y bordes
        obstacles.forEach(o => {
            const d = Math.hypot(o.x - this.x, o.y - this.y);
            if (d < 60) { this.vx -= (o.x - this.x) / d * 0.8; this.vy -= (o.y - this.y) / d * 0.8; }
        });

        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.85; this.vy *= 0.85;
        if (this.shake > 0) this.shake *= 0.8;

        const pad = this.size/2;
        this.x = Math.max(ARENA.x + pad, Math.min(ARENA.x + ARENA.width - pad, this.x));
        this.y = Math.max(ARENA.y + pad, Math.min(ARENA.y + ARENA.height - pad, this.y));
    }

    performAttack(target) {
        if (!this.isRanged) {
            // Animación de estocada Melee
            this.offX = (target.x - this.x) * 0.5;
            this.offY = (target.y - this.y) * 0.5;
            setTimeout(() => { this.offX = 0; this.offY = 0; }, 100);
            
            target.receiveDamage(this.role === "ROGUE" ? 28 : 18);
        } else {
            // Ataque a distancia
            const color = (this.role === "MAGE") ? "#00f2ff" : "#fbff00";
            const dmg = (this.role === "MAGE") ? 35 : -25;
            this.game.projectiles.push(new Projectile(this.x, this.y, target, dmg, color));
        }
    }

    draw() {
        ctx.save();
        // Aplicar offset de ataque y vibración de bloqueo
        const sx = Math.sin(Date.now()) * this.shake;
        ctx.translate(this.x + this.offX + sx, this.y + this.offY);

        // Feedback visual de cura o bloqueo
        if (this.shake > 1) {
            ctx.strokeStyle = "cyan"; ctx.lineWidth = 3;
            ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);
        }

        ctx.font = `${this.size}px serif`;
        ctx.textAlign = "center";
        ctx.fillText(ICONS[this.role], 0, this.size/3);
        
        // Barra de vida
        const bw = (this.role === "BOSS") ? 100 : 40;
        ctx.fillStyle = "black"; ctx.fillRect(-bw/2, -this.size - 5, bw, 5);
        ctx.fillStyle = this.team === 0 ? "#ff4d4d" : "#4dff4d";
        ctx.fillRect(-bw/2, -this.size - 5, (this.hp/this.maxHp) * bw, 5);
        ctx.restore();
    }
}

class Game {
    constructor() {
        this.units = []; this.projectiles = []; this.obstacles = [];
        this.init();
    }

    init() {
        for (let i = 0; i < 7; i++) {
            this.obstacles.push({
                x: ARENA.x + 200 + Math.random() * (ARENA.width - 400),
                y: ARENA.y + 150 + Math.random() * (ARENA.height - 300)
            });
        }
        this.spawn();
    }

    spawn() {
        this.units.push(new Unit(ARENA.x + 100, ARENA.y + ARENA.height/2, "BOSS", 0, this));
        for(let i=0; i<3; i++) this.units.push(new Unit(ARENA.x + 150, ARENA.y + Math.random()*ARENA.height, "ORC", 0, this));
        
        const roles = ["WARRIOR", "ROGUE", "ROGUE", "ROGUE", "MAGE", "MAGE", "PRIEST"];
        for(let i=0; i<18; i++) {
            let r = roles[Math.floor(Math.random()*roles.length)];
            this.units.push(new Unit(ARENA.x + ARENA.width - 150, ARENA.y + Math.random()*ARENA.height, r, 1, this));
        }
    }

    findNearest(me, team) {
        return this.units.filter(u => u.team === team)
            .sort((a,b) => Math.hypot(a.x-me.x, a.y-me.y) - Math.hypot(b.x-me.x, b.y-me.y))[0];
    }

    findHurtAlly(me) {
        return this.units.filter(u => u.team === me.team && u.hp < u.maxHp).sort((a,b) => a.hp - b.hp)[0];
    }

    loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#111"; ctx.fillRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height);
        ctx.strokeStyle = "#444"; ctx.strokeRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height);

        ctx.font = "40px serif";
        this.obstacles.forEach(o => ctx.fillText(ICONS.ROCK, o.x, o.y + 15));

        this.units.forEach(u => u.update(this.units, this.obstacles));
        this.projectiles.forEach(p => p.update());
        this.units = this.units.filter(u => u.hp > 0);
        this.projectiles = this.projectiles.filter(p => p.active);
        this.units.forEach(u => u.draw());
        this.projectiles.forEach(p => p.draw());

        requestAnimationFrame(() => this.loop());
    }
}

document.getElementById("startBtn").onclick = () => { new Game().loop(); };