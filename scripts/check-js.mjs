import { spawnSync } from 'node:child_process';
// The browser and PDF code is plain JavaScript, which `npm run typecheck` does not cover. Full type checking would be
// mostly noise there (DOM lookups, untyped PDF objects), so only the mistakes that always mean a bug are enforced:
// names that do not exist, variables used before they are declared, and imports of things a module does not export.
const FATAL = {
  2304: 'name does not exist', 2552: 'name does not exist (misspelt?)', 2448: 'used before its declaration', 2454: 'used before it is assigned',
  2451: 'declared twice', 2300: 'duplicate identifier', 2305: 'module does not export it', 2614: 'module does not export it', 2724: 'module does not export it (misspelt?)',
  2393: 'duplicate function', 2867: 'name does not exist', 2693: 'type used as a value',
};
const run = spawnSync('npx', ['tsc', '-p', 'tsconfig.js.json', '--pretty', 'false'], { encoding: 'utf8' });
const problems = run.stdout.split('\n').map(line => line.match(/^(.+?)\((\d+),(\d+)\): error TS(\d+): (.*)$/)).filter(Boolean).filter(m => FATAL[m[4]]);
for (const [, file, line, , code, message] of problems) console.error(`${file}:${line}  ${FATAL[code]}: ${message}`);
if (problems.length) { console.error(`\n${problems.length} problem(s) in browser/PDF code.`); process.exit(1); }
console.log('Browser and PDF code: no undeclared names, use-before-declaration or bad imports.');
