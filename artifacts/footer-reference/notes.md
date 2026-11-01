# Footer motion reference

Inspected the user-supplied 9.8-second screen recording dated 2026-10-23 at
9:05:04 PM. Twelve extracted frames are retained here for comparison only;
none of the recorded imagery, text, or branding is served by the site.

Observed treatment: almost-black footer, faint iridescent outlined wordmark,
shallow curved luminous upper rim, and silver fluid folds following the cursor
across the complete footer. Trails lose their brightness after input stops.

Implementation adapts the existing user-supplied Lightswind solver. Higher
simulation/dye resolution preserves folds; density-gradient shading provides
silver highlights and restrained pearlescent color. The full output pass writes
transparent pixels to prevent old trails accumulating in the canvas. Input is
local to the footer, links stay above the canvas, and idle/hidden/removed footers
stop rendering. Touch and reduced-motion modes retain a static footer.

Ashutosh's existing name, footer information, navigation and copyright remain.
Syntax checks, the production build and 22 tests pass. Live browser comparison
is not verified because Computer Use access is unavailable.
