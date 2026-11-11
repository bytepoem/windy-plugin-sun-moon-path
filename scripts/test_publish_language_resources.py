"""Exercise language publication against a local remote without external writes."""
import importlib.util
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import sys

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('languages', Path(__file__).with_name('publish-language-resources.py'))
languages = importlib.util.module_from_spec(spec)
spec.loader.exec_module(languages)


class LanguagePublishTests(unittest.TestCase):
    def test_retry_retains_old_resources_and_update_pointer_and_rejects_rewrite(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            remote = root / 'remote.git'
            work = root / 'work'
            work.mkdir()
            subprocess.run(['git', 'init', '--bare', '-q', str(remote)], check=True)
            languages.mirrors.git(work, 'init', '-q')
            (work / 'latest.json').write_text('existing update pointer')
            (work / 'languages' / 'old').mkdir(parents=True)
            (work / 'languages' / 'old' / 'fr.json').write_text('old bytes')
            languages.mirrors.git(work, 'add', '.')
            languages.mirrors.git(work, '-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'seed')
            languages.mirrors.git(work, 'push', str(remote), 'HEAD:refs/heads/updates')
            site = root / 'site'
            version = 'a' * 64
            directory = site / 'languages' / 'release' / version
            directory.mkdir(parents=True)
            data = b'{"language":"fr"}\n'
            (directory / 'fr.json').write_bytes(data)
            manifest = {'environment': 'release', 'version': version, 'hashes': {'fr': hashlib.sha256(data).hexdigest()}}
            (site / 'manifest.json').write_text(json.dumps(manifest))
            languages.publish(site, str(remote), 'updates')
            head = languages.mirrors.git(remote, 'rev-parse', 'updates')
            languages.publish(site, str(remote), 'updates')
            self.assertEqual(head, languages.mirrors.git(remote, 'rev-parse', 'updates'))

            self.assertEqual(languages.mirrors.git(remote, 'show', 'updates:latest.json'), 'existing update pointer')
            self.assertEqual(languages.mirrors.git(remote, 'show', 'updates:languages/old/fr.json'), 'old bytes')
            data = b'changed bytes'
            (directory / 'fr.json').write_bytes(data)
            manifest['hashes']['fr'] = hashlib.sha256(data).hexdigest()
            (site / 'manifest.json').write_text(json.dumps(manifest))
            with self.assertRaisesRegex(RuntimeError, 'rewrite'):
                languages.publish(site, str(remote), 'updates')
            self.assertEqual(head, languages.mirrors.git(remote, 'rev-parse', 'updates'))

    def test_local_resources_are_rejected_before_connecting_to_a_remote(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'manifest.json').write_text(json.dumps({'environment': 'local'}))
            with self.assertRaisesRegex(ValueError, 'Only release'):
                languages.publish(root, 'invalid-remote-that-must-not-be-contacted', 'updates')


if __name__ == '__main__':
    unittest.main()
