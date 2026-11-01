# Reference assets

The About hero uses two separate assets created with the built-in image tool:
- `public/media/ashutosh-cutout.png`: transparent portrait extracted from the
  user-supplied `portrait-ashutosh-front.png`. The supplied original remains
  unchanged in the user's Downloads folder; the unused public duplicate was removed.
- `public/media/about-stone-gallery.png`: original full-width stone interior.
- Exact prompts: `artifacts/about/portrait-prompt.txt` and
  `artifacts/about/environment-prompt.txt`.

The portrait sits as a foreground layer in the continuous architectural scene.
The live heading reads “Ashutosh Yadav”, with a short design-and-development label
and supporting line. No reference team content or reference portrait is used.

## Skills illustrations

Three original concept illustrations were made with the built-in image generation tool on October 31, 2026. They share the portfolio's ivory stone, sage, graphite, and muted metallic palette. These depict skill areas, not photographs of completed projects or actual events.

- `public/media/skills-software.jpg`: coding, interface layouts, and a database model.
- `public/media/skills-electronics.jpg`: a microcontroller, breadboard, and robotic gripper.
- `public/media/skills-community.jpg`: a collaborative workshop with laptops, sketches, and a prototype.

The original outputs and exact prompts are retained in `artifacts/imagegen/skills-*-source.png` and `artifacts/imagegen/skills-*-prompt.txt`. Production images are compressed JPEGs, lazy loaded at their native 3:2 ratio so the subjects remain visible on phones.

## Personal project covers

- `attendly-cover.jpg`: screenshot of the public sign-in/landing page at
  https://attendlytrack.vercel.app (no authentication or account data).
- `cygnus-cover.jpg`: screenshot of the public homepage at
  https://cygnusclub.vercel.app.
- `tivzo-cover.png`: project artwork from
  https://github.com/octoqbit/tivzo/blob/main/public/images/tivzo-voxel-festival.png.
- Project descriptions checked against https://github.com/octoqbit/attendly,
  https://github.com/octoqbit/tivzo, and https://github.com/octoqbit/cygnus.club.
- `geist.woff2`: Geist by Vercel, originally obtained from the selected reference's
  `/fonts/geist/Geist-Variable.woff2`.

The earlier reference-brand project covers, practice images, robot, and reference
reel were removed when the portfolio was personalised. The opening recording
still depicts the user-selected Apricode reference, as documented below.

## Original Beyond environment

The Beyond chapter uses an original generated lagoon backdrop and a native
Three.js marble causeway, tiered marble platform, and extruded metallic Ashutosh mark.
Scroll moves the camera down the path, revolves the logo, passes through its
opening, and fills the view with golden light before revealing the page.
The original portal and tunnel scroll distances are preserved; extra scroll
space is added only after the tunnel ends.

- `public/media/beyond-environment.webp`: clean lagoon background; generated
  with the built-in image tool. The exact editing prompt is retained in
  `artifacts/beyond/environment-prompt.txt`; the unused PNG export was removed.
- `public/media/path-marble.webp`: ivory marble with sage and champagne-gold
  veining, generated with the built-in image tool. Exact prompt:
  `artifacts/beyond/path-marble-prompt.txt`. The unused PNG export was removed.
  The path and platform share this polished material. World-aligned UVs continue
  the pattern across slabs and terraces; mirrored repeats prevent
  hard texture seams. A physical clearcoat material provides the polished finish.
- `public/media/beyond-platform.webp`: original static fallback for devices
  without WebGL. Its prompt remains in `artifacts/beyond/prompt.txt`.
- Camera, logo rotation, and light are tied to scroll and reverse consistently.
  The existing Pause control stops movement. Renderers are released on navigation.
- No robot appears in Beyond. Unused reference observatory files were removed.

## Homepage opening

`portal-full/` is extracted from the user-supplied
`Screen Recording 2026-10-22 at 10.36.55 PM.mov` (the actual filename uses a narrow
space before PM). It records the Apricode portal reference; attribution still applies.

- Complete section: 0–9.867 seconds, including the initial smaller portal.
- Crop: x=0, y=36, width=2912, height=1600. Removes browser chrome, scrollbar,
  and bottom progress line without cutting the portal's opening pose.
- 297 frames at 30 samples/second, selected by decoded presentation timestamps.
- Desktop: native 2912 × 1600. Mobile: same composition, reduced to 1600 × 879.
- Recorded UI is removed with local masks and directional interpolation from
  adjacent water and metal contours. Transparent lettering over the portal edge
  is uncomposited to retain the recorded silhouette. No generated imagery is
  included in the final frames.
- WebP quality 94. No interpolation between frames. Desktop uses a proportional
  cover crop; phones have a dedicated image area with portal-focused framing.
  The renderer never stretches edge pixels to fill the viewport.
- `manifest.json` records the source timestamps and output dimensions.
- Reproduce with `python3 scripts/extract-recording.py` (OpenCV required).

The uploaded recording stays unchanged. The first clean frame is also the static
poster for reduced motion and loading fallback. The older extracted sequence
remains removed; the unused original `portal.webp` reference assets were also removed.

## Mobile portal ocean extension

`public/media/portal-ocean-backdrop.jpg` is a compressed derivative of a backdrop generated with the built-in image generation tool on October 31, 2026. The supplied portal opening frame was the visual reference. The full-resolution generated source is retained at `artifacts/imagegen/portal-ocean-backdrop-source.png`. It fills the portrait hero behind the existing portal footage; CSS masks blend the footage into the backdrop without altering the sculpture.

Final generation prompt:

> Use case: precise-object-edit. Asset type: seamless ocean backdrop for a portrait mobile portfolio hero. Input image is the edit target and exact lighting/color reference. Remove the entire metallic portal and its reflection, replacing them with naturally continuing quiet ocean and cloudy sky. Recompose as a tall portrait 1024x1536 image, with the soft hazy ocean horizon at approximately 32 percent from the top. Match the original subdued warm gray sky, charcoal gray water, tiny calm ripples, muted pale gold reflections and exposure closely. The foreground ocean should continue all the way to the bottom with visible water texture, gently darker near the bottom for white website text. No flat green areas. No structures, no islands, no extra objects, no portal, no letters, no text, no borders. The result is an empty continuation of the original environment to blend under the original portal footage using soft masks, not a new scene or different weather.

## About typography

`public/media/cormorant-garamond-medium.ttf` is Cormorant Garamond Medium,
served locally for the About name. Downloaded from Google Fonts; its SIL Open
Font License is included in `public/media/cormorant-garamond-OFL.txt`.
