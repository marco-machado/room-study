# Room Study

An unfurnished reconstruction of the photographed interior, built with procedural Three.js geometry and WebGPU. All plaster, timber, ceramic tile, and stone surface detail is generated in Three Shader Language. No room models, photographs, image textures, or HDR environments are loaded.

## Run

```sh
npm install
npm run dev
```

Open the local URL in a WebGPU-capable browser, such as a current Chrome or Edge, with hardware acceleration enabled. WebGPU requires localhost or HTTPS. The renderer explicitly disables Three.js's WebGL fallback; an unsupported browser gets a clear compatibility message.

```sh
npm run build
npm run preview
```

## Explore

- Drag to look; use WASD or arrow keys to walk; scroll to move forward or backward.
- Choose Entrance, Living, or Kitchen for an animated camera transition.
- Open Floor plan for a cutaway overview; drag to orbit and scroll to zoom.
- Change the daylight preset or use Scene settings for a light slider and door toggle.
- Use the on-screen arrows to walk on mobile. Press R to reset the current view.

The reconstruction preserves the cream walls, diagonal tiles, crown molding, dark baseboards, arched barred window, six-panel wooden entrance door, side openings, and fixed kitchen counter. Room dimensions and unseen adjoining areas are approximations inferred from the photographs, not surveyed measurements.

## Source

- `src/room.ts` — architectural dimensions and procedural geometry.
- `src/materials.ts` — procedural TSL materials.
- `src/viewer.ts` — WebGPU renderer, lighting, ambient occlusion, cameras, and navigation.
- `src/main.ts` and `src/style.css` — responsive viewer controls.

UI fonts are bundled locally. The application does not need runtime network requests.

## Browser verification

With the development server running and Chromium installed:

```sh
npm run test:browser
```

Set `CHROMIUM_PATH` or `APP_URL` to use a different Chromium executable or server URL. The check exercises actual WebGPU rendering, camera transitions, lighting, the hinged door, walking, mobile controls, and the unsupported-browser state. It saves temporary visual checks under `/tmp/room-study-qa`.
