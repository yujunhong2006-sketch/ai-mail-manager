import { readFileSync, writeFileSync, existsSync, mkdirSync, openSync, closeSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const data = join(root, 'local-data');
mkdirSync(data, { recursive: true });
const env = { ...process.env };
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) env[match[1]] = match[2].trim();
}
Object.assign(env, { DATABASE_DRIVER: 'local', LOCAL_DATABASE_PATH: join(data, 'mail-db'), NODE_ENV: 'development', ALLOW_EMAIL_SEND: 'false', VITE_LOCAL_WORKBENCH: 'true' });
const apiPort = Number(env.API_PORT || 5531), webPort = Number(env.WEB_PORT || 5230);
const url = `http://localhost:${webPort}/app/manager`;
const candidates = [resolve(root, '../work/package/bin/bun.exe'), join(env.USERPROFILE || '', '.bun/bin/bun.exe')];
const bun = candidates.find(existsSync) || 'bun';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function health(port, identity) {
  try { const response = await fetch(`http://127.0.0.1:${port}/local-health`, { signal: AbortSignal.timeout(1000) }); const result = await response.json(); return result.app === identity; } catch { return false; }
}
if (process.argv.includes('--stop')) {
  for (const [port, endpoint, identity] of [[apiPort, '/local-setup/stop', 'ai-mail-manager-api'], [webPort, '/local-stop', 'ai-mail-manager-local']]) {
    if (!(await health(port, identity))) continue;
    const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${env.API_SECRET}` }, signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw Error('停止请求未成功，后台可能仍在运行。');
    for (let attempt = 0; attempt < 15 && await health(port, identity); attempt++) await sleep(1000);
    if (await health(port, identity)) throw Error('后台仍在关闭数据库，请稍后再次点击停止。');
  }
  console.log('邮件工作台已停止。');
  process.exit(0);
}
const manifest = join(root, 'packages/web/dist/index.html');
const hash = createHash('sha256').update(env.API_SECRET || '').update('local-workbench-v1');
function hashSources(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).toSorted((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) hashSources(path);
    else if (entry.isFile()) hash.update(entry.name).update(readFileSync(path));
  }
}
hashSources(join(root, 'packages/web/src'));
hash.update(readFileSync(join(root, 'packages/web/vite.config.ts')));
const fingerprint = hash.digest('hex');
const buildStamp = join(data, 'web-built');
if (!existsSync(manifest) || !existsSync(buildStamp) || readFileSync(buildStamp, 'utf8') !== fingerprint) {
  console.log('正在准备工作台页面，首次启动请稍候…');
  const result = spawnSync(bun, ['node_modules/vite/bin/vite.js', 'build'], { cwd: join(root, 'packages/web'), env, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw Error('页面构建失败，请查看上述错误。');
  writeFileSync(buildStamp, fingerprint);
}
async function start(name, script, port, identity) {
  if (await health(port, identity)) return;
  const out = openSync(join(data, name + '.log'), 'a'), err = openSync(join(data, name + '.error.log'), 'a');
  const child = spawn(bun, ['run', script], { cwd: root, env, detached: true, stdio: ['ignore', out, err], windowsHide: true });
  closeSync(out); closeSync(err);
  let failure;
  child.on('error', error => { failure = error; });
  child.unref();
  for (let i = 0; i < 45; i++) {
    if (failure) throw failure;
    if (await health(port, identity)) return;
    await sleep(1000);
  }
  throw Error(`后台未能启动，请查看 local-data/${name}.error.log`);
}
await start('api', 'packages/api/src/index.ts', apiPort, 'ai-mail-manager-api');
await start('web', 'scripts/local/web.ts', webPort, 'ai-mail-manager-local');
console.log(`工作台已启动：${url}`);
if (!process.argv.includes('--no-open')) spawn('explorer.exe', [url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
