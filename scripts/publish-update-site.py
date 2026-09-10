"""Atomically deploy validated static files after Windy succeeds; never log credentials."""
import io
import json
import os
from pathlib import Path
import sys
import time
import urllib.request
import zipfile

SITE = 'bytepoem-windy-updates.netlify.app'
API = 'https://api.netlify.com/api/v1'

def request(url, token=None, data=None, content_type=None):
    headers = {'Authorization': 'Bearer ' + token} if token else {}
    if content_type:
        headers['Content-Type'] = content_type
    with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers), timeout=30) as response:
        return response.read()

def main():
    root = Path(sys.argv[1])
    token = os.environ['NETLIFY_AUTH_TOKEN']
    latest = json.loads((root / 'latest.json').read_text())
    live = json.loads(request('https://' + SITE + '/latest.json'))
    version_key = lambda value: tuple(map(int, value.split('.')))
    if version_key(latest['version']) < version_key(live['version']):
        raise RuntimeError('Refusing to replace a newer published version')
    # An older cached manifest must still find its exact snapshot after atomic replacement.
    for path in root.glob('*/notes.json'):
        if version_key(path.parent.name) <= version_key(live['version']):
            remote = json.loads(request('https://' + SITE + '/' + path.relative_to(root).as_posix()))
            if remote != json.loads(path.read_text()):
                raise RuntimeError('Refusing to rewrite published snapshot: ' + path.parent.name)
    if not (root / live['version'] / 'notes.json').is_file():
        raise RuntimeError('Missing currently published snapshot')
    request(latest['pluginUrl'])  # Do not announce an unavailable Windy release.
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted(root.rglob('*')):
            if path.is_file():
                bundle.write(path, path.relative_to(root).as_posix())
    deploy = json.loads(request(API + '/sites/' + SITE + '/deploys', token, archive.getvalue(), 'application/zip'))
    for _ in range(60):
        state = json.loads(request(API + '/deploys/' + deploy['id'], token))
        if state['state'] == 'ready':
            print('Netlify deploy ready:', deploy['id'])
            return
        if state['state'] == 'error':
            raise RuntimeError('Netlify deployment failed')
        time.sleep(2)
    raise RuntimeError('Deployment state uncertain; inspect Netlify before retrying')

if __name__ == '__main__':
    main()
