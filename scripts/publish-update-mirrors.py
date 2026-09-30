"""Publish JSON snapshots with one atomic Git ref update per mirror after Windy succeeds."""
import base64
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.request
from urllib.parse import urlparse


def git(directory, *args, env=None):
    result = subprocess.run(['git', *args], cwd=directory, env=env, capture_output=True, text=True)
    if result.returncode:
        # Do not expose credential-bearing environment or server error payloads.
        raise RuntimeError('Git mirror operation failed: ' + args[0])
    return result.stdout.strip()


def version_key(value):
    if not re.fullmatch(r'\d+\.\d+\.\d+', value):
        raise ValueError('Invalid formal version')
    return tuple(map(int, value.split('.')))


def validate_snapshot(root):
    manifest = json.loads((root / 'latest.json').read_text())
    version_key(manifest['version'])
    if manifest['notesUrl'] != './' + manifest['version'] + '/notes.json':
        raise RuntimeError('Invalid snapshot pointer')
    snapshot = root / manifest['version'] / 'notes.json'
    if not snapshot.is_file():
        raise RuntimeError('Missing current snapshot')
    return manifest


def publish(root, remote, branch, token=None):
    latest = validate_snapshot(root)
    env = os.environ.copy()
    env['GIT_TERMINAL_PROMPT'] = '0'
    if token:
        username = 'x-access-token' if urlparse(remote).hostname == 'github.com' else 'oauth2'
        credentials = base64.b64encode((username + ':' + token).encode()).decode()
        env.update(GIT_CONFIG_COUNT='1', GIT_CONFIG_KEY_0='http.extraHeader',
                   GIT_CONFIG_VALUE_0='Authorization: Basic ' + credentials)
    with tempfile.TemporaryDirectory(prefix='windy-mirror-') as temporary:
        target = Path(temporary)
        git(target, 'init', '-q')
        refs = git(target, 'ls-remote', remote, 'refs/heads/' + branch, env=env)
        if refs:
            git(target, 'fetch', '--depth=1', remote, 'refs/heads/' + branch, env=env)
            git(target, 'checkout', '-q', '-b', branch, 'FETCH_HEAD')
            live = validate_snapshot(target)
            if version_key(latest['version']) < version_key(live['version']):
                raise RuntimeError('Refusing to downgrade mirror')
            # Every published snapshot must survive with identical JSON content.
            for old in target.glob('*/notes.json'):
                new = root / old.relative_to(target)
                if not new.is_file() or json.loads(old.read_text()) != json.loads(new.read_text()):
                    raise RuntimeError('Refusing to rewrite or remove snapshot: ' + old.parent.name)
        else:
            git(target, 'checkout', '-q', '--orphan', branch)
        for source in [root / 'latest.json', *sorted(root.glob('*/notes.json'))]:
            destination = target / source.relative_to(root)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(source.read_bytes())
        git(target, 'add', 'latest.json', '*/notes.json')
        if not git(target, 'diff', '--cached', '--name-only'):
            print(branch + ': already current')
            return
        git(target, '-c', 'user.name=bytepoem', '-c', 'user.email=bytepoem@users.noreply.github.com',
            'commit', '-q', '-m', 'docs: 同步 ' + latest['version'] + ' 更新日志')
        # No force push: a concurrent publisher fails instead of overwriting a newer state.
        git(target, 'push', remote, 'HEAD:refs/heads/' + branch, env=env)
        print(branch + ': published ' + latest['version'])


def main():
    root = Path(sys.argv[1]).resolve()
    manifest = validate_snapshot(root)
    expected = 'https://windy-plugins.com/17629746/windy-plugin-sun-moon-path/' + manifest['version'] + '/plugin.min.js'
    if manifest.get('pluginUrl') != expected:
        raise RuntimeError('Unexpected plugin URL')
    with urllib.request.urlopen(expected, timeout=30) as response:
        if response.status != 200 or not response.read(1):
            raise RuntimeError('Windy bundle is unavailable')
    publish(root, 'https://gitee.com/bytepoem/windy-plugin.git', 'master', os.environ['GITEE_TOKEN'])
    publish(root, 'https://github.com/bytepoem/windy-plugin-sun-moon-path.git', 'update-metadata', os.environ['GITHUB_TOKEN'])


if __name__ == '__main__':
    main()
