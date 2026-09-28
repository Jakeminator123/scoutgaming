"""Read endpoint health without submitting a job or changing worker settings."""
import argparse
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path)
    parser.add_argument('--list', action='store_true', help='List endpoint metadata, never environment variables')
    args = parser.parse_args()
    values = {}
    if args.env_file:
        for line in args.env_file.read_text(encoding='utf-8-sig').splitlines():
            match = re.match(r'^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$', line)
            if match:
                values[match[1]] = match[2].strip('\"\'')
    values.update(os.environ)
    key = values.get('RUNPOD_API_KEY')
    if args.list:
        if not key:
            raise SystemExit('Missing RUNPOD_API_KEY; no request sent.')
        request = urllib.request.Request('https://rest.runpod.io/v1/endpoints',
            headers={'Authorization': f'Bearer {key}', 'Accept': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                endpoints = json.load(response)
        except urllib.error.HTTPError as error:
            raise SystemExit(f'RunPod endpoint list HTTP {error.code}; no job submitted.') from None
        except (urllib.error.URLError, TimeoutError):
            raise SystemExit('RunPod endpoint list unavailable; no job submitted.') from None
        if not isinstance(endpoints, list):
            raise SystemExit('Unexpected endpoint list response; no response body displayed.')
        fields = ('id', 'name', 'workersMin', 'workersMax', 'gpuTypeIds', 'dataCenterIds')
        print(json.dumps({'readOnly': True, 'endpoints': [
            {field: endpoint.get(field) for field in fields} for endpoint in endpoints
        ]}, indent=2))
        return
    endpoint = values.get('CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID') or values.get('RUNPOD_ENDPOINT_ID')
    # Older demo configuration stores the full runsync URL in this variable.
    url_match = re.fullmatch(r'https://api\.runpod\.ai/v2/([A-Za-z0-9_-]{1,100})(?:/(?:run|runsync))?/?', endpoint or '')
    if url_match:
        endpoint = url_match[1]
    if not key or not endpoint or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', endpoint):
        raise SystemExit('Missing RUNPOD_API_KEY or valid endpoint id; no request sent.')
    request = urllib.request.Request(
        f'https://api.runpod.ai/v2/{endpoint}/health',
        headers={'Authorization': f'Bearer {key}', 'Accept': 'application/json'},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit(f'RunPod health HTTP {error.code}; no job submitted.') from None
    except (urllib.error.URLError, TimeoutError):
        raise SystemExit('RunPod health unavailable; no job submitted.') from None
    print(json.dumps({'endpoint': endpoint, 'jobs': data.get('jobs'),
                      'workers': data.get('workers'), 'readOnly': True}, indent=2))


if __name__ == '__main__':
    main()
