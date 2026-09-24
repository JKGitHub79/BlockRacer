/* Block Racer - the same game, in two engines.
 *
 *   node tools/cross-engine.js
 *
 * Runs tools/webkit/suite.js in Chromium and in real WebKit (WebKitGTK, the
 * engine Safari is built on), each once with ordinary storage and once with
 * localStorage throwing the way Safari makes it throw under "Block All
 * Cookies", and prints every result side by side. Anything that differs by
 * engine or by storage is marked DIFF. Needs the packages listed at the top
 * of tools/webkit/wk.py.
 */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; }
const WK = path.join(__dirname, 'webkit');
/* The WebKitGTK bindings belong to whichever python the distribution built
 * them for, which is not always the one called python3 - so ask each
 * candidate whether it can load them and use the first that can. */
const PY = ['python3', '/usr/bin/python3', '/usr/bin/python3.12', '/usr/bin/python3.13',
            '/usr/bin/python3.11', '/usr/bin/python3.10'].find(py => {
  try {
    execFileSync(py, ['-c', "import gi; gi.require_version('WebKit2', '4.1')"], { stdio: 'ignore' });
    return true;
  } catch (e) { return false; }
});
if (!PY) {
  console.error('No python with the WebKitGTK bindings. Install them with:\n' +
    '  sudo apt-get install gir1.2-webkit2-4.1 python3-gi python3-gi-cairo xvfb');
  process.exit(2);
}
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');
const body = fs.readFileSync(path.join(WK, 'suite.js'), 'utf8');
const BLOCK = `Object.defineProperty(window, 'localStorage', { configurable: true, get: function () {
  throw new DOMException('The operation is insecure.', 'SecurityError'); } });`;
(async () => {
  const b = await chromium.launch();
  const results = {};
  for (const mode of ['normal', 'blocked']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    if (mode === 'blocked') await p.addInitScript(BLOCK);
    await p.goto(FILE); await p.waitForTimeout(600);
    results['chromium/' + mode] = await p.evaluate(`(async () => { ${body} })()`);
    results['chromium/' + mode].pageErrors = errs;
    await p.close();
    const env = Object.assign({}, process.env, mode === 'blocked' ? { BLOCK_STORAGE: '1' } : {});
    const out = execFileSync('xvfb-run', ['-a', PY, path.join(WK, 'wk.py'), '1280x860',
      path.join(WK, 'suite.js')], { encoding: 'utf8', timeout: 300000, env });
    const res = (out.match(/^RESULT (.*)$/m) || [])[1];
    results['webkit/' + mode] = res ? JSON.parse(res) : { failed: out.slice(-400) };
    results['webkit/' + mode].pageErrors = JSON.parse((out.match(/^ERRORS (.*)$/m) || [, '[]'])[1]);
  }
  await b.close();
  const keys = Object.keys(results['chromium/normal']);
  const cols = Object.keys(results);
  let diffs = 0;
  for (const k of keys) {
    const canon = v => JSON.stringify(v, (key, val) => val && typeof val === "object" && !Array.isArray(val) ? Object.keys(val).sort().reduce((o, x) => (o[x] = val[x], o), {}) : val); const vals = cols.map(c => canon(results[c][k]));
    const same = vals.every(v => v === vals[0]);
    if (k === 'storage') continue;
    if (!same) diffs++;
    console.log((same ? 'same  ' : 'DIFF  ') + k.padEnd(18) + (same ? vals[0] : '\n' + cols.map((c, i) => '        ' + c.padEnd(17) + vals[i]).join('\n')).slice(0, 400));
  }
  console.log(diffs ? '\n' + diffs + ' check(s) differ across engine/storage' : '\nevery check identical in both engines, with and without storage');
})();
