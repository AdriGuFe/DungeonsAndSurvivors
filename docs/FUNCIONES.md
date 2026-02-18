# Descripción de todas las funciones del proyecto

Documento de referencia: qué hace cada función en el código. Organizado por archivo.

---

## 1. `js/game.js`

### AudioManager (objeto global)

| Función | Qué hace |
|--------|----------|
| **load()** | Carga todos los archivos de audio (música menu, battle, victory y SFX: espada, escudo, cuchillo, flecha, cura, orco). Marca las pistas de música como loop. No recibe parámetros. |
| **playMusic(track)** | Reproduce la pista indicada (`"menu"`, `"battle"` o `"victory"`). Si ya suena otra, la para y pone su `currentTime` a 0. En battle empieza en 62s, en menu en 10s. No hace nada si la música está muteada. |
| **stopMusic()** | Para todas las pistas de música y pone su `currentTime` a 0. Limpia `currentTrack`. |
| **playSFX(name)** | Reproduce el efecto de sonido indicado (p. ej. `"swordImpact"`, `"heal"`). Usa un clon del Audio para poder solapamientos. Orco usa volumen 0.05, el resto 0.14. No hace nada si SFX están muteados. |
| **setMusicMuted(v)** | Asigna el mute de música; si `v` es true, llama a `stopMusic()`. |
| **setSFXMuted(v)** | Asigna el mute de efectos de sonido. |

---

### Sprites (objeto global)

| Función | Qué hace |
|--------|----------|
| **splitSpriteSheet(img, frameWidth, frameHeight)** | Parte una imagen en frames de tamaño dado (por defecto 32×32). Devuelve un array de objetos `{ img, sx, sy, sw, sh }` para cada celda. No se usa actualmente (las animaciones son imágenes sueltas). |
| **load()** | Carga todas las imágenes del juego: fondo, borde, esquina, Priest/Warrior/Rogue/Archer/Orc (idle, run, attack, guard, shoot, heal, effect), flecha, rocas (4), árboles (8), arbustos (8). Devuelve una Promise que se resuelve cuando todas han cargado (o fallado en silencio). |
| **drawAnimation(role, animationName, frameIndex, x, y, size, rotation)** | Dibuja un frame de una animación del personaje en el contexto del canvas. `role` en minúscula (ej. `"priest"`), `animationName` (ej. `"heal"`). Hace translate, rotate y drawImage centrado en (x,y) con el tamaño dado. Devuelve `true` si dibujó, `false` si no hay datos o imagen no cargada. |
| **draw(role, x, y, size, rotation)** | Atajo que dibuja el frame 0 de la animación "idle" del rol. Compatibilidad con código antiguo. |

---

### Funciones globales (game.js)

| Función | Qué hace |
|--------|----------|
| **resize()** | Ajusta el tamaño del canvas al viewport manteniendo la proporción 1400:900. En pantallas estrechas (<768px) usa más porcentaje de ventana. Aplica un mínimo de 320px de ancho. Actualiza `ARENA.width`, `ARENA.height`, `ARENA.x`, `ARENA.y` a 0. Se ejecuta al cargar y en el evento `resize` de la ventana. |

---

### Clase Projectile

| Método | Qué hace |
|--------|----------|
| **constructor(x, y, target, damage, color, role)** | Crea un proyectil en (x,y) con objetivo `target`, daño, color y rol. Si es arquero, guarda inicio/fin y prepara trayectoria parabólica (`arcHeight`, `totalDist`, `progress`). |
| **update()** | Avanza el proyectil un frame. Si el objetivo murió, desactiva. Si es flecha: avanza `progress` por la parábola; al llegar al final, aplica daño al objetivo, suena impacto y desactiva. Si es otro tipo: se mueve en línea recta hacia el objetivo; al estar a menos de 20px aplica daño y desactiva. |
| **draw()** | Dibuja el proyectil. Si es flecha y existe sprite, lo dibuja rotado según la tangente de la parábola. Si no, dibuja un círculo pequeño del color del proyectil. |

---

### Clase Unit

