# Ashutosh — Ideas into experiences

Ashutosh Yadav’s personal portfolio: second-year B.Tech ECE at BTKIT, software and electronics projects, CYGNUS club leadership, and student experience. The site includes a scroll-controlled introduction, project detail pages, About, Skills (at the existing `/practice/` URL), and Contact.

## Development

```sh
npm install
npm run dev
```

## Validation

```sh
npm run validate
```

The build creates directly loadable HTML entry points for every route in `content.js`.
Validation checks all JavaScript files, the test suite, the production build,
internal routes, fragment links, image alternatives, and referenced CSS/media files.

## Hosting

Use `npm ci` to install the locked dependencies and `npm run validate` before publishing.
The build command is `npm run build`; publish the `dist/` directory at the domain root.
Routes include `/work/`, `/practice/` (Skills), `/about/`, `/contact/`, and each project.
Serve `404.html` for unknown routes and use HTTPS so the contact clipboard action works.
The contact form prepares a copied message; it does not send email or require a backend.

The complete portal sequence contains roughly 116 MB of source media across the two
device variants. Browsers request only the current variant with a bounded frame cache;
the full directory is still part of the hosting upload. Live device/browser review
remains necessary before publishing because automated checks do not verify visual layout.

## Content status

Personal information comes from Ashutosh. Project descriptions and links were checked
against his public GitHub account, `octoqbit`. Work features Attendly, Tivzo, and
CYGNUS. Tivzo is labelled in development; its repository is linked rather than an
unconfirmed deployment. Education, supplied skills, Google Student Ambassador
experience (May–September 2026), two techfest contest wins, and Cisco Introduction
to IoT certification appear on About. Contact prepares a note to copy and email;
it does not send messages automatically.

Update personal details, projects, skills, and highlights in `content.js`.

## Source map

- `pages.js`: page templates and reusable sections.
- `style.css`: layouts, typography, responsive styles, reduced-motion behavior.
- `main.js`: navigation, scroll animation, dialogs, forms, and lifecycle cleanup.
- `motion.js`: deterministic scene progress and visibility.
- `sequence.js`: single-frame canvas rendering with a bounded decoded-image cache.
- `scripts/extract-recording.py`, `scripts/recording_cleanup.py`: full recording extraction and overlay cleanup (Python, NumPy, OpenCV).
- `footer-smoke.js`: footer-only smoke lifecycle and local pointer input.
- `src/components/lightswind/footer-fluid.ts`: fluid solver adapted from the supplied `smokey-cursor.tsx` component.
- `work-motion.js`, `work-sheets.js`: left-entering flexible project banners and pointer tilt.
- `project-transition.js`: banner-to-fullscreen expansion and detail-page cover handoff.
- `scene.js`: Three.js tunnel, loaded during the approach to the portal.
- `public/media`: reference imagery and media; sources are in `ASSETS.md`.
- `.openai/hosting.json`: retained private Site identity.

## Motion and accessibility

The homepage uses all 297 sampled frames from the supplied October 22 screen
recording, from 0–9.867 seconds. The first 5.2 seconds are restored. Only browser
chrome, the scrollbar, and the bottom progress line are cropped away; recorded
text and the pointer are repaired separately. Desktop retains 2912 × 1600;
mobile uses the same composition at 1600 × 879. Desktop fills the viewport with a proportional crop. Portrait phones frame the complete opening sculpture above the introduction,
reserving the measured text height and blending the image edges into a matching generated ocean backdrop. Once the introduction has faded, the portal frame expands to fill the screen and its edge masks disappear. The backdrop is hidden only after the footage covers it, before the tunnel crossfade. The canvas resizes with the frame in both scroll directions. Framing follows the portal toward its entry.
No edge pixels are stretched to fill unused space; canvas density is capped by
the source resolution. Recorded lettering is removed by continuing
adjacent water and metal contours through its masked strokes. Faded
letters over the portal edge are uncomposited to preserve its silhouette. Reconstructed background pixels are not claimed
to be identical to the hidden original pixels.
The original upload remains untouched. Rebuild the frames with
`python3 scripts/extract-recording.py`. Frames use WebP quality 94 with no
cross-frame blending or sharpening filters. The recorded portal is not upscaled during extraction.
At most six decoded frames are cached, with two requests in flight. Only the
current device variant loads, and images are released after entering the tunnel.
Scroll controls the recording, Three.js tunnel, and transition to the arrival scene.
The render loop stops when scrolling settles and while the page is hidden or a
dialog is open. Pause freezes recording and tunnel travel while retaining page navigation.
Reduced motion uses the static opening with direct access to work.
Mouse movement gently tilts the portal, tunnel, and arrival backgrounds as one
layer. Foreground text and controls stay steady. Tilt eases back to center when
the pointer leaves or motion is paused, and is disabled for touch and reduced
motion. The page has no global cursor overlay. Each black footer has local silver,
iridescent fluid trails using the supplied Lightswind solver, with a curved pearl rim
and a dark ASHUTOSH wordmark. Input spans the entire footer. It loads on hover,
fades out after pointer movement, and releases its GPU resources on route changes.
Touch and reduced-motion users receive the static wordmark. Scene canvases render at up to 2× device density.
The recording has no additional dark overlay; tunnel fog remains light.

The complete recording reaches its opening, then transitions into the Three.js tunnel; continued scrolling travels
through its metallic frames and reveals the arrival scene. Tunnel camera and
shader time follow the same reversible scroll timeline. A CSS tunnel remains
available without WebGL.

## Frame comparison

`python3 scripts/compare-recording.py` checks six matching timestamps and saves
side-by-side asset comparisons to `artifacts/portal-comparison/`. Portal feature
registration checks scale and displacement; it does not claim reconstructed
water pixels are identical to pixels hidden by opaque text. The comparison is
frame based, as requested, rather than a live-browser validation.

Generated comparison images and unused source exports were removed during cleanup.
The original recording, regeneration scripts, asset prompts, font license, tests,
and hosting configuration are retained. The website serves only the current media.
