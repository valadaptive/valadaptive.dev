import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as sass from 'sass';
import * as cheerio from 'cheerio';
import * as esbuild from 'esbuild';
import * as pagefind from 'pagefind';

import postcss from 'postcss';
import postcssUrl from 'postcss-url';
import cssnano from 'cssnano';

import markdownItAnchor from 'markdown-it-anchor';
import markdownItAttrs from 'markdown-it-attrs';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItShiki from '@shikijs/markdown-it';
import {bundledThemes} from 'shiki/themes';

import {eleventyImageTransformPlugin} from '@11ty/eleventy-img';
import eleventyNavigationPlugin from '@11ty/eleventy-navigation';
import {feedPlugin} from '@11ty/eleventy-plugin-rss';
import {RenderPlugin} from '@11ty/eleventy';

const postcssConfig = {
    plugins: [
        postcssUrl({
            url: 'inline',
            maxSize: 0,
            filter: '**/*.svg',
            fallback: 'copy',
        }),
        cssnano({preset: 'default'}),
    ],
    options: {},
};

const shikiPlugin = await (async() => {
    const darkTheme = structuredClone((await bundledThemes['catppuccin-mocha']()).default);
    const lightTheme = structuredClone((await bundledThemes['catppuccin-latte']()).default);

    for (const tokenColors of [
        darkTheme.tokenColors,
        lightTheme.tokenColors,
    ]) {
        if (!tokenColors) continue;
        for (const tokenSetting of tokenColors) {
            delete tokenSetting.settings.fontStyle;
        }
    }

    darkTheme.colors = lightTheme.colors = {
        'editor.background': 'var(--code-background)',
        'editor.foreground': 'var(--text-color)',
    };

    return await markdownItShiki({
        themes: {
            light: lightTheme,
            dark: darkTheme,
        },
    });
})();