| Método | Qué hace |
|--------|----------|
| **constructor(x, y, role, team, game)** | Crea una unidad en (x,y): rol (WARRIOR, ROGUE, ARCHER, PRIEST, ORC), equipo (0 = orcos, 1 = aliados), referencia al Game. Inicializa vida, tamaño, radios de colisión, timers de ataque/bloqueo, si es ranged, cooldowns. Priest: healCastTime, healCooldown, healingTarget, healProgress. Archer: attackTarget, arrowLaunched. |
| **receiveDamage(amount)** | Resta `amount` a `hp`. Si es guerrero y recibe daño positivo y no está atacando, activa bloqueo (blockAnimTime 300ms) y reduce el daño al 40%. Si el daño es negativo (cura), activa efecto visual de escudo. |
| **getMovementTarget(units, enemyTeam)** | Devuelve el objetivo de movimiento: si es Priest, el aliado más cercano al enemigo (para acercarse al frente); si no, el enemigo más cercano. |
| **getMoveSpeed()** | Devuelve la velocidad de movimiento según rol: Priest 0.2, Archer 0.18, ranged 0.11, melee 0.3. |
| **tickAttackAndBlockTimers()** | Resta 16ms a `attackAnimTime` y `blockAnimTime`. Al terminar el ataque resetea offX/offY/rotation y, si es arquero, attackTarget y arrowLaunched. Al terminar bloqueo resetea shake. |
| **computeAIState(units, target, nearestOrc, moveSpeed)** | Calcula y devuelve un objeto con todo el estado de combate: distancias al objetivo, si está en rango melee, distancia al orco más cercano, si está kiteando, si está en combate, si el guerrero está siendo atacado, si puede atacar (`shouldPerformAttack`), etc. |
| **applyAIMovement(state)** | Establece `vx` y `vy`. Si está atacando: 0. Si está kiteando (ranged aliado cerca de orcos): se aleja del orco más cercano. Si hay objetivo y no es priest curando: se acerca al objetivo si está más lejos de `idealDist`. Si priest curando: 0. |
| **tryAIAttack(state)** | Si `state.shouldPerformAttack` y hay objetivo, llama a `performAttack`, actualiza `lastAttack` y reinicia animFrame/animTime. |
| **applyCombatStop(state)** | Pone vx y vy a 0 si está en combate o con attackAnimTime > 0. También a 0 si es priest y tiene healingTarget. |
| **updateFacing(target)** | Actualiza `facingRight`: si hay objetivo enemigo, según si está a la derecha o izquierda; si no, según el signo de vx. |
| **updatePriestHealAndAnim(units, state)** | Si tiene healingTarget: avanza healProgress; al llegar a healCastTime aplica -40 de daño (cura), suena heal, limpia healingTarget y pone animState "heal". Si no cura: busca aliado herido con findHurtAlly; si hay uno en rango, quieto y sin cooldown, lo asigna como healingTarget y pone animState "heal". Si no cura ni empieza cura: animState "run" o "idle" según si se mueve y no está en combate. |
| **updateRoleAnimState(state)** | Asigna `animState` según rol: Warrior (attack / guard si bloqueando o siendo atacado / run / idle), Rogue/Orc (attack / run / idle), Archer (shoot / run / idle). |
| **tickAnimFrames()** | Suma 16ms a animTime; cuando supera la velocidad del frame (220/300/110/280 ms según animación), avanza animFrame. En arquero en "shoot", en el frame 6 lanza la flecha (crea Projectile y arrowLaunched = true). |
| **applyBushSlowdown(bushes)** | Si el centro de la unidad está dentro de 28px de algún arbusto, multiplica vx y vy por 0.62. |
| **applyObstacleAvoidance(obstacles, state)** | Si no está en combate, no es priest curando y no está atacando: por cada obstáculo, si la unidad está más cerca de lo permitido, añade una fuerza de velocidad que la aleja del obstáculo. |
| **applyPhysicsAndClamp()** | Suma vx/vy a x/y, aplica fricción (0.85), atenúa shake. Limita x e y a los bordes de la arena usando márgenes simétricos (UNIT_PAD_X_MIN, UNIT_PAD_Y). |
| **update(units, obstacles, bushes)** | Orquesta un frame de IA: obtiene objetivo y moveSpeed, hace tick de timers, calcula state, aplica movimiento, intenta ataque, aplica parada de combate, actualiza facing, actualiza animación del priest o del resto de roles, tick de frames de animación, ralentización por arbustos, evitación de obstáculos y física con clamp. |
| **performAttack(target)** | Si no hay objetivo o está muerto, sale. Melee: asigna attackAnimTime 280, aplica daño (28 rogue, 18 resto), reproduce SFX. Archer: guarda attackTarget, arrowLaunched false, attackAnimTime para la animación de disparo (8×480 ms). |
| **drawCharacter()** | Dibuja el personaje en el canvas (ctx ya trasladado al centro de la unidad). Si hay sprites cargados para ese rol, dibuja el frame actual (con escalas especiales para priest, orc, archer). Si no, dibuja formas vectoriales (orco, guerrero, rogue, arquero, sacerdote) como fallback. |
| **draw()** | Aplica translate con posición + offset de ataque del rogue + shake. Llama a drawCharacter(). Dibuja la barra de vida encima. Si es aliado y un priest lo tiene como healingTarget, dibuja encima el efecto de curación (sprites Effect del priest). |

