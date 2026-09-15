# McLary — Personal Portfolio

An independently implemented portfolio with an open-ocean 3D scene, reflected water, a sun, moving clouds, a sailboat contact view, an underwater project gallery, and an interactive sculpture playground.

## Start

```sh
pnpm install
pnpm dev
```

Visit `http://127.0.0.1:4173/`. Requires Node.js 20.19+ or 22.12+.

```sh
pnpm build
pnpm check
pnpm preview
```

The static production output is `build/`. It can be deployed independently to any static host. The main routes are `/`, `/work/`, `/contact/`, and `/playground/`; each has a physical HTML entrypoint, so refreshes work without a special server.

## GitHub Pages

- Source: https://github.com/Mclarenlife/McLary
- Published site: https://mclarenlife.github.io/
- Deployment repository: https://github.com/Mclarenlife/Mclarenlife.github.io

Run `pnpm build`, `pnpm check`, `node scripts/check-ocean.mjs`, and `node scripts/check-motion.mjs`. Publish the contents of `build/` at the root of the deployment repository's `main` branch. Its existing GitHub Pages branch deployment publishes the site. `public/.nojekyll` is copied into the output so GitHub serves the compiled files directly. The deployment repository contains generated files; edit this source repository and rebuild for future updates.

The site uses root-relative URLs for the account site (`mclarenlife.github.io`), not a `/McLary/` project subdirectory. The home boat uses a world scale of 0.68, with the contact camera adjusted proportionally to preserve the close-up.

## Make it your own

Edit **`src/content.js`** to change the introduction, biography, contact email and project data. The six current entries are explicitly labeled concept studies, not claims about real clients or completed commissions. Set `profile.email` to print your email onto the animated sail and enable the matching accessible email link and copy button. An unset address shows an explicit coming-soon message; no email is invented.

For each real project, replace its title, category, subtitle, description and image. Put your files in `public/projects/` and set `image: '/projects/your-image.webp'`. Image paths you specify are preserved by the data mapping. Projects open in an accessible native dialog.

## Source structure

| File                      | Purpose                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `src/main.js`             | Navigation, filters, project dialogs, keyboard handling, synthesized audio              |
| `src/scene.js`            | Scene routing, perspective camera, lighting, reflected water and gallery/sculpture environments     |
| `src/ocean-scene.js`     | Procedural sky, sun, clouds, boat, deforming sail and contact ink |
| `src/underwater-scene.js` | Underwater light shafts, surface shimmer, instanced swimming fish and bounded pointer bubbles |
| `src/scene-push.js`       | Two-background, direction-aware compression and elastic scene replacement               |
| `src/water-motion.js`     | Animated water geometry, reflection distortion, gentle pointer ripples and scene refraction      |
| `src/gallery-motion.js`   | One finite full-list surface, bounded scrolling, subtle dispersion and spatial rotation |
| `src/paper-geometry.js`   | Continuous ribbon path, shared flutter, finite texture bounds and project hit regions   |
| `src/artworks.js`         | Original 3D concept-study renderer used during development                              |
| `src/content.js`          | Editable personal and project content                                                   |
| `src/style.css`           | Typography, layout, responsive styles and controls                                      |
| `public/studies/`         | Locally rendered, self-contained portfolio demo images                                  |
| `scripts/check-build.mjs` | Routes, assets, size limits and independent-build checks                                |

## Technology and independence

