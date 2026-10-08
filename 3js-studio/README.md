# 3.js Studio – Mobile WebGL Engine + Runtime Visual Layout Editor

Production-ready, lightweight 3D game engine + live editor tailored for **32-bit Android WebView**.

## Stack
- Vanilla ES6 + HTML5 + CSS3 (no React, no Electron, no Webpack)
- Three.js r128 (CDN)
- Rapier 3D (asm.js / pure-JS path – **no WASM**)
- Native Android WebView container with hardware layer

## SDK
- minSdk 21
- targetSdk / compileSdk **36**
- AGP 8.13.2 · Gradle 8.13

## Project layout
```
3js-studio/
├── index.html              # Main entry + touch UI
├── js/
│   ├── Engine.js           # WebGLRenderer + context-loss recovery + render loop
│   ├── Physics.js          # Rapier world + bi-directional mesh↔body map
│   ├── ScriptEngine.js     # Runtime onStart / onUpdate script compiler
│   └── Generators.js       # Heightmap terrain + CPU water waves
└── android/                # Native shell
    └── app/src/main/
        ├── java/.../MainActivity.java
        ├── AndroidManifest.xml
        └── assets/         # Engine files loaded by WebView
```

## Quick start (browser)
Open `index.html` in Chrome / Edge (or any modern mobile browser).

## Build APK (Android Studio)
1. Open the `android/` folder in Android Studio.
2. Let Gradle sync.
3. Build → Build Bundle(s) / APK(s) → Build APK(s).

## License
MIT
