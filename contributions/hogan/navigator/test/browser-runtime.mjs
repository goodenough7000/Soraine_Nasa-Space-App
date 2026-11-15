import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
let runtime;
try {runtime=await import('playwright');}
catch {runtime=await import(pathToFileURL(resolve(dirname(process.execPath),'../node_modules/playwright/index.mjs')));}
export const chromium=runtime.chromium;
export const baseUrl=process.env.SORAINE_TEST_URL||'http://127.0.0.1:4319';
