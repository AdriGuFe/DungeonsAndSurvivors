/**
 * DUNGEONS AND SURVIVORS - Lógica del juego (combate)
 * ===================================================
 * Estructura del archivo:
 *   1. Canvas y constantes globales (arena, márgenes)
 *   2. AudioManager: música y efectos de sonido
 *   3. Sprites: carga de imágenes y animaciones (unidades, obstáculos, decoración)
 *   4. resize(): ajuste responsive del canvas manteniendo proporción
 *   5. Projectile: flechas y proyectiles (movimiento y dibujo)
 *   6. Unit: personajes (IA, movimiento, ataque, curación, dibujo)
 *   7. Game: partida (init, spawn, colisiones, bucle principal, game over)
 *   8. Inicialización: carga, estadísticas, loop
 * No modifica el DOM excepto canvas y overlays (loading, game over, stats).
 */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

// ---------------------------------------------------------------------------
// CONSTANTES DE ARENA Y MARGENES (simetria y proporciones al redimensionar)
// ---------------------------------------------------------------------------
const ARENA = { width: 1400, height: 900, x: 0, y: 0 };
const ARENA_ASPECT = ARENA.width / ARENA.height;
const MARGIN_SPAWN_X = 150;       // Distancia al borde para spawn de orcos y aliados
const MARGIN_OBSTACLE_X = 150;
const MARGIN_OBSTACLE_Y = 120;    // Zona donde se colocan rocas y árboles
const MARGIN_BUSH_X = 120;
const MARGIN_BUSH_Y = 100;        // Zona donde se colocan arbustos
const UNIT_PAD_Y = 32;            // Margen vertical (barra de vida + sprite)
const UNIT_PAD_X_MIN = 35;        // Margen horizontal mínimo para unidades

// ---------------------------------------------------------------------------
// AUDIO: musica de fondo y efectos de sonido (persistencia mute en localStorage)
// ---------------------------------------------------------------------------
const AUDIO_BASE = "audio/";
const AudioManager = {
    music: { menu: null, battle: null, victory: null },
    sfx: { swordImpact: null, shieldImpact: null, knifeImpact: null, arrowImpact: null, heal: null, orcImpact: null },
    musicMuted: (typeof localStorage !== "undefined" && localStorage.getItem("musicMuted") === "1"),
    sfxMuted: (typeof localStorage !== "undefined" && localStorage.getItem("sfxMuted") === "1"),
    currentTrack: null,
    load: function () {
        const base = AUDIO_BASE;
        this.music.menu = new Audio(base + "music/Shop.mp3");
        this.music.battle = new Audio(base + "music/Battle.mp3");
        this.music.victory = new Audio(base + "music/Victory.mp3");
        this.sfx.swordImpact = new Audio(base + "sounds/SwordImpact.mp3");
        this.sfx.shieldImpact = new Audio(base + "sounds/ShieldImpact.mp3");
        this.sfx.knifeImpact = new Audio(base + "sounds/KnifeImpact.mp3");
        this.sfx.arrowImpact = new Audio(base + "sounds/ArrowImpact.mp3");
        this.sfx.heal = new Audio(base + "sounds/Heal.mp3");
        this.sfx.orcImpact = new Audio(base + "sounds/OrcImpact.mp3");
        this.music.menu.loop = true;
        this.music.battle.loop = true;
    },
    playMusic: function (track) {
        if (this.musicMuted) return;
        if (this.currentTrack && this.currentTrack !== track) {
            const prev = this.music[this.currentTrack];
            if (prev) { prev.pause(); prev.currentTime = 0; }
        }
        const a = this.music[track];
        if (a) {
            const targetVol = (track === "battle") ? 0.4 : (track === "menu") ? 0.2 : (track === "victory") ? 0.3 : 0.5;
            a.currentTime = (track === "battle") ? 62 : (track === "menu") ? 12.75 : 0;

            if (track === "menu") {
                a.volume = 0;
                a.play().catch(() => { });
                let fade = setInterval(() => {
                    if (a.volume < targetVol) {
                        a.volume = Math.min(targetVol, a.volume + 0.05);
                    } else {
                        clearInterval(fade);
                    }
                }, 120);
            } else {
                a.volume = targetVol;
                a.play().catch(() => { });
            }
            this.currentTrack = track;
        }
    },
    stopMusic: function () {
        Object.values(this.music).forEach(a => { if (a) { a.pause(); a.currentTime = 0; } });
        this.currentTrack = null;
    },
    playSFX: function (name) {
        if (this.sfxMuted) return;
        const a = this.sfx[name];
        if (a) {
            const clone = a.cloneNode();
            clone.currentTime = 0;
            clone.volume = (name === "orcImpact") ? 0.05 : 0.14;
            clone.play().catch(() => { });
        }
    },
    setMusicMuted: function (v) { this.musicMuted = v; if (v) this.stopMusic(); },
    setSFXMuted: function (v) { this.sfxMuted = v; }
};

// ---------------------------------------------------------------------------
// SPRITES: carga de imágenes (fondos, bordes, unidades, obstáculos, decoración)
// ---------------------------------------------------------------------------
const ASSETS_BASE = "assets/";
const UNITS_BASE = ASSETS_BASE + "Units/";
const ENEMIES_BASE = ASSETS_BASE + "Enemies/";
const Sprites = {
    background: null,
    border: null,
    corner: null,
    // Animaciones por personaje: { idle: [frames], run: [frames], attack: [frames], etc. }
    animations: {
        orc: {}, warrior: {}, rogue: {}, archer: {}, priest: {}
    },
    arrow: null,
    rocks: [],
    trees: [],
    bushes: [],
    coin: [],
    
    // Divide un sprite sheet en frames (asume frames de 32x32px por defecto)
    splitSpriteSheet: function (img, frameWidth = 32, frameHeight = 32) {
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

    load: function () {
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
        // Border y Corner (Terrain)
        const borderImg = new Image();
        borderImg.src = ASSETS_BASE + "Terrain/Border/Border.png";
        Sprites.border = borderImg;
        imagePromises.push(new Promise((resolve) => {
            borderImg.onload = resolve;
            borderImg.onerror = silentFail(resolve);
        }));
        const cornerImg = new Image();
        cornerImg.src = ASSETS_BASE + "Terrain/Corner/Corner.png";
        Sprites.corner = cornerImg;
        imagePromises.push(new Promise((resolve) => {
            cornerImg.onload = resolve;
            cornerImg.onerror = silentFail(resolve);
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
        // ——— Priest: Idle (6), Run (4), Heal (10), Effect (assets/Units/Priest/Effect/ — se superpone al aliado curado)
        const priestBase = UNITS_BASE + "Priest/";
        Sprites.animations.priest = {
            idle: loadFrames(priestBase, "Idle", 6, "Idle"),
            run: loadFrames(priestBase, "Run", 4, "Run"),
            heal: loadFrames(priestBase, "Heal", 10, "Heal"),
            effect: loadFrames(priestBase, "Effect", 10, "Effect")
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
        // Arboles (8 frames de animacion)
        for (let i = 1; i <= 8; i++) {
            const img = new Image();
            img.src = ASSETS_BASE + `Terrain/Decorations/Tree/Tree${i}.png`;
            Sprites.trees.push(img);
            imagePromises.push(new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = silentFail(resolve);
            }));
        }

        // Arbustos (8 frames de animacion, ralentizan al atravesar)
        for (let i = 1; i <= 8; i++) {
            const img = new Image();
            img.src = ASSETS_BASE + "Terrain/Decorations/Bush/Bush" + i + ".png";
            Sprites.bushes.push(img);
            imagePromises.push(new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = silentFail(resolve);
            }));
        }

        // Monedas (9 frames de animacion)
        for (let i = 1; i <= 9; i++) {
            const img = new Image();
            img.src = ASSETS_BASE + "Coin/Coin" + i + ".png";
            Sprites.coin.push(img);
            imagePromises.push(new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = silentFail(resolve);
            }));
        }
        
        return Promise.all(imagePromises);
    },

    // Dibuja un frame de animación de un personaje (solo para priest con frames individuales)
    drawAnimation: function (role, animationName, frameIndex, x, y, size, rotation = 0) {
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
        ctx.drawImage(frame, -size / 2, -size / 2, size, size);
        ctx.restore();
        return true;
    },

    // Método legacy para compatibilidad (usa idle por defecto)
    draw: function (role, x, y, size, rotation = 0) {
        return Sprites.drawAnimation(role, "idle", 0, x, y, size, rotation);
    }
};

