// Build Tiny Tells from src/.
//
//   node tools/build.mjs           writes dist/ (both bundles, readable and minified, plus the API files) and site/ (the
//                                  landing page, the docs, and the 404)
//   node tools/build.mjs --check   also fails if a minified bundle is over its min + gzip budget, or play adds 1 KB or more
//   node tools/build.mjs --sizes   also prints each bundle's min + gzip size
//
// Web Awesome is only page chrome. The site self-hosts it from the npm package's dist-cdn build, along with its fonts.
import { build, transform } from 'esbuild';
import { copyFileSync, cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { BOX } from '../src/box.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(ROOT, ...parts), 'utf8');
const write = (text, ...parts) => {
  const path = join(ROOT, ...parts);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return relative(ROOT, path);
};

const { version: VERSION, homepage: HOMEPAGE } = JSON.parse(read('package.json'));
const API = JSON.parse(read('src', 'api.json'));
const REPO = 'https://github.com/talbs/tiny-tells';
const FA_KIT = '3572f3662e';
const WA_CDN = join(ROOT, 'node_modules', '@awesome.me', 'webawesome', 'dist-cdn');
/* The site asks the kit for Web Awesome's own icons, so it has to use the Font Awesome release Web Awesome was built with. */
const FA_VERSION = readdirSync(join(WA_CDN, 'chunks'))
  .map(file => readFileSync(join(WA_CDN, 'chunks', file), 'utf8').match(/FA_VERSION = "([\d.]+)"/)?.[1])
  .find(Boolean);
if (!FA_VERSION) throw new Error('Could not find the Font Awesome version inside @awesome.me/webawesome');
const BUNDLES = [
  { name: 'tiny-tells', title: 'Tiny Tells', budgetKb: 14 },
  { name: 'tiny-tells-play', title: 'Tiny Tells Play', budgetKb: 15 },
];

const bundle = async (entry, { minify = false, banner = '' } = {}) => {
  const result = await build({
    entryPoints: [join(ROOT, entry)],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify,
    write: false,
    legalComments: 'inline',
    banner: banner ? { js: banner } : undefined,
    define: { __TINY_TELLS_VERSION__: JSON.stringify(VERSION), __FA_VERSION__: JSON.stringify(FA_VERSION) },
  });
  return result.outputFiles[0].text;
};

const gzipKb = text => gzipSync(text, { level: 9 }).length / 1024;

const tsType = attr =>
  attr.values
    ? Object.keys(attr.values)
        .map(v => `'${v}'`)
        .join(' | ')
    : { string: 'string | null', boolean: 'boolean' }[attr.type];

const manifest = () => {
  const stateValues = API.attributes.find(a => a.name === 'state').values;
  const decl = {
    kind: 'class',
    name: API.class,
    tagName: API.tag,
    customElement: true,
    description: API.description,
    superclass: { name: 'HTMLElement' },
    attributes: API.attributes.map(a => ({
      name: a.name,
      fieldName: a.name,
      type: { text: tsType(a) },
      default: JSON.stringify(a.default),
      description: a.description,
    })),
    members: [
      ...API.attributes.map(a => ({
        kind: 'field',
        name: a.name,
        attribute: a.name,
        reflects: true,
        type: { text: tsType(a) },
        default: JSON.stringify(a.default),
        description: a.description,
      })),
      ...API.statics.map(m => ({
        kind: 'field',
        name: m.name,
        static: true,
        readonly: !!m.readonly,
        type: { text: m.type },
        description: m.description,
      })),
    ],
    events: API.events.map(e => ({ name: e.name, type: { text: e.class }, description: eventNote(e) })),
    cssProperties: API.cssProperties,
    cssParts: API.cssParts,
    cssStates: Object.entries(stateValues).map(([name, description]) => ({ name, description })),
  };
  const ref = { name: API.class, module: 'dist/tiny-tells.js' };
  const module = (path, declarations) => ({
    kind: 'javascript-module',
    path,
    declarations,
    exports: [
      { kind: 'js', name: API.class, declaration: ref },
      { kind: 'custom-element-definition', name: API.tag, declaration: ref },
    ],
  });
  return {
    schemaVersion: '2.1.0',
    readme: 'README.md',
    modules: [module('dist/tiny-tells.js', [decl]), module('dist/tiny-tells-play.js', [])],
  };
};

const vscodeData = () => ({
  version: 1.1,
  tags: [
    {
      name: API.tag,
      description: API.description,
      attributes: API.attributes.map(a => ({
        name: a.name,
        description: a.description,
        ...(a.values
          ? { values: Object.entries(a.values).map(([name, description]) => ({ name, description })) }
          : a.type === 'boolean'
            ? { valueSet: 'v' }
            : {}),
      })),
      references: [{ name: 'Docs', url: 'https://talbs.github.io/tiny-tells/docs/' }],
    },
  ],
});

const dts = () => {
  const alias = a => (a.values ? `Tell${a.name[0].toUpperCase()}${a.name.slice(1)}` : null);
  const types = API.attributes
    .filter(alias)
    .map(a => `export type ${alias(a)} = ${tsType(a)};\n`)
    .join('');
  const attrs = API.attributes.map(a => `  ${a.name}?: ${alias(a) || a.type};\n`).join('');
  const statics = API.statics
    .map(m => `  /** ${m.description} */\n  static ${m.readonly ? 'readonly ' : ''}${m.name}: ${m.type};\n`)
    .join('');
  const props = API.attributes.map(a => `  /** ${a.description} */\n  ${a.name}: ${alias(a) || tsType(a)};\n`).join('');
  return `${types}
/** The attributes, for typing framework props. */
export interface ${API.class}Attributes {
${attrs}}

/** ${API.description} */
export declare class ${API.class} extends HTMLElement {
${statics}${props}}

declare global {
  interface HTMLElementTagNameMap {
    '${API.tag}': ${API.class};
  }
}
`;
};

const eventNote = e => `${e.bundle === 'play' ? 'Play bundle only. ' : ''}${e.description}`;
const playDts = () => `export * from './tiny-tells.js';

${API.events.map(e => `/** ${eventNote(e)} */\nexport declare class ${e.class} extends Event {\n  constructor();\n}\n`).join('\n')}
declare global {
  interface HTMLElementEventMap {
${API.events.map(e => `    '${e.name}': ${e.class};\n`).join('')}  }
}
`;

const ICONS = ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'];
/* The PNG claims 32x32 so browsers that read SVG icons pick the SVG, and older Safari falls back to the PNG. */
const favicon = root => `<link rel="icon" href="${root}favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}apple-touch-icon.png">`;
/* Latin and Latin Extended only: Fontsource's default files pull in every subset, and the Korean ones alone are 4 MB. */
const FONTS = [
  'martian-mono/400',
  'martian-mono/500',
  'schibsted-grotesk/400',
  'schibsted-grotesk/500',
  'schibsted-grotesk/700',
].flatMap(font => ['latin', 'latin-ext'].map(subset => font.replace('/', `/${subset}-`)));
const SITE_CSS = [
  ['tools', 'shared', 'theme.css'],
  ['tools', 'shared', 'studio.css'],
  ['tools', 'site', 'site.css'],
  ['tools', 'site', 'components.css'],
  ['tools', 'site', 'sections.css'],
];
const LANDING_CSS = [
  ['tools', 'site', 'hero.css'],
  ['tools', 'site', 'cast.css'],
];

const attr = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const pageMeta = ({ title, description, path }) => {
  const url = HOMEPAGE + path;
  return `<link rel="canonical" href="${url}">
<meta name="description" content="${attr(description)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f9f9fa">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#23262c">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tiny Tells">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${HOMEPAGE}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The Tiny Tells wordmark with the Eyes tell as the dot on its i, circled in red pencil with the note “keep an i on it.” All six tells stand below it, above a timing ruler.">
<meta name="twitter:card" content="summary_large_image">`;
};

const sitePage = async ({
  body,
  script,
  root,
  title,
  description,
  path,
  size,
  isPickerInHeader,
  isNoindex,
  isHandLettered,
  css = SITE_CSS,
}) => {
  const js = await bundle(`tools/site/${script}`, { minify: true });
  const { code: styles } = await transform(css.map(path => read(...path)).join('\n'), { loader: 'css', minify: true });
  const fills = {
    header: read('tools', 'site', 'header.html').replace(
      '{{picker}}',
      isPickerInHeader ? read('tools', 'site', 'picker.html').trim() : ''
    ),
    footer: read('tools', 'site', 'footer.html'),
  };
  const values = { root, version: VERSION, size };
  const html = read('tools', 'site', body)
    .replace(/\{\{(header|footer)\}\}/g, (_, name) => fills[name])
    .replace(/\{\{(root|version|size)\}\}/g, (_, name) => values[name]);
  const components = [
    ...new Set(
      [...(html + js).matchAll(/<(wa-[a-z-]+)|createElement\(['"](wa-[a-z-]+)['"]\)/g)].map(m =>
        (m[1] || m[2]).slice(3)
      )
    ),
  ];
  const preloads = components
    .map(name => `<link rel="modulepreload" href="${root}assets/webawesome/components/${name}/${name}.js">`)
    .join('\n');
  /* wa-page renders as desktop until its resize observer runs, then jumps to mobile; setting its view before it upgrades skips the jump. */
  const page = html.replace(
    /<wa-page\b[^>]*>/,
    tag =>
      `${tag}<script>{const p = document.currentScript.parentElement; p.setAttribute('view', document.documentElement.clientWidth >= parseFloat(p.getAttribute('mobile-breakpoint') ?? 768) ? 'desktop' : 'mobile'); document.currentScript.remove();}</script>`
  );
  const leftover = html.match(/\{\{\w+\}\}/);
  if (leftover) throw new Error(`${body}: unfilled placeholder ${leftover[0]}`);
  return `<!doctype html>
<html lang="en" data-fa-kit-code="${FA_KIT}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${favicon(root)}
${pageMeta({ title, description, path })}${isNoindex ? '\n<meta name="robots" content="noindex">' : ''}
<script>const d = document.documentElement.dataset; d.loading = d.upgrading = ''; setTimeout(() => { delete d.loading; delete d.upgrading; }, 2000);</script>
<link rel="stylesheet" href="${root}assets/vendor.css">${isHandLettered ? `\n<link rel="stylesheet" href="${root}assets/hand.css">` : ''}
<script type="module" src="${root}assets/webawesome/webawesome.loader.js" data-webawesome="${root}assets/webawesome"></script>
${preloads}
<script type="module" src="${root}assets/microlighter/microlighter.min.js"></script>
<style>
${styles}</style>
</head>
<body data-syntax-theme="drafting">
${page}
<script type="module">
${js}
</script>
</body>
</html>
`;
};

const minified = {};
/* The npm entries share one chunk, so a library importing the core and an app importing play get one element. The minified CDN files stay standalone. */
rmSync(join(ROOT, 'dist', 'chunks'), { recursive: true, force: true });
const shared = await build({
  entryPoints: BUNDLES.map(({ name }) => join(ROOT, 'src', `${name}.js`)),
  bundle: true,
  splitting: true,
  format: 'esm',
  target: 'es2022',
  outdir: join(ROOT, 'dist'),
  chunkNames: 'chunks/[name]-[hash]',
  write: false,
  legalComments: 'inline',
  banner: { js: `/*! Tiny Tells ${VERSION} · <tiny-tell> · MIT · ${REPO} */` },
  define: { __TINY_TELLS_VERSION__: JSON.stringify(VERSION) },
});
shared.outputFiles.forEach(file => console.log('wrote', write(file.text, relative(ROOT, file.path))));
for (const { name, title } of BUNDLES) {
  minified[name] = await bundle(`src/${name}.js`, {
    banner: `/*! ${title} ${VERSION} · <tiny-tell> · MIT · ${REPO} */`,
    minify: true,
  });
  console.log('wrote', write(minified[name], 'dist', `${name}.min.js`));
}
write(
  `/*! Tiny Tells ${VERSION} · reserves each tell's space until the element loads · MIT */\ntiny-tell:not(:defined):not([hidden]) { ${BOX} overflow: hidden; }\n`,
  'dist',
  'reserve.css'
);
write(JSON.stringify(manifest(), null, 2) + '\n', 'dist', 'custom-elements.json');
write(JSON.stringify(vscodeData(), null, 2) + '\n', 'dist', 'vscode.html-custom-data.json');
write(dts(), 'dist', 'tiny-tells.d.ts');
write(playDts(), 'dist', 'tiny-tells-play.d.ts');
console.log('wrote dist/custom-elements.json, dist/vscode.html-custom-data.json, dist/*.d.ts');
/* Web Awesome's stylesheet is a chain of @imports, so it's bundled into one file with the fonts. data-webawesome on the loader tells it where its components are, because it can't resolve a relative script path itself. */
rmSync(join(ROOT, 'site', 'assets'), { recursive: true, force: true });
const vendorCss = (name, imports) =>
  build({
    stdin: { contents: imports.map(path => `@import '${path}';`).join('\n'), resolveDir: ROOT, loader: 'css' },
    bundle: true,
    minify: true,
    outfile: join(ROOT, 'site', 'assets', `${name}.css`),
    assetNames: 'fonts/[name]-[hash]',
    loader: { '.woff2': 'file', '.woff': 'file' },
  });
await vendorCss('vendor', [
  '@awesome.me/webawesome/dist/styles/webawesome.css',
  ...FONTS.map(font => `@fontsource/${font}.css`),
]);
await vendorCss('hand', ['@fontsource/nanum-pen-script/latin-400.css']);
const skipCopy = path => /[\\/](react|ssr|skills)([\\/]|$)|\.d\.ts$/.test(path);
cpSync(WA_CDN, join(ROOT, 'site', 'assets', 'webawesome'), {
  recursive: true,
  filter: path => !skipCopy(path),
});
cpSync(join(ROOT, 'node_modules', 'microlighter', 'dist'), join(ROOT, 'site', 'assets', 'microlighter'), {
  recursive: true,
  filter: path => !skipCopy(path),
});

for (const [out, opts] of [
  [
    ['site', 'index.html'],
    {
      body: 'landing.html',
      script: 'landing.js',
      root: './',
      path: '',
      title: 'Tiny Tells: give your app’s status a face',
      description:
        'A spinner only says busy. A tell shows whether your app is working, done, failed, or waiting on you. Six tiny characters, one <tiny-tell> element.',
      isPickerInHeader: true,
      isHandLettered: true,
      css: [...SITE_CSS, ...LANDING_CSS],
    },
  ],
  [
    ['site', 'docs', 'index.html'],
    {
      body: 'docs.html',
      script: 'docs.js',
      root: '../',
      path: 'docs/',
      title: 'Docs · Tiny Tells',
      description:
        'Get a tell into your app in three steps, then make it fit: size, color, accessibility, frameworks, and the full API.',
    },
  ],
  [
    ['site', '404.html'],
    {
      body: '404.html',
      script: '404.js',
      // Pages serves this file at whatever URL missed, so its links can't be relative.
      root: new URL(HOMEPAGE).pathname,
      path: '404.html',
      title: 'Nothing Here · Tiny Tells',
      description: 'This page doesn’t exist, but the tells are still here.',
      isNoindex: true,
    },
  ],
]) {
  const html = await sitePage({ ...opts, size: gzipKb(minified['tiny-tells']).toFixed(1) });
  console.log('wrote', write(html, ...out), `(${Math.round(html.length / 1024)} KB)`);
}
copyFileSync(join(ROOT, 'tools', 'og', 'og.png'), join(ROOT, 'site', 'og.png'));
ICONS.forEach(name => copyFileSync(join(ROOT, 'tools', 'favicon', name), join(ROOT, 'site', name)));
console.log('wrote site/og.png and the favicons');

const args = process.argv.slice(2);
if (args.includes('--sizes') || args.includes('--check')) {
  let isOver = false;
  for (const { name, budgetKb } of BUNDLES) {
    const kb = gzipKb(minified[name]);
    isOver ||= kb > budgetKb;
    console.log(`budget: dist/${name}.min.js is ${kb.toFixed(1)} KB min + gzip (limit ${budgetKb} KB)`);
  }
  /* The docs promise Play costs under 1 KB more than the core. */
  const playExtraKb = gzipKb(minified['tiny-tells-play']) - gzipKb(minified['tiny-tells']);
  isOver ||= playExtraKb >= 1;
  console.log(`budget: play adds ${playExtraKb.toFixed(2)} KB min + gzip (limit 1 KB)`);
  if (args.includes('--check') && isOver) process.exit(1);
}
