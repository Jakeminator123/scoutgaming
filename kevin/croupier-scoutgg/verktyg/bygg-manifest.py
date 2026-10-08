#!/usr/bin/env python3
"""Bygger public/media/manifest.json ur klippen i public/media/ — det webbsidan och kundens spel läser.

    python verktyg/bygg-manifest.py

Körs om när klipp läggs till eller byts. Kräver ffprobe i PATH (för längderna).
"""
import json, os, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, "public", "media")

# Vilken spelhändelse som spelar vilken replik (kundens web/public/app.mjs på main, 2026-09-24)
EVENT = {
    "greeting": "spelaren kommer in", "placebets": "ny runda, insatser öppna", "goodluck": "insatserna stängs",
    "sidebet": "en sidobet vinner", "insurance": "försäkring erbjuds", "double": "spelaren dubblar",
    "bust": "spelarens hand över 21", "blackjack": "spelaren får blackjack och vinner",
    "dealerblackjack": "dealern har blackjack", "dealerbust": "dealern över 21", "win": "spelare vinner",
    "push": "oavgjort", "lose": "spelaren förlorar", "peek": None, "farewell": None, "chatter1": None, "chatter2": None,
}
# Hur ofta varje idle-variant väljs när inget annat spelas (relativ vikt)
# blink passar inte som idle och ligger inte i loopen (Emil 2026-09-25)
IDLE_WEIGHT = {"still": 40, "breath": 14, "glance": 12, "cheek": 3, "insulted": 1}
IDLE_TEXT = {"still": "stilla, andas", "blink": "blinkar", "breath": "djupare andetag", "glance": "blicken åt sidan",
             "cheek": "handen till kinden", "insulted": "kort förnärmad min"}
DEAL_TEXT = {**{f"pos{i}": f"kort till spelare {i}" for i in range(1, 8)}, "posdealer": "dealerns eget kort", "hole": "dealerns dolda kort, baksidan upp", "flip": "dealern vänder sitt dolda kort"}
DEAL_SPOT = {"hole": "dealer", "flip": "dealer"}


def dur(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                         capture_output=True, text=True).stdout.strip()
    return round(float(out), 2)


bank = json.load(open(os.path.join(MEDIA, "repliker", "bank.json"), encoding="utf-8"))
pos = json.load(open(os.path.join(MEDIA, "deal", "kortpositioner.json"), encoding="utf-8"))

manifest = {
    "startbild": "/media/startbild.png",
    "format": "1080x1920, 24 fps, H.264 BT.709 — alla klipp börjar och slutar exakt i startbilden",
    "rost": {"leverantor": "Cartesia sonic-3.5", "namn": "Freja – Informative Host (svensk brytning)",
             "id": "bcdcad6d-4eb6-4a71-89fd-1ae2ce9f95d8"},
    "idle": [{"id": k, "url": f"/media/idle/{k}.mp4", "vikt": w, "beskrivning": IDLE_TEXT[k],
              "dur": dur(os.path.join(MEDIA, "idle", f"{k}.mp4"))}
             for k, w in IDLE_WEIGHT.items() if os.path.exists(os.path.join(MEDIA, "idle", f"{k}.mp4"))],
    # repliker: en eller flera varianter per spelhändelse. bank.json = {"<id>": {"text", "event"?}} — utan "event" är id:t händelsen.
    "repliker": [{"id": k, "event": v.get("event", k), "url": f"/media/repliker/{k}.mp4", "text": v["text"],
                  "handelse": EVENT.get(v.get("event", k)), "dur": dur(os.path.join(MEDIA, "repliker", f"{k}.mp4"))}
                 for k, v in bank.items()],
    "deal": [{"id": f"deal_{k}", "url": f"/media/deal/{k}.mp4", "beskrivning": DEAL_TEXT[k],
              "kort": pos["positioner"].get(DEAL_SPOT.get(k, k.replace("pos", "")), pos.get("dealer")),
              "dur": dur(os.path.join(MEDIA, "deal", f"{k}.mp4"))}
             for k in DEAL_TEXT if os.path.exists(os.path.join(MEDIA, "deal", f"{k}.mp4"))],
    "kort_storlek": {"bredd": pos.get("kort_bredd"), "hojd": pos.get("kort_hojd")},
}
# händelse → varianter (spelet slumpar bland dem)
manifest["handelser"] = {}
for r in manifest["repliker"]:
    manifest["handelser"].setdefault(r["event"], {"handelse": r["handelse"], "varianter": []})["varianter"].append(r["id"])
json.dump(manifest, open(os.path.join(MEDIA, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"manifest: {len(manifest['idle'])} idle, {len(manifest['repliker'])} repliker i {len(manifest['handelser'])} händelser, {len(manifest['deal'])} deal")
