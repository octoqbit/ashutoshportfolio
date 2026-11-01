"""Compare actual source frames against the extracted assets at matching timestamps."""
from pathlib import Path
import json
import cv2
import numpy as np

root = Path('artifacts/portal-comparison')
root.mkdir(parents=True, exist_ok=True)
manifest = json.loads(Path('public/media/portal-full/manifest.json').read_text())
indices = [0, 60, 135, 156, 225, 296]
times = {i: manifest['sourceTimes'][i] for i in indices}
cap = cv2.VideoCapture(str(next(Path('.').glob('Screen Recording*.mov'))))
results = []
sift = cv2.SIFT_create(nfeatures=1600)
remaining = list(indices)
while remaining:
    ok, frame = cap.read()
    if not ok: break
    time = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
    index = remaining[0]
    if time + .0001 < times[index]: continue
    remaining.pop(0)
    original = frame[36:1636, :2912]
    cleaned = cv2.imread(f'public/media/portal-full/desktop/{index:04d}.webp')
    # Assess the portal itself, excluding text-repair areas and the browser UI.
    a = original[400:1400, 1450:2700]
    b = cleaned[400:1400, 1450:2700]
    ka, da = sift.detectAndCompute(cv2.cvtColor(a, cv2.COLOR_BGR2GRAY), None)
    kb, db = sift.detectAndCompute(cv2.cvtColor(b, cv2.COLOR_BGR2GRAY), None)
    matches = [x for x,y in cv2.BFMatcher().knnMatch(da, db, k=2) if x.distance < .7*y.distance]
    src = np.float32([ka[m.queryIdx].pt for m in matches])
    dst = np.float32([kb[m.trainIdx].pt for m in matches])
    transform, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=1)
    scale = float(np.hypot(transform[0,0], transform[1,0]))
    movement = float(np.linalg.norm(transform[:,2]))
    assert abs(scale-1) < .002 and movement < .5, (index, scale, movement)
    result = {'frame': index, 'sourceTime': time, 'portalScale': scale, 'portalDisplacementPixels': movement, 'matchingFeatures': int(inliers.sum())}
    results.append(result)
    # These are video-asset comparisons, not simulated browser screenshots.
    for label, im in [('source', original), ('cleaned', cleaned)]:
        cv2.imwrite(str(root / f'{label}-{index:04d}.jpg'), im, [cv2.IMWRITE_JPEG_QUALITY, 95])
    width = 1050
    height = round(1600 * width / 2912)
    sheet = np.full((height+52, width*2, 3), 245, np.uint8)
    sheet[52:, :width] = cv2.resize(original, (width,height), interpolation=cv2.INTER_AREA)
    sheet[52:, width:] = cv2.resize(cleaned, (width,height), interpolation=cv2.INTER_AREA)
    cv2.putText(sheet, f'Source recording / {time:.2f}s', (22,33), cv2.FONT_HERSHEY_SIMPLEX, .65, (30,30,30), 1, cv2.LINE_AA)
    cv2.putText(sheet, 'Cleaned asset / same camera view', (width+22,33), cv2.FONT_HERSHEY_SIMPLEX, .65, (30,30,30), 1, cv2.LINE_AA)
    cv2.imwrite(str(root / f'comparison-{index:04d}.jpg'), sheet, [cv2.IMWRITE_JPEG_QUALITY,95])
cap.release()
assert not remaining
(root / 'measurements.json').write_text(json.dumps(results, indent=2)+'\n')
print(json.dumps(results, indent=2))