export default function(eleventyConfig) {
    eleventyConfig.addPassthroughCopy('src/assets');
    eleventyConfig.addPassthroughCopy('src/blog/**/*.svg');

    eleventyConfig.addPlugin(RenderPlugin);
    eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
        widths: ['auto'],
        formats: ['svg', 'webp'],
        svgShortCircuit: true,
        urlPath: '/assets/images/',
        outputDir: '_site/assets/images/',
        htmlOptions: {
            imgAttributes: {
                loading: 'lazy',
                decoding: 'async',
            },
        },
        transformOnRequest: false,
    });

    eleventyConfig.amendLibrary('md', mdlib => {
        mdlib = mdlib
            .use(markdownItAttrs)
            .use(markdownItAnchor, {permalink: markdownItAnchor.permalink.headerLink({safariReaderFix: true})})
            .use(markdownItFootnote)
            .use(shikiPlugin);

        mdlib.renderer.rules.footnote_block_open = () => (
            '<section class="footnotes">\n' +
            '<ol class="footnotes-list">\n'
        );

        return mdlib;
    });

    eleventyConfig.addPlugin(eleventyNavigationPlugin);

    eleventyConfig.addPlugin(feedPlugin, {
        type: 'rss',
        outputPath: '/rss.xml',
        collection: {
            name: 'posts',
            limit: 10,
        },
        metadata: {
            language: 'en',
            title: 'valadaptive.dev',
            base: 'https://valadaptive.dev',
            author: {
                name: 'Valadaptive',
            },
        },
    });

    eleventyConfig.addTemplateFormats('scss');
    eleventyConfig.addExtension('scss', {
        outputFileExtension: 'css',
        async compile(inputContent, inputPath) {
            const parsed = path.parse(inputPath);
            const sassResult = sass.compileString(inputContent, {
                loadPaths: [
                    parsed.dir || '.',
                    this.config.dir.includes,
                ],
            });

            this.addDependencies(inputPath, sassResult.loadedUrls);
            let outputPromise;

            return async() => {
                if (!outputPromise) {
                    outputPromise = (async() => {
                        const {plugins, options} = postcssConfig;
                        const processor = postcss(plugins);

                        const postcssOptions = {...options};
                        if (!postcssOptions.from) postcssOptions.from = inputPath;
                        if (!postcssOptions.to) {
                            const cssPath = path.join(parsed.dir, `${parsed.name}.css`);
                            postcssOptions.to = cssPath;
                        }

                        const postcssResult = await processor.process(sassResult.css, postcssOptions);

                        for (const message of postcssResult.messages) {
                            if (message.type === 'dependency' && message.file) {
                                this.addDependencies(inputPath, [message.file]);
                            }
                        }

                        return postcssResult.css;
                    })();
                }

                return outputPromise;
            };
        },
    });

    eleventyConfig.addCollection('indexablePages', function(collectionsApi) {
        return collectionsApi.getAll().filter(function(item) {
            return item.page.outputFileExtension === 'html';
        });
    });

    eleventyConfig.addTransform('externalify', async function(content) {
        if (this.page.outputFileExtension !== 'html' || !(this.page.outputPath.endsWith('.html'))) {
            return content;
        }
        const $ = cheerio.load(content);
        for (const link of $('a')) {
            if (typeof link.attribs.href === 'string' && link.attribs.href.includes('://') && typeof link.attribs.class === 'undefined') {
                link.attribs.class = 'external-link';
            }
        }
        return $.html();
    });

    eleventyConfig.addFilter('readableDate', dateObj => {
        return Intl.DateTimeFormat('en-US', {year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'})
            .format(dateObj);
    });

    eleventyConfig.addFilter('htmlDateString', dateObj => {
        return dateObj.toISOString().split('T')[0];
    });

    eleventyConfig.addPreprocessor('drafts', '*', data => {
        if (data.draft) {
            return false;
        }
    });

    eleventyConfig.on('eleventy.after', async function({dir, outputMode, results}) {
        if (outputMode !== 'fs') return;

        const {errors, index} = await pagefind.createIndex();
        if (errors.length > 0) throw new Error(errors.join('\n'));

        for (const result of results) {
            if (result.outputPath.endsWith('.html')) {
                const {errors} = await index.addHTMLFile({url: result.url, content: result.content});
                for (const error of errors) {
                    // eslint-disable-next-line no-console
                    console.warn(error);
                }
            }
        }

        await index.writeFiles({outputPath: path.join(dir.output, 'pagefind')});
        // We don't use these
        await Promise.all([
            fs.unlink(path.join(dir.output, 'pagefind', 'pagefind-ui.js')),
            fs.unlink(path.join(dir.output, 'pagefind', 'pagefind-ui.css')),
            fs.unlink(path.join(dir.output, 'pagefind', 'pagefind-modular-ui.js')),
            fs.unlink(path.join(dir.output, 'pagefind', 'pagefind-modular-ui.css')),
            fs.unlink(path.join(dir.output, 'pagefind', 'pagefind-highlight.js')),
        ]);
        await index.deleteIndex();
    });

    eleventyConfig.addWatchTarget('src/js/');
    eleventyConfig.on('eleventy.after', async function({dir}) {
        await esbuild.build({
            entryPoints: ['src/js/search.tsx', 'src/js/vfx.ts'],
            bundle: true,
            splitting: true,
            outdir: path.join(dir.output, 'js'),
            format: 'esm',

            jsx: 'transform',
            jsxFactory: 'h',
            jsxFragment: 'Fragment',
            jsxImportSource: 'preact',

            alias: {
                'pagefind-web': '/pagefind/pagefind.js',
            },
            external: ['/pagefind/pagefind.js'],
            sourcemap: 'linked',
            minify: true,
        });
    });

    return {
        dir: {
            input: 'src',
            output: '_site',
            includes: '_includes',
            layouts: '_layouts',
            data: '_data',
        },
    };
};
