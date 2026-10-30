import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

// Arguments: saved plugin.min.js, exported diagnostic report JSON.
// Resolve only artifacts proven to belong to that exact build; never rebuild an old version.
const [bundlePath, reportPath] = process.argv.slice(2);
if (!bundlePath || !reportPath) {
    throw new Error('Usage: node scripts/resolve-diagnostic-stack.mjs <plugin.min.js> <report.json>');
}
const manifest = JSON.parse(readFileSync(`${bundlePath}.build.json`, 'utf8'));
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
if (manifest.id !== report.build?.id) { throw new Error('Diagnostic build ID does not match the saved bundle'); }
for (const [name, expected] of Object.entries(manifest.sha256)) {
    const actual = createHash('sha256').update(readFileSync(resolve(dirname(bundlePath), name))).digest('hex');
    if (actual !== expected) { throw new Error(`Artifact hash mismatch: ${name}`); }
}
const map = new TraceMap(JSON.parse(readFileSync(`${bundlePath}.map`, 'utf8')));
const result = report.errors.map(item => ({
    stage: item.stage,
    name: item.error.name,
    message: item.error.message,
    frames: item.error.frames.map(frame => {
        const match = /^(plugin(?:\.min)?\.js):(\d+):(\d+)$/.exec(frame);
        if (!match || !bundlePath.endsWith(match[1])) { return { generated: frame, source: null }; }
        return { generated: frame, ...originalPositionFor(map, { line: Number(match[2]), column: Number(match[3]) - 1 }) };
    }),
}));
console.log(JSON.stringify(result, null, 2));