// ---------------------------------------------------------------------------
// REDIMENSIONADO: mantiene proporción 1400:900 y tamaño mínimo jugable
// ---------------------------------------------------------------------------
function resize() {
    if (!canvas) return;
    // Responsive: más espacio en pantallas pequeñas, proporción 1400:900
    const isNarrow = window.innerWidth < 600;
    const padW = isNarrow ? 0.98 : 0.94;
    const padH = isNarrow ? 0.96 : 0.90;
    const maxW = Math.min(window.innerWidth * padW, 1400);
    const maxH = Math.min(window.innerHeight * padH, 900);
    let w = maxW;
    let h = w / ARENA_ASPECT;
    if (h > maxH) {
        h = maxH;
        w = h * ARENA_ASPECT;
    }
    const minW = Math.min(300, window.innerWidth * 0.9);
    const minH = minW / ARENA_ASPECT;
    w = Math.max(minW, Math.floor(w));
    h = Math.max(minH, Math.floor(h));
    canvas.width = w;
    canvas.height = h;
    ARENA.width = canvas.width;
    ARENA.height = canvas.height;
    ARENA.x = 0;
    ARENA.y = 0;
}
window.addEventListener('resize', resize);
resize();

// Iconos para la cinta de estadísticas (emojis por rol)
const ICONS = { ORC: "👹", WARRIOR: "🛡️", ROGUE: "🗡️", ARCHER: "🏹", PRIEST: "✨", ROCK: "🪨" };

