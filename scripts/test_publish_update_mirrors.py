"""Verify immutable snapshots and atomic mirror updates using local Git repositories."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('mirrors', Path(__file__).with_name('publish-update-mirrors.py'))
mirrors = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirrors)


class MirrorTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.remote = self.root / 'remote.git'
        subprocess.run(['git', 'init', '--bare', '-q', str(self.remote)], check=True)
        self.site = self.root / 'site'
        self.site.mkdir()
        self.write_version('0.11.0')

    def write_version(self, version):
        (self.site / version).mkdir(exist_ok=True)
        (self.site / version / 'notes.json').write_text(json.dumps({'version': version}))
        (self.site / 'latest.json').write_text(json.dumps({'version': version, 'notesUrl': './' + version + '/notes.json'}))

    def publish(self):
        mirrors.publish(self.site, str(self.remote), 'updates')

    def head(self):
        return mirrors.git(self.remote, 'rev-parse', 'refs/heads/updates')

    def test_create_upgrade_and_idempotent_retry(self):
        self.publish()
        first = self.head()
        self.publish()
        self.assertEqual(first, self.head())
        self.write_version('0.11.1')
        self.publish()
        self.assertNotEqual(first, self.head())
        old = mirrors.git(self.remote, 'show', 'refs/heads/updates:0.11.0/notes.json')
        self.assertEqual(json.loads(old), {'version': '0.11.0'})

    def test_rewrite_and_removal_rejected_without_remote_change(self):
        self.publish()
        before = self.head()
        self.write_version('0.11.1')
        old = self.site / '0.11.0/notes.json'
        old.write_text('{}')
        with self.assertRaisesRegex(RuntimeError, 'rewrite or remove'):
            self.publish()
        old.unlink()
        with self.assertRaisesRegex(RuntimeError, 'rewrite or remove'):
            self.publish()
        self.assertEqual(before, self.head())

    def test_downgrade_rejected(self):
        self.write_version('0.11.1')
        self.publish()
        before = self.head()
        self.write_version('0.11.0')
        with self.assertRaisesRegex(RuntimeError, 'downgrade'):
            self.publish()
        self.assertEqual(before, self.head())


if __name__ == '__main__':
    unittest.main()