---

### Clase Game

| Método | Qué hace |
|--------|----------|
| **constructor()** | Inicializa arrays units, projectiles, obstacles, bushes; flags imagesLoaded, gameOver, winner. Llama a init(). |
| **loadImages()** | Ejecuta Sprites.load() y marca imagesLoaded; si falla, usa fallback de dibujo con código. |
| **init()** | Coloca 18 rocas y 12 árboles en posiciones aleatorias sin solaparse (mínima distancia 55). Coloca 35 arbustos sin solaparse entre sí ni con obstáculos. Llama a spawn(). |
| **spawn()** | Añade orcos (1–8 según probabilidades) en el borde izquierdo; añade aliados (0–3 warriors, 0–2 priests, resto rogues/archers hasta 6–9) en el borde derecho, barajados. |
| **findNearest(me, team)** | Devuelve la unidad viva del equipo `team` más cercana a `me` (por distancia euclidiana). |
| **findHurtAlly(me)** | Devuelve el aliado vivo con hp &lt; maxHp que tenga menos vida (el más herido). Para que el priest elija a quién curar. |
| **findNearestAlly(me)** | Devuelve el aliado vivo más cercano a `me` excluyendo a `me`. |
| **findAllyNearestToEnemy(me)** | Devuelve el aliado vivo más cercano al enemigo más cercano a `me`. El priest usa esto como objetivo de movimiento para ir hacia el frente. |
| **resolveUnitCollisions()** | Evita solapamiento: por pares de unidades vivas, si la distancia es menor que la suma de radios, las separa (solo mueve aliados en enfrentamientos aliado vs enemigo; mismo bando se separan a la mitad). Repite hasta 10 iteraciones o hasta que no haya solapamientos. Después mantiene todas dentro de la arena. |
| **drawArenaBackground()** | Dibuja el interior de la arena con tiles de fondo (o color verde si no hay imagen); dibuja bordes superior, inferior, izquierdo y derecho con el sprite de borde; dibuja las cuatro esquinas con el sprite de esquina. |
| **drawBush(x, y, bushIndex, flip)** | Dibuja un arbusto en (x,y): frame animado según tiempo y bushIndex, opcional flip horizontal; si no hay sprite, un círculo verde. |
| **drawRock(x, y, rockIndex, flip)** | Dibuja una roca en (x,y): sprite o forma vectorial gris con sombra; opcional flip. |
| **drawTree(x, y, treeIndex, flip)** | Dibuja un árbol en (x,y): sprite animado o rectángulo + círculo verde; opcional flip. |
| **updateStats()** | Actualiza el DOM de la cinta de estadísticas: cuenta aliados vivos por rol (Guerrero, Pícaro, Arquero, Sacerdote) y orcos vivos; escribe el HTML con iconos y números. |
| **showGameOver(victory)** | Muestra el overlay de fin de partida: pone clase victory o defeat, texto "VICTORIA" o "DERROTA" y el subtítulo. Si victoria, para la música y reproduce la pista de victoria (si no está muteada). |
| **loop()** | Un frame del juego: limpia canvas, dibuja fondo de arena, arbustos sin unidad encima; actualiza todas las unidades, resuelve colisiones, actualiza proyectiles; elimina muertos e inactivos; comprueba victoria/derrota y llama showGameOver si aplica; dibuja unidades, obstáculos, proyectiles, actualiza stats, dibuja arbustos con unidad encima; si no es game over, pide el siguiente frame con requestAnimationFrame. |