// ---------------------------------------------------------------------------
// PROYECTIL: flechas del arquero (trayectoria parabólica) y otros proyectiles
// ---------------------------------------------------------------------------
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
            // Homing: el destino siempre es la posición actual del enemigo
            this.endX = this.target.x;
            this.endY = this.target.y;

            // Actualizar progreso
            this.progress += (this.speed / this.totalDist) * 1.3; // Un poco más rápido
            const t = Math.min(1, this.progress);

            // Calcular posición ACTUALIZADA antes de cualquier chequeo
            const dx = this.endX - this.startX;
            const dy = this.endY - this.startY;
            this.x = this.startX + dx * t;
            this.y = this.startY + dy * t - this.arcHeight * 4 * t * (1 - t);

            // Si llegamos al final, impacto garantizado
            if (this.progress >= 1) {
                this.target.receiveDamage(this.damage);
                if (typeof AudioManager !== "undefined") AudioManager.playSFX("arrowImpact");
                this.active = false;
            }
        } else {
            // Lógica para otros proyectiles (si existieran)
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 25) {
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

// ---------------------------------------------------------------------------
// UNIDAD: personaje (aliado o orco). IA (objetivo, movimiento, ataque), animación, dibujo
// ---------------------------------------------------------------------------
class Unit {
    constructor(x, y, role, team, game) {
        this.game = game;
        this.x = x; this.y = y;
        this.role = role; this.team = team;
        this.vx = 0; this.vy = 0;
        this.maxHp = { "WARRIOR": 300, "ROGUE": 140, "ARCHER": 120, "PRIEST": 120, "ORC": 90 }[role] || 100;
        this.hp = this.maxHp;
        this.size = (role === "ORC" ? 56 : (role === "WARRIOR" ? 54 : 50));
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
        this.facingRight = team === 0; // Aliados izquierda, Orcos derecha
    }

    // —— Constantes de IA (distancias y márgenes; no cambian comportamiento) ——
    static get MELEE_MARGIN() { return 8; }
    static get COMBAT_RANGE_EXTRA() { return 25; }
    static get KITE_DISTANCE() { return 220; }
    static get RANGED_ATTACK_RANGE() { return 450; }
    static get HEAL_RANGE() { return 450; }
    static get FRAME_MS() { return 16; }

    receiveDamage(amount) {
        // Guerrero: bloquea cuando es atacado (reduce daño); no puede bloquear mientras ataca
        if (this.role === "WARRIOR" && amount > 0 && this.attackAnimTime <= 0) {
            this.blockAnimTime = 300; // Animación de guard al ser golpeado
            amount *= 0.4; // Bloqueo: solo recibe 40% del daño (60% reducción)
            if (typeof AudioManager !== "undefined") AudioManager.playSFX("shieldImpact");
        }
        this.hp -= amount;
        if (this.hp > this.maxHp) this.hp = this.maxHp;
        if (amount < 0) this.shieldPulse = 1.0; // Efecto de cura
    }

    /** Decide el objetivo de movimiento/ataque según el rol (enemigo o aliado cercano al frente para priest). */
    getMovementTarget(units, enemyTeam) {
        if (this.role === "PRIEST") return this.game.findAllyNearestToEnemy(this);
        return this.game.findNearest(this, enemyTeam);
    }

    /** Velocidad de movimiento por rol (priest/archer más lentos, melee más rápido). */
    getMoveSpeed() {
        if (this.role === "PRIEST") return 0.2;
        if (this.role === "ARCHER") return 0.18;
        return this.isRanged ? 0.11 : 0.3;
    }

    /** Decrementa timers de ataque y bloqueo; resetea estado del arquero al terminar ataque. */
    tickAttackAndBlockTimers() {
        if (this.attackAnimTime > 0) {
            this.attackAnimTime -= Unit.FRAME_MS;
            if (this.attackAnimTime <= 0) {
                this.attackAnimTime = 0;
                this.offX = 0;
                this.offY = 0;
                this.rotation = 0;
                if (this.role === "ARCHER") {
                    // Disparo de seguridad: si el timer expiró antes de alcanzar el frame 6
                    if (!this.arrowLaunched && this.attackTarget && this.attackTarget.hp > 0) {
                        this.game.projectiles.push(new Projectile(this.x, this.y, this.attackTarget, 25, "#8b7355", this.role));
                        if (typeof AudioManager !== "undefined") AudioManager.playSFX("arrowImpact");
                    }
                    this.attackTarget = null;
                    this.arrowLaunched = false;
                }
            }
        }
        if (this.blockAnimTime > 0) {
            this.blockAnimTime -= Unit.FRAME_MS;
            if (this.blockAnimTime <= 0) {
                this.blockAnimTime = 0;
                this.shake = 0;
            }
        }
    }

    /** Calcula estado de combate y rangos (distancia al objetivo, melee, kiting, si puede atacar). */
    computeAIState(units, target, nearestOrc, moveSpeed) {
        const dx = target ? target.x - this.x : 0;
        const dy = target ? target.y - this.y : 0;
        const dist = target ? Math.hypot(dx, dy) : Infinity;
        const isMoving = Math.abs(this.vx) > 0.01 || Math.abs(this.vy) > 0.01;
        const meleeReach = target && !this.isRanged ? (this.size + target.size) / 2 + 6 : 0;
        const idealDist = this.isRanged ? 300 : meleeReach;
        const inMeleeRange = !this.isRanged && target && target.hp > 0 && dist <= meleeReach + Unit.MELEE_MARGIN;
        const distToNearestOrc = nearestOrc ? Math.hypot(nearestOrc.x - this.x, nearestOrc.y - this.y) : Infinity;
        const isKiting = this.isRanged && this.team === 1 && distToNearestOrc < Unit.KITE_DISTANCE;
        const combatDist = this.isRanged ? idealDist + Unit.COMBAT_RANGE_EXTRA : meleeReach + Unit.MELEE_MARGIN;
        const inCombat = target && target.hp > 0 && target.team !== this.team && dist <= combatDist && !isKiting;
        const isBeingAttacked = this.role === "WARRIOR" && units.some(u =>
            u.team !== this.team && u.hp > 0 && u.attackAnimTime > 0 && this.game.findNearest(u, this.team) === this
        );
        const warriorBlocking = this.role === "WARRIOR" && (isBeingAttacked || this.blockAnimTime > 0);
        const canHit = target && target.hp > 0 && target.team !== this.team &&
            (Date.now() - this.lastAttack > this.attackCooldown) && !warriorBlocking;
        const meleeCanHit = inMeleeRange; // Se quita restricción de isMoving para que Boids no rompa los ataques
        const shouldPerformAttack = canHit && (this.isRanged ? dist < Unit.RANGED_ATTACK_RANGE : meleeCanHit);
        return {
            target, dx, dy, dist, isMoving, idealDist, inMeleeRange, distToNearestOrc, nearestOrc,
            isKiting, combatDist, inCombat, isBeingAttacked, moveSpeed, shouldPerformAttack
        };
    }

    /** Aplica velocidad según estado: ataque (quieto), kiting, acercarse al objetivo o priest curando. */
    applyAIMovement(state) {
        if (this.attackAnimTime > 0) {
            this.vx = 0;
            this.vy = 0;
            return;
        }
        if (state.isKiting && state.nearestOrc) {
            const kiteFactor = (this.role === "PRIEST" || this.role === "ARCHER") ? 1 : 3;
            const d = state.distToNearestOrc;
            this.vx -= (state.nearestOrc.x - this.x) / d * state.moveSpeed * kiteFactor;
            this.vy -= (state.nearestOrc.y - this.y) / d * state.moveSpeed * kiteFactor;
            return;
        }
        if (state.target) {
            const priestHealing = this.role === "PRIEST" && this.healingTarget;
            if (priestHealing) {
                this.vx = 0;
                this.vy = 0;
            } else if (state.dist > state.idealDist && state.dist > 0) {
                this.vx += (state.dx / state.dist) * state.moveSpeed;
                this.vy += (state.dy / state.dist) * state.moveSpeed;
            }
        }
    }

    /** Intenta atacar si la IA lo permite; actualiza lastAttack y anim. */
    tryAIAttack(state) {
        if (!state.shouldPerformAttack || !state.target) return;
        this.performAttack(state.target);
        this.lastAttack = Date.now();
        this.animFrame = 0;
        this.animTime = 0;
    }

    /** Fuerza velocidad a cero en combate o durante ataque; priest curando también quieto. */
    applyCombatStop(state) {
        if (state.inCombat || this.attackAnimTime > 0) {
            this.vx = 0;
            this.vy = 0;
        }
        if (this.role === "PRIEST" && this.healingTarget) {
            this.vx = 0;
            this.vy = 0;
        }
    }

    /** Actualiza facingRight según enemigo o dirección de movimiento. */
    updateFacing(target) {
        if (target && target.team !== this.team) {
            this.facingRight = target.x > this.x;
        } else if (Math.abs(this.vx) > 0.02) {
            this.facingRight = this.vx > 0;
        }
    }

    /** Priest: avance de curación, elección de aliado herido, estado run/idle/heal. */
    updatePriestHealAndAnim(units, state) {
        if (this.healingTarget) {
            this.healProgress += Unit.FRAME_MS;
            if (this.healProgress >= this.healCastTime) {
                if (this.healingTarget.hp > 0 && this.healingTarget.hp < this.healingTarget.maxHp) {
                    this.healingTarget.receiveDamage(-40);
                }
                if (typeof AudioManager !== "undefined") AudioManager.playSFX("heal");
                this.lastHealTime = Date.now();
                this.healingTarget = null;
                this.healProgress = 0;
            }
            this.animState = "heal";
            return;
        }
        const hurtAlly = this.game.findHurtAlly(this);
        const distToHurt = hurtAlly ? Math.hypot(hurtAlly.x - this.x, hurtAlly.y - this.y) : Infinity;
        if (hurtAlly && distToHurt < Unit.HEAL_RANGE && !state.isMoving && (Date.now() - this.lastHealTime >= this.healCooldown)) {
            this.healingTarget = hurtAlly;
            this.healProgress = 0;
            this.vx = 0;
            this.vy = 0;
            this.animFrame = 0;
            this.animTime = 0;
            this.animState = "heal";
            return;
        }
        if (!this.healingTarget) {
            this.animState = (state.isMoving && !state.inCombat) ? "run" : "idle";
        }
    }

    /** Asigna animState para warrior, rogue, orc, archer según ataque/bloqueo/movimiento. */
    updateRoleAnimState(state) {
        const oldState = this.animState;
        if (this.role === "WARRIOR") {
            if (this.attackAnimTime > 0) this.animState = "attack";
            else if (this.blockAnimTime > 0 || state.isBeingAttacked) this.animState = "guard";
            else this.animState = (state.isMoving && !state.inCombat) ? "run" : "idle";
        }
        else if (this.role === "ROGUE" || this.role === "ORC") {
            this.animState = this.attackAnimTime > 0 ? "attack" : (state.isMoving && !state.inCombat ? "run" : "idle");
        }
        else if (this.role === "ARCHER") {
            this.animState = this.attackAnimTime > 0 ? "shoot" : (state.isMoving && !state.inCombat ? "run" : "idle");
        }

        if (oldState !== this.animState) {
            this.animFrame = 0;
            this.animTime = 0;
        }
    }

    /** Avanza frames de animación y lanza flecha del arquero en el frame correcto. */
    tickAnimFrames() {
        const roleKey = this.role.toLowerCase();
        if (!Sprites.animations[roleKey] || !Sprites.animations[roleKey][this.animState]) return;
        this.animTime += Unit.FRAME_MS;
        const speed = this.animState === "heal" ? 220 : (this.animState === "shoot" ? 300 : (this.animState === "attack" ? 110 : 280));
        if (this.animTime < speed) return;
        this.animTime = 0;
        const anims = Sprites.animations[roleKey];
        if (!anims[this.animState]) return;
        const len = anims[this.animState].length;
        if (this.role === "ARCHER" && this.animState === "shoot") {
            if (this.animFrame < len - 1) {
                this.animFrame++;
                if (this.animFrame === 6 && !this.arrowLaunched && this.attackTarget && this.attackTarget.hp > 0) {
                    this.game.projectiles.push(new Projectile(this.x, this.y, this.attackTarget, 25, "#8b7355", this.role));
                    this.arrowLaunched = true;
                }
            }
        } else {
            this.animFrame = (this.animFrame + 1) % len;
        }
    }

    /** Ralentiza al atravesar arbustos. */
    applyBushSlowdown(bushes) {
        const bushRadius = 28;
        const inBush = bushes.some(b => Math.hypot(this.x - b.x, this.y - b.y) < bushRadius);
        if (inBush) {
            this.vx *= 0.62;
            this.vy *= 0.62;
        }
    }

    /** Empuja suavemente lejos de obstáculos cuando no está en combate ni curando. */
    applyObstacleAvoidance(obstacles, state) {
        if (state.inCombat || (this.role === "PRIEST" && this.healingTarget) || this.attackAnimTime > 0) return;
        const obstacleRadius = 30;
        const minObstacleDist = this.size / 2 + obstacleRadius + 15; // increased margin
        obstacles.forEach(o => {
            const dx = this.x - o.x;
            const dy = this.y - o.y;
            const d = Math.hypot(dx, dy);
            if (d < minObstacleDist && d > 0) {
                const force = (minObstacleDist - d) / minObstacleDist * 1.2; // stronger force
                this.vx += (dx / d) * force;
                this.vy += (dy / d) * force;
            }
        });
    }

    /** Aplica "Separation" (Boids) para evitar que las unidades aliadas se agrupen en un solo punto. */
    applyFlocking(units) {
        if (this.attackAnimTime > 0 || this.hp <= 0) return;
        const separationRadius = this.size * 1.2;
        let forceX = 0, forceY = 0;
        let count = 0;

        for (let i = 0; i < units.length; i++) {
            const other = units[i];
            if (other === this || other.hp <= 0 || other.team !== this.team) continue;

            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 0 && dist < separationRadius) {
                const repulse = (separationRadius - dist) / separationRadius;
                forceX += (dx / dist) * repulse;
                forceY += (dy / dist) * repulse;
                count++;
            }
        }

        if (count > 0) {
            const flockingStrength = 0.5; // Ajuste empírico para suavidad
            this.vx += (forceX / count) * flockingStrength;
            this.vy += (forceY / count) * flockingStrength;
        }
    }

    /** Aplica velocidad, fricción y limita posición a la arena (márgenes simétricos). */
    applyPhysicsAndClamp() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.85;
        this.vy *= 0.85;
        if (this.shake > 0) this.shake *= 0.85;
        const padX = Math.max(this.collisionRadius, UNIT_PAD_X_MIN);
        const padY = this.size / 2 + UNIT_PAD_Y;
        this.x = Math.max(ARENA.x + padX, Math.min(ARENA.x + ARENA.width - padX, this.x));
        this.y = Math.max(ARENA.y + padY, Math.min(ARENA.y + ARENA.height - padY, this.y));
    }

    update(units, obstacles, bushes = []) {
        const enemyTeam = this.team === 0 ? 1 : 0;
        // Bug fix: orcos no necesitan calcular nearestOrc (solo aliados hacen kiting)
        const nearestOrc = this.team === 1 ? this.game.findNearest(this, 0) : null;
        const target = this.getMovementTarget(units, enemyTeam);
        const moveSpeed = this.getMoveSpeed();
        this.tickAttackAndBlockTimers();
        const state = this.computeAIState(units, target, nearestOrc, moveSpeed);

        this.applyAIMovement(state);
        this.tryAIAttack(state);
        this.applyCombatStop(state);
        this.updateFacing(target);

        if (this.role === "PRIEST") {
            this.updatePriestHealAndAnim(units, state);
        } else {
            this.updateRoleAnimState(state);
        }
        this.tickAnimFrames();

        this.applyBushSlowdown(bushes);
        this.applyFlocking(units);
        this.applyObstacleAvoidance(obstacles, state);
        this.applyPhysicsAndClamp();
    }

    performAttack(target) {
        if (!target || target.hp <= 0) return;
        if (!this.isRanged) {
            // Animación de ataque; no se puede interrumpir hasta que termine
            this.attackAnimTime = 280;
            target.receiveDamage(this.role === "ROGUE" ? 28 : 18);
            if (typeof AudioManager !== "undefined") {
                if (this.role === "ORC") AudioManager.playSFX("orcImpact");
                else AudioManager.playSFX(this.role === "ROGUE" ? "knifeImpact" : "swordImpact");
            }
        } else if (this.role === "ARCHER") {
            this.attackTarget = target;
            this.arrowLaunched = false;
            this.animFrame = 0;
            this.animTime = 0;
            this.attackAnimTime = 8 * 300;
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
        const barY = this.y - this.size / 2 - 24;

        ctx.fillStyle = "#000000";
        ctx.fillRect(this.x - bw / 2 - 2, barY - 2, bw + 4, barHeight + 4);

        const hpPercent = this.hp / this.maxHp;
        ctx.fillStyle = hpPercent > 0.5 ? "#00ff00" : (hpPercent > 0.25 ? "#ffff00" : "#ff0000");
        ctx.fillRect(this.x - bw / 2, barY, hpPercent * bw, barHeight);

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x - bw / 2 - 2, barY - 2, bw + 4, barHeight + 4);

        ctx.restore();

        // Efecto de curación superpuesto (assets/Units/Priest/Effect/) encima del aliado que está siendo curado
        if (this.team === 1 && this.game.units.some(u => u.role === "PRIEST" && u.healingTarget === this)) {
            const effectFrames = Sprites.animations.priest?.effect;
            if (effectFrames && effectFrames.length > 0) {
                const effectFrame = Math.floor(Date.now() / 100) % effectFrames.length;
                ctx.save();
                ctx.translate(this.x, this.y);
                Sprites.drawAnimation("priest", "effect", effectFrame, 0, 0, this.size * 1.2, 0);
                ctx.restore();
            }
        }
    }
}

