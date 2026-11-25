"""Publish immutable language files without advancing update-log pointers.

Each mirror uses one non-force ref update. Existing files (including old language
versions and notes) are retained. An interrupted publication is safe to retry.
"""
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import hashlib
import base64

spec = importlib.util.spec_from_file_location('mirrors', Path(__file__).with_name('publish-update-mirrors.py'))
mirrors = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirrors)


def publish(root, remote, branch, token=None):
    manifest = json.loads((root / 'manifest.json').read_text())
    if manifest.get('environment') != 'release':
        raise ValueError('Only release language resources may be published')
    version = manifest['version']
    if len(version) != 64 or any(c not in '0123456789abcdef' for c in version):
        raise ValueError('Invalid language version')
    env = os.environ.copy()
    env['GIT_TERMINAL_PROMPT'] = '0'
    if token:
        username = 'x-access-token' if 'github.com/' in remote else 'oauth2'
        credentials = base64.b64encode((username + ':' + token).encode()).decode()
        env.update(GIT_CONFIG_COUNT='1', GIT_CONFIG_KEY_0='http.extraHeader',
                   GIT_CONFIG_VALUE_0='Authorization: Basic ' + credentials)
    with tempfile.TemporaryDirectory(prefix='windy-languages-') as temporary:
        target = Path(temporary)
        mirrors.git(target, 'init', '-q')
        mirrors.git(target, 'fetch', '--depth=1', remote, 'refs/heads/' + branch, env=env)
        mirrors.git(target, 'checkout', '-q', '-b', branch, 'FETCH_HEAD')
        for code, checksum in manifest['hashes'].items():
            if not code.replace('-', '').isalpha():
                raise ValueError('Invalid language code')
            relative = Path('languages') / 'release' / version / (code + '.json')
            data = (root / relative).read_bytes()
            if hashlib.sha256(data).hexdigest() != checksum:
                raise ValueError('Invalid language hash')
            destination = target / relative
            if destination.exists() and destination.read_bytes() != data:
                raise RuntimeError('Refusing to rewrite immutable language')
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
        mirrors.git(target, 'add', 'languages/release/' + version)
        if not mirrors.git(target, 'diff', '--cached', '--name-only'):
            return
        mirrors.git(target, '-c', 'user.name=bytepoem', '-c', 'user.email=bytepoem@users.noreply.github.com',
                    'commit', '-q', '-m', 'feat: 发布不可变语言资源 ' + version[:12])
        mirrors.git(target, 'push', remote, 'HEAD:refs/heads/' + branch, env=env)


if __name__ == '__main__':
    root = Path(sys.argv[1]).resolve()
    publish(root, 'https://gitee.com/bytepoem/windy-plugin.git', 'master', os.environ['GITEE_TOKEN'])
    publish(root, 'https://github.com/bytepoem/windy-plugin-sun-moon-path.git', 'update-metadata', os.environ['GITHUB_TOKEN'])
