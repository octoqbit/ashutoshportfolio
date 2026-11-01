"""Overlay cleanup for the supplied recording, retaining its camera geometry.

Masked lettering is repaired along the adjacent water and metal contours.
All processing uses original pixels and preserves the recorded camera geometry.
"""
import cv2
import numpy as np


class RecordingCleanup:
    def __init__(self, first):
        self.shape = first.shape[:2]
        self.gray = cv2.cvtColor(first, cv2.COLOR_BGR2GRAY).astype(np.float32)
        self.heading = (190, 710, 1220, 340)
        x, y, w, h = self.heading
        glyph = (self.gray[y:y+h, x:x+w] > 200).astype(np.uint8) * 255
        self.glyph = cv2.dilate(glyph, np.ones((7, 7), np.uint8))
        original = first[y:y+h, x:x+w].astype(np.float32)
        background = cv2.inpaint(first[y:y+h, x:x+w], self.glyph, 5, cv2.INPAINT_NS).astype(np.float32)
        self.ink = np.median(original[glyph > 0], axis=0)
        self.matte = np.clip(np.mean((original-background) / np.maximum(self.ink-background, 1), axis=2), 0, 1)
        self.matte *= self.glyph > 0
        t = self.gray[y:y+h, x:x+w]
        self.template = t - cv2.GaussianBlur(t, (0, 0), 12)
        self.template_energy = (self.template ** 2).sum()
        self.static = self.stencil(first, [(180, 1515, 290, 75), (1070, 1515, 470, 75), (2535, 1515, 230, 75)], 80)
        # Pointer includes its dark center and antialiased outline.
        self.static[1025:1075, 2878:2918] = 255
        self.labels = self.stencil(first, [(190, 285, 360, 40), (2460, 285, 300, 40)], 125)
        self.copy = self.stencil(first, [(190, 1080, 810, 115), (190, 1265, 380, 80)], 110)
        self.copy[1271:1318, 540:553] = 255
        self.copy[1332:1343, 198:560] = 255

    def stencil(self, frame, boxes, threshold):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).astype(np.float32)
        detail = gray - cv2.GaussianBlur(gray, (0, 0), 3)
        mask = np.zeros(self.shape, np.uint8)
        for x, y, w, h in boxes:
            mask[y:y+h, x:x+w] = ((gray[y:y+h, x:x+w] > threshold) & (detail[y:y+h, x:x+w] > 3)).astype(np.uint8) * 255
        return cv2.dilate(mask, np.ones((5, 5), np.uint8))

    @staticmethod
    def repair_horizontal(frame, mask):
        """Continue adjacent contours through glyphs without smearing rail edges."""
        result = frame.copy()
        columns = np.arange(frame.shape[1])
        for row in np.flatnonzero(mask.any(axis=1)):
            missing = mask[row] > 0
            known = ~missing
            if not known.any():
                continue
            for channel in range(3):
                result[row, missing, channel] = np.interp(
                    columns[missing], columns[known], frame[row, known, channel])
        return result

    def clean(self, frame, time):
        mask = self.static.copy()
        if time < .7:
            mask |= self.stencil(frame, [(45, 36, 320, 120), (2230, 36, 655, 150)], 145)
        if time < 5.2:
            mask |= self.copy
        result = self.repair_horizontal(frame, mask)
        if time < 5.2:
            # These labels cross a near-vertical portal edge as the camera
            # approaches. Continue that edge vertically, not across its silhouette.
            result = self.repair_horizontal(result.transpose(1, 0, 2), self.labels.T).transpose(1, 0, 2).copy()
            mask |= self.labels
        if time < 5.2:
            x, y, w, h = self.heading
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).astype(np.float32)
            search = gray[y-75:y+h+5, x:x+w]
            search = search - cv2.GaussianBlur(search, (0, 0), 12)
            _, score, _, location = cv2.minMaxLoc(cv2.matchTemplate(search, self.template, cv2.TM_CCOEFF_NORMED))
            dy = location[1] - 75
            alpha = np.clip((search[location[1]:location[1]+h] * self.template).sum() / self.template_energy, 0, 1)
            if score > .08:
                heading_mask = np.zeros(self.shape, np.uint8)
                heading_mask[y+dy:y+dy+h, x:x+w] = self.glyph
                edge_line = None
                if time > 3:
                    # Fit the straight outer edge across many rows, ignoring
                    # the final title letters that briefly overlap that edge.
                    rows = gray[y+dy:y+dy+h, 900:2100]
                    smooth = cv2.GaussianBlur(rows, (51, 1), 0)
                    candidates = np.argmin(smooth[:, 40:] - smooth[:, :-40], axis=1) + 920
                    positions = np.arange(h)
                    valid = (candidates > 1100) & (candidates < 1800)
                    if valid.sum() < 30:
                        valid = np.ones(h, dtype=bool)
                    fit = np.polyfit(positions[valid], candidates[valid], 1)
                    for _ in range(3):
                        edge_line = np.polyval(fit, positions)
                        next_valid = valid & (abs(candidates-edge_line) < 35)
                        if next_valid.sum() < 30:
                            break
                        valid = next_valid
                        fit = np.polyfit(positions[valid], candidates[valid], 1)
                    edge_line = np.polyval(fit, positions)
                    coverage = self.matte[..., None] * min(.7, alpha)
                    source = frame[y+dy:y+dy+h, x:x+w].astype(np.float32)
                    restored = np.clip((source-coverage*self.ink) / (1-coverage), 0, 255).astype(np.uint8)
                    for row, edge in enumerate(edge_line):
                        cut = max(0, min(w, round(edge)-x-16))
                        heading_mask[y+dy+row, x+cut:x+w] = 0
                        result[y+dy+row, x+cut:x+w] = restored[row, cut:]
                result = self.repair_horizontal(result, heading_mask)
                mask |= heading_mask
        return result[36:1636, :2912], mask[36:1636, :2912]