// ---------------------------------------------------------------------------
// PARTIDA: arena, obstáculos, spawn de equipos, colisiones, bucle y game over
// ---------------------------------------------------------------------------
class Game {
    constructor() {
        this.units = []; this.projectiles = []; this.obstacles = []; this.bushes = [];
        this.imagesLoaded = false;
        this.gameOver = false;
        this.winner = null;

        this.isShopPage = window.location.pathname.includes('shop.html');

        // Valores por defecto
        this.level = 1;
        this.coins = 100;
        this.boughtQueue = [];
        this.mouseX = 0;
        this.mouseY = 0;
        this.floatingTexts = [];

        this.loadStateFromStorage();
        this.state = (this.boughtQueue.length > 0) ? "PLACEMENT" : "COMBAT";
        this.selectedRoleToBuy = this.boughtQueue.length > 0 ? this.boughtQueue[0] : null;

        this.init();
        if (this.isShopPage) this.setupShopEvents();
    }

    saveStateToStorage() {
        const stateToSave = {
            level: this.level,
            coins: this.coins,
            roster: this.units.filter(u => u.team === 1 && u.hp > 0).map(u => ({
                role: u.role, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp
            }))
        };
        localStorage.setItem('ds_state', JSON.stringify(stateToSave));
    }

    loadStateFromStorage() {
        const saved = localStorage.getItem('ds_state');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.level = data.level || 1;
                this.coins = data.coins || 100;
                this.boughtQueue = data.queue || [];

                // Cargar roster aliado
                if (data.roster && data.roster.length > 0) {
                    data.roster.forEach(uData => {
                        const u = new Unit(uData.x, uData.y, uData.role, 1, this);
                        u.maxHp = uData.maxHp || u.maxHp;
                        u.hp = uData.hp || u.maxHp;
                        this.units.push(u);
                    });
                }
            } catch (e) {
                console.error("Error loading state", e);
            }
        }
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
        const minDistRock = 140;   // distancia mínima entre piedras
        const obsW = ARENA.width - 2 * MARGIN_OBSTACLE_X;
        const obsH = ARENA.height - 2 * MARGIN_OBSTACLE_Y;
        // Piedras (rocas)
        for (let i = 0; i < 18; i++) {
            let attempts = 0;
            while (attempts < 60) {
                const ox = ARENA.x + MARGIN_OBSTACLE_X + Math.random() * obsW;
                const oy = ARENA.y + MARGIN_OBSTACLE_Y + Math.random() * obsH;
                const tooClose = this.obstacles.some(o => Math.hypot(ox - o.x, oy - o.y) < minDistRock);
                if (!tooClose) {
                    this.obstacles.push({ x: ox, y: oy, type: "rock", rockIndex: i % 4, flip: Math.random() < 0.4 });
                    break;
                }
                attempts++;
            }
        }
        // Arboles: también mantienen distancia de piedras para no solaparse
        const minDistTree = 140;   // distancia mínima entre árboles y respecto a piedras
        for (let i = 0; i < 12; i++) {
            let attempts = 0;
            while (attempts < 60) {
                const ox = ARENA.x + MARGIN_OBSTACLE_X + Math.random() * obsW;
                const oy = ARENA.y + MARGIN_OBSTACLE_Y + Math.random() * obsH;
                const tooClose = this.obstacles.some(o => Math.hypot(ox - o.x, oy - o.y) < minDistTree);
                if (!tooClose) {
                    this.obstacles.push({ x: ox, y: oy, type: "tree", treeIndex: i % 8, flip: Math.random() < 0.4 });
                    break;
                }
                attempts++;
            }
        }
        // Arbustos (decoración, ralentizan al atravesar) — sin colisionar entre sí ni con piedras
        const minDistBushRock = 55;
        const minDistBushBush = 45;
        const bushW = ARENA.width - 2 * MARGIN_BUSH_X;
        const bushH = ARENA.height - 2 * MARGIN_BUSH_Y;
        for (let i = 0; i < 35; i++) {
            let attempts = 0;
            while (attempts < 80) {
                const bx = ARENA.x + MARGIN_BUSH_X + Math.random() * bushW;
                const by = ARENA.y + MARGIN_BUSH_Y + Math.random() * bushH;
                const tooCloseToRock = this.obstacles.some(o => Math.hypot(bx - o.x, by - o.y) < minDistBushRock);
                const tooCloseToBush = this.bushes.some(b => Math.hypot(bx - b.x, by - b.y) < minDistBushBush);
                if (!tooCloseToRock && !tooCloseToBush) {
                    this.bushes.push({ x: bx, y: by, bushIndex: i % 8, flip: Math.random() < 0.4 });
                    break;
                }
                attempts++;
            }
        }

        // Conservar HP real de supervivientes (no curar entre oleadas)
        this.units = this.units.filter(u => u.team === 1 && u.hp > 0);

        this.spawnEnemies();

        if (this.state === "PLACEMENT") {
            this.setupPlacementUI();
        } else {
            this.startCombat();
        }
    }

    setupPlacementUI() {
        const ui = document.getElementById("placementUI");
        if (ui) ui.style.display = "block";
        this.updatePlacementUI();

        canvas.addEventListener("mousemove", (e) => {
            if (this.state !== "PLACEMENT") return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            this.mouseX = (e.clientX - rect.left) * scaleX;
            this.mouseY = (e.clientY - rect.top) * scaleY;
        });

        canvas.addEventListener("click", (e) => {
            if (this.state !== "PLACEMENT") return;
            // Verificar mitad derecha
            if (this.mouseX > ARENA.x + ARENA.width / 2) {
                const role = this.boughtQueue.shift();
                this.units.push(new Unit(this.mouseX, this.mouseY, role, 1, this));
                if (typeof AudioManager !== "undefined") AudioManager.playSFX("swordImpact");

                if (this.boughtQueue.length > 0) {
                    this.updatePlacementUI();
                } else {
                    this.startCombat();
                }
            } else {
                if (typeof AudioManager !== "undefined") AudioManager.playSFX("shieldImpact"); // sonido de colocación inválida
            }
        });
    }

    updatePlacementUI() {
        const uiNext = document.getElementById("nextToPlace");
        const uiIcon = document.getElementById("nextToPlaceIcon");
        const uiCount = document.getElementById("queueCount");
        const roleNames = { "WARRIOR": "Guerrero", "ROGUE": "Picaro", "ARCHER": "Arquero", "PRIEST": "Sacerdote" };
        const roleIcons = {
            "WARRIOR": "assets/UI Elements/UI Elements/Human Avatars/Warrior.png",
            "ROGUE": "assets/UI Elements/UI Elements/Human Avatars/Rogue.png",
            "ARCHER": "assets/UI Elements/UI Elements/Human Avatars/Archer.png",
            "PRIEST": "assets/UI Elements/UI Elements/Human Avatars/Priest.png"
        };
        if (this.boughtQueue.length > 0) {
            if (uiNext) uiNext.textContent = roleNames[this.boughtQueue[0]];
            if (uiIcon) { uiIcon.src = roleIcons[this.boughtQueue[0]]; uiIcon.style.display = "inline-block"; }
        }
        if (uiCount) uiCount.textContent = this.boughtQueue.length;
        this.selectedRoleToBuy = this.boughtQueue.length > 0 ? this.boughtQueue[0] : null;
    }

    startCombat() {
        this.state = "COMBAT";
        this.selectedRoleToBuy = null;
        const ui = document.getElementById("placementUI");
        if (ui) ui.style.display = "none";

        // Save empty queue just to clear it
        this.saveStateToStorage();
    }

    spawnEnemies() {
        // Orcos base: crecimiento lineal suave hasta nivel 5
        let totalOrcs = 2 + Math.floor(this.level * 1.5);

        // A partir del nivel 6 el incremento se acelera cada nivel:
        //   nivel 6 → +2 respecto al anterior
        //   nivel 7 → +3 respecto al anterior
        //   nivel 8 → +4 … etc.
        // Fórmula compacta del bonus acumulado: k*(k+1)/2 - 1  donde k = level - 4
        if (this.level >= 6) {
            const k = this.level - 4;
            totalOrcs += Math.floor(k * (k + 1) / 2) - 1;
        }

        for (let i = 0; i < totalOrcs; i++) {
            this.units.push(new Unit(
                ARENA.x + MARGIN_SPAWN_X + Math.random() * 50,
                ARENA.y + 100 + Math.random() * (ARENA.height - 200),
                "ORC", 0, this
            ));
        }
    }

    drawGhostUnit() {
        if (this.state !== "PLACEMENT" || !this.selectedRoleToBuy) return;
        ctx.save();
        ctx.globalAlpha = 0.5;
        // Solo pintarlo verde si está en la zona válida (mitad derecha)
        const isValid = this.mouseX > ARENA.x + ARENA.width / 2;
        ctx.translate(this.mouseX, this.mouseY);

        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fillStyle = isValid ? "rgba(0, 255, 0, 0.4)" : "rgba(255, 0, 0, 0.4)";
        ctx.fill();

        const roleKey = this.selectedRoleToBuy.toLowerCase();
        // Bug fix: drawAnimation toma (role, anim, frame, x, y, size, rotation); 'true' era rotación errónea
        ctx.scale(-1, 1); // voltear horizontalmente para mirar a la izquierda
        Sprites.drawAnimation(roleKey, "idle", 0, 0, 0, 54, 0);
        ctx.restore();

        // Línea divisoria
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 2;
        ctx.setLineDash([15, 15]);
        ctx.beginPath();
        ctx.moveTo(ARENA.x + ARENA.width / 2, ARENA.y);
        ctx.lineTo(ARENA.x + ARENA.width / 2, ARENA.y + ARENA.height);
        ctx.stroke();
        ctx.restore();
    }

    /** Unidad del equipo dado más cercana a `me` (para targeting de ataque o movimiento). */
    findNearest(me, team) {
        const byDistance = (a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y);
        return this.units.filter(u => u.team === team && u.hp > 0).sort(byDistance)[0];
    }

    /** Aliado herido (hp < maxHp) con menos vida restante; usado por el priest para elegir a quién curar. */
    findHurtAlly(me) {
        return this.units
            .filter(u => u.team === me.team && u.hp > 0 && u.hp < u.maxHp)
            .sort((a, b) => a.hp - b.hp)[0];
    }

    /** Aliado más cercano a `me` (excluyendo a sí mismo); fallback cuando no hay enemigos. */
    findNearestAlly(me) {
        const byDistance = (a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y);
        return this.units.filter(u => u.team === me.team && u !== me && u.hp > 0).sort(byDistance)[0];
    }

    /** Aliado más cercano al enemigo más próximo; el priest usa esto para seguir al frente y curar. */
    findAllyNearestToEnemy(me) {
        const nearestEnemy = this.findNearest(me, 0);
        if (!nearestEnemy) return this.findNearestAlly(me);
        const byDistToEnemy = (a, b) =>
            Math.hypot(a.x - nearestEnemy.x, a.y - nearestEnemy.y) - Math.hypot(b.x - nearestEnemy.x, b.y - nearestEnemy.y);
        return this.units.filter(u => u.team === me.team && u !== me && u.hp > 0).sort(byDistToEnemy)[0];
    }

    /** Física: evita solapamiento entre unidades. Solo corrige posiciones (sin empuje). */
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

            // Mantener dentro del arena (márgenes simétricos, mismos que Unit.applyPhysicsAndClamp)
            units.forEach(u => {
                if (u.hp <= 0) return;
                const padX = Math.max(u.collisionRadius, UNIT_PAD_X_MIN);
                const padY = u.size / 2 + UNIT_PAD_Y;
                u.x = Math.max(ARENA.x + padX, Math.min(ARENA.x + ARENA.width - padX, u.x));
                u.y = Math.max(ARENA.y + padY, Math.min(ARENA.y + ARENA.height - padY, u.y));
            });

            if (!anyOverlap) break;
        }
    }

    /** Dibuja fondo (tiles o color), bordes y esquinas de la arena. */
    drawArenaBackground() {
        const border = Sprites.border;
        const corner = Sprites.corner;
        const bw = border && border.complete ? border.naturalWidth : 32;
        const bh = border && border.complete ? border.naturalHeight : 32;
        const cw = corner && corner.complete ? corner.naturalWidth : 32;
        const ch = corner && corner.complete ? corner.naturalHeight : 32;
        // Izq/der: el borde está rotado 90°, su anchura en X es bh. Arriba/abajo: altura del tile = bh.
        const edgeW = Math.max(cw, bh);
        const edgeH = Math.max(ch, bh);
        const innerX = ARENA.x + edgeW;
        const innerY = ARENA.y + edgeH;
        const innerW = ARENA.width - 2 * edgeW;
        const innerH = ARENA.height - 2 * edgeH;

        // 1) Fondo solo en el interior: recortar para que no se superponga a bordes ni deje huecos
        ctx.save();
        ctx.beginPath();
        ctx.rect(innerX, innerY, innerW, innerH);
        ctx.clip();
        if (Sprites.background && Sprites.background.complete && Sprites.background.naturalWidth > 0) {
            const img = Sprites.background;
            const tw = img.naturalWidth;
            const th = img.naturalHeight;
            for (let y = innerY; y < innerY + innerH; y += th) {
                for (let x = innerX; x < innerX + innerW; x += tw) {
                    ctx.drawImage(img, x, y, tw, th);
                }
            }
        } else {
            ctx.fillStyle = "#2d5a27";
            ctx.fillRect(innerX, innerY, innerW, innerH);
        }
        ctx.restore();

        // 2) Bordes: tiles entre esquinas; tamaño natural; si queda hueco al final, un tile parcial (sin invadir corners).
        const extraBorderH = 2;
        const extraBorderSide = 8;
        const bhTop = bh + extraBorderH;
        const bhSide = bh + extraBorderSide;
        if (border && border.complete && border.naturalWidth > 0) {
            const xMin = ARENA.x + cw;
            const xMax = ARENA.x + ARENA.width - cw;
            const yMin = ARENA.y + ch;
            const yMax = ARENA.y + ARENA.height - ch;
            // Arriba: tiles completos + tile parcial si hace falta
            for (let x = xMin; x < xMax; x += bw) {
                const w = Math.min(bw, xMax - x);
                const sw = (w / bw) * border.naturalWidth;
                ctx.drawImage(border, 0, 0, sw, border.naturalHeight, x, ARENA.y, w, bhTop);
            }
            // Abajo
            for (let x = xMin; x < xMax; x += bw) {
                const w = Math.min(bw, xMax - x);
                const sw = (w / bw) * border.naturalWidth;
                ctx.save();
                ctx.translate(x, ARENA.y + ARENA.height);
                ctx.scale(1, -1);
                ctx.drawImage(border, 0, 0, sw, border.naturalHeight, 0, 0, w, bhTop);
                ctx.restore();
            }
            // Izquierda: grosor un poco más ancho (bhSide) para que no se vea estrecho.
            for (let y = yMin; y < yMax; y += bw) {
                const segLen = Math.min(bw, yMax - y);
                const sw = (segLen / bw) * border.naturalWidth;
                ctx.save();
                ctx.translate(ARENA.x, y + segLen);
                ctx.rotate(-Math.PI / 2);
                ctx.drawImage(border, 0, 0, sw, border.naturalHeight, 0, 0, segLen, bhSide);
                ctx.restore();
            }
            // Derecha
            for (let y = yMin; y < yMax; y += bw) {
                const segLen = Math.min(bw, yMax - y);
                const sw = (segLen / bw) * border.naturalWidth;
                ctx.save();
                ctx.translate(ARENA.x + ARENA.width, y);
                ctx.rotate(Math.PI / 2);
                ctx.drawImage(border, 0, 0, sw, border.naturalHeight, 0, 0, segLen, bhSide);
                ctx.restore();
            }
        }

        // 3) Esquinas: solo en las cuatro esquinas del canvas (corner = esquina superior-izquierda).
        if (corner && corner.complete && corner.naturalWidth > 0) {
            ctx.drawImage(corner, ARENA.x, ARENA.y, cw, ch);
            ctx.save();
            ctx.translate(ARENA.x + ARENA.width, ARENA.y);
            ctx.scale(-1, 1);
            ctx.drawImage(corner, 0, 0, cw, ch);
            ctx.restore();
            ctx.save();
            ctx.translate(ARENA.x + ARENA.width, ARENA.y + ARENA.height);
            ctx.scale(-1, -1);
            ctx.drawImage(corner, 0, 0, cw, ch);
            ctx.restore();
            ctx.save();
            ctx.translate(ARENA.x, ARENA.y + ARENA.height);
            ctx.scale(1, -1);
            ctx.drawImage(corner, 0, 0, cw, ch);
            ctx.restore();
        }
    }

    /** Dibuja un arbusto (animado); si no hay sprite, círculo verde. */
    drawBush(x, y, bushIndex = 0, flip = false) {
        const bushes = Sprites.bushes;
        if (bushes.length > 0) {
            const frame = Math.floor(Date.now() / 120) % 8;
            const bush = bushes[(bushIndex + frame) % bushes.length];
            if (bush && bush.complete && bush.naturalWidth > 0) {
                ctx.save();
                ctx.translate(x, y);
                if (flip) ctx.scale(-1, 1);
                const size = 50;
                ctx.drawImage(bush, -size / 2, -size / 2, size, size);
                ctx.restore();
                return;
            }
        }
        ctx.save();
        ctx.translate(x, y);
        if (flip) ctx.scale(-1, 1);
        ctx.fillStyle = "#2d5a1a";
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /** Dibuja una roca (sprite o forma vectorial). */
    drawRock(x, y, rockIndex = 0, flip = false) {
        const rocks = Sprites.rocks;
        if (rocks.length > 0) {
            const rock = rocks[rockIndex % rocks.length];
            if (rock && rock.complete && rock.naturalWidth > 0) {
                ctx.save();
                ctx.translate(x, y);
                if (flip) ctx.scale(-1, 1);
                ctx.drawImage(rock, -30, -30, 60, 60);
                ctx.restore();
                return;
            }
        }

        // Fallback: dibujar con código
        ctx.save();
        ctx.translate(x, y);
        if (flip) ctx.scale(-1, 1);

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

    /** Dibuja un árbol (sprite animado o forma simple). */
    drawTree(x, y, treeIndex = 0, flip = false) {
        const trees = Sprites.trees;
        if (trees.length > 0) {
            const frame = Math.floor(Date.now() / 140) % 8;
            const tree = trees[(treeIndex + frame) % trees.length];
            if (tree && tree.complete && tree.naturalWidth > 0) {
                ctx.save();
                ctx.translate(x, y);
                if (flip) ctx.scale(-1, 1);
                ctx.drawImage(tree, -32, -88, 64, 88);
                ctx.restore();
                return;
            }
        }
        ctx.save();
        ctx.translate(x, y);
        if (flip) ctx.scale(-1, 1);
        ctx.fillStyle = "#2d5a1a";
        ctx.fillRect(-8, -28, 16, 56);
        ctx.fillStyle = "#1a3d10";
        ctx.beginPath();
        ctx.arc(0, -42, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /** Actualiza la cinta de estadisticas (conteo de aliados por rol y orcos vivos). */
    updateStats() {
        const statsAlliesEl = document.getElementById("statsAlliesRow");
        const statsEnemiesEl = document.getElementById("statsEnemiesRow");
        if (!statsAlliesEl || !statsEnemiesEl) return;
        const alive = this.units.filter(u => u.hp > 0);
        const AVATARS = "assets/UI Elements/UI Elements/Human Avatars/";
        const ICONS = "assets/UI Elements/UI Elements/Icons/";
        const allyRoles = [
            { role: "WARRIOR", icon: AVATARS + "Warrior.png", label: "Guerrero" },
            { role: "ROGUE", icon: AVATARS + "Rogue.png", label: "Picaro" },
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
        statsEnemiesEl.innerHTML = `<span class="stats-unit" title="Orco"><img src="${ENEMIES_BASE}Orc1/Idle/Idle1.png" alt="Orco"><span class="stats-num">${orcs}</span></span>`;
        
        const statsCoinsEl = document.getElementById("gameCoins");
        if (statsCoinsEl) {
            statsCoinsEl.textContent = this.coins;
        }
    }

    /** Muestra overlay de victoria o derrota y opcionalmente música de victoria. */
    showGameOver(victory) {
        const overlay = document.getElementById("gameOverOverlay");
        const titleEl = document.getElementById("gameOverTitle");
        const subEl = document.getElementById("gameOverSub");
        const replayEl = document.getElementById("gameOverReplayBtn");

        if (!overlay || !titleEl) return;
        overlay.className = "game-over-overlay visible " + (victory ? "victory" : "defeat");
        if (victory) {
            if (this.level >= 10) {
                titleEl.textContent = "Juego Completado";
                if (subEl) subEl.textContent = "Enhorabuena! Has completado el juego.";
            } else {
                titleEl.textContent = "VICTORIA";
                if (subEl) subEl.textContent = "Has despejado la oleada " + this.level;
            }

            if (replayEl) {
                if (this.level >= 10) {
                    replayEl.textContent = "Jugar de nuevo";
                    replayEl.href = "shop.html";
                    replayEl.onclick = () => { 
                        localStorage.removeItem('ds_state');
                        window.allowTransition = true; 
                    };
                } else {
                    replayEl.textContent = "Siguiente Ronda";
                    replayEl.href = "shop.html";
                    replayEl.onclick = () => { window.allowTransition = true; };
                }
            }
        } else {
            titleEl.textContent = "DERROTA";
            if (subEl) subEl.textContent = "El Mal ha arrasado con todo...";
            if (replayEl) {
                replayEl.textContent = "Volver a intentar";
                replayEl.href = "shop.html";
                replayEl.onclick = () => { window.allowTransition = true; };
            }
            // Borrar state en derrota para resetear
            localStorage.removeItem('ds_state');
        }

        if (victory && typeof AudioManager !== "undefined") {
            AudioManager.stopMusic();
            if (!AudioManager.musicMuted) AudioManager.playMusic("victory");
        }
    }

    /** Bucle principal: dibuja escena, actualiza unidades y proyectiles, comprueba fin de partida. */
    loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fondo de arena/piedra estilo medieval
        this.drawArenaBackground();

        // Arbustos sin unidad dentro (se dibujan debajo)
        const bushRadius = 28;
        this.bushes.forEach(b => {
            const hasUnitInside = this.units.some(u => u.hp > 0 && Math.hypot(u.x - b.x, u.y - b.y) < bushRadius);
            if (!hasUnitInside) this.drawBush(b.x, b.y, b.bushIndex || 0, b.flip);
        });

        if (this.state === "COMBAT") {
            this.units.forEach(u => u.update(this.units, this.obstacles, this.bushes));
            this.resolveUnitCollisions();
            this.projectiles.forEach(p => p.update());

            // Recompensas por matar orcos (cantidad aleatoria 20-25)
            let earnedCoins = 0;
            this.units.forEach(u => {
                if (u.hp <= 0 && u.team === 0 && !u.countedDead) {
                    const reward = Math.floor(Math.random() * 6) + 20; // 20, 21, 22, 23, 24 o 25
                    earnedCoins += reward;
                    u.countedDead = true;
                    // Texto flotante con la cantidad real obtenida
                    this.floatingTexts.push({ x: u.x, y: u.y - u.size, amount: reward, alpha: 1.0, floatY: 0 });
                }
            });
            if (earnedCoins > 0) {
                this.coins += earnedCoins;
            }

            this.units = this.units.filter(u => u.hp > 0);
            this.projectiles = this.projectiles.filter(p => p.active);

            // Comprobar victoria/derrota
            const alliesAlive = this.units.filter(u => u.team === 1).length;
            const orcsAlive = this.units.filter(u => u.team === 0).length;

            if (alliesAlive === 0 && !this.gameOver) {
                this.gameOver = true;
                this.state = "DEFEAT";
                this.showGameOver(false);
            } else if (orcsAlive === 0 && !this.gameOver) {
                this.gameOver = true;
                this.state = "VICTORY";
                if (this.level >= 10) {
                    // Para nivel final, cambiar texto del botón
                    const replayEl = document.getElementById("gameOverReplayBtn");
                    if (replayEl) {
                        replayEl.textContent = "Enhorabuena! Has completado el juego.";
                        replayEl.href = "index.html";
                        localStorage.removeItem('ds_state');
                    }
                } else {
                    // Guardamos la progression con el HP real (sin curar)
                    this.level++;
                    this.saveStateToStorage();
                }
                this.showGameOver(true);
            }
        }

        this.units.forEach(u => {
            if (this.state === "PLACEMENT") {
                u.tickAnimFrames();
            }
            u.draw();
        });
        // Obstáculos (rocas y árboles) por delante de los personajes
        this.obstacles.forEach(o => {
            if (o.type === "tree") this.drawTree(o.x, o.y, o.treeIndex, o.flip);
            else this.drawRock(o.x, o.y, o.rockIndex || 0, o.flip);
        });
        this.projectiles.forEach(p => p.draw());
        this.updateStats();
        // Arbustos con unidad dentro (encima del personaje, se ve debajo del arbusto)
        this.bushes.forEach(b => {
            const hasUnitInside = this.units.some(u => u.hp > 0 && Math.hypot(u.x - b.x, u.y - b.y) < bushRadius);
            if (hasUnitInside) this.drawBush(b.x, b.y, b.bushIndex || 0, b.flip);
        });

        if (this.state === "PLACEMENT") {
            this.drawGhostUnit();
        }

        // Textos flotantes (monedas ganadas)
        if (this.floatingTexts && this.floatingTexts.length > 0) {
            this.floatingTexts.forEach(ft => {
                ft.floatY -= 1.5;
                ft.alpha -= 0.015;
                ctx.save();
                ctx.globalAlpha = Math.max(0, ft.alpha);
                ctx.fillStyle = "#ffd700";
                ctx.font = "bold 26px LifeCraft, Cinzel, sans-serif";
                ctx.textAlign = "center";
                ctx.shadowColor = "rgba(0,0,0,0.8)";
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
                
                const text = `+${ft.amount}`;
                const textWidth = ctx.measureText(text).width;
                const coinSize = 24;
                const spacing = 4;
                const totalWidth = textWidth + spacing + coinSize;
                
                const startX = ft.x - totalWidth / 2;
                ctx.textAlign = "left";
                ctx.fillText(text, startX, ft.y + ft.floatY);
                
                if (Sprites.coin.length > 0) {
                    const coinFrame = Math.floor(Date.now() / 100) % Sprites.coin.length;
                    const coinImg = Sprites.coin[coinFrame];
                    if (coinImg && coinImg.complete) {
                        ctx.drawImage(coinImg, startX + textWidth + spacing, ft.y + ft.floatY - coinSize + 4, coinSize, coinSize);
                    }
                }
                ctx.restore();
            });
            this.floatingTexts = this.floatingTexts.filter(ft => ft.alpha > 0);
        }

        if (!this.gameOver) requestAnimationFrame(() => this.loop());
    }
}

// ---------------------------------------------------------------------------
// PANTALLA DE CARGA: muestra un aliado al azar y barra de progreso antes del combate
// ---------------------------------------------------------------------------
const LOADING_DURATION = 1500;
const LOADING_ALLIES = [
    { folder: "Warrior", anim: "Attack", prefix: "Attack", frames: 4 },
    { folder: "Rogue", anim: "Attack", prefix: "Attack", frames: 4 },
    { folder: "Archer", anim: "Shoot", prefix: "Shoot", frames: 8 },
    { folder: "Priest", anim: "Heal", prefix: "Heal", frames: 10 }
];

function runFakeLoading() {
    const overlay = document.getElementById("loadingOverlay");
    const imgEl = document.getElementById("loadingAllyImg");
    const barFill = document.getElementById("loadingBarFill");
    if (!overlay || !imgEl) return Promise.resolve();

    const c = LOADING_ALLIES[Math.floor(Math.random() * LOADING_ALLIES.length)];

    if (barFill) barFill.style.width = "0%";

    return new Promise((resolve) => {
        let frameIndex = 1;
        const start = performance.now();

        function updateFrame() {
            imgEl.src = UNITS_BASE + c.folder + "/" + c.anim + "/" + c.prefix + frameIndex + ".png";
        }

        function tick() {
            const elapsed = performance.now() - start;
            if (barFill) {
                const pct = Math.min(100, (elapsed / LOADING_DURATION) * 100);
                barFill.style.width = pct + "%";
            }
            if (elapsed < LOADING_DURATION) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);

        const frameInterval = setInterval(() => {
            frameIndex = (frameIndex % c.frames) + 1;
            updateFrame();
        }, 140);

        updateFrame();

        setTimeout(() => {
            clearInterval(frameInterval);
            if (barFill) barFill.style.width = "100%";
            overlay.classList.add("hidden");
            resolve();
        }, LOADING_DURATION);
    });
}

// ---------------------------------------------------------------------------
// INICIALIZACIÓN: AudioManager + controles de sonido (todas las páginas) y loop de combate (solo game.html)
// ---------------------------------------------------------------------------

// Cargar AudioManager siempre (shop.html también lo necesita)
AudioManager.load();

// Bind de botones de música/SFX — funcionan en game.html Y en shop.html
const _musicToggle = document.getElementById("battleMusicToggle");
const _sfxToggle = document.getElementById("sfxToggle");
if (_musicToggle) {
    _musicToggle.classList.toggle("muted", AudioManager.musicMuted);
    _musicToggle.addEventListener("click", () => {
        AudioManager.musicMuted = !AudioManager.musicMuted;
        _musicToggle.classList.toggle("muted", AudioManager.musicMuted);
        if (typeof localStorage !== "undefined") localStorage.setItem("musicMuted", AudioManager.musicMuted ? "1" : "0");
        if (AudioManager.musicMuted) AudioManager.stopMusic();
        else {
            const _isShopPage = window.location.pathname.includes('shop.html');
            AudioManager.playMusic(_isShopPage ? "menu" : "battle");
        }
    });
}
if (_sfxToggle) {
    _sfxToggle.classList.toggle("muted", AudioManager.sfxMuted);
    _sfxToggle.addEventListener("click", () => {
        AudioManager.sfxMuted = !AudioManager.sfxMuted;
        _sfxToggle.classList.toggle("muted", AudioManager.sfxMuted);
        if (typeof localStorage !== "undefined") localStorage.setItem("sfxMuted", AudioManager.sfxMuted ? "1" : "0");
    });
}

// Loop de combate: solo en game.html (tiene #gameCanvas)
if (document.getElementById("gameCanvas")) {
    // Detectar recarga o navegacion atras y redirigir si es necesario
    const navEntries = window.performance.getEntriesByType('navigation');
    if (navEntries.length > 0 && (navEntries[0].type === 'reload' || navEntries[0].type === 'back_forward')) {
        localStorage.removeItem('ds_state');
        window.location.href = 'index.html';
    } else {
        (async () => {
            const game = new Game();
            await game.loadImages();
            const isShop = window.location.pathname.includes('shop.html');
            if (!AudioManager.musicMuted) AudioManager.playMusic(isShop ? "menu" : "battle");
            if (!isShop) {
                await runFakeLoading();
            }
            game.loop();
        })();
    }
}

// Control de navegacion para resetear progreso al salir
window.allowTransition = false;
window.addEventListener('beforeunload', () => {
    if (!window.allowTransition) {
        localStorage.removeItem('ds_state');
    }
});