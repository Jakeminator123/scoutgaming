"""Repeatable chronological bridge inspection; no live media mutation."""
from pathlib import Path
root=Path(__file__).resolve().parent
source=(root/'review-clean.py').read_text()
for pose in (3,47):
    script=source.replace("'clean-source.mp4'",f"'bridge-{pose}.mp4'").replace("'clean-review-frames'",f"'bridge-{pose}-review-frames'").replace("'clean-motion-sheet.jpg'",f"'bridge-{pose}-sheet.jpg'").replace("'clean-review.json'",f"'bridge-{pose}-review.json'")
    exec(compile(script,'bridge-review','exec'),{'__file__':str(root/'review-clean.py')})
