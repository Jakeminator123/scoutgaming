"""Resolve only the recorded Linux CPython 3.12 versions to immutable wheel hashes.

This reads public package metadata, never installs packages or starts GPU jobs.
Run explicitly when recreating the lock; ordinary builds consume wheels.lock.
"""
import concurrent.futures
import hashlib
import html.parser
import json
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request
from pip._vendor.packaging.tags import cpython_tags, compatible_tags
from pip._vendor.packaging.utils import parse_wheel_filename

ROOT = Path(__file__).resolve().parent
PLATFORMS = [f"manylinux_2_{v}_x86_64" for v in range(39, 16, -1)]
PLATFORMS += ["manylinux2014_x86_64", "manylinux2010_x86_64", "manylinux1_x86_64", "linux_x86_64"]
TAGS = list(cpython_tags((3, 12), ["cp312"], PLATFORMS))
TAGS += list(compatible_tags((3, 12), "cp312", PLATFORMS))
RANK = {tag: index for index, tag in enumerate(TAGS)}


def fetch(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read()


class Links(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.links.extend(value for key, value in attrs if key == "href")


def resolve(line):
    name, version = line.split("==")
    if name in ("torch", "torchaudio", "torchvision"):
        page = Links()
        page.feed(fetch("https://download.pytorch.org/whl/cu128/" + name + "/").decode())
        candidates = []
        for link in page.links:
            parsed = urllib.parse.urlsplit(link)
            filename = urllib.parse.unquote(parsed.path.rsplit("/", 1)[-1])
            if filename.endswith(".whl"):
                checksum = urllib.parse.parse_qs(parsed.fragment).get("sha256", [""])[0]
                candidates.append((filename, link.split("#")[0], checksum))
    else:
        metadata = json.loads(fetch("https://pypi.org/pypi/" + name + "/" + version + "/json"))
        candidates = [(item["filename"], item["url"], item["digests"]["sha256"])
                      for item in metadata["urls"] if item["packagetype"] == "bdist_wheel" and not item["yanked"]]
    compatible = []
    for filename, url, checksum in candidates:
        try:
            _, wheel_version, _, tags = parse_wheel_filename(filename)
        except ValueError:
            continue
        matching = [RANK[tag] for tag in tags if tag in RANK]
        if str(wheel_version) == version and matching and re.fullmatch(r"[a-f0-9]{64}", checksum):
            compatible.append((min(matching), filename, url, checksum))
    if not compatible:
        raise ValueError("No pinned Linux CPython 3.12 wheel for " + line)
    _, _, url, checksum = min(compatible)
    return name + " @ " + url + " --hash=sha256:" + checksum


def main():
    lines = [line.strip() for line in (ROOT / (sys.argv[1] if len(sys.argv)>1 else "requirements.lock")).read_text().splitlines() if line.strip()]
    if any(not re.fullmatch(r"[A-Za-z0-9_.-]+==[A-Za-z0-9_.+-]+", line) for line in lines):
        raise ValueError("Unpinned requirement")
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        resolved = list(executor.map(resolve, lines))
    target = ROOT / (sys.argv[2] if len(sys.argv)>2 else "wheels.lock")
    target.write_text("\n".join(resolved) + "\n", encoding="utf-8")
    print(json.dumps({"wheels": len(resolved), "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}))


if __name__ == "__main__":
    main()
