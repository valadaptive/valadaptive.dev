---
date: 2025-09-24
title: The making of Glypht
draft: true
---

For the past few months, I've been working on [Glypht](https://glypht.valadaptive.dev), a toolkit for packaging web fonts. In this post, I'll go into what it is and why I made it, and take you through what it was like to develop.

## What and why

If you're designing a website, you'll probably want to use some web fonts to make it look pretty. However, getting *good* web fonts isn't a straightforward process. Packaging fonts for the web requires special considerations and takes several steps:

- To keep your website fast, you need to *subset* your fonts--this means reducing its character set to cover only the languages your site uses. If you're using [variable fonts](https://fonts.google.com/knowledge/introducing_type/introducing_variable_fonts), subsetting can also reduce the variation space to encompass only the variations that your site uses as well.

- You may also want to *instance* your fonts. This is the font equivalent of [code splitting](https://web.dev/articles/reduce-javascript-payloads-with-code-splitting), and ties into subsetting: you can split up your fonts by character set (or variation), meaning that browsers will only fetch fonts necessary to display the current page's text.

- You'll definitely need to *compress* your fonts. In all modern browsers, you'll be using the [WOFF2](https://www.w3.org/TR/WOFF2/) format. Compressing your fonts into this format requires its own tooling, of course.

- Finally, you'll need to *put those fonts in your CSS*, using [the `@font-face` rule](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face). Depending on the number of font instances you're using, this can be quite tedious. Also, if you split up your font files by language coverage like I mentioned above, [you'll need to specify the exact character ranges supported by each font file, inline within the CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range). Fun!

There are a couple of ways to do this, but all of them are a bit lacking.

### 1. Google Fonts

First off, you can [just use Google Fonts](https://fonts.google.com/); this is not without its complications. Because it's a third-party CDN, [the fonts can be updated out from under you](https://pimpmytype.com/google-fonts-hosting/). [Using it may violate the GDPR](https://github.com/google/fonts/issues/5537).[^1] Their fonts [are also stripped of most OpenType features](https://github.com/google/fonts/issues/1335), meaning you can't enable things like stylistic alternates (for instance, the venerable Inter font lets you use alternate forms of the "I" and "l" characters that are less ambiguous, and indeed GitLab and MDN do this, but Google Fonts strips those alternate forms).

You can self-host Google fonts using [Fontsource](https://fontsource.org/). This solves the "third-party CDN" problem at least. However, those fonts are distributed via NPM, so they require a build step using a bundler that knows how to handle them. At the time I'm writing this blog post, they also ship the stripped-down versions of fonts from Google's CDN.[^2]

[google-webfonts-helper](https://gwfh.mranftl.com/fonts) is basically the same, except it doesn't support variable fonts (it doesn't seem to have been updated in a long time). This makes the resulting fonts even larger.

If you want to self-host a Google font on your own static site, without depending on a bundler, and take advantage of variable fonts, then you can look forward to [this rigmarole](https://blog.velocifyer.com/Posts/3,0,0,2025-8-13,+how+to+self+host+a+font+from+google+fonts.html).

The other downside to all of these approaches, of course, is that you're restricted to the Google Fonts library! If you want to use any of the [beautiful](https://dotcolon.net/) [non-Google](https://github.com/eigilnikolajsen/commit-mono) [fonts](https://monaspace.githubnext.com/) available online, you're out of luck.

### 2. Doing it yourself

The other route is to replicate Google Fonts' process yourself, using open-source tooling to subset and compress the fonts yourself and then creating your own CSS. [Here's one such guide on doing so](https://damieng.com/blog/2021/12/03/using-variable-webfonts-for-speed/).[^3]

The tooling here is kinda lackluster. The guide linked above recommends [fontTools](https://fonttools.readthedocs.io/), which is a Python package. Maybe if you're already set up for web development, installing Python stuff isn't too much of an ask. For me, it feels like every other `pip install` that I run gives me an obscure error with 0 search results because some wheel build doesn't like my GCC version, or Python made a breaking change to the language, or I forgot to set up a virtualenv once and now some dependency conflicts with my global `site-packages`.

As that guide also notes, it's hard to specify good Unicode character sets:

> Unfortunately there is no easy language option but you can specify unicode ranges `--unicodes=` or even text files full of characters `--text-file=` or simply provide a list of characters with `--text=`. If you go the unicode range route then [Unicodepedia](https://www.unicodepedia.com/groups/) has some good coverage of what you'll need.

Writing down and keeping track of these character sets can be annoying, especially if you later need to add more language coverage to your site and need to go back and subset the fonts all over again. [Google Fonts has a nice repository of predefined character sets](https://github.com/googlefonts/nam-files/), but they're not in the format that `pyftsubset` expects.

There *was* a tool that handles a lot of this for you in a nice GUI, and technically it still exists: it's [FontSquirrel's webfont generator](https://www.fontsquirrel.com/tools/webfont-generator). Unfortunately, it's inordinately slow (it takes 10 seconds to upload a single small font, and a full minute to process it), doesn't handle variable fonts at all, and is heavily geared towards the legacy web.

### Enter Glypht

Glypht is my contribution to the font tooling ecosystem. It performs all the steps I listed earlier, providing a complete web font processing pipeline. It lets you subset your fonts according to Google Fonts' nice character sets (or your own custom Unicode ranges), splits them up by language, compresses them in parallel, and generates a CSS file.

Glypht started out solely as a web app (my goal was a modern recreation of FontSquirrel's webfont generator), but I've added a CLI as well. It uses [HarfBuzz](https://github.com/harfbuzz/harfbuzz) for the subsetting, the [woff2](https://github.com/google/woff2) library for WOFF2 compression, and [sfnt2woff-zopfli](https://github.com/bramstein/sfnt2woff-zopfli) for WOFF compression (if you still need that).

In some sense, it's "just" a wrapper around [hb-subset](https://harfbuzz.github.io/utilities.html#utilities-command-line-hbsubset) and the WOFF/WOFF2 libraries. But Glypht adds enough functionality to make the process much smoother: it sorts the fonts into families, analyzes the predefined character sets covered by each font, creates the full matrix of font instances, creates unique filenames for each output font (a surprisingly tricky problem), and generates CSS which includes the correct Unicode ranges for every font face.

All the libraries are compiled to WebAssembly, so the webapp is entirely client-side (it'll never go down) and the CLI has no native dependencies and fits right in with other web tooling.

Now that I've explained the "why", let's move on to the "how".

## The wrapper

HarfBuzz offers their own WebAssembly package called [harfbuzzjs](npmjs.com/package/harfbuzzjs), but it makes it hard to load the WebAssembly module, doesn't export a lot of functions I make use of, and doesn't seem to have received much love in general. Instead, I opted to compile it myself, which gives me full control over the exported symbols and code size.

I dealt with the expected impedance mismatch between JavaScript and C APIs. HarfBuzz's API surface is quite well-designed, so I didn't have to do anything too crazy, but the C ABI isn't very expressive.

C code involves a lot of manually freeing values, be it directly calling `free` on pointers you previously `malloc`ed, manually unref'ing refcounted objects, or calling the `destroy` method on the higher-level wrappers you've written. The [explicit resource management](https://github.com/tc39/proposal-explicit-resource-management) proposal will eventually solve this, but for the time being, the only solution involves a *lot* of `try`/`finally` to avoid leaking memory in the presence of exceptions. Helpfully, HarfBuzz's documentation explicitly tells you the ownership semantics of each function (with regards to who owns any objects that they return), but that didn't stop me from messing it up a few times and double-freeing memory.

Any C API surface also inclues a lot of caller-allocated "out" parameters. To avoid the overhead of `malloc`, Emscripten offers a stack allocation API for this: `stackAlloc`, `stackSave`, and `stackRestore`. I added a `withStack` API that saves and restores the stack for you (with ol' reliable, `try`/`finally`). It turns out Emscripten also has this but doesn't advertise it, and [is thinking about getting rid of it](https://github.com/emscripten-core/emscripten/issues/21763).

### WebAssembly woes

The tool that everyone uses to compile WebAssembly (at least for C/C++-based projects) is [emscripten](https://github.com/emscripten-core/emscripten/). It mostly works, although it does still feel like a tech demo sometimes. For every WebAssembly module, Emscripten also generates a [JavaScript module](https://raw.githubusercontent.com/valadaptive/glypht/62c3d40ee70b4771ba4afb37704283eb652c2fc6/c-libs-wrapper/hb.js), which has the responsibility of locating and loading the corresponding `.wasm` file, and hooking into it to provide functionality like typed views into the WebAssembly memory. This JS module includes its own "read file" shims for loading the module file(s), which are supposed to work isomorphically in both Node and the browser. This doesn't always work well, and doesn't really play nice with bundlers.

Eventually, I decided to bypass Emscripten's generated JavaScript module and just [reimplement the parts of it that I need](https://github.com/valadaptive/glypht/blob/62c3d40ee70b4771ba4afb37704283eb652c2fc6/glypht-core/src/wrap-wasm.ts). This cuts down on the code size, and more importantly it allows me to load WebAssembly modules in a more flexible manner. It turns out that isomorphically fetching a file stored next to a JavaScript module [still requires heroics if you want to do it cross-platform](https://github.com/valadaptive/glypht/blob/62c3d40ee70b4771ba4afb37704283eb652c2fc6/glypht-core/src/platform.ts#L33-L85). If it's a file path or a `file:///` URI, Node doesn't let you use `fetch()`. But if it's a blob URI, then you *need* to use `fetch()`. It's a really annoying bit of logic.

I believe the eventual "modern" successor to Emscripten is [wasi-sdk](https://github.com/WebAssembly/wasi-sdk/). It'll hopefully avoid a lot of the "tech-demo-y" workarounds and hacks that have accumulated in Emscripten over the years, now that WebAssembly finally has a spec for a standard library interface. I can't switch to it yet because [it generates WebAssembly that is inexplicably larger than Emscripten's](https://github.com/WebAssembly/wasi-sdk/issues/547), but it's a work in progress and hopefully I'll be able to use it eventually.

If fetching WebAssembly modules is a bit painful, *bundling* them is ten times worse. Theoretically, a vanilla JS module can get the URL for a WebAssembly module (or other static asset for that matter), using:

```js
new URL('./foo.wasm', import.meta.url)
```

which should resolve `./foo.wasm` relative to the JS module that imports it. In practice, few bundlers recognize this pattern, and all have their own ad-hoc ways for importing static assets and configuring which file extensions even count as static assets. Let's take a look:

#### esbuild

[esbuild doesn't recognize the `new URL(..., import.meta.url)` pattern](https://github.com/evanw/esbuild/issues/795). It has two ways of importing static assets currently.

The first is [the `file` loader](https://esbuild.github.io/content-types/#external-file), which copies the imported file into the output folder, and imports the *filename* as a string. This means that if you distribute the bundle as a package itself, any downstream bundler won't recognize the existence of the static file--it's just an arbitrary string.

The second is [the `copy` loader](https://esbuild.github.io/content-types/#copy), which preserves the import statement but rewrites the path. This has the opposite problem: if you depend on a package that's been bundled that way, you *need* to bundle it yourself in a way that resolves the import "for real", because you can't just `import` a .wasm file. This means your package won't work out of the box, and may even require any downstream consumers to configure *their* bundler to resolve *your* URL in a way that you expect.

#### Vite

Vite *does* recognize the `new URL(..., import.meta.url)` pattern, and will even transform import statements into it! This is what I did back when Glypht was one big webapp and I didn't need to distribute the WebAssembly components as part of a library. Unfortunately, when running Vite in "library mode", [all binary assets are base64 encoded](https://github.com/vitejs/vite/issues/4454), which adds a 33% file size overhead and makes them harder to compress. JS engines probably don't enjoy parsing 700kB string literals either.

#### Rollup

Rollup, by convention, doesn't do much by default and depends on plugins for most functionality. For static assets, there's [the `@web/rollup-plugin-import-meta-assets` plugin](https://www.npmjs.com/package/@web/rollup-plugin-import-meta-assets), which fits the bill perfectly. Unfortunately, I tried it and it just... doesn't work? I don't know what I'm doing wrong, but it doesn't recognize the URLs.

In the end, I decided to just use Rollup without that plugin, and just manually copy the WebAssembly assets into the `dist` folder. This is a bit ugly, and it mandates a build step on my end, but at least it works.

### Worker woes

Sadly, WebAssembly is not the only alien technology beyond the reach of bundlers. I'm also using [web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) to compress fonts in parallel, and subset them off of the main thread. Despite these things being introduced in *2010*, actually using them in production is apparently a famous unsolved problem in computer science, because bundlers just don't know what to do with them. The main hurdle here is that each worker must be recognized as its own *entrypoint* to be bundled separately. Once again, each bundler has its own way of doing this.

#### esbuild, rollup

esbuild and Rollup do not recognize any form of worker entrypoint. You have to add each worker to the bundler config yourself.

#### Vite

Vite recognizes two different types of worker imports. The first is its bespoke `import MyWorker from './foo-worker.js?worker'` syntax. The second, which is more useful, is that [it recognizes the `new Worker(new URL(..., import.meta.url))` pattern via a regex](https://github.com/vitejs/vite/blob/fdb758a51796b1ab605437b2eee778a84e87e169/packages/vite/src/node/plugins/workerImportMetaUrl.ts#L219), and knows to treat that URL as an entrypoint.

This regex-based worker detection created a *fun* bug for me. Node doesn't support web workers (it has its own worker API instead because it wants to), so in the `@glypht/core` package, I import [a polyfill](https://github.com/valadaptive/web-worker). When I build this package with Rollup, it will rewrite the `import Worker from 'web-worker'` into something like `import Worker$1 from 'web-worker'` in the final bundle. This is the "same" code, but it means that `new Worker(new URL(..., import.meta.url))` becomes `new Worker$1(new URL(..., import.meta.url))`, and Vite will no longer recognize it. The solution, as always, is [another Rollup plugin](https://www.npmjs.com/package/@rollup/plugin-inject) which automatically injects the polyfill under the correct name. I'm not the first person to notice this issue--[see this comment in an esbuild issue about worker support](https://github.com/evanw/esbuild/issues/312#issuecomment-864623606).

#### Node

As I mentioned, Node requires a polyfill for web workers. However, this polyfill is missing an important feature.

When you're done with a worker, you can just remove all of its event listeners, and that should allow the process to exit cleanly without terminating the worker. However, in order to translate Node's worker events to those specified in the web worker API, we need to add an event listener that we can never remove. Fortunately, Node lets you manually choose whether or not a worker thread should keep the parent process alive using `parentPort.ref()` and `parentPort.unref()`. So we can just [manually refcount the number of "real" event listeners](https://github.com/valadaptive/web-worker/blob/56a5994145a252f9a390ce6c798a3984175d8f8b/src/node/index.js#L111-L120), calling `ref()` when it's incremented from 0 and `unref()` when it hits 0.

However, after putting this solution into production, I noticed that compressing a large number of fonts would *sometimes* prevent the process from exiting. It's random whether or not it happens, and the chance seems to increase the more fonts we subset. Either I'm doing something wrong, or there's a bug in Node. Since I have no idea how to debug this on the Node side, I decided to solve the problem less elegantly at the RPC layer by [refcounting the number of in-flight RPC calls](https://github.com/valadaptive/glypht/blob/62c3d40ee70b4771ba4afb37704283eb652c2fc6/glypht-core/src/worker-rpc.ts#L164-L167) and terminating the worker once it hits 0.

## The webapp

The frontend uses [Preact with signals](https://preactjs.com/guide/v10/signals/). Maybe it's a bit of a niche framework, but I've been using it for a while and I appreciate the lack of compile-time magic. It sticks to React's original "just a library" philosophy, and it works quite well. I started out learning React, switched to Preact because it was faster and smaller, and stuck with it as it began to diverge from React. I have no idea what on earth React is off doing now.

I'm also not using any off-the-shelf UI framework, since it's hard to find one for Preact. I have a collection of UI elements that I copy from project to project, refining them each time, and they work well. My CSS could probably stand to be a bit cleaner; right now I'm just doing the traditional "reference elements by class name and add properties until the layout works" thing. Tailwind always seemed to add more complexity than it removes. I may look into [vanilla-extract](https://vanilla-extract.style) for future projects though.

Despite the WebAssembly modules being unavoidably large, I still try to avoid bringing in unnecessary dependencies and performing unnecessary computations. For instance, it's nice to syntax-highlight the CSS that Glypht generates. Instead of bringing in a syntax highlighting library for this, I created a "CSS generator" class that outputs token types as well. Why re-parse the CSS that we just generated?

### Adding the Google Fonts browser

One of the ideas I had for Glypht initially, but didn't ship when I initially released it, was allowing users to pick fonts from the Google Fonts catalog. I'm glad I saved this for later, because it was an endeavor.

I mentioned many times that font files shipped from Google Fonts come with most OpenType features missing. They also come pre-instanced, so doing your own processing on them would be a bit awkward. It turns out that these issues go away if you avoid the Google Fonts developer API, and get your fonts directly from the [Google Fonts repo](https://github.com/google/fonts). All the fonts available in their catalog are stored in this one big GitHub repo, and they're the full unprocessed versions too.

Compiling all the font metadata from the repo is not straightforward. Because this is Google, the metadata is stored in protobuf. Specifically, its [text format](https://protobuf.dev/reference/protobuf/textformat-spec/). While the Python and C++ libraries support this, [protobuf.js explicitly chose not to](https://github.com/protobufjs/protobuf.js/issues/236).

Because it's not a very important bit of code, and I wanted to get on with the more interesting parts, I used Gemini to port the Python protobuf text format parser [to JavaScript](https://github.com/valadaptive/pbtxtjs). It worked fairly well, all things considered, although it did keep making unnecessary deviations from the Python code until I told it not to. It also incorrectly translated the string literal parsing code (Python and JS treat strings somewhat differently), so I had to rewrite that part myself. Don't worry about code quality--I had Claude write a test suite.

There's some important metadata that we need to calculate ourselves: language coverage. [Google Fonts maintains a list of language metadata](https://github.com/googlefonts/lang), conveniently also vendored into the Google Fonts catalog repo. This metadata includes sample text for most languages, as well as sets of "exemplar" characters which a font must be able to render in order to count as "supporting" a language.

While a font includes a list of all Unicode codepoints it nominally supports, the *right* way to test if a font supports a language is to shape[^4] a string of the language's exemplar characters and check if there are any missing glyphs in the output. That's what HarfBuzz was originally for, and we're building it anyway for subsetting, so for the "generate Google Fonts metadata" script, I just built it again with the subsetting features disabled and the shaping features enabled.

There are around 1900 different font files, and 1700 languages, so this gets expensive quickly. Some of the exemplar character strings get quite long, so an easy optimization is to start by shaping a small substring first, and marking the language as "not covered" if that substring is missing glyphs already. This helps, but it was still quite slow--each run took about 60 seconds on a relatively high-end machine. The solution is multithreading: calculate language coverage for all the fonts in parallel. Given everything I've just said about the pain of using web workers, you can imagine how fun this was to implement. In the end, I had to use a bundler. It's worth it, though; it took the computation time from 60 seconds per run to around 8.

The next challenge is *storing* the language coverage. The Google Fonts catalog is stored in the webapp as one big JSON file containing all the fonts, and we want it to be fast to download. The initial approach was to just store the supported languages for each font as an array of language tags (e.g. `["en_Latn","es_Latn","fr_Latn","pt_Latn",...]`). This seems wasteful, but you'd be surprised what compression can do. This comes out to ~550KB zipped.

Since we're shipping a list of language metadata anyway (for sample text), we can optimize things a bit by storing an array of language indices instead of language tags. This takes the metadata file down to ~400KB zipped.

We can squeeze this down even further by storing language coverage as a bitset. Each language is a bit in the bitset: 1 if it's supported and 0 if it's not. If we sort the languages by popularity, then the start of the bitset will be mostly ones and the end of the bitset will be mostly zeroes, which helps with compression. We need to base64-encode them to store them in the JSON, but even so, this takes up around ~300KB zipped. That's a significant reduction!

Later on, I took things even further--the previous implementation sorted the languages by *population*. If we instead sort languages by the number of fonts that support them, we can reduce the bitsets' entropy even further. This means no longer calculating the language coverage and constructing the language bitsets in a single pass, because we need to know the language coverage in order to sort the languages for the bitsets. Instead, we construct the bitsets in a second pass. This takes things down to ~250KB zipped.

All in all, it takes around 1m40s to clone the Google Fonts repo and 50 seconds to compute language coverage for every font in it on GitHub Actions. Adding overhead for environment setup and such, that's around 2m45s for a complete CI run, which isn't bad at all when you consider it's computing coverage for 1700 languages over 1900 fonts. It's especially good when I compare it to [my Rust application](https://github.com/valadaptive/ntsc-rs/), which takes 4m35s to build.

In the webapp, I asynchronously import the Google Fonts browser modal, which allows it to be split from the main bundle. The combined code + font metadata + language metadata is ~375KB compressed, which isn't bad considering the sheer number of fonts.

Loading the fonts themselves is surprisingly easy. I can't ship them in the webapp itself (it runs on GitHub Pages, which has a 1GB size limit), but because the Google Fonts catalog repo is hosted on GitHub, we can just load the fonts from GitHub's CDN. `raw.githubusercontent.com` has very permissive CORS headers. The only downside seems to be that it doesn't gzip-encode the files it serves. jsDelivr does, but the on-demand compression incurs a fixed latency cost of a few hundred milliseconds. I chose to stick with GitHub, but if it turns out that most users are on a slower connection, jsDelivr may turn out to be faster on the whole.

#### Trying AI again

I used Copilot to generate some of the UI components for the Google Fonts modal, to reduce what seemed like a mountain of work and tedious boilerplate code. It generated alright-looking code, with some decent-looking CSS, but I ran into some issues that would make me think twice about using it again:

- Lack of understanding about React and the [rules of hooks](https://react.dev/reference/rules/rules-of-hooks) (e.g. it would sometimes add early returns before all hooks ran, try to use hooks inside a loop, that sort of thing). This was surprising, considering that React is quite popular and there should be lots of examples of it in the training data. Maybe this is a limitation of learning by example on a massive scale: sure, none of the training examples use hooks anywhere but the top level, but that doesn't mean it *can't* be done. Generalization is the thing that makes AI useful in the first place, after all. The only way to learn about how hooks *cannot* be used is the documentation.

- Lack of understanding about Preact signals. This is more understandable, since it's a significantly more niche framework.

- Lots of overcomplicated code, and limited ability to take a step back and modify existing code to achieve an ultimately simpler solution. Some of this might be down to Copilot's approach of reading very narrow ranges of code in order to aggressively manage context. When I code, I'm constantly jumping back and forth between different parts of code and making heavy use of "jump to definition". The closest Copilot equivalent seems to be to grep for the symbol name and then guess which search result is the definition. Copilot's approach seems penny-wise, pound-foolish: they've saved 500 lines of context by making the model reason for 2000 lines trying to find the right code.

- Many "no-op" CSS properties. Everyone's a bit guilty of adding random CSS properties until the layout works, and in the process leaving some unnecessary ones in, but Copilot's generated CSS contained a lot of properties that served no purpose and could be removed. LLMs are probably not going to be very good at CSS for a long time, since they're exclusively text-based and [even VLMs only really glance at images anyway](https://arxiv.org/abs/2505.23941).

I'm probably not going to use Copilot for this sort of thing again. I'm sure there are other, better tools for people with more disposable income to burn, but I prefer doing it myself. I'm not sure if I'm doing something wrong here, or if AI agents are just not good at anything with moderate cognitive complexity.

#### Surprise web platform bug

I'm storing font descriptions in a big file of all descriptions concatenated together. Each font's metadata contains the byte range for that font's description, which can be fetched on-demand via an HTTP range request. (It now occurs to me that I could probably do this for other metadata as well.) When implementing this, I ran into a *browser* bug!

Per the Fetch API specification, HTTP range requests should always use `Accept-Encoding: identity`. This was specified [in this PR from 2018](https://github.com/whatwg/fetch/pull/751). However, when this was implemented in Firefox, [they chose to simply add `identity` to the list of accepted encodings](https://bugzilla.mozilla.org/show_bug.cgi?id=1782835). This means that we could end up with non-`identity` encodings in the `Accept-Encoding` header.

Not to worry though: there are Web Platform Tests that cover this behavior! The only problem is that whoever implemented it in Firefox [simply changed the tests to accept the incorrect behavior](https://github.com/web-platform-tests/wpt/pull/35804), probably because [the spec is confusing](https://github.com/whatwg/fetch/issues/1850). I've since [fixed the web platform tests](https://github.com/web-platform-tests/wpt/pull/54373) and [fixed Firefox](https://phabricator.services.mozilla.com/D261327), but in the meantime, I just don't use HTTP range requests if a Firefox user agent is detected. I believe it's not possible to access the `Content-Encoding` header via the fetch API, so there's no good way to feature-detect this.

## The CLI

Glypht started out as a webapp, but I realized a CLI would be quite useful for many people as well. Glypht is basically a bundler for fonts instead of JS, so it makes sense to use it like one. This process involved setting up a monorepo and factoring out a lot of the functionality into packages that the webapp and CLI could both consume. This is also where I ran into a lot of the bundler woes I mentioned above.

The first package I split off was `@glypht/core`. Its purpose is to abstract away all the worker/WebAssembly loading business and expose parsing, subsetting, and compression functionality for single fonts at a time. [Fontsource has started using it in a new font converter tool!](https://fontsource.org/tools/converter) This package is where I ran into many of the bundler woes I described earlier. Requiring a build step is a bit annoying if I want to do things that require modifying it and the webapp simultaneously, but it works well enough.

The next package on top of it is `@glypht/bundler-utils`. This one is responsible for sorting fonts into families, analyzing which style attributes and variation axes are shared between all fonts in a family and which ones are unique per font, creating the matrix of font instances (for instance, if you have 2 character sets and 2 variation axis values, it'll produce the Cartesian product: 4 font faces), naming the output files, and generating the CSS.

Finally, there's the CLI itself. Once I'd completed the effort of disentangling and refactoring everything so it could be split into different packages, the CLI was actually quite straightforward.

The main bit of complexity is the command which generates a config file from a list of fonts. Whenever I use a command-line tool that requires a JS or JSON configuration file, I always get a bit lost trying to set it up. Inevitably, I end up with one config file I copy from project to project, adjusting it as necessary, accumulating useless config options all the while. For the Glypht CLI, I therefore created a command that generates an *annotated* configuration file tailored to the fonts you put in. I later added a similar "save settings as CLI config" button to the webapp.

To validate the CLI config, and give pretty error messages rather than failing deep in the bowels of `@glypht/core`, I'm using [Valibot](https://valibot.dev/). It's quite nice to use, although the package is huge (1.74 MB!) because it includes a bunch of built-in schemas for a bajillion different things. For Glypht, I have no need to validate hex colors, IMEI numbers, IPv6 addresses, or ISO datetimes; but they're part of the package regardless. In the end, I chose to bundle valibot, which lets me tree-shake everything I don't use. The bundle is 33 KB, which means that it'd take around 50 different packages (assuming they use a similar amount of valibot as `@glypht/cli` does) deciding to bundle it before it takes up the same amount of space in your `node_modules` as the unbundled version of the package. It'd be nice to have a validation library that only supports types that TypeScript itself defines.

## The documentation

Before launching the CLI, I knew I had to provide a better way to browse documentation than "just look at the source code". I've added documentation comments to every exported type, so I knew I wanted to generate documentation from the code instead of keeping it in sync manually. I also wanted to integrate some manually-written documentation (like tutorials and guides) as well, and integrate the documentation into the webapp.

The only JavaScript-based static site generator I know of that's not tied to a framework is [Eleventy](https://www.11ty.dev/). It's extremely flexible and can integrate well with most other build systems, even if it does take a bit of hacking. I use [eleventy-plugin-vite](https://www.11ty.dev/docs/server-vite/), which just runs Eleventy's entire output through Vite as a final build step. This means code splitting "just works", but it does complicate things a bit when plumbing things like static assets through the entire build process.

The only maintained documentation generator nowadays seems to be [TypeDoc](https://typedoc.org/). It's very powerful, but a bit hard to configure. I was hoping it'd be easy to integrate with Eleventy, but it turned out to be quite an involved process. TypeDoc really wants to either generate the *entire site* or just give you a "project reflection" type and make you render the entire thing yourself. It theoretically offers hooks that you can use to customize the default theme, but they're not flexible enough.

At first, I tried to just render the TypeDoc reflections myself, but properly formatting things like type definitions is finicky--you need to access a very specific path of object properties depending on the type, or the definition will just show up as `{}` or `any`. TypeDoc's default theme will also generate some really nice formatted code that cross-links every defined type, but [the code formatter](https://github.com/TypeStrong/typedoc/blob/bd7888a189352bfaed88793aff6f051a0b6a7ea7/src/lib/output/formatter.tsx) seems to be completely inaccessible in the public API, so if you're implementing your own theme, you'll need to just copy all that code into your project.

I then switched over to using TypeDoc's default theme. It really wants to output files: you tell it to render a document, and it writes directly to the filesystem. This doesn't work well with Eleventy, unfortunately. In order to have TypeDoc give you a list of pages and their rendered HTML content, without writing directly to disk, you need to manually tie a bunch of classes together and set up a bunch of required state that would normally be set up in the filesystem-writing methods. I got it working, but quickly discovered that the default theme is very hard to customize. It lets you define your own custom icons, but expects the icon theme to be stored as a single SVG file that you provide the path to, and hardcodes inline `<svg>` elements (I use CSS mask images instead). It outputs formatted code into non-`<code>` elements (often without *any* wrapper element you can target with CSS). It uses different syntax highlighting themes for formatted type expressions and Markdown code blocks.

The solution I ended up with was to just copy all of TypeDoc's theme code into my project (along with any utility functions and classes that it depends on), and modify it as necessary. This was mostly mechanical work: updating import paths and changing the code where necessary to not use TypeDoc-specific internal infrastructure. Claude helped with some of this but it can be quite boneheaded.

The final pipeline is a bit cursed: TypeDoc processes all the code and generates a `ProjectReflection`, Eleventy runs and turns it into documentation through a page template, and then everything from Eleventy is sent through Vite. Somehow, it all works!

## The result

Web fonts should finally be easy now! You no longer have to choose between relying on a third-party CDN, performing a manual and finicky process to subset fonts, or shipping fonts that are larger than they need to be. [Try it out yourself](https://glypht.valadaptive.dev) and let me know what you think.

[^1]: The FAQ linked in that post reportedly said that Google Fonts did not log IP addresses. In classic Google fashion, they've since redesigned the FAQ, and the section on privacy seems to be completely gone.
[^2]: This could change soon. I believe Fontsource is looking into using Glypht to subset the fonts itself!
[^3]: This guide says to base64-encode your fonts so that you can inline them directly into the CSS. Don't do this! Not only do you lose out on the ability to split up font files by character set and load them on-demand, but base64 encoding has a constant **33% size overhead**.
[^4]: For simple scripts like Latin, there's roughly a 1:1 correspondence between glyphs and codepoints. For many other scripts, this is not the case. Text shaping is the complicated task of mapping a string of codepoints to a run of glyphs (see [HarfBuzz's explanation](https://harfbuzz.github.io/what-is-harfbuzz.html#what-is-text-shaping)).
