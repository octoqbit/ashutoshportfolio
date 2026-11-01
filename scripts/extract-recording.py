"""Restore the full supplied VFR recording with clean overlays and original framing.

Requires opencv-python. Run from the repository root. The original stays intact.
Sequential decoding is deliberate: frame-index seeks are unreliable for this MOV.
"""
import json
import argparse
from pathlib import Path
import cv2
from recording_cleanup import RecordingCleanup

parser = argparse.ArgumentParser()
parser.add_argument('--resume', action='store_true', help='Keep frames already written by an interrupted extraction')
args = parser.parse_args()
source = next(Path('.').glob('Screen Recording*.mov'))
output = Path('public/media/portal-full')
for variant in ('desktop', 'mobile'):
    (output / variant).mkdir(parents=True, exist_ok=True)

start, end, fps = 0, 9.866666667, 30
count = round((end - start) * fps) + 1
capture = cv2.VideoCapture(str(source))
index = 0
times = []
cleaner = None
while capture.isOpened():
    ok, frame = capture.read()
    if not ok:
        break
    time = capture.get(cv2.CAP_PROP_POS_MSEC) / 1000
    if cleaner is None:
        cleaner = RecordingCleanup(frame)
    clean = None
    while index < count and time + .0001 >= start + index / fps:
        name = f'{index:04d}.webp'
        if args.resume and all((output / variant / name).exists() for variant in ('desktop', 'mobile')):
            times.append(round(time, 6))
            index += 1
            continue
        if clean is None:
            clean, _ = cleaner.clean(frame, time)
        cv2.imwrite(str(output / 'desktop' / name), clean, [cv2.IMWRITE_WEBP_QUALITY, 94])
        # Same composition on both devices; no moving crop or subject stretching.
        mobile = cv2.resize(clean, (1600, 879), interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(output / 'mobile' / name), mobile, [cv2.IMWRITE_WEBP_QUALITY, 94])
        times.append(round(time, 6))
        index += 1
        if index % 30 == 0:
            print(f'Prepared {index}/{count} frames', flush=True)
capture.release()
if index != count:
    raise RuntimeError(f'Expected {count} frames, extracted {index}')
(output / 'manifest.json').write_text(json.dumps({
    'count': count, 'fps': fps, 'start': start, 'end': times[-1],
    'crop': {'x': 0, 'y': 36, 'width': 2912, 'height': 1600},
    'desktop': {'width': 2912, 'height': 1600},
    'mobile': {'width': 1600, 'height': 879},
    'framing': 'proportional cover crop; mobile image area follows portal; no stretched edge fill',
    'cleanup': 'Recorded UI removed; opaque heading background reconstructed; portal retained from source',
    'sourceTimes': times,
}, indent=2) + '\n')
print(f'Extracted {count} clean frames per variant from {source.name}')
