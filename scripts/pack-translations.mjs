// Preserve the existing validation command while validating external resources.
import { execFileSync } from 'node:child_process';
process.stdout.write(execFileSync(process.execPath, ['scripts/language-resources.mjs', '--check'], { encoding: 'utf8' }));
