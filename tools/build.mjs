// Build Tiny Tells from src/.
//
//   node tools/build.mjs           writes dist/ (both bundles, readable and minified, plus the API files) and site/ (the
//                                  landing page, the docs, and the 404)
//   node tools/build.mjs --check   also fails if a minified bundle is over its min + gzip budget, play adds 1 KB or more, a
//                                  page's inline CSS is over its gzip budget, or CHANGELOG.md has no section for
//                                  package.json's version
//   node tools/build.mjs --sizes   also prints each bundle's min + gzip size
//
// Web Awesome is only page chrome. The site bundles the components it uses from the npm package's dist build, and self-hosts its fonts.
import { build, transform } from 'esbuild';
import { copyFileSync, cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { BOX } from '../src/box.js';
import { AGENT_RULES, ASSISTANT_PROMPT } from './shared/copy.js';
import { setScheme } from './site/scheme.js';

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
const SUPPORT = { Chrome: '111', Firefox: '113', Safari: '16.4' };
const FA_KIT = '3572f3662e';
const UMAMI_WEBSITE_ID = '9f2cb342-dd92-4387-b96a-cf0b52f5ec76';
const WA_DIST = join(ROOT, 'node_modules', '@awesome.me', 'webawesome', 'dist');
/* The site asks the kit for Web Awesome's own icons, so it has to use the Font Awesome release Web Awesome was built with. */
const FA_VERSION = readdirSync(join(WA_DIST, 'chunks'))
  .map(file => readFileSync(join(WA_DIST, 'chunks', file), 'utf8').match(/FA_VERSION = "([\d.]+)"/)?.[1])
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
    define: { __TINY_TELLS_VERSION__: JSON.stringify(VERSION) },
  });
  return result.outputFiles[0].text;
};

const gzipKb = text => gzipSync(text, { level: 9 }).length / 1024;
/* data-domains keeps local serves, previews, and Playwright out of the numbers. */
const umamiTag = () =>
  UMAMI_WEBSITE_ID
    ? `\n<script async src="https://cloud.umami.is/script.js" data-website-id="${UMAMI_WEBSITE_ID}" data-domains="tinytells.dev" data-do-not-track="true" data-exclude-search="true"></script>`
    : '';

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
      ...declarations
        .filter(d => d !== decl)
        .map(d => ({ kind: 'js', name: d.name, declaration: { name: d.name, module: path } })),
      { kind: 'custom-element-definition', name: API.tag, declaration: ref },
    ],
  });
  const events = API.events.map(e => ({
    kind: 'class',
    name: e.class,
    superclass: { name: 'Event', package: 'global:' },
    description: eventNote(e),
  }));
  return {
    schemaVersion: '2.1.0',
    readme: 'README.md',
    modules: [module('dist/tiny-tells.js', [decl]), module('dist/tiny-tells-play.js', events)],
  };
};

/* A plain-text brief for coding assistants (llmstxt.org). The reference sections come from api.json; the rules are written by hand and mirror the docs' Your Part list. */
const llmsTxt = sizeKb => {
  const docs = `${HOMEPAGE}docs/`;
  const skins = Object.keys(API.attributes.find(a => a.name === 'skin').values).length;
  const list = (items, line) => items.map(line).join('\n');
  const attr = a =>
    `- \`${a.name}\`${a.default == null || a.type === 'boolean' ? '' : ` (default \`${a.default}\`)`}: ${a.description}` +
    (a.values ? '\n' + list(Object.entries(a.values), ([v, d]) => `  - \`${v}\`: ${d}`) : '');
  return `# Tiny Tells

> \`<tiny-tell>\` is one custom element for app status: working, done, error, warning, or idle. Pick from ${skins} small animated characters. No dependencies, ${sizeKb} KB min+gzip. ${Object.entries(
    SUPPORT
  )
    .map(([browser, v]) => `${browser} ${v}+`)
    .join(', ')}.

This file describes version ${VERSION}. Tiny Tells is pre-1.0, so pin the version.

## Install

With a bundler:

\`\`\`bash
npm i tiny-tells
\`\`\`

\`\`\`js
import 'tiny-tells';
\`\`\`

Without one:

\`\`\`html
<script type="module" src="https://cdn.jsdelivr.net/npm/tiny-tells@${VERSION}/dist/tiny-tells.min.js"></script>
\`\`\`

The play bundle adds a glance at a nearby pointer and a five-tap dance. Use it only if asked. Import \`tiny-tells/play\` instead of \`tiny-tells\`, or load \`tiny-tells-play.min.js\` from the same CDN path. Types ship with the package, and the element class is exported as \`TinyTell\`.

## Use

\`\`\`html
<p><tiny-tell skin="dekatron" state="working" label=""></tiny-tell> <span role="status">Syncing 3 files…</span></p>
\`\`\`

\`\`\`js
document.querySelector('tiny-tell').state = 'done';
document.querySelector('[role="status"]').textContent = 'Synced 3 files.';
\`\`\`

Rules:

- Put words next to every tell. If the status can change while someone's on the page, put them in a \`role="status"\` region. A state change doesn't announce on its own.
- When the words beside it already say the state, set \`label=""\`. Otherwise give it a more specific \`label\`, like \`label="Uploading photos"\`.
- \`warning\` means stuck until a person acts. Not for soft errors.
- Size follows the text. Set \`--tell-size\` to pin it.
- If a tell can move for more than five seconds, add a pause button that sets \`paused\`.
- \`paused\` is a boolean attribute. Any value pauses, \`paused="false"\` included. Remove it to resume.
- If you override \`--tell-color-*\`, keep 3:1 contrast against the surface behind it.
- Reduced motion and forced colors are handled for you.
- Custom tells aren't supported.

## Attributes

${list(API.attributes, attr)}

## CSS

${list(API.cssProperties, p => `- \`${p.name}\`${p.default != null ? ` (default \`${p.default}\`)` : ''}: ${p.description}`)}
${list(API.cssParts, p => `- \`::part(${p.name})\`: ${p.description}`)}