---

### Pantalla de carga e inicialización (game.js)

| Función | Qué hace |
|--------|----------|
| **runFakeLoading()** | Muestra la pantalla de carga: elige un aliado al azar (Warrior, Rogue, Archer, Priest), actualiza la imagen del sprite con los frames de su animación cada 140 ms, y una barra de progreso según el tiempo. Tras LOADING_DURATION (2600 ms) oculta el overlay y resuelve la Promise. |
| **Código al final del script** | Si existe el canvas del juego: carga audio, enlaza clics de música y SFX con mute y localStorage; crea una instancia de Game, carga imágenes, reproduce música de batalla si no está muteada, ejecuta runFakeLoading() y luego inicia game.loop(). |

---

## 2. `js/menu-landscape.js`

Todo el código está dentro de una IIFE; no hay funciones globales.

| Función | Qué hace |
|--------|----------|
| **loadImage(src)** | Crea una Promise que carga una imagen por URL; resuelve con la imagen en onload o con null en onerror (para no bloquear Promise.all). |
| **loadAll()** | Carga en paralelo: fondo, borde, 8 bush, 8 tree, 4 rocks, sprites idle de Priest/Warrior/Rogue/Archer, y animaciones attack/shoot/heal según rol. Devuelve Promise.all de todas. |
| **resize()** | Lee el tamaño del contenedor (wrap), asigna width/height al canvas, obtiene el contexto 2D. Se llama al cargar y en resize de ventana. |
| **drawBackground(innerX, innerY, innerW, innerH)** | Rellena el rectángulo interior con tiles del fondo o, si no hay imagen, un rectángulo verde. |
| **drawTopBorderOnly(bw, bh, horizonY)** | Dibuja solo el borde superior del terreno: repite el sprite de borde a lo largo del ancho del canvas a la altura horizonY. |
| **drawBush(x, y, bushIndex, flip)** | Dibuja un arbusto en (x,y) con frame animado (Date.now/120 % 8) y opcional flip; si no hay sprite, círculo verde. |
| **drawTree(x, y, treeIndex, flip)** | Dibuja un árbol en (x,y) con frame animado (Date.now/140 % 8) y opcional flip; si no hay sprite, rectángulo y círculo verdes. |
| **drawRock(x, y, rockIndex, flip)** | Dibuja una roca en (x,y) con el sprite según rockIndex y opcional flip. Si no hay sprite, no dibuja fallback. |
| **drawAlly(ally, size)** | Dibuja un aliado del layout: si tiene animUntil y animName (ataque/heal/shoot), usa esos frames según el tiempo restante; si no, usa idle. Aplica escalas especiales al priest (estrecho en idle y primeros frames de heal, más ancho después). |
| **draw()** | Bucle de dibujo: limpia canvas, calcula zona interior (debajo del horizonte), dibuja fondo recortado, borde superior. Si el tamaño cambió, recalcula layout (overlaps, placeOne): coloca 8 arbustos, 7 árboles, 4 rocas y 4 aliados (warrior, rogue, archer, priest) sin solaparse. Dibuja todos los elementos y programa el siguiente frame con requestAnimationFrame(draw). |
| **overlaps(x, y, r)** | (Interna a draw.) Comprueba si (x,y) con radio r se solapa con algún elemento ya colocado en `placed`. |
| **placeOne(xMin, xMax, yMin, yMax, r, maxTries)** | (Interna a draw.) Intenta hasta maxTries posiciones aleatorias en el rectángulo; si no solapa con `placed`, añade el punto y devuelve {x,y}. Si falla, coloca en el centro del rectángulo. |
| **getCanvasCoords(e)** | Convierte las coordenadas del evento (clientX, clientY) a coordenadas del canvas teniendo en cuenta el tamaño real del canvas y el de su contenedor. |
| **hitAlly(cx, cy)** | Devuelve el primer aliado del layout cuyo bounding box (56×56 centrado en su posición) contiene el punto (cx, cy). Si ninguno, null. |
| **getAnimNameForRole(role)** | Devuelve el nombre de animación al clicar: "attack" para warrior y rogue, "shoot" para archer, "heal" para priest. |
| **playAllySFX(role)** | Si los SFX no están muteados (localStorage), reproduce el sonido correspondiente al rol (swordImpact, knifeImpact, arrowImpact, heal) con volumen 0.14. |
| **Listener click del canvas** | Obtiene coordenadas del clic, comprueba si se ha pulsado un aliado con hitAlly; si sí, reproduce su SFX y asigna animName y animUntil (Date.now + 800 ms) para que drawAlly muestre la animación de ataque/heal/shoot. |

