// Usage: npm run release:patch | release:minor | release:major   (or: node scripts/release.mjs <type>)
// Checks the repo is ready, shows what it will do, asks for confirmation, then tags and pushes. The tag push triggers the Deploy workflow.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const type = process.argv[2];
if (!['patch', 'minor', 'major'].includes(type)) { console.error('Usage: node scripts/release.mjs <patch|minor|major>'); process.exit(1); }
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', ...options }).trim();
const stream = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });
const fail = message => { console.error(`\n${message}`); process.exit(1); };

const branch = run('git', ['branch', '--show-current']);
if (branch !== 'main') fail(`Releases are made from main, but you are on "${branch}".`);
if (run('git', ['status', '--porcelain'])) fail('The working tree has uncommitted changes. Commit or stash them first.');
run('git', ['fetch', 'origin', 'main', '--tags']);
const [behind, ahead] = run('git', ['rev-list', '--left-right', '--count', 'origin/main...HEAD']).split(/\s+/).map(Number);
if (behind) fail(`main is ${behind} commit(s) behind origin. Run "git pull" first.`);

const current = JSON.parse(readFileSync('package.json', 'utf8')).version;
const [major, minor, patch] = current.split('.').map(Number);
const next = type === 'major' ? `${major + 1}.0.0` : type === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
if (run('git', ['tag', '--list', `v${next}`])) fail(`Tag v${next} already exists.`);

const last = run('git', ['tag', '--list', 'v*', '--sort=-v:refname']).split('\n')[0];
const log = run('git', ['log', '--oneline', last ? `${last}..HEAD` : 'HEAD']);
console.log(`Release ${type}: ${current} -> ${next}  (tag v${next})`);
console.log(`\nChanges since ${last || 'the start'}${ahead ? `, including ${ahead} not yet pushed` : ''}:\n${log ? log.replace(/^/gm, '  ') : '  (none)'}`);
console.log(`\nThis will run:\n  npm run check\n  npm version ${type}        (commits "${next}" and tags v${next})\n  git push --follow-tags     (pushes to origin and deploys to the server)\n`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question(`Release v${next}? [y/N] `)).trim().toLowerCase();
rl.close();
if (answer !== 'y' && answer !== 'yes') fail('Cancelled. Nothing was changed.');

stream('npm', ['run', 'check']);
stream('npm', ['version', type]);
stream('git', ['push', '--follow-tags']);
console.log(`\nv${next} pushed. Watch the deploy at https://github.com/andyboltondev/sheetsmith/actions`);
