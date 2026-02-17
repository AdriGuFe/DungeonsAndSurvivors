/**
 * Paisaje del menú: terreno con bordes, decoraciones animadas (arbustos, árboles, rocas) y un aliado de cada tipo en idle.
 * Ocupa menos de la mitad de la pantalla; el resto es cielo.
 */
(function () {
    const ASSETS = "assets/";
    const UNITS = ASSETS + "Units/";

    const canvas = document.getElementById("menuLandscape");
    const wrap = document.getElementById("menuLandscapeWrap");
    if (!canvas || !wrap) return;

    let ctx = null;
    let w = 0, h = 0;
    var layout = null;
    var lastLayoutW = 0;
    var lastLayoutH = 0;

    var HORIZON_OFFSET = 130;

    const assets = {
        background: null,
        border: null,
        bushes: [],
        trees: [],
        rocks: [],
        allies: {
            priest: { idle: [], heal: [] },
            warrior: { idle: [], attack: [] },
            rogue: { idle: [], attack: [] },
            archer: { idle: [], shoot: [] }
        }
    };

    function loadImage(src) {
        return new Promise(function (resolve) {
            const img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { resolve(null); };
            img.src = src;
        });
    }

    function loadAll() {
        const promises = [];

        promises.push(loadImage(ASSETS + "Terrain/Background/Background.png").then(function (img) { assets.background = img; }));
        promises.push(loadImage(ASSETS + "Terrain/Border/Border.png").then(function (img) { assets.border = img; }));

        var i;
        for (i = 1; i <= 8; i++) {
            (function (idx) {
                promises.push(loadImage(ASSETS + "Terrain/Decorations/Bush/Bush" + idx + ".png").then(function (img) {
                    assets.bushes[idx - 1] = img;
                }));
            })(i);
        }
        for (i = 1; i <= 8; i++) {
            (function (idx) {
                promises.push(loadImage(ASSETS + "Terrain/Decorations/Tree/Tree" + idx + ".png").then(function (img) {
                    assets.trees[idx - 1] = img;
                }));
            })(i);
        }
        for (i = 1; i <= 4; i++) {
            (function (idx) {
                promises.push(loadImage(ASSETS + "Terrain/Decorations/Rocks/Rock" + idx + ".png").then(function (img) {
                    assets.rocks[idx - 1] = img;
                }));
            })(i);
        }

        ["Priest", "Warrior", "Rogue", "Archer"].forEach(function (role) {
            var key = role.toLowerCase();
            var idleCount = { priest: 6, warrior: 8, rogue: 8, archer: 6 }[key];
            for (i = 1; i <= idleCount; i++) {
                (function (idx) {
                    promises.push(loadImage(UNITS + role + "/Idle/Idle" + idx + ".png").then(function (img) {
                        assets.allies[key].idle[idx - 1] = img;
                    }));
                })(i);
            }
        });
        [["Warrior", "Attack", "Attack", 4, "warrior", "attack"],
            ["Rogue", "Attack", "Attack", 4, "rogue", "attack"],
            ["Archer", "Shoot", "Shoot", 8, "archer", "shoot"],
            ["Priest", "Heal", "Heal", 10, "priest", "heal"]
        ].forEach(function (cfg) {
            var role = cfg[0], folder = cfg[1], prefix = cfg[2], count = cfg[3], key = cfg[4], animName = cfg[5];
            for (i = 1; i <= count; i++) {
                (function (idx) {
                    var path = UNITS + role + "/" + folder + "/" + prefix + idx + ".png";
                    promises.push(loadImage(path).then(function (img) {
                        if (!assets.allies[key][animName].length) assets.allies[key][animName] = [];
                        assets.allies[key][animName][idx - 1] = img;
                    }));
                })(i);
            }
        });

        return Promise.all(promises);
    }

    function resize() {
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        w = rect.width;
        h = rect.height;
        canvas.width = w;
        canvas.height = h;
        ctx = canvas.getContext("2d");
    }

    function drawBackground(innerX, innerY, innerW, innerH) {
        const img = assets.background;
        if (img && img.complete && img.naturalWidth > 0) {
            const tw = img.naturalWidth;
            const th = img.naturalHeight;
            for (var y = innerY; y < innerY + innerH; y += th) {
                for (var x = innerX; x < innerX + innerW; x += tw) {
                    ctx.drawImage(img, x, y, tw, th);
                }
            }
        } else {
            ctx.fillStyle = "#2d5a27";
            ctx.fillRect(innerX, innerY, innerW, innerH);
        }
    }

    function drawTopBorderOnly(bw, bh, horizonY) {
        const border = assets.border;
        const extraBorderH = 2;
        const bhTop = bh + extraBorderH;
        var xMin = 0;
        var xMax = w;

        if (border && border.complete && border.naturalWidth > 0) {
            for (var x = xMin; x < xMax; x += bw) {
                var segW = Math.min(bw, xMax - x);
                var sw = (segW / bw) * border.naturalWidth;
                ctx.drawImage(border, 0, 0, sw, border.naturalHeight, x, horizonY, segW, bhTop);
            }
        }
    }

    function drawBush(x, y, bushIndex, flip) {
        var frame = Math.floor(Date.now() / 120) % 8;
        var bush = assets.bushes[(bushIndex + frame) % 8];
        if (bush && bush.complete && bush.naturalWidth > 0) {
            var size = 50;
            ctx.save();
            ctx.translate(x, y);
            if (flip) ctx.scale(-1, 1);
            ctx.drawImage(bush, -size / 2, -size / 2, size, size);
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(x, y);
            if (flip) ctx.scale(-1, 1);
            ctx.fillStyle = "#2d5a1a";
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawTree(x, y, treeIndex, flip) {
        var frame = Math.floor(Date.now() / 140) % 8;
        var tree = assets.trees[(treeIndex + frame) % 8];
        if (tree && tree.complete && tree.naturalWidth > 0) {
            ctx.save();
            ctx.translate(x, y);
            if (flip) ctx.scale(-1, 1);
            ctx.drawImage(tree, -32, -88, 64, 88);
            ctx.restore();
        } else {
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
    }

    function drawRock(x, y, rockIndex, flip) {
        var rock = assets.rocks[rockIndex % 4];
        if (rock && rock.complete && rock.naturalWidth > 0) {
            ctx.save();
            ctx.translate(x, y);
            if (flip) ctx.scale(-1, 1);
            ctx.drawImage(rock, -30, -30, 60, 60);
            ctx.restore();
        }
    }

    var ALLY_ANIM_DURATION = 800;
    var ANIM_FPS = 12;

    function drawAlly(ally, size) {
        var role = ally.role;
        var data = assets.allies[role];
        if (!data || !data.idle || !data.idle.length) return;
        var now = Date.now();
        var frames, frameIndex;
        if (ally.animUntil && now < ally.animUntil && ally.animName && data[ally.animName] && data[ally.animName].length) {
            var elapsed = (ALLY_ANIM_DURATION - (ally.animUntil - now)) | 0;
            if (elapsed < 0) elapsed = 0;
            frames = data[ally.animName];
            var progress = elapsed / ALLY_ANIM_DURATION;
            frameIndex = Math.min(Math.floor(progress * frames.length), frames.length - 1);
        } else {
            frames = data.idle;
            frameIndex = Math.floor(now / 120) % frames.length;
        }
        var frame = frames[frameIndex];
        if (!frame || !frame.complete || !frame.naturalWidth) return;
        ctx.save();
        ctx.translate(ally.x, ally.y);
        var isHealAnim = role === "priest" && ally.animName === "heal" && ally.animUntil && now < ally.animUntil;
        var priestNarrow = role === "priest" && (!isHealAnim || frameIndex <= 1);
        var priestHealWide = role === "priest" && isHealAnim && frameIndex >= 2;
        if (priestNarrow) ctx.scale(0.78, 1);
        else if (priestHealWide) ctx.scale(1.06, 1);
        ctx.drawImage(frame, -size / 2, -size / 2, size, size);
        ctx.restore();
    }

    function draw() {
        if (!ctx || w <= 0 || h <= 0) {
            requestAnimationFrame(draw);
            return;
        }
        ctx.clearRect(0, 0, w, h);

        var border = assets.border;
        var bw = border && border.complete ? border.naturalWidth : 32;
        var bh = border && border.complete ? border.naturalHeight : 32;
        var bhTop = bh + 2;
        var topHeight = bhTop;
        var horizonY = HORIZON_OFFSET;

        var innerX = 0;
        var innerY = horizonY + topHeight;
        var innerW = w;
        var innerH = h - innerY;

        ctx.save();
        ctx.beginPath();
        ctx.rect(innerX, innerY, innerW, innerH);
        ctx.clip();
        drawBackground(innerX, innerY, innerW, innerH);
        ctx.restore();

        drawTopBorderOnly(bw, bh, horizonY);

        if (!layout || lastLayoutW !== w || lastLayoutH !== h) {
            lastLayoutW = w;
            lastLayoutH = h;
            var margin = 50;
            var groundMinY = innerY + 40;
            var groundMaxY = h - 30;
            var allyMinY = innerY + Math.floor((groundMaxY - groundMinY) * 0.4);
            var allyMaxY = groundMaxY - 40;
            var minGap = 18;

            var placed = [];

            function overlaps(x, y, r) {
                for (var i = 0; i < placed.length; i++) {
                    var p = placed[i];
                    if (Math.hypot(x - p.x, y - p.y) < r + p.r + minGap) return true;
                }
                return false;
            }

            function placeOne(xMin, xMax, yMin, yMax, r, maxTries) {
                maxTries = maxTries || 80;
                for (var t = 0; t < maxTries; t++) {
                    var x = xMin + Math.random() * (xMax - xMin);
                    var y = yMin + Math.random() * (yMax - yMin);
                    if (!overlaps(x, y, r)) {
                        placed.push({ x: x, y: y, r: r });
                        return { x: x, y: y };
                    }
                }
                var x = xMin + (xMax - xMin) * 0.5;
                var y = yMin + (yMax - yMin) * 0.5;
                placed.push({ x: x, y: y, r: r });
                return { x: x, y: y };
            }

            var bushR = 28, treeR = 46, rockR = 32, allyR = 32;
            layout = { bushes: [], trees: [], rocks: [], allies: [] };

            [0, 1, 2, 3, 4, 5, 6, 7].forEach(function (i) {
                var p = placeOne(margin, w - margin, groundMinY, groundMaxY, bushR);
                layout.bushes.push({ x: p.x, y: p.y, i: i, flip: Math.random() < 0.4 });
            });
            [0, 1, 2, 3, 4, 5, 6].forEach(function (i) {
                var p = placeOne(margin, w - margin, groundMinY, groundMaxY, treeR);
                layout.trees.push({ x: p.x, y: p.y, i: i, flip: Math.random() < 0.4 });
            });
            [0, 1, 2, 3].forEach(function (i) {
                var p = placeOne(margin, w - margin, groundMinY, groundMaxY, rockR);
                layout.rocks.push({ x: p.x, y: p.y, i: i, flip: Math.random() < 0.4 });
            });
            ["warrior", "rogue", "archer", "priest"].forEach(function (role) {
                var p = placeOne(margin, w - margin, allyMinY, allyMaxY, allyR);
                layout.allies.push({ x: p.x, y: p.y, role: role });
            });
        }

        var size = 56;
        layout.bushes.forEach(function (b) { drawBush(b.x, b.y, b.i, b.flip); });
        layout.trees.forEach(function (t) { drawTree(t.x, t.y, t.i, t.flip); });
        layout.rocks.forEach(function (r) { drawRock(r.x, r.y, r.i, r.flip); });
        layout.allies.forEach(function (a) { drawAlly(a, size); });

        requestAnimationFrame(draw);
    }

    function getCanvasCoords(e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    function hitAlly(cx, cy) {
        if (!layout || !layout.allies) return null;
        var size = 56;
        var half = size / 2;
        for (var i = 0; i < layout.allies.length; i++) {
            var a = layout.allies[i];
            if (cx >= a.x - half && cx <= a.x + half && cy >= a.y - half && cy <= a.y + half)
                return a;
        }
        return null;
    }

    function getAnimNameForRole(role) {
        if (role === "warrior" || role === "rogue") return "attack";
        if (role === "archer") return "shoot";
        if (role === "priest") return "heal";
        return "attack";
    }

    var SFX_PATHS = {
        swordImpact: "audio/sounds/SwordImpact.mp3",
        knifeImpact: "audio/sounds/KnifeImpact.mp3",
        arrowImpact: "audio/sounds/ArrowImpact.mp3",
        heal: "audio/sounds/Heal.mp3"
    };

    function playAllySFX(role) {
        if (typeof localStorage !== "undefined" && localStorage.getItem("sfxMuted") === "1") return;
        var name = (role === "warrior") ? "swordImpact" : (role === "rogue") ? "knifeImpact" : (role === "archer") ? "arrowImpact" : (role === "priest") ? "heal" : null;
        if (!name || !SFX_PATHS[name]) return;
        var a = new Audio(SFX_PATHS[name]);
        a.volume = 0.14;
        a.play().catch(function () {});
    }

    canvas.addEventListener("click", function (e) {
        var coords = getCanvasCoords(e);
        var ally = hitAlly(coords.x, coords.y);
        if (ally) {
            playAllySFX(ally.role);
            ally.animName = getAnimNameForRole(ally.role);
            ally.animUntil = Date.now() + ALLY_ANIM_DURATION;
        }
    });

    resize();
    window.addEventListener("resize", resize);
    loadAll().then(function () {
        requestAnimationFrame(draw);
    });
})();
