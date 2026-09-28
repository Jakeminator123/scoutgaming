#!/usr/bin/env python3
"""
LICENSFRI ERSATTNING for MuseTalks DWPose-beroende (2026-08-22).

Varfor: MuseTalk-koden ar MIT, men avatarforberedelsen anvander DWPose
(CC BY-NC-SA = ICKE-kommersiell) for ansiktslandmarken, och S3FD vars licens
ar oklar. Bada gor det befintliga biblioteket olampligt for en kommersiell
produkt. Den har modulen ersatter dem med **MediaPipe Face Mesh (Apache 2.0)**
som gor bade ansiktsdetektion och landmarken i ett steg - alltsa forsvinner
BADA licensfragorna.

Bonus: mmpose/mmcv/mmdet/chumpy behovs inte langre, vilket tar bort hela den
beroendekedja som kravde en egen venv med aldre torch.

API:t ar identiskt med musetalk.utils.preprocessing.get_landmark_and_bbox, sa
det racker att byta import i scripts/realtime_inference.py:

    # from musetalk.utils.preprocessing import get_landmark_and_bbox
    from preprocessing_mp import get_landmark_and_bbox

Bbox-logiken ar ordagrant densamma som MuseTalks (nasan som referens, halva
ansiktshojden uppat) sa att resultatet blir jamforbart med tidigare klipp.
"""
import numpy as np
import cv2
import mediapipe as mp

# MediaPipe Face Mesh (478 punkter) -> iBUG-68, standardmappning.
# MuseTalk vantar sig 68 punkter i den har ordningen: kaklinje 0-16,
# ogonbryn 17-26, nasa 27-35, ogon 36-47, mun 48-67.
MP_TO_IBUG68 = [
    162, 234, 93, 58, 172, 136, 149, 148, 152, 377, 378, 365, 397, 288, 323, 454, 389,  # kaklinje
    71, 63, 105, 66, 107,                    # hoger ogonbryn
    336, 296, 334, 293, 301,                 # vanster ogonbryn
    168, 197, 5, 4,                          # nasrygg (index 30 = nastippen)
    75, 97, 2, 326, 305,                     # nasvingar
    33, 160, 158, 133, 153, 144,             # hoger oga
    362, 385, 387, 263, 373, 380,            # vanster oga
    61, 39, 37, 0, 267, 269, 291, 405, 314, 17, 84, 181,   # ytterlapp
    78, 82, 13, 312, 308, 317, 14, 87,       # innerlapp
]

COORD_PLACEHOLDER = (0.0, 0.0, 0.0, 0.0)


MODEL_PATH = "/workspace/MuseTalk/models/mediapipe/face_landmarker.task"


class _Mesh:
    """Laddas en gang. MediaPipe Tasks (1.x-API) kor pa CPU, ~10 ms/bildruta."""
    _inst = None

    @classmethod
    def get(cls):
        if cls._inst is None:
            from mediapipe.tasks import python as mp_python
            from mediapipe.tasks.python import vision
            cls._inst = vision.FaceLandmarker.create_from_options(
                vision.FaceLandmarkerOptions(
                    base_options=mp_python.BaseOptions(model_asset_path=MODEL_PATH),
                    num_faces=1,
                    running_mode=vision.RunningMode.IMAGE,
                )
            )
        return cls._inst


def _detect(img_bgr):
    """rakt anrop mot MediaPipe; returnerar 478 normaliserade punkter eller None"""
    h, w = img_bgr.shape[:2]
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
    res = _Mesh.get().detect(image)
    if not res.face_landmarks:
        return None
    pts = res.face_landmarks[0]
    return np.array([[pts[i].x * w, pts[i].y * h] for i in MP_TO_IBUG68], dtype=np.float32)


