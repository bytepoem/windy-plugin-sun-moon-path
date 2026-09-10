"""Exercise publish ordering and guards without credentials or external writes."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('publisher', Path(__file__).with_name('publish-update-site.py'))
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)

class PublishTests(unittest.TestCase):
    def run_case(self, live_version='0.10.3', changed=False, windy_fails=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '0.10.3').mkdir()
            snapshot = {'version': '0.10.3', 'seriesNotes': []}
            (root / '0.10.3/notes.json').write_text(json.dumps(snapshot))
            (root / 'latest.json').write_text(json.dumps({'version': '0.10.3', 'pluginUrl': 'https://windy.example/plugin.js'}))
            calls = []
            def request(url, token=None, data=None, content_type=None):
                calls.append((url, data is not None))
                if url.endswith('/latest.json'):
                    return json.dumps({'version': live_version}).encode()
                if url.endswith('/notes.json'):
                    return json.dumps({'bad': True} if changed else snapshot).encode()
                if url == 'https://windy.example/plugin.js':
                    if windy_fails:
                        raise RuntimeError('Windy unavailable')
                    return b'plugin'
                if data is not None:
                    return b'{"id":"test-deploy"}'
                return b'{"state":"ready"}'
            with patch.object(publisher, 'request', side_effect=request), patch.dict('os.environ', {'NETLIFY_AUTH_TOKEN':'test-only'}), patch('sys.argv', ['publish', directory]):
                if live_version != '0.10.3' or changed or windy_fails:
                    with self.assertRaises(RuntimeError):
                        publisher.main()
                    self.assertFalse(any(write for _, write in calls))
                else:
                    publisher.main()
                    write_index = next(i for i, (_, write) in enumerate(calls) if write)
                    self.assertEqual(calls[write_index - 1][0], 'https://windy.example/plugin.js')
    def test_downgrade_is_rejected(self):
        self.run_case(live_version='0.10.4')
    def test_snapshot_rewrite_is_rejected(self):
        self.run_case(changed=True)
    def test_windy_failure_never_publishes(self):
        self.run_case(windy_fails=True)
    def test_success_publishes_only_after_checks(self):
        self.run_case()

if __name__ == '__main__':
    unittest.main()
