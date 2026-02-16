const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ARENA = { width: 1400, height: 900, x: 0, y: 0 };

// Sistema de sprites/imágenes
const ASSETS_BASE = "assets/";
const UNITS_BASE = ASSETS_BASE + "Units/";
const ENEMIES_BASE = ASSETS_BASE + "Enemies/";
const Sprites = {
    background: null,
    // Animaciones por personaje: { idle: [frames], run: [frames], attack: [frames], etc. }
    animations: {
        orc: {}, warrior: {}, rogue: {}, archer: {}, priest: {}
    },
    arrow: null,
    rocks: [],
    bush: null,
    
    // Divide un sprite sheet en frames (asume frames de 32x32px, común en Tiny Swords)
    splitSpriteSheet: function(img, frameWidth = 32, frameHeight = 32) {
        const frames = [];
        const cols = Math.floor(img.width / frameWidth);
        const rows = Math.floor(img.height / frameHeight);
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                frames.push({
                    img: img,
                    sx: col * frameWidth,
                    sy: row * frameHeight,
                    sw: frameWidth,
                    sh: frameHeight
                });
            }
        }
        return frames;
    },
    
    load: function() {
        const imagePromises = [];
        const silentFail = (resolve) => { return () => resolve(); };
        
        // Fondo (Terrain/Background)
        const bgImg = new Image();
        bgImg.src = ASSETS_BASE + "Terrain/Background/Background.png";
        Sprites.background = bgImg;
        imagePromises.push(new Promise((resolve) => {
            bgImg.onload = resolve;
            bgImg.onerror = silentFail(resolve);
        }));
        
        // Helper: cargar N frames desde basePath/animName/AnimName1.png ...
        function loadFrames(basePath, animName, count, filePrefix) {
            const arr = [];
            const prefix = filePrefix || animName;
            for (let i = 1; i <= count; i++) {
                const img = new Image();
                img.src = basePath + `${animName}/${prefix}${i}.png`;
                arr.push(img);
                imagePromises.push(new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = silentFail(resolve);
                }));
            }
            return arr;
        }
        
        // Units están en Units/Warrior, Units/Rogue, Units/Priest; cada uno con carpetas por animación
        // ——— Priest: Idle (6), Run (4), Heal (10)
        const priestBase = UNITS_BASE + "Priest/";
        Sprites.animations.priest = {
            idle: loadFrames(priestBase, "Idle", 6, "Idle"),
            run: loadFrames(priestBase, "Run", 4, "Run"),
            heal: loadFrames(priestBase, "Heal", 10, "Heal")
        };
        
        // ——— Warrior: Idle (8), Run (6), Attack (4), Guard (6)
        const warriorBase = UNITS_BASE + "Warrior/";
        Sprites.animations.warrior = {
            idle: loadFrames(warriorBase, "Idle", 8, "Idle"),
            run: loadFrames(warriorBase, "Run", 6, "Run"),
            attack: loadFrames(warriorBase, "Attack", 4, "Attack"),
            guard: loadFrames(warriorBase, "Guard", 6, "Guard")
        };
        
        // ——— Rogue: Idle (8), Run (6), Attack (4)
        const rogueBase = UNITS_BASE + "Rogue/";
        Sprites.animations.rogue = {
            idle: loadFrames(rogueBase, "Idle", 8, "Idle"),
            run: loadFrames(rogueBase, "Run", 6, "Run"),
            attack: loadFrames(rogueBase, "Attack", 4, "Attack")
        };
        
        // ——— Archer: Idle (6), Run (4), Shoot (8)
        const archerBase = UNITS_BASE + "Archer/";
        Sprites.animations.archer = {
            idle: loadFrames(archerBase, "Idle", 6, "Idle"),
            run: loadFrames(archerBase, "Run", 4, "Run"),
            shoot: loadFrames(archerBase, "Shoot", 8, "Shoot")
        };
        
        // Flecha (proyectil del arquero)
        const arrowImg = new Image();
        arrowImg.src = ASSETS_BASE + "Units/Archer/Arrow/Arrow.png";
        Sprites.arrow = arrowImg;
        imagePromises.push(new Promise((resolve) => {
            arrowImg.onload = resolve;
            arrowImg.onerror = silentFail(resolve);
        }));
        
        // ——— Orc (enemigos): Idle (4), Run (8), Attack (8)
        const orcBase = ENEMIES_BASE + "Orc1/";
        Sprites.animations.orc = {
            idle: loadFrames(orcBase, "Idle", 4, "Idle"),
            run: loadFrames(orcBase, "Run", 8, "Run"),
            attack: loadFrames(orcBase, "Attack", 8, "Attack")
        };
        
        // Rocas (4 variantes)
        for (let i = 1; i <= 4; i++) {
            const img = new Image();
            img.src = ASSETS_BASE + `Terrain/Decorations/Rocks/Rock${i}.png`;
            Sprites.rocks.push(img);
            imagePromises.push(new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = silentFail(resolve);
            }));
        }
        
        // Arbusto (decoración, ralentiza al atravesar)
        const bushImg = new Image();
        bushImg.src = ASSETS_BASE + "Terrain/Decorations/Bush/Bush.png";
        Sprites.bush = bushImg;
        imagePromises.push(new Promise((resolve) => {
            bushImg.onload = resolve;
            bushImg.onerror = silentFail(resolve);
        }));
        
        return Promise.all(imagePromises);
    },
    
    // Dibuja un frame de animación de un personaje (solo para priest con frames individuales)
    drawAnimation: function(role, animationName, frameIndex, x, y, size, rotation = 0) {
        const anims = Sprites.animations[role.toLowerCase()];
        if (!anims || !anims[animationName]) return false;
        
        const frames = anims[animationName];
        if (!frames || frames.length === 0) return false;
        
        const frame = frames[frameIndex % frames.length];
        if (!frame || !frame.complete || !frame.naturalWidth) return false;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        // Para frames individuales (priest), dibujar la imagen completa
        ctx.drawImage(frame, -size/2, -size/2, size, size);
        ctx.restore();
        return true;
    },
    
    // Método legacy para compatibilidad (usa idle por defecto)
    draw: function(role, x, y, size, rotation = 0) {
        return Sprites.drawAnimation(role, "idle", 0, x, y, size, rotation);
    }
};

