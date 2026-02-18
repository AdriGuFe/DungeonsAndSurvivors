# Estructura del proyecto Dungeons and Survivors

Rutas relativas a la raíz del proyecto. Los HTML están en `html/`; el resto de carpetas (css, js, assets, audio, fonts) en la raíz.

```
DungeonsAndSurvivors/
├── docs/
│   ├── FUNCIONES.md
│   ├── STRUCTURE.md
│   └── ASSETS_README.md
├── html/
│   ├── index.html          # Menú principal
│   └── game.html           # Pantalla de combate
├── css/
│   └── style.css           # Estilos globales (fuente: ../fonts/...)
├── js/
│   ├── game.js             # Lógica del combate (arena, unidades, IA, dibujo)
│   └── menu-landscape.js   # Canvas del paisaje en el menú
├── assets/                 # Imágenes y sprites
│   ├── Terrain/            # Fondo, bordes, decoraciones (Bush, Tree, Rocks, Clouds)
│   ├── Units/              # Guerrero, Pícaro, Arquero, Sacerdote (Idle, Run, Attack, etc.)
│   ├── Enemies/            # Orc1 (Idle, Run, Attack)
│   └── UI Elements/        # Iconos, avatares, cintas, espadas
├── audio/
│   ├── music/              # Menu.mp3, Battle.mp3, Victory.mp3
│   └── sounds/             # SwordImpact, Heal, ArrowImpact, etc.
└── fonts/
    └── LifeCraft_Font.ttf
```

- **HTML**: en `html/`; enlazan `../css/style.css`, `../js/*.js`, `../assets/`, `../fonts/`, `../audio/`.
- **CSS**: en `css/`; la fuente se carga con `url('../fonts/...')` porque el CSS está en una subcarpeta.
- **JS**: en `js/`; las rutas a assets y audio son relativas al documento HTML (desde html/ sería `../assets/`, etc.).