def landmarks68(img_bgr):
    """
    68 iBUG-punkter i HELBILDENS pixelkoordinater, eller None.

    MediaPipes detektor skalar ned indata till en kvadrat, sa i vart avlanga
    mobilformat (928x1664) blir ansiktet for litet och missas. Darfor provas
    helbilden forst och sedan allt kvadratiskare utsnitt av overdelen, dar
    dealerns ansikte alltid finns. Offset laggs tillbaka sa att koordinaterna
    alltid galler originalbilden.
    """
    h, w = img_bgr.shape[:2]
    windows = [(0, 0, w, h)]
    if h > w * 1.2:                       # portratt: prova overdelen
        for frac in (0.75, 0.5, 0.35):
            windows.append((0, 0, w, int(h * frac)))
    for x0, y0, x1, y1 in windows:
        lm = _detect(img_bgr[y0:y1, x0:x1])
        if lm is not None:
            lm[:, 0] += x0
            lm[:, 1] += y0
            if h > w * 1.2:
                lm = _refine(img_bgr, lm)
            return lm
    return None


def _refine(img_bgr, lm):
    """
    Andra pass for portratt: i helbilden (1080x1920-spelbilden i 2x) ar ansiktet
    sa litet att forsta traffen ger grova punkter (hakan ~20 px fel i 2x). Ett
    kvadratiskt utsnitt runt ansiktet, 3x dess bredd, ger stabila punkter —
    uppmatt 2026-09-24: utsnitt 520-1600 px ger samma bbox inom 3 px.
    """
    h, w = img_bgr.shape[:2]
    cx, cy = lm[:, 0].mean(), lm[:, 1].mean()
    s = int(min(3 * (lm[:, 0].max() - lm[:, 0].min()), w, h))
    x0 = int(np.clip(cx - s / 2, 0, w - s))
    y0 = int(np.clip(cy - s / 2, 0, h - s))
    fine = _detect(img_bgr[y0:y0 + s, x0:x0 + s])
    if fine is None:
        return lm
    fine[:, 0] += x0
    fine[:, 1] += y0
    return fine


def bbox_from_landmarks(face_land_mark, img_h, upperbondrange=0):
    """
    MuseTalks egen bbox-logik, ordagrant overford:
      - nasan (punkt 29) ar referens
      - ansiktets underkant minus nasan ger 'halva ansiktshojden'
      - overkanten laggs lika langt ovanfor nasan
    upperbondrange flyttar overkanten (samma parameter som i MuseTalk).
    """
    half_face_coord = face_land_mark[29].copy()
    if upperbondrange != 0:
        half_face_coord[1] = half_face_coord[1] + upperbondrange
    half_face_dist = np.max(face_land_mark[:, 1]) - half_face_coord[1]
    upper_bond = half_face_coord[1] - half_face_dist
    return (
        int(np.min(face_land_mark[:, 0])),
        int(max(upper_bond, 0)),
        int(np.max(face_land_mark[:, 0])),
        int(min(np.max(face_land_mark[:, 1]), img_h)),
    )


def get_landmark_and_bbox(img_list, upperbondrange=0):
    """
    Samma signatur och returvarden som MuseTalks funktion:
      coords_list : [(x1, y1, x2, y2), ...] per bildruta
      frames      : [BGR-bild, ...]
    Bildrutor utan ansikte far COORD_PLACEHOLDER, precis som originalet.
    """
    coords_list, frames = [], []
    for img in img_list:
        frame = cv2.imread(img) if isinstance(img, str) else img
        frames.append(frame)
        lm = landmarks68(frame)
        if lm is None:
            coords_list.append(COORD_PLACEHOLDER)
            continue
        bbox = bbox_from_landmarks(lm, frame.shape[0], upperbondrange)
        if bbox[2] - bbox[0] <= 0 or bbox[3] - bbox[1] <= 0:
            coords_list.append(COORD_PLACEHOLDER)
        else:
            coords_list.append(bbox)
    return coords_list, frames


if __name__ == "__main__":
    import sys
    cap = cv2.VideoCapture(sys.argv[1])
    ok, frame = cap.read()
    cap.release()
    assert ok, "kunde inte lasa videon"
    lm = landmarks68(frame)
    print("ansikte hittat:", lm is not None)
    if lm is not None:
        print("bbox:", bbox_from_landmarks(lm, frame.shape[0]))