- Three.js / WebGL for 3D; its standard Water helper supplies a reflection render target. Geometry, water-normal texture, materials, composition and interaction code are authored here.
- GSAP for camera and interface transitions.
- The entire gallery is a single 48 × 192 WebGL mesh with one finite texture containing images, captions and divider lines. Wheel, touch dragging and keyboard input move content along a continuous surface with bounded head and tail positions. Entering Work resets the filter and scroll position to the first projects. At rest the first row is ahead of the fold and remains uncurled, with gentle shared flutter. The first 190 pixels of desktop travel (150 on mobile) smoothly bring the bend into the upper gallery, preserving clearance below the fixed heading mask. The tangent turns from 0° to 120° backward/downward, follows that slope for 1.15 times the bend radius, then returns to 60° backward/upward. Both halves curve inward and then outward symmetrically; the folds sit below the heading mask. Shared waves deform the whole surface. Subpixel RGB dispersion follows the same wave phases, fades at image boundaries and is reduced to 3% on captions. The document stays at scroll position zero. Pointer movement rotates the gallery through a damped 3D perspective. Raycasting skips empty surface segments and maps visible images and captions to projects; native keyboard buttons remain accessible. The welcome screen reports image decoding, texture upload, shader compilation and a rendered first frame before enabling entry. The gallery surface, image nodes and WebGL renderer persist across route changes; an inert hidden container parks the prepared surface while another page is active. Only actual filter or viewport changes rebuild its texture, disposing of the previous texture. A category change sends the complete old list upward along the surface for 1.25 seconds; after it is fully outside the visible texture range, the selected list enters from below the viewport over 1.45 seconds. Rapid clicks keep the latest requested category. Scroll input pauses during this exchange, and navigation cancels it cleanly. Native cards stay hidden during preparation, so navigation never flashes a flat fallback before the animated surface. Reduced-motion and failed WebGL preparation use the accessible native list.
- Index and Contact share one ocean scene. Contact moves the perspective camera toward the same boat over 2.6 seconds while email ink fades onto its animated sail. Index reverses the camera journey. The email link follows the projected sail in screen space for mouse and keyboard access; a readable text fallback is available if graphics fail. Phone framing keeps the boat within the viewport. All other route changes last about 3.2 seconds: a 0.38-second anticipation precedes the launch and elastic arrival. The incoming work background pushes the home background upward into a compressed strip; returning home reverses the push, and the work heading and gallery exit downward. A curved moving boundary and nonuniform compression join the two backgrounds without a crossfade or camera lift. The work mask follows the background during the push, then returns to its fixed viewport position. Background camera movement follows the pointer with a wider, smoothed orbit. Reduced-motion and WebGL fallback modes provide flat cards with ordinary scrolling inside the fixed gallery area.
- The water uses four moving wave scales, pointer-generated expanding waves and full-scene ripple refraction. Pointer ripple amplitudes are reduced by about 75–85% while autonomous ocean waves remain active. Text remains readable above the scene. Sun, cloud and boat reflections update with the water; reduced-motion preferences pause these effects.
- Work uses a separate underwater environment within the same renderer and elastic scene transition. Animated sunlight fans down from the surface into blue depth. Three schools of instanced fish swim with deforming tails; mobile uses fewer fish. Pointer movement releases small translucent bubbles that drift upward over the gallery, with a maximum of 48 live bubbles and a short lifetime. Bubbles clear on route changes and pause for menus/dialogs and reduced motion. The environment is compiled during the initial welcome preload. Gallery captions use pale ink, and the heading clearance is applied to the paper's alpha in its shader, leaving the underwater background continuous instead of covering it with an opaque header mask.
- Vite for development and production bundles; pnpm lockfile pins dependencies.
- DM Sans and Cormorant Garamond from Fontsource, bundled locally.
- Ambient audio is synthesized using the Web Audio API and starts only after an explicit choice.
- Portfolio studies are rendered from this project's own geometry. Open `/?render-studies=1` during development to regenerate them. A localhost-only Vite middleware saves these renders into `public/studies/`; it is absent from the production site.
- No original-site scripts, models, images, audio, styles, fonts, embedded pages or runtime services are used. No third-party analytics or runtime network services are required.

The visual direction was inspired by the user's reference. This is a new implementation, not a source mirror or a pixel-identical reconstruction of the reference's custom assets.

Run `node scripts/check-motion.mjs` to check the unfolded initial row, smooth raised fold entry, 120°/60° tangents, intermediate travel length, continuous joins, mirrored inward/outward bends, mask clearance, finite texture bounds, project picking, shared flutter and refresh-rate independence.

Run `node scripts/check-ocean.mjs` to check desktop/mobile home placement, contact framing and the perspective zoom.

Run `node scripts/check-underwater.mjs` to check the bubble pool limit, upward drift, expiry, route cleanup, fish movement and responsive sizing.

## Accessibility and resilience

Keyboard focus indicators, native modal dialogs, a keyboard-contained navigation menu, reduced-motion handling, adaptive rendering resolution and a 2D content fallback are included. In a browser without WebGL, the portfolio and local project imagery remain accessible. A graphics-capable browser is required for the 3D experience.