function resize() {
    // Ventana grande pero más pequeña que la pantalla (~90%)
    canvas.width = Math.min(Math.floor(window.innerWidth * 0.92), 1400);
    canvas.height = Math.min(Math.floor(window.innerHeight * 0.88), 900);
    ARENA.width = canvas.width;
    ARENA.height = canvas.height;
    ARENA.x = 0;
    ARENA.y = 0;
}
window.addEventListener('resize', resize);
resize();

const ICONS = { ORC: "👹", WARRIOR: "🛡️", ROGUE: "🗡️", ARCHER: "🏹", PRIEST: "✨", ROCK: "🪨" };

class Projectile {
    constructor(x, y, target, damage, color, role) {
        this.x = x; this.y = y;
        this.target = target;
        this.damage = damage;
        this.color = color;
        this.role = role || null; // "ARCHER" | "PRIEST" para animación
        this.speed = (role === "ARCHER") ? 7 : 12;
        this.active = true;
        this.born = Date.now();
        // Trayectoria parabólica para flechas del arquero
        if (role === "ARCHER" && target) {
            this.startX = x;
            this.startY = y;
            this.endX = target.x;
            this.endY = target.y;
            this.arcHeight = 60; // Altura del arco (píxeles)
            this.totalDist = Math.hypot(this.endX - this.startX, this.endY - this.startY) || 1;
            this.progress = 0;
        }
    }
    update() {
        if (!this.target || this.target.hp <= 0) { this.active = false; return; }
        if (this.role === "ARCHER") {
            // Avance a lo largo de la parábola
            this.progress += (this.speed / this.totalDist) * 1.2; // Factor para compensar longitud del arco
            if (this.progress >= 1) {
                const distToTarget = Math.hypot(this.target.x - this.x, this.target.y - this.y);
                if (distToTarget < 35) this.target.receiveDamage(this.damage);
                this.active = false;
                return;
            }
            const t = this.progress;
            const dx = this.endX - this.startX;
            const dy = this.endY - this.startY;
            this.x = this.startX + dx * t;
            this.y = this.startY + dy * t - this.arcHeight * 4 * t * (1 - t); // Arco hacia arriba (Y crece hacia abajo)
        } else {
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
    }
    draw() {
        if (this.role === "ARCHER" && Sprites.arrow && Sprites.arrow.complete && Sprites.arrow.naturalWidth > 0) {
            ctx.save();
            ctx.translate(this.x, this.y);
            let angle;
            if (this.progress !== undefined && this.progress < 1) {
                const t = this.progress;
                const dx = this.endX - this.startX;
                const dy = this.endY - this.startY;
                const dydt = dy - this.arcHeight * 4 * (1 - 2 * t);
                angle = Math.atan2(dydt, dx);
            } else {
                const dx = this.target ? this.target.x - this.x : 1;
                const dy = this.target ? this.target.y - this.y : 0;
                angle = Math.atan2(dy, dx);
            }
            ctx.rotate(angle);
            ctx.drawImage(Sprites.arrow, -20, -6, 40, 12);
            ctx.restore();
            return;
        }
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
        this.hp = (role === "ORC" ? 350 : (role === "WARRIOR" ? 200 : 45));
        if (role === "ROGUE") this.hp = 80;
        this.maxHp = this.hp;
        this.size = (role === "ORC" ? 52 : (role === "WARRIOR" ? 50 : 46));
        // Radio de colisión: no pueden solaparse ni 1mm
        this.collisionRadius = this.size / 2 + 1;
        
        // Animaciones mejoradas
        this.offX = 0; this.offY = 0; // Offset para animar estocadas
        this.attackAnimTime = 0; // Tiempo de animación de ataque
        this.shake = 0; // Para efectos de bloqueo
        this.blockAnimTime = 0; // Tiempo de animación de bloqueo
        this.rotation = 0; // Rotación para animaciones
        this.isRanged = (role === "ARCHER" || role === "PRIEST");
        this.attackCooldown = this.isRanged ? 1600 : 800;
        this.lastAttack = 0;
        // Priest: canaliza la curación varios segundos; no puede cortar hasta que acabe la ronda
        if (role === "PRIEST") {
            this.healCastTime = 2500;  // ~2.5 s canalizando
            this.healCooldown = 3000;
            this.lastHealTime = 0;
            this.healingTarget = null;
            this.healProgress = 0;
        }
        if (role === "ARCHER") {
            this.attackTarget = null;
            this.arrowLaunched = false;
        }
        
        // Animación de sprite sheets
        this.animState = "idle"; // "idle", "run", "attack", "guard", "shoot", "heal"
        this.animFrame = 0;
        this.animTime = 0;
        this.animSpeed = 150; // ms por frame
        this.facingRight = true; // Sprites miran a la derecha por defecto
    }

    receiveDamage(amount) {
        // Guerrero: bloquea cuando es atacado (reduce daño); no puede bloquear mientras ataca
        if (this.role === "WARRIOR" && amount > 0 && this.attackAnimTime <= 0) {
            this.blockAnimTime = 300; // Animación de guard al ser golpeado
            amount *= 0.4; // Bloqueo: solo recibe 40% del daño (60% reducción)
        }
        this.hp -= amount;
        if (amount < 0) this.shieldPulse = 1.0; // Efecto de cura
    }

    update(units, obstacles, bushes = []) {
        const enemyTeam = (this.team === 0) ? 1 : 0;
        const nearestOrc = this.game.findNearest(this, 0);
        // Priest sigue al aliado que está más cerca de los orcos para acercarse al combate y curar
        let target = (this.role === "PRIEST")
            ? this.game.findAllyNearestToEnemy(this)
            : this.game.findNearest(this, enemyTeam);

        const moveSpeed = (this.role === "PRIEST") ? 0.2 : (this.role === "ARCHER" ? 0.18 : (this.isRanged ? 0.11 : 0.3));

        // Actualizar animaciones
        if (this.attackAnimTime > 0) {
            this.attackAnimTime -= 16; // ~60fps
            if (this.attackAnimTime <= 0) {
                this.attackAnimTime = 0;
                this.offX = 0;
                this.offY = 0;
                this.rotation = 0;
                if (this.role === "ARCHER") {
                    this.attackTarget = null;
                    this.arrowLaunched = false;
                }
            }
        }
        if (this.blockAnimTime > 0) {
            this.blockAnimTime -= 16;
            if (this.blockAnimTime <= 0) {
                this.blockAnimTime = 0;
                this.shake = 0;
            }
        }
        const dx = target ? target.x - this.x : 0;
        const dy = target ? target.y - this.y : 0;
        const dist = target ? Math.hypot(dx, dy) : Infinity;
        const isMoving = Math.abs(this.vx) > 0.01 || Math.abs(this.vy) > 0.01;
        // Rango melee: solo pueden golpear cuando están en rango cuerpo a cuerpo
        const idealDist = this.isRanged ? 300 : 48;
        const inMeleeRange = !this.isRanged && target && target.hp > 0 && dist <= idealDist + 8;
        const distToNearestOrc = nearestOrc ? Math.hypot(nearestOrc.x - this.x, nearestOrc.y - this.y) : Infinity;
        const isKiting = this.isRanged && this.team === 1 && distToNearestOrc < 220;
        // En combate: quietos cuando están en rango
        const combatDist = this.isRanged ? idealDist + 25 : idealDist + 8;
        const inCombat = target && target.hp > 0 && target.team !== this.team && dist <= combatDist && !isKiting;

        // Guerrero: si está siendo atacado (enemigo con él como objetivo en animación de ataque), debe bloquear y no atacar
        const isBeingAttacked = this.role === "WARRIOR" && units.some(u =>
            u.team !== this.team && u.hp > 0 && u.attackAnimTime > 0 &&
            this.game.findNearest(u, this.team) === this
        );

        // Durante el ataque no puede moverse ni bloquear; la animación no se interrumpe
        if (this.attackAnimTime > 0) {
            this.vx = 0;
            this.vy = 0;
        } else if (isKiting) {
            const kiteFactor = (this.role === "PRIEST" || this.role === "ARCHER") ? 1 : 3;
            this.vx -= (nearestOrc.x - this.x) / distToNearestOrc * moveSpeed * kiteFactor;
            this.vy -= (nearestOrc.y - this.y) / distToNearestOrc * moveSpeed * kiteFactor;
        } else if (target) {
            // Priest no se mueve mientras cura; debe estar quieto para poder curar
            const priestHealing = this.role === "PRIEST" && this.healingTarget;
            if (priestHealing) {
                this.vx = 0;
                this.vy = 0;
            } else if (dist > idealDist) {
                this.vx += (dx / dist) * moveSpeed;
                this.vy += (dy / dist) * moveSpeed;
            }

            // Melee (orcos, warrior, rogue): solo atacan en rango y estando quietos; ranged a distancia
            // Guerrero: no ataca si está siendo atacado o bloqueando (debe bloquear)
            const warriorBlocking = this.role === "WARRIOR" && (isBeingAttacked || this.blockAnimTime > 0);
            const canHit = target && target.hp > 0 && target.team !== this.team && Date.now() - this.lastAttack > this.attackCooldown && !warriorBlocking;
            const meleeCanHit = inMeleeRange && !isMoving;
            if (canHit && (this.isRanged ? dist < 450 : meleeCanHit)) {
                this.performAttack(target);
                this.lastAttack = Date.now();
                this.animFrame = 0;
                this.animTime = 0;
            }
        }

        // En combate o durante ataque: quedarse quieto (anular velocidad de movimiento)
        if (inCombat || this.attackAnimTime > 0) {
            this.vx = 0;
            this.vy = 0;
        }
        // Dirección para voltear sprite: enemigo a la derecha o movimiento a la derecha
        if (target && target.team !== this.team) {
            this.facingRight = target.x > this.x;
        } else if (Math.abs(this.vx) > 0.02) {
            this.facingRight = this.vx > 0;
        }
        
        // Determinar estado de animación (priest, warrior, rogue con sprites)
        if (this.role === "PRIEST") {
            // Una vez empieza a curar, no puede cortar hasta que acabe la ronda de curación
            if (this.healingTarget) {
                this.healProgress += 16;
                if (this.healProgress >= this.healCastTime) {
                    if (this.healingTarget.hp > 0 && this.healingTarget.hp < this.healingTarget.maxHp) {
                        this.healingTarget.receiveDamage(-40);
                    }
                    this.lastHealTime = Date.now();
                    this.healingTarget = null;
                    this.healProgress = 0;
                }
                this.animState = "heal";
            } else {
                const hurtAlly = this.game.findHurtAlly(this);
                const distToHurt = hurtAlly ? Math.hypot(hurtAlly.x - this.x, hurtAlly.y - this.y) : Infinity;
                if (hurtAlly && distToHurt < 450 && !isMoving && Date.now() - this.lastHealTime >= this.healCooldown) {
                    this.healingTarget = hurtAlly;
                    this.healProgress = 0;
                    this.vx = 0;
                    this.vy = 0;
                    this.animFrame = 0;
                    this.animTime = 0;
                    this.animState = "heal";
                }
            }
            if (!this.healingTarget) {
                if (isMoving && !inCombat) {
                    this.animState = "run";
                } else {
                    this.animState = "idle";
                }
            }
        } else if (this.role === "WARRIOR") {
            if (this.attackAnimTime > 0) {
                this.animState = "attack";
            } else if (this.blockAnimTime > 0 || isBeingAttacked) {
                this.animState = "guard";
            } else if (isMoving && !inCombat) {
                this.animState = "run";
            } else {
                this.animState = "idle";
            }
        } else if (this.role === "ROGUE" || this.role === "ORC") {
            if (this.attackAnimTime > 0) {
                this.animState = "attack";
            } else if (isMoving && !inCombat) {
                this.animState = "run";
            } else {
                this.animState = "idle";
            }
        } else if (this.role === "ARCHER") {
            if (this.attackAnimTime > 0) {
                this.animState = "shoot";
            } else if (isMoving && !inCombat) {
                this.animState = "run";
            } else {
                this.animState = "idle";
            }
        }
        
        // Actualizar frame de animación (priest, warrior, rogue, archer, orc)
        const roleKey = this.role.toLowerCase();
        if (Sprites.animations[roleKey] && Sprites.animations[roleKey][this.animState]) {
            this.animTime += 16;
            // Animaciones más lentas para apreciarlas mejor (ms por frame)
            const speed = this.animState === "heal" ? 220 : (this.animState === "shoot" ? 300 : (this.animState === "attack" ? 180 : 280));
            if (this.animTime >= speed) {
                this.animTime = 0;
                const anims = Sprites.animations[roleKey];
                if (anims[this.animState]) {
                    const len = anims[this.animState].length;
                    // Shoot: no hacer loop, quedarse en el último frame; lanzar flecha en frame 6
                    if (this.role === "ARCHER" && this.animState === "shoot") {
                        if (this.animFrame < len - 1) {
                            this.animFrame++;
                            if (this.animFrame === 6 && !this.arrowLaunched && this.attackTarget && this.attackTarget.hp > 0) {
                                this.game.projectiles.push(new Projectile(this.x, this.y, this.attackTarget, 35, "#8b7355", this.role));
                                this.arrowLaunched = true;
                            }
                        }
                    } else {
                        this.animFrame = (this.animFrame + 1) % len;
                    }
                }
            }
        }

        // Ralentización al atravesar arbustos
        const bushRadius = 28;
        let inBush = false;
        bushes.forEach(b => {
            if (Math.hypot(this.x - b.x, this.y - b.y) < bushRadius) inBush = true;
        });
        if (inBush) {
            this.vx *= 0.62;
            this.vy *= 0.62;
        }
        // Esquive de obstáculos (rocas) — no aplicar en combate, al curar ni durante el ataque
        if (!inCombat && !(this.role === "PRIEST" && this.healingTarget) && this.attackAnimTime <= 0) obstacles.forEach(o => {
            const dx = this.x - o.x;
            const dy = this.y - o.y;
            const d = Math.hypot(dx, dy);
            const obstacleRadius = 30;
            const minObstacleDist = this.size/2 + obstacleRadius + 10;
            
            if (d < minObstacleDist && d > 0) {
                const force = (minObstacleDist - d) / minObstacleDist * 0.8;
                this.vx += (dx / d) * force;
                this.vy += (dy / d) * force;
            }
        });

        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.85;
        this.vy *= 0.85;
        if (this.shake > 0) this.shake *= 0.85;

        // Límites para que sprite, barra de vida y etiqueta no se salgan de pantalla
        const padX = Math.max(this.collisionRadius, 35);
        const padTop = this.size / 2 + 32;   // barra encima del sprite
        const padBottom = this.size / 2 + 15; // margen por debajo (flash/overflow)
        this.x = Math.max(ARENA.x + padX, Math.min(ARENA.x + ARENA.width - padX, this.x));
        this.y = Math.max(ARENA.y + padTop, Math.min(ARENA.y + ARENA.height - padBottom, this.y));
    }

    performAttack(target) {
        if (!target || target.hp <= 0) return;
        if (!this.isRanged) {
            // Animación de ataque más larga; no se puede interrumpir hasta que termine
            this.attackAnimTime = 450;
            target.receiveDamage(this.role === "ROGUE" ? 28 : 18);
        } else if (this.role === "ARCHER") {
            this.attackTarget = target;
            this.arrowLaunched = false;
            this.attackAnimTime = 8 * 480; // 8 frames × 480 ms para ver toda la animación
        }
    }

    drawCharacter() {
        // Priest, Warrior, Rogue y Orc usan sprites animados si están cargados
        if (this.role === "PRIEST" || this.role === "WARRIOR" || this.role === "ROGUE" || this.role === "ARCHER" || this.role === "ORC") {
            const roleKey = this.role.toLowerCase();
            if (this.role === "PRIEST") {
                ctx.save();
                if (!this.facingRight) ctx.scale(-1, 1);
                const healFrames = Sprites.animations[roleKey]?.heal?.length ?? 10;
                const isFirstTwoHealFrames = this.animState === "heal" && (this.animFrame === 0 || this.animFrame === 1);
                const priestScaleX = this.animState === "idle" || isFirstTwoHealFrames ? 0.82 : (this.animState === "heal" ? 1.38 : 1.05);
                ctx.scale(priestScaleX, 1);
                if (Sprites.drawAnimation(roleKey, this.animState, this.animFrame, 0, 0, this.size, 0)) {
                    ctx.restore();
                    return;
                }
                ctx.restore();
            } else if (this.role === "ORC") {
                ctx.save();
                if (!this.facingRight) ctx.scale(-1, 1);
                const orcNarrowScale = (this.animState === "idle") || (this.animState === "run") || (this.animState === "attack" && this.animFrame === 0);
                if (orcNarrowScale) ctx.scale(0.58, 1); // Bastante más estrecho en idle, run y primer frame de ataque
                if (Sprites.drawAnimation(roleKey, this.animState, this.animFrame, 0, 0, this.size, 0)) {
                    ctx.restore();
                    return;
                }
                ctx.restore();
            } else if (this.role === "ARCHER") {
                ctx.save();
                if (!this.facingRight) ctx.scale(-1, 1);
                const archerAnim = this.animState === "shoot" ? "shoot" : (this.animState === "run" ? "run" : "idle");
                if (Sprites.drawAnimation(roleKey, archerAnim, this.animFrame, 0, 0, this.size, 0)) {
                    ctx.restore();
                    return;
                }
                ctx.restore();
            } else {
                ctx.save();
                if (!this.facingRight) ctx.scale(-1, 1);
                if (Sprites.drawAnimation(roleKey, this.animState, this.animFrame, 0, 0, this.size, 0)) {
                    ctx.restore();
                    return;
                }
                ctx.restore();
            }
        }
        
        // Resto: dibujar con código (fallback si no hay sprites)
        
        // Si no hay imagen, dibujar con código
        const s = this.size;
        ctx.lineWidth = 3; // Contornos gruesos estilo caricaturesco
        
        if (this.role === "ORC") {
            // Orco verde con armadura de cuero marrón - Estilo mejorado
            // Sombra del cuerpo
            ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
            ctx.beginPath();
            ctx.ellipse(0, s * 0.25, s * 0.35, s * 0.15, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Cuerpo verde musculoso
            ctx.fillStyle = "#4a8c4a";
            ctx.strokeStyle = "#2d5a2d";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, s * 0.1, s * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Músculos del torso
            ctx.fillStyle = "#3a7c3a";
            ctx.beginPath();
            ctx.arc(-s * 0.15, s * 0.05, s * 0.08, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(s * 0.15, s * 0.05, s * 0.08, 0, Math.PI * 2);
            ctx.fill();
            
            // Cabeza verde más grande
            ctx.fillStyle = "#5a9c5a";
            ctx.strokeStyle = "#2d5a2d";
            ctx.beginPath();
            ctx.arc(0, -s * 0.15, s * 0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Armadura de cuero marrón mejorada
            ctx.fillStyle = "#8b4513";
            ctx.strokeStyle = "#654321";
            ctx.fillRect(-s * 0.3, -s * 0.1, s * 0.6, s * 0.4);
            ctx.strokeRect(-s * 0.3, -s * 0.1, s * 0.6, s * 0.4);
            
            // Detalles de la armadura
            ctx.strokeStyle = "#654321";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-s * 0.3, s * 0.05);
            ctx.lineTo(s * 0.3, s * 0.05);
            ctx.stroke();
            
            // Hombros con pinchos mejorados
            ctx.fillStyle = "#654321";
            ctx.strokeStyle = "#4a2c15";
            ctx.fillRect(-s * 0.4, -s * 0.2, s * 0.2, s * 0.15);
            ctx.strokeRect(-s * 0.4, -s * 0.2, s * 0.2, s * 0.15);
            ctx.fillRect(s * 0.2, -s * 0.2, s * 0.2, s * 0.15);
            ctx.strokeRect(s * 0.2, -s * 0.2, s * 0.2, s * 0.15);
            
            // Pinchos
            ctx.fillStyle = "#2a1a0a";
            ctx.beginPath();
            ctx.moveTo(-s * 0.3, -s * 0.2);
            ctx.lineTo(-s * 0.35, -s * 0.3);
            ctx.lineTo(-s * 0.25, -s * 0.2);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(s * 0.3, -s * 0.2);
            ctx.lineTo(s * 0.35, -s * 0.3);
            ctx.lineTo(s * 0.25, -s * 0.2);
            ctx.closePath();
            ctx.fill();
            
            // Ojos rojos brillantes
            ctx.fillStyle = "#ff0000";
            ctx.strokeStyle = "#8b0000";
            ctx.beginPath();
            ctx.arc(-s * 0.1, -s * 0.2, s * 0.04, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(s * 0.1, -s * 0.2, s * 0.04, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Highlight en los ojos
            ctx.fillStyle = "#ff6666";
            ctx.beginPath();
            ctx.arc(-s * 0.1, -s * 0.21, s * 0.015, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(s * 0.1, -s * 0.21, s * 0.015, 0, Math.PI * 2);
            ctx.fill();
            
        } else if (this.role === "WARRIOR") {
            // Guerrero con armadura de placa gris
            // Cuerpo con armadura
            ctx.fillStyle = "#888888";
            ctx.strokeStyle = "#555555";
            ctx.fillRect(-s * 0.3, -s * 0.2, s * 0.6, s * 0.5);
            ctx.strokeRect(-s * 0.3, -s * 0.2, s * 0.6, s * 0.5);
            
            // Casco gris que cubre la cara
            ctx.fillStyle = "#777777";
            ctx.strokeStyle = "#444444";
            ctx.fillRect(-s * 0.35, -s * 0.45, s * 0.7, s * 0.3);
            ctx.strokeRect(-s * 0.35, -s * 0.45, s * 0.7, s * 0.3);
            
            // Visor del casco (ojos)
            ctx.fillStyle = "#000000";
            ctx.fillRect(-s * 0.15, -s * 0.35, s * 0.1, s * 0.05);
            ctx.fillRect(s * 0.05, -s * 0.35, s * 0.1, s * 0.05);
            
            // Escudo
            ctx.fillStyle = "#999999";
            ctx.strokeStyle = "#666666";
            ctx.fillRect(-s * 0.45, -s * 0.1, s * 0.2, s * 0.4);
            ctx.strokeRect(-s * 0.45, -s * 0.1, s * 0.2, s * 0.4);
            
            // Espada
            ctx.fillStyle = "#cccccc";
            ctx.strokeStyle = "#888888";
            ctx.fillRect(s * 0.25, -s * 0.3, s * 0.1, s * 0.5);
            ctx.strokeRect(s * 0.25, -s * 0.3, s * 0.1, s * 0.5);
            
        } else if (this.role === "ROGUE") {
            // Rogue delgado con armadura ligera
            // Cuerpo delgado
            ctx.fillStyle = "#6b4423";
            ctx.strokeStyle = "#4a2c15";
            ctx.fillRect(-s * 0.2, -s * 0.1, s * 0.4, s * 0.4);
            ctx.strokeRect(-s * 0.2, -s * 0.1, s * 0.4, s * 0.4);
            
            // Cabeza
            ctx.fillStyle = "#d4a574";
            ctx.strokeStyle = "#8b6f47";
            ctx.beginPath();
            ctx.arc(0, -s * 0.25, s * 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Capucha/capa
            ctx.fillStyle = "#4a4a4a";
            ctx.strokeStyle = "#2a2a2a";
            ctx.beginPath();
            ctx.arc(0, -s * 0.15, s * 0.3, Math.PI, 0, false);
            ctx.fill();
            ctx.stroke();
            
            // Daga/espada corta
            ctx.fillStyle = "#aaaaaa";
            ctx.strokeStyle = "#666666";
            ctx.fillRect(s * 0.15, -s * 0.2, s * 0.15, s * 0.3);
            ctx.strokeRect(s * 0.15, -s * 0.2, s * 0.15, s * 0.3);
            
        } else if (this.role === "ARCHER") {
            // Fallback: arquero con arco
            ctx.fillStyle = "#4a7ba7";
            ctx.strokeStyle = "#2d4a6b";
            ctx.fillRect(-s * 0.25, s * 0.1, s * 0.5, s * 0.4);
            ctx.strokeRect(-s * 0.25, s * 0.1, s * 0.5, s * 0.4);
            ctx.fillStyle = "#d4a574";
            ctx.strokeStyle = "#8b6f47";
            ctx.beginPath();
            ctx.arc(0, -s * 0.25, s * 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = "#654321";
            ctx.beginPath();
            ctx.arc(0, -s * 0.2, s * 0.25, -0.5, 0.5);
            ctx.stroke();
            
        } else if (this.role === "PRIEST") {
            // Sacerdote con túnica marrón claro
            // Túnica marrón
            ctx.fillStyle = "#d4a574";
            ctx.strokeStyle = "#8b6f47";
            ctx.fillRect(-s * 0.25, s * 0.1, s * 0.5, s * 0.4);
            ctx.strokeRect(-s * 0.25, s * 0.1, s * 0.5, s * 0.4);
            
            // Parte superior
            ctx.fillStyle = "#e4b584";
            ctx.fillRect(-s * 0.25, -s * 0.1, s * 0.5, s * 0.2);
            ctx.strokeRect(-s * 0.25, -s * 0.1, s * 0.5, s * 0.2);
            
            // Cabeza
            ctx.fillStyle = "#d4a574";
            ctx.strokeStyle = "#8b6f47";
            ctx.beginPath();
            ctx.arc(0, -s * 0.25, s * 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Halo dorado
            ctx.strokeStyle = "#ffd700";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, -s * 0.35, s * 0.15, 0, Math.PI * 2);
            ctx.stroke();
            
            // Efecto de curación
            ctx.fillStyle = `rgba(255, 215, 0, ${0.3 + Math.sin(Date.now() * 0.01) * 0.2})`;
            ctx.beginPath();
            ctx.arc(0, -s * 0.25, s * 0.25, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    draw() {
        ctx.save();
        
        // Animación de ataque del ROGUE (interpolación suave)
        let currentOffX = 0, currentOffY = 0;
        if (this.role === "ROGUE" && this.attackAnimTime > 0) {
            const progress = 1 - (this.attackAnimTime / 200);
            const easeOut = 1 - Math.pow(1 - progress, 3); // Easing suave
            currentOffX = this.offX * easeOut;
            currentOffY = this.offY * easeOut;
        } else if (this.role !== "ROGUE") {
            currentOffX = this.offX;
            currentOffY = this.offY;
        }
        
        const sx = Math.sin(Date.now() * 0.02) * this.shake;
        ctx.translate(this.x + currentOffX + sx, this.y + currentOffY);

        // Dibujar personaje con estilo caricaturesco
        this.drawCharacter();
        
        ctx.shadowBlur = 0;
        ctx.restore();
        
        // Barra de vida pequeña
        ctx.save();
        const isEnemy = (this.team === 1);
        const bw = isEnemy ? 18 : 28;
        const barHeight = isEnemy ? 3 : 4;
        const barY = this.y - this.size/2 - 24;
        
        ctx.fillStyle = "#000000";
        ctx.fillRect(this.x - bw/2 - 2, barY - 2, bw + 4, barHeight + 4);
        
        const hpPercent = this.hp / this.maxHp;
        ctx.fillStyle = hpPercent > 0.5 ? "#00ff00" : (hpPercent > 0.25 ? "#ffff00" : "#ff0000");
        ctx.fillRect(this.x - bw/2, barY, hpPercent * bw, barHeight);
        
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x - bw/2 - 2, barY - 2, bw + 4, barHeight + 4);
        
        ctx.restore();
    }
}

class Game {
    constructor() {
        this.units = []; this.projectiles = []; this.obstacles = []; this.bushes = [];
        this.imagesLoaded = false;
        this.gameOver = false;
        this.winner = null; // "allies" | "orcs"
        this.init();
    }
    
    async loadImages() {
        // Cargar imágenes si están disponibles
        try {
            await Sprites.load();
            this.imagesLoaded = true;
        } catch (e) {
            console.log("Usando dibujo con código (imágenes no disponibles)");
            this.imagesLoaded = false;
        }
    }

    init() {
        // Más piedras (rocas)
        for (let i = 0; i < 28; i++) {
            this.obstacles.push({
                x: ARENA.x + 150 + Math.random() * (ARENA.width - 300),
                y: ARENA.y + 120 + Math.random() * (ARENA.height - 240),
                rockIndex: i % 4
            });
        }
        // Arbustos (decoración, ralentizan al atravesar) — sin colisionar entre sí ni con piedras
        const minDistBushRock = 55;
        const minDistBushBush = 45;
        for (let i = 0; i < 35; i++) {
            let attempts = 0;
            while (attempts < 80) {
                const bx = ARENA.x + 120 + Math.random() * (ARENA.width - 240);
                const by = ARENA.y + 100 + Math.random() * (ARENA.height - 200);
                const tooCloseToRock = this.obstacles.some(o => Math.hypot(bx - o.x, by - o.y) < minDistBushRock);
                const tooCloseToBush = this.bushes.some(b => Math.hypot(bx - b.x, by - b.y) < minDistBushBush);
                if (!tooCloseToRock && !tooCloseToBush) {
                    this.bushes.push({ x: bx, y: by });
                    break;
                }
                attempts++;
            }
        }
        this.spawn();
    }

    spawn() {
        for (let i = 0; i < 4; i++) this.units.push(new Unit(ARENA.x + 150, ARENA.y + Math.random()*ARENA.height, "ORC", 0, this));
        
        const roles = ["WARRIOR", "ROGUE", "ROGUE", "ROGUE", "ARCHER", "ARCHER", "PRIEST"];
        this.units.push(new Unit(ARENA.x + ARENA.width - 150, ARENA.y + Math.random()*ARENA.height, "WARRIOR", 1, this));
        for (let i = 0; i < 7; i++) {
            let r = roles[Math.floor(Math.random()*roles.length)];
            this.units.push(new Unit(ARENA.x + ARENA.width - 150, ARENA.y + Math.random()*ARENA.height, r, 1, this));
        }
    }

    findNearest(me, team) {
        return this.units.filter(u => u.team === team && u.hp > 0)
            .sort((a,b) => Math.hypot(a.x-me.x, a.y-me.y) - Math.hypot(b.x-me.x, b.y-me.y))[0];
    }

    findHurtAlly(me) {
        return this.units.filter(u => u.team === me.team && u.hp > 0 && u.hp < u.maxHp).sort((a,b) => a.hp - b.hp)[0];
    }

    findNearestAlly(me) {
        return this.units.filter(u => u.team === me.team && u !== me && u.hp > 0)
            .sort((a,b) => Math.hypot(a.x-me.x, a.y-me.y) - Math.hypot(b.x-me.x, b.y-me.y))[0];
    }

    /** Aliado más cercano a los orcos (para que el priest se acerque al combate siguiendo al frente) */
    findAllyNearestToEnemy(me) {
        const nearestEnemy = this.findNearest(me, 0);
        if (!nearestEnemy) return this.findNearestAlly(me);
        return this.units.filter(u => u.team === me.team && u !== me && u.hp > 0)
            .sort((a,b) => Math.hypot(a.x - nearestEnemy.x, a.y - nearestEnemy.y) - Math.hypot(b.x - nearestEnemy.x, b.y - nearestEnemy.y))[0];
    }

    /**
     * Física: resuelve colisiones entre unidades. No pueden solaparse ni 1mm.
     * Solo corrige posiciones (sin añadir velocidad de empuje).
     */
    resolveUnitCollisions() {
        const units = this.units;
        const maxIterations = 10;
        
        for (let iter = 0; iter < maxIterations; iter++) {
            let anyOverlap = false;
            
            for (let i = 0; i < units.length; i++) {
                const a = units[i];
                if (a.hp <= 0) continue;
                const rA = a.collisionRadius;
                
                for (let j = i + 1; j < units.length; j++) {
                    const b = units[j];
                    if (b.hp <= 0) continue;
                    const rB = b.collisionRadius;
                    
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const dist = Math.hypot(dx, dy);
                    const minDist = rA + rB;
                    
                    if (dist < minDist && dist > 0) {
                        anyOverlap = true;
                        const overlap = minDist - dist;
                        const nx = dx / dist;
                        const ny = dy / dist;
                        // Aliado vs enemigo: solo mover al aliado (team 1) para no empujar enemigos
                        if (a.team !== b.team) {
                            if (a.team === 1) {
                                a.x -= nx * overlap;
                                a.y -= ny * overlap;
                            } else {
                                b.x += nx * overlap;
                                b.y += ny * overlap;
                            }
                        } else {
                            // Mismo bando: separar mitad y mitad
                            a.x -= nx * (overlap * 0.5);
                            a.y -= ny * (overlap * 0.5);
                            b.x += nx * (overlap * 0.5);
                            b.y += ny * (overlap * 0.5);
                        }
                    }
                }
            }
            
            // Mantener dentro del arena (mismos márgenes que en Unit.update para no cortar sprites)
            units.forEach(u => {
                if (u.hp <= 0) return;
                const padX = Math.max(u.collisionRadius, 35);
                const padTop = u.size / 2 + 32;
                const padBottom = u.size / 2 + 15;
                u.x = Math.max(ARENA.x + padX, Math.min(ARENA.x + ARENA.width - padX, u.x));
                u.y = Math.max(ARENA.y + padTop, Math.min(ARENA.y + ARENA.height - padBottom, u.y));
            });
            
            if (!anyOverlap) break;
        }
    }

    drawArenaBackground() {
        if (Sprites.background && Sprites.background.complete && Sprites.background.naturalWidth > 0) {
            const img = Sprites.background;
            const tw = img.naturalWidth;
            const th = img.naturalHeight;
            for (let y = ARENA.y; y < ARENA.y + ARENA.height; y += th) {
                for (let x = ARENA.x; x < ARENA.x + ARENA.width; x += tw) {
                    ctx.drawImage(img, x, y, tw, th);
                }
            }
        } else {
            ctx.fillStyle = "#2d5a27";
            ctx.fillRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height);
        }
        ctx.strokeStyle = "#1e3d1a";
        ctx.lineWidth = 4;
        ctx.strokeRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height);
    }

    drawBush(x, y) {
        const bush = Sprites.bush;
        if (bush && bush.complete && bush.naturalWidth > 0) {
            ctx.save();
            ctx.translate(x, y);
            const size = 50;
            ctx.drawImage(bush, -size/2, -size/2, size, size);
            ctx.restore();
            return;
        }
    }

    drawRock(x, y, rockIndex = 0) {
        const rocks = Sprites.rocks;
        if (rocks.length > 0) {
            const rock = rocks[rockIndex % rocks.length];
            if (rock && rock.complete && rock.naturalWidth > 0) {
                ctx.save();
                ctx.translate(x, y);
                ctx.drawImage(rock, -30, -30, 60, 60);
                ctx.restore();
                return;
            }
        }
        
        // Fallback: dibujar con código
        ctx.save();
        ctx.translate(x, y);
        
        // Sombra de la roca mejorada
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath();
        ctx.ellipse(0, 10, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Roca gris claro con contorno grueso mejorado
        ctx.fillStyle = "#b0bec5";
        ctx.strokeStyle = "#78909c";
        ctx.lineWidth = 4;
        
        // Forma irregular de roca más detallada
        ctx.beginPath();
        ctx.moveTo(-18, 6);
        ctx.lineTo(-22, -4);
        ctx.lineTo(-15, -12);
        ctx.lineTo(-8, -16);
        ctx.lineTo(6, -18);
        ctx.lineTo(20, -10);
        ctx.lineTo(22, 4);
        ctx.lineTo(15, 12);
        ctx.lineTo(5, 14);
        ctx.lineTo(-8, 13);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Detalles de sombra en la roca mejorados
        ctx.fillStyle = "#90a4ae";
        ctx.beginPath();
        ctx.ellipse(-6, -6, 10, 7, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlight para dar profundidad
        ctx.fillStyle = "#c5d1d8";
        ctx.beginPath();
        ctx.ellipse(8, -8, 6, 4, 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    updateStats() {
        const statsAlliesEl = document.getElementById("statsAlliesRow");
        const statsEnemiesEl = document.getElementById("statsEnemiesRow");
        if (!statsAlliesEl || !statsEnemiesEl) return;
        const alive = this.units.filter(u => u.hp > 0);
        const AVATARS = "assets/UI Elements/UI Elements/Human Avatars/";
        const ICONS = "assets/UI Elements/UI Elements/Icons/";
        const allyRoles = [
            { role: "WARRIOR", icon: AVATARS + "Warrior.png", label: "Guerrero" },
            { role: "ROGUE", icon: AVATARS + "Rogue.png", label: "Pícaro" },
            { role: "ARCHER", icon: AVATARS + "Archer.png", label: "Arquero" },
            { role: "PRIEST", icon: AVATARS + "Priest.png", label: "Sacerdote" }
        ];
        let alliesHtml = "";
        for (const r of allyRoles) {
            const n = alive.filter(u => u.team === 1 && u.role === r.role).length;
            alliesHtml += `<span class="stats-unit" title="${r.label}"><img src="${r.icon}" alt="${r.label}"><span class="stats-num">${n}</span></span>`;
        }
        const orcs = alive.filter(u => u.team === 0).length;
        statsAlliesEl.innerHTML = alliesHtml;
        statsEnemiesEl.innerHTML = `<span class="stats-unit" title="Orco"><img src="${ICONS}Icon_04.png" alt="Orco"><span class="stats-num">${orcs}</span></span>`;
    }

    showGameOver(victory) {
        const overlay = document.getElementById("gameOverOverlay");
        const titleEl = document.getElementById("gameOverTitle");
        const subEl = document.getElementById("gameOverSub");
        if (!overlay || !titleEl) return;
        overlay.className = "game-over-overlay visible " + (victory ? "victory" : "defeat");
        titleEl.textContent = victory ? "VICTORIA" : "DERROTA";
        if (subEl) subEl.textContent = victory ? "¡Los aliados han prevalecido!" : "Los orcos han arrasado con todo...";
    }

    loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Fondo de arena/piedra estilo medieval
        this.drawArenaBackground();

        // Arbustos sin unidad dentro (se dibujan debajo)
        const bushRadius = 28;
        this.bushes.forEach(b => {
            const hasUnitInside = this.units.some(u => u.hp > 0 && Math.hypot(u.x - b.x, u.y - b.y) < bushRadius);
            if (!hasUnitInside) this.drawBush(b.x, b.y);
        });
        // Dibujar obstáculos (rocas)
        this.obstacles.forEach(o => {
            this.drawRock(o.x, o.y, o.rockIndex);
        });

        this.units.forEach(u => u.update(this.units, this.obstacles, this.bushes));
        this.resolveUnitCollisions();
        this.projectiles.forEach(p => p.update());
        this.units = this.units.filter(u => u.hp > 0);
        this.projectiles = this.projectiles.filter(p => p.active);

        // Comprobar victoria/derrota
        const alliesAlive = this.units.filter(u => u.team === 1).length;
        const orcsAlive = this.units.filter(u => u.team === 0).length;
        if (alliesAlive === 0 && !this.gameOver) {
            this.gameOver = true;
            this.winner = "orcs";
            this.showGameOver(false);
        } else if (orcsAlive === 0 && !this.gameOver) {
            this.gameOver = true;
            this.winner = "allies";
            this.showGameOver(true);
        }

        this.units.forEach(u => u.draw());
        this.projectiles.forEach(p => p.draw());
        this.updateStats();
        // Arbustos con unidad dentro (encima del personaje, se ve debajo del arbusto)
        this.bushes.forEach(b => {
            const hasUnitInside = this.units.some(u => u.hp > 0 && Math.hypot(u.x - b.x, u.y - b.y) < bushRadius);
            if (hasUnitInside) this.drawBush(b.x, b.y);
        });

        if (!this.gameOver) requestAnimationFrame(() => this.loop());
    }
}

// Iniciar juego automáticamente al cargar la página del combate
if (document.getElementById("gameCanvas")) {
    (async () => {
        const game = new Game();
        await game.loadImages();
        game.loop();
    })();
}