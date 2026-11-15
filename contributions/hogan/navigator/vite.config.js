import {defineConfig} from 'vite';
export default defineConfig({
  base: process.env.SORAINE_BASE_PATH || '/',
  server: {fs: {allow: ['..']}},
  build:{rolldownOptions:{onwarn(warning,defaultHandler){
    // These dependencies mark React client components. This app is entirely client-side.
    if(warning.code==='MODULE_LEVEL_DIRECTIVE')return;
    defaultHandler(warning);
  }}}
});
