import {mkdir, readFile, writeFile} from 'node:fs/promises';

// app.mjs keeps its view functions private and touches the page when it loads.
// Load the part that defines them against a stand-in document and export them.
export async function loadApp(bundle) {
  const dist = new URL('../../dist/', import.meta.url);
  const source = (await readFile(new URL('app.mjs', dist), 'utf8')).split('\n');
  const end = source.findIndex(line => line.startsWith('function showAbout('));
  // navigate() would render into the page; record where it goes instead. The functions under test are unchanged.
  const navigate = "function navigate(name){if(!VIEWS.includes(name))return;state.view=name;syncURL();globalThis.__navigated.push(name)}";
  const body = source.slice(0, end + 1).filter(line => line !== 'initGlossary();').map(line => line.startsWith('function navigate(name){') ? navigate : line).join('\n').replaceAll("from './", `from '${dist.href}`) +
    '\nexport const __app={paths,icon,state,worldInfo,sampleText,materialDescription,unitLabel,evidenceLabel,fieldLabel,materialPanel,chart,chartPanel,overview,metricName,compare,option,evidence,renderEvidenceRows,sourceView,renderSources,openRecord,openSource,showAbout,syncURL,restoreURLState,routeGlobalSearch,setData(b){bundle=b;rows=joinResearch(b)}};\n';
  const element = new Proxy(function () {}, {get: (_, key) => key === 'forEach' ? () => {} : element, apply: () => element});
  // Elements the render functions write into keep what was assigned, so it can be read back.
  const sinks = {};
  const sink = () => { const store = {}; return new Proxy(function () {}, {get: (_, key) => key in store ? store[key] : element, set: (_, key, value) => { store[key] = value; return true; }, apply: () => element}); };
  globalThis.document = new Proxy({}, {get: (_, key) => key === 'querySelectorAll' ? () => [] : key === 'querySelector' ? selector => (sinks[selector] ??= sink()) : () => element});
  globalThis.__sinks = sinks;
  globalThis.__navigated = [];
  globalThis.location = {href: 'https://soraine.vercel.app/', search: '', hash: ''};
  globalThis.history = {replaceState: (_state, _title, url) => { globalThis.__replaced = String(url); }};
  await mkdir(new URL('../target/', import.meta.url), {recursive: true});
  const file = new URL('../target/app-under-test.mjs', import.meta.url);
  await writeFile(file, body);
  const {__app} = await import(file.href);
  __app.setData(bundle);
  __app.written = selector => sinks[selector]?.innerHTML;
  return __app;
}
