# Rutas de assets del proyecto

Ruta base (desde la raíz del proyecto):
```
assets/
```

---

## 1. Terrain (terreno y decoración)

### 1.1 Decorations
- **Clouds:** `Terrain/Decorations/Clouds/`  
  `Clouds_01.png` … `Clouds_08.png`
- **Bush:** `Terrain/Decorations/Bush/`  
  `Bush1.png` … `Bush8.png`
- **Tree:** `Terrain/Decorations/Tree/`
- **Border / Corner:** `Terrain/Border/`, `Terrain/Corner/`

### 1.2 Fondos
- Fondo de arena, bordes y esquinas usados en el juego (ver `js/game.js` y `js/menu-landscape.js`).

---

## 2. Units (aliados)

Cada unidad tiene carpetas por animación: Idle, Run, Attack, etc.

- **Guerrero:** `Units/Warrior/` (Idle, Run, Attack, Guard)
- **Pícaro:** `Units/Rogue/` (Idle, Run, Attack)
- **Arquero:** `Units/Archer/` (Idle, Run, Shoot)
- **Sacerdote:** `Units/Priest/` (Idle, Run, Heal, Effect)

**Ejemplo:**  
`assets/Units/Warrior/Idle/Idle1.png`, `assets/Units/Priest/Heal/Heal1.png`

---

## 3. Enemies (enemigos)

- **Orco:** `Enemies/Orc1/` (Idle, Run, Attack)

**Ejemplo:**  
`assets/Enemies/Orc1/Idle/Idle1.png`

---

## 4. UI Elements

- **Human Avatars:** `UI Elements/UI Elements/Human Avatars/`  
  `Warrior.png`, `Rogue.png`, `Archer.png`, `Priest.png`, etc.
- **Icons:** `UI Elements/UI Elements/Icons/`  
  `Icon_01.png` … `Icon_12.png`
- **Ribbons:** `UI Elements/UI Elements/Ribbons/`  
  `Ribbon1.png`, `Ribbon2.png`, `Ribbon3.png`
- **Swords:** `UI Elements/UI Elements/Swords/`  
  `Swords1.png`, `Sword2.png`, `Sword3.png`

**Ejemplo:**  
`assets/UI Elements/UI Elements/Icons/Icon_09.png`

---

## 5. Otros

- **FireBall (efectos):** `assets/FireBall/`  
  `Fire Ball_Frame_01.png` … `Fire Ball_Frame_08.png`  
  (espacio en "Fire Ball", número con dos dígitos)

---

Todas las rutas son relativas a la raíz del proyecto. En código se usan rutas como `assets/Units/...`, `assets/Terrain/...`, etc.
