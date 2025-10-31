import postcssUrl from 'postcss-url';
import cssnano from 'cssnano';

export default {
    plugins: [
        postcssUrl({
            url: 'inline',
            maxSize: 0,
            filter: '**/*.svg',
            fallback: 'copy',
        }),
        cssnano({preset: 'default'}),
    ],
};