---

## 3. `index.html` (script inline)

### Música y SFX (IIFE inicial)

| Código / función | Qué hace |
|------------------|----------|
| **tryPlay()** | Intenta reproducir la música del menú si no está muteada. Se usa en canplaythrough y en el primer clic/tecla. |
| **Listeners** | canplaythrough y primer click/keydown en body llaman a tryPlay. musicToggle y sfxToggle conmutan mute y guardan en localStorage. |

### Modal "Cómo funciona"

| Función / lógica | Qué hace |
|------------------|----------|
| **getListaActual()** | Devuelve el array que corresponde a la pestaña activa: `aliados` o `criaturas`. |
| **actualizarSlide()** | Sincroniza el contenido del modal con el slide actual: pone título, descripción, icono del personaje; reinicia el intervalo del sprite idle y lo actualiza cada 180 ms; aplica clases de escala al sprite (narrow, narrow-priest); regenera los puntos de navegación (dots) y asigna clic y keydown para cambiar de slide. |
| **Clic en pestañas (Aliados/Criaturas)** | Cambia `tabActual`, pone slide a 0, actualiza clase del modal-box, marca la pestaña activa y llama actualizarSlide(). |
| **Clic en "Cómo funciona"** | Pone pestaña a aliados, slide 0, abre el modal (visible) y actualiza el slide. |
| **Clic en cerrar / clic en el fondo del modal** | Limpia el intervalo del sprite y cierra el modal (quita visible). |
| **Clic en flechas Anterior/Siguiente** | Decrementa o incrementa slideActual en módulo la longitud de la lista actual y llama actualizarSlide(). |

---

## Resumen por archivo

- **game.js**: Audio (load, playMusic, stopMusic, playSFX, setMusicMuted, setSFXMuted). Sprites (load, drawAnimation, draw). resize(). Projectile (constructor, update, draw). Unit (constructor, receiveDamage, getMovementTarget, getMoveSpeed, tickAttackAndBlockTimers, computeAIState, applyAIMovement, tryAIAttack, applyCombatStop, updateFacing, updatePriestHealAndAnim, updateRoleAnimState, tickAnimFrames, applyBushSlowdown, applyObstacleAvoidance, applyPhysicsAndClamp, update, performAttack, drawCharacter, draw). Game (constructor, loadImages, init, spawn, findNearest, findHurtAlly, findNearestAlly, findAllyNearestToEnemy, resolveUnitCollisions, drawArenaBackground, drawBush, drawRock, drawTree, updateStats, showGameOver, loop). runFakeLoading(). Inicialización al cargar.
- **menu-landscape.js**: loadImage, loadAll, resize, drawBackground, drawTopBorderOnly, drawBush, drawTree, drawRock, drawAlly, draw (y helpers overlaps, placeOne), getCanvasCoords, hitAlly, getAnimNameForRole, playAllySFX, y el listener de click.
- **index.html**: tryPlay, listeners de música/SFX, getListaActual, actualizarSlide, y todos los listeners del modal (tabs, abrir, cerrar, prev/next).

Si necesitas el detalle de una función concreta (parámetros, valores de retorno o un flujo paso a paso), se puede ampliar en ese punto.
