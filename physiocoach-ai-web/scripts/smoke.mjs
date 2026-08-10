const args = new Map(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));
const targetArg = args.get('target') || args.get('env') || 'all';

const targets = {
  dev: 'https://dev.physiocoach-ai-web.pages.dev',
  prod: 'https://physiocoach.otconnect.ir',
};

const targetList =
  targetArg === 'all'
    ? Object.entries(targets)
    : Object.entries(targets).filter(([name]) => name === targetArg);

if (!targetList.length) {
  console.error(`Unknown target "${targetArg}". Use: dev | prod | all.`);
  process.exit(1);
}

let failed = false;
let checks = 0;
let passed = 0;

function buildSummary(name, ok, details) {
  console[ok ? 'log' : 'error'](`${ok ? '✅' : '❌'} [${name}] ${ok ? 'PASS' : 'FAIL'} ${details}`);
}

async function testUrl(name, url) {
  const response = await fetch(url, { redirect: 'manual' });
  checks += 1;

  const ok = response.status >= 200 && response.status < 400;
  buildSummary(name, ok, `GET ${url} -> ${response.status}`);
  return ok;
}

function parseConfigText(text) {
  const match = text.match(/window\.__PHYSIOCOACH_CONFIG__\s*=\s*({[\s\S]*?});?/m);
  if (!match) {
    return null;
  }

  const configText = match[1]
    .replace(/([\n{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":')
    .replace(/'([^']*)'/g, '"$1"')
    .replace(/,\s*(?=[}\]])/g, '');

  return JSON.parse(configText);
}

async function testConfig(name, baseUrl) {
  const configUrl = `${baseUrl}/config.js`;
  const response = await fetch(configUrl, { redirect: 'manual' });
  checks += 1;

  if (!(response.status >= 200 && response.status < 400)) {
    buildSummary(name, false, `GET ${configUrl} -> ${response.status}`);
    return false;
  }

  const text = await response.text();
  const config = parseConfigText(text);
  const hasConfig = Boolean(config);
  const ok = hasConfig && config.apiUrl && config.environment;

  buildSummary(
    name,
    ok,
    `${configUrl} -> ${hasConfig ? `apiUrl ${config.apiUrl}` : 'invalid config format'}`,
  );

  return ok;
}

(async () => {
  for (const [name, baseUrl] of targetList) {
    const rootOk = await testUrl(name, baseUrl);
    const configOk = rootOk ? await testConfig(name, baseUrl) : false;

    passed += rootOk ? 1 : 0;
    passed += configOk ? 1 : 0;

    if (!rootOk || !configOk) failed = true;
  }

  console.log(`Web smoke completed: ${passed}/${checks} checks`);

  if (failed) {
    process.exitCode = 1;
  }
})();