## Statics

${list(API.statics ?? [], s => `- \`TinyTell.${s.name}\`: ${s.description}`)}

## Events

${list(API.events ?? [], e => `- \`${e.name}\`${e.cancelable ? ' (cancelable)' : ''}${e.bundle ? `, ${e.bundle} bundle only` : ''}: ${e.description}`)}

## Docs

- [Get Started](${docs}#get-started)
- [Build with AI](${docs}#build-with-ai)
- [Play Bundle](${docs}#play)
- [States](${docs}#states)
- [Accessibility](${docs}#accessibility)
- [Pausing](${docs}#pausing)
- [Size](${docs}#size)
- [Color](${docs}#color)
- [Frameworks and Editors](${docs}#frameworks-and-editors)
- [React](${docs}#react)
- [Agent Status](${docs}#agent-status)
- [Testing Your App](${docs}#testing)
- [Before It Loads](${docs}#before-it-loads)
- [API](${docs}#api)
`;
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
      references: [{ name: 'Docs', url: `${HOMEPAGE}docs/` }],
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
  /* Setting null or undefined removes the attribute, so setters take them even where getters never return them. */
  const props = API.attributes
    .map(a => {
      const type = alias(a) || tsType(a);
      const doc = `  /** ${a.description} */\n`;
      if (a.type === 'boolean') return `${doc}  ${a.name}: ${type};\n`;
      const set = [...new Set([...type.split(' | '), 'null', 'undefined'])].join(' | ');
      return `${doc}  get ${a.name}(): ${type};\n  set ${a.name}(value: ${set});\n`;
    })
    .join('');
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
/* Latin only. Fontsource's per-subset files have no unicode-range, so every subset listed here downloads on every page. */
const FONTS = [
  'martian-mono/latin-400',
  'martian-mono/latin-500',
  'schibsted-grotesk/latin-400',
  'schibsted-grotesk/latin-500',
  'schibsted-grotesk/latin-700',
];
/* Gzip limits for each page's inline CSS, about 10% over what each shipped with. */
const CSS_BUDGET_KB = { landing: 12.8, docs: 9.8, 404: 7.6 };
/* Every width a site @media query may use, so breakpoints can't drift apart. */
const BREAKPOINTS = ['480px', '600px', '860px', '1200px'];

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

/* The docs' reference tables are copied from api.json, so the build writes them: they're in the HTML for readers without JS, and they can't drift from the API. */
const docsTables = () => {
  const ATTR = Object.fromEntries(API.attributes.map(a => [a.name, a]));
  const USE_IT = {
    working: 'For the whole wait, from the first step to the last.',
    done: 'Once the work is really finished, not just sent.',
    error: 'Always with words beside it that say what broke.',
    warning: 'When someone has to act on an approval, a conflict, or a sign-in, and nothing is broken.',
    idle: 'For anything ready, queued, or up to date, when nobody is waiting on it.',
  };
  const GUIDE = {
    skin: '#tells',
    state: '#states',
    color: '#match-text',
    scheme: '#match-scheme',
    label: '#labels',
    paused: '#pausing',
  };
  const codeify = text => text.replace(/\b[\w-]+\(\)/g, '<code>$&</code>');
  const codeOrDash = v => (v == null || v === false ? '—' : `<code>${v}</code>`);
  return {
    'tell-rows': Object.entries(ATTR.skin.values)
      .map(
        ([s, about]) =>
          `<tr><td class="tell-cell"><tiny-tell skin="${s}" label=""></tiny-tell></td><th scope="row"><code>${s}</code></th><td>${about}</td></tr>`
      )
      .join(''),
    'state-rows': Object.entries(ATTR.state.values)
      .map(
        ([s, about]) =>
          `<tr><td class="tell-cell"><tiny-tell skin="drones" state="${s}" label=""></tiny-tell></td><th scope="row"><code>${s}</code></th><td>${about}</td><td>${USE_IT[s]}</td></tr>`
      )
      .join(''),
    'attr-rows': API.attributes
      .map(
        a =>
          `<tr><th scope="row"><code>${a.name}</code></th><td>${
            a.name === 'skin'
              ? 'One of the six <a href="#tells">tells</a>'
              : a.name === 'state'
                ? 'One of the five <a href="#states">states</a>'
                : a.values
                  ? Object.keys(a.values)
                      .map(v => `<code>${v}</code>`)
                      .join(', ')
                  : a.type === 'boolean'
                    ? 'boolean'
                    : 'text'
          }<br><span class="wa-caption-s">${a.description} <a href="${GUIDE[a.name]}">How to use it</a>.</span></td><td>${codeOrDash(a.default)}</td></tr>`
      )
      .join(''),
    'css-property-rows': API.cssProperties
      .map(
        c =>
          `<tr><th scope="row"><code>${c.name}</code></th><td>${codeOrDash(c.default)}</td><td>${codeify(c.description)}</td></tr>`
      )
      .join(''),
    'css-part-rows': API.cssParts
      .map(c => `<tr><th scope="row"><code>${c.name}</code></th><td>${codeify(c.description)}</td></tr>`)
      .join(''),
    'custom-state-rows': Object.entries(ATTR.state.values)
      .map(([s, about]) => `<tr><th scope="row"><code>:state(${s})</code></th><td>${about}</td></tr>`)
      .join(''),
    'support-tags': Object.entries(SUPPORT)
      .map(([browser, v]) => `<li><wa-tag class="studio" appearance="outlined" size="xs">${browser} ${v}</wa-tag></li>`)
      .join(''),
    'event-rows': API.events
      .map(
        e =>
          `<tr><th scope="row"><code>${e.name}</code></th><td>${e.cancelable ? 'Yes' : 'No'}</td><td>${codeify(e.description)}</td></tr>`
      )
      .join(''),
    'static-rows': API.statics
      .map(
        m =>
          `<tr><th scope="row"><span class="wa-cluster wa-gap-xs wa-flex-nowrap"><code>${API.class}.${m.name}</code>${m.readonly ? '<wa-tag class="studio" appearance="outlined" size="xs">Read-Only</wa-tag>' : ''}</span></th><td><code>${m.type}</code></td><td>${m.description}</td></tr>`
      )
      .join(''),
  };
};

/* Each heading is named by its own text, because a link inside a heading otherwise joins its accessible name ("Get Started Link to Get Started"). An h2 links to its section, whose id isn't always the heading's. */
const addAnchors = html => {
  const sections = [];
  const anchored = html.replace(
    /<section\b([^>]*)>|<\/section>|<(h2|h3)( id="([^"]+)")?>([^<]+)<\/\2>/g,
    (match, sectionAttrs, level, idAttr, id, text) => {
      if (sectionAttrs !== undefined) {
        sections.push(sectionAttrs.match(/\sid="([^"]+)"/)?.[1] ?? '');
        return match;
      }
      if (match === '</section>') {
        sections.pop();
        return match;
      }
      const target = level === 'h2' ? sections.at(-1) : id;
      if (level === 'h2' && !target) throw new Error(`docs.html: an h2 outside a section with an id: ${match}`);
      if (!target) return match;
      const label = text.replaceAll('"', '&quot;');
      return `<${level}${idAttr ?? ''} aria-label="${label}">${text}<a class="heading-anchor" href="#${target}"><wa-icon family="sharp" variant="regular" name="anchor" label="Link to ${label}"></wa-icon></a></${level}>`;
    }
  );
  const missed = anchored.match(/<h2\b(?![^>]*aria-label)[^>]*>|<h3\b(?=[^>]*\sid=)(?![^>]*aria-label)[^>]*>/);
  if (missed)
    throw new Error(`docs.html: no anchor for ${missed[0]} (keep anchored headings to plain text, with only an id)`);
  return anchored;
};

const preparePage = async ({ body, script, root, size, hasAnchors, name }) => {
  const js = await bundle(`tools/site/${script}`, { minify: true });
  /* tokens.css declares the layer order, so it comes first. */
  const css = ['tokens', 'base', 'shell', 'components', name].map(file => read('tools', 'site', 'css', `${file}.css`));
  const { code: styles } = await transform(css.join('\n'), { loader: 'css', minify: true });
  const fills = {
    header: read('tools', 'site', 'header.html'),
    footer: read('tools', 'site', 'footer.html'),
    wordmark: read('tools', 'site', 'wordmark.html'),
    ...docsTables(),
  };
  const values = {
    root,
    version: VERSION,
    size,
    prompt: attr(ASSISTANT_PROMPT),
    rules: attr(AGENT_RULES),
  };
  const source = read('tools', 'site', body);
  const html = (hasAnchors ? addAnchors(source) : source)
    .replace(/\{\{([\w-]+)\}\}/g, (match, name) => fills[name] ?? match)
    .replace(/\{\{(root|version|size|prompt|rules)\}\}/g, (_, name) => values[name]);
  const leftover = html.match(/\{\{[\w-]+\}\}/);
  if (leftover) throw new Error(`${body}: unfilled placeholder ${leftover[0]}`);
  const components = [...(html + js).matchAll(/<(wa-[a-z-]+)|createElement\(['"](wa-[a-z-]+)['"]\)/g)].map(m =>
    (m[1] || m[2]).slice(3)
  );
  return { js, styles, html, components };
};

/* Web Awesome's guide for bundlers: cherry-pick each component from dist. The list is every wa-* tag any page uses, so one file serves and caches across pages. */
const waBundle = async components => {
  const contents = [
    ...components.map(name => `import '@awesome.me/webawesome/dist/components/${name}/${name}.js';`),
    "import './tools/site/wa-system-icons.js';",
    "export { allDefined } from '@awesome.me/webawesome';",
  ].join('\n');
  const { metafile } = await build({
    stdin: { contents, resolveDir: ROOT, loader: 'js' },
    bundle: true,
    format: 'esm',
    minify: true,
    outdir: join(ROOT, 'site', 'assets'),
    entryNames: 'webawesome-[hash]',
    define: { __FA_VERSION__: JSON.stringify(FA_VERSION) },
    metafile: true,
    logLevel: 'warning',
  });
  const files = Object.keys(metafile.outputs).filter(file => file.endsWith('.js'));
  if (files.length !== 1) throw new Error(`Expected one Web Awesome bundle, got ${files.join(', ') || 'none'}`);
  return files[0].split('/').pop();
};

const sitePage = ({ root, title, description, path, isNoindex, isHandLettered }, { js, styles, html }, waFile) => {
  /* wa-page renders as desktop until its resize observer runs, then jumps to mobile; setting its view before it upgrades skips the jump. */
  const page = html.replace(
    /<wa-page\b[^>]*>/,
    tag =>
      `${tag}<script>{const p = document.currentScript.parentElement; p.setAttribute('view', document.documentElement.clientWidth >= parseFloat(p.getAttribute('mobile-breakpoint') ?? 768) ? 'desktop' : 'mobile'); document.currentScript.remove();}</script>`
  );
  return `<!doctype html>
<html lang="en" data-fa-kit-code="${FA_KIT}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${favicon(root)}
${pageMeta({ title, description, path })}${isNoindex ? '\n<meta name="robots" content="noindex">' : ''}
<script>const d = document.documentElement.dataset; d.loading = d.upgrading = ''; setTimeout(() => { delete d.loading; delete d.upgrading; }, 2000);
(${setScheme})();</script>
<link rel="preconnect" href="https://ka-p.fontawesome.com" crossorigin>
<link rel="stylesheet" href="${root}assets/vendor.css">${isHandLettered ? `\n<link rel="stylesheet" href="${root}assets/hand.css">` : ''}
<script type="module" src="${root}assets/${waFile}" data-webawesome="${root}assets"></script>${umamiTag()}
<style>
${styles}</style>
</head>
<body data-syntax-theme="drafting">
${page}
<script type="module">
${js}
</script>
<script type="module" src="${root}assets/microlighter/microlighter.min.js"></script>
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
  `/*! Tiny Tells ${VERSION} · reserves each tell's space until the element loads · MIT */\n:where(tiny-tell:not(:defined):not([hidden])) { ${BOX} overflow: hidden; }\n`,
  'dist',
  'reserve.css'
);
write(JSON.stringify(manifest(), null, 2) + '\n', 'dist', 'custom-elements.json');
write(JSON.stringify(vscodeData(), null, 2) + '\n', 'dist', 'vscode.html-custom-data.json');
write(dts(), 'dist', 'tiny-tells.d.ts');
write(playDts(), 'dist', 'tiny-tells-play.d.ts');
console.log('wrote dist/custom-elements.json, dist/vscode.html-custom-data.json, dist/*.d.ts');
/* Web Awesome's stylesheet is a chain of @imports, so it's bundled into one file with the fonts. */
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
cpSync(join(ROOT, 'node_modules', 'microlighter', 'dist'), join(ROOT, 'site', 'assets', 'microlighter'), {
  recursive: true,
  filter: path => !path.endsWith('.d.ts'),
});

const SIZE_KB = gzipKb(minified['tiny-tells']).toFixed(1);
const PAGES = [
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
      isHandLettered: true,
      name: 'landing',
    },
  ],
  [
    ['site', 'docs', 'index.html'],
    {
      body: 'docs.html',
      script: 'docs.js',
      hasAnchors: true,
      root: '../',
      path: 'docs/',
      title: 'Docs · Tiny Tells',
      description:
        'Get a tell into your app in three steps, then make it fit: size, color, accessibility, frameworks, and the full API.',
      name: 'docs',
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
      name: '404',
    },
  ],
];
const prepared = await Promise.all(PAGES.map(([, opts]) => preparePage({ ...opts, size: SIZE_KB })));
const waFile = await waBundle([...new Set(prepared.flatMap(({ components }) => components))].sort());
console.log(`wrote site/assets/${waFile}`);
PAGES.forEach(([out, opts], i) => {
  const html = sitePage(opts, prepared[i], waFile);
  console.log('wrote', write(html, ...out), `(${Math.round(html.length / 1024)} KB)`);
});
['og.png', 'readme.gif', 'readme-dark.gif'].forEach(name =>
  copyFileSync(join(ROOT, 'tools', 'og', name), join(ROOT, 'site', name))
);
ICONS.forEach(name => copyFileSync(join(ROOT, 'tools', 'favicon', name), join(ROOT, 'site', name)));
console.log('wrote site/og.png, the README strips, and the favicons');
const llms = llmsTxt(SIZE_KB);
const builtDocs = read('site', 'docs', 'index.html');
const deadAnchors = [...llms.matchAll(/docs\/#([\w-]+)\)/g)]
  .map(m => m[1])
  .filter(id => !builtDocs.includes(`id="${id}"`));
if (deadAnchors.length) throw new Error(`llms.txt links to docs anchors that don't exist: ${deadAnchors.join(', ')}`);
console.log('wrote', write(llms, 'site', 'llms.txt'));

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
  PAGES.forEach(([out, { name }], i) => {
    const kb = gzipKb(prepared[i].styles);
    const budgetKb = CSS_BUDGET_KB[name];
    isOver ||= !budgetKb || kb > budgetKb;
    console.log(`budget: ${out.join('/')} inline CSS is ${kb.toFixed(1)} KB gzip (limit ${budgetKb} KB)`);
  });
  /* npm publish runs --check, so a version can't ship without its changelog section. */
  const hasChangelog = new RegExp(`^## ${VERSION.replaceAll('.', '\\.')}( |$)`, 'm').test(read('CHANGELOG.md'));
  console.log(`changelog: ${hasChangelog ? 'has' : 'MISSING'} a "## ${VERSION}" section`);
  const strays = readdirSync(join(ROOT, 'tools', 'site', 'css'))
    .flatMap(file => read('tools', 'site', 'css', file).match(/@media[^{]*/g) ?? [])
    .flatMap(query => query.match(/\d+(?:\.\d+)?(?:px|rem)/g) ?? [])
    .filter(width => !BREAKPOINTS.includes(width));
  console.log(
    `breakpoints: ${strays.length ? `NOT in BREAKPOINTS: ${[...new Set(strays)].join(', ')}` : 'all in BREAKPOINTS'}`
  );
  if (args.includes('--check') && (isOver || !hasChangelog || strays.length)) process.exit(1);
}
