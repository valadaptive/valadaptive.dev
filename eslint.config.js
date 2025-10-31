// @ts-check
import tseslint from 'typescript-eslint';
import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

export default tseslint.config(
    {
        ignores: [
            '**/dist/**/*',
            'bundles/**/*',
            'src/js/pagefind-web.d.ts',
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        plugins: {
            '@stylistic': stylistic,
        },
        languageOptions: {
            parserOptions: {
                project: [
                    './packages/*/tsconfig.json',
                    './tsconfig.json',
                ],
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals['shared-node-browser'],
            },
        },
        rules: {
            // Built-in ESLint rules
            camelcase: ['error', {
                properties: 'never',
            }],
            eqeqeq: ['off'],
            'no-console': ['error'],
            'no-constant-condition': ['error', {
                checkLoops: false,
            }],
            'no-control-regex': ['off'],
            'no-mixed-operators': ['error'],
            'no-multiple-empty-lines': ['error', {
                max: 2,
                maxBOF: 0,
                maxEOF: 0,
            }],
            'no-throw-literal': ['error'],
            'no-unneeded-ternary': ['error'],
            'prefer-const': ['error'],

            // TypeScript ESLint rules
            '@typescript-eslint/no-empty-object-type': ['off'],
            '@typescript-eslint/no-misused-promises': ['error', {
                checksVoidReturn: false,
            }],
            '@typescript-eslint/no-unused-vars': ['error', {
                args: 'after-used',
                varsIgnorePattern: '__.*$',
            }],

            // Stylistic rules
            '@stylistic/array-bracket-spacing': ['error', 'never'],
            '@stylistic/block-spacing': ['error', 'never'],
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/comma-spacing': ['error'],
            '@stylistic/comma-style': ['error'],
            '@stylistic/eol-last': ['error', 'always'],
            '@stylistic/function-call-spacing': ['error', 'never'],
            '@stylistic/indent': ['error', 4, {
                SwitchCase: 1,
            }],
            '@stylistic/key-spacing': ['error', {
                beforeColon: false,
                afterColon: true,
                mode: 'strict',
            }],
            '@stylistic/keyword-spacing': ['error', {
                before: true,
                after: true,
            }],
            '@stylistic/max-len': [1, {
                code: 120,
                tabWidth: 4,
                ignoreUrls: true,
                ignoreTemplateLiterals: true,
            }],
            '@stylistic/member-delimiter-style': ['error'],
            '@stylistic/new-parens': ['error'],
            '@stylistic/newline-per-chained-call': ['error'],
            '@stylistic/no-trailing-spaces': ['error', {
                skipBlankLines: true,
            }],
            '@stylistic/object-curly-spacing': ['error'],
            '@stylistic/object-property-newline': ['error', {
                allowAllPropertiesOnSameLine: true,
            }],
            '@stylistic/operator-linebreak': ['error', 'after', {
                overrides: {
                    '|': 'ignore',
                },
            }],
            '@stylistic/quotes': ['error', 'single', {
                allowTemplateLiterals: 'always',
                avoidEscape: true,
            }],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/semi-spacing': ['error'],
            '@stylistic/space-before-function-paren': ['error', 'never'],
            '@stylistic/space-in-parens': ['error'],
            '@stylistic/space-infix-ops': ['error'],
            '@stylistic/space-unary-ops': ['error'],
        },
    },
    {
        files: ['**/*.{js,mjs,cjs,jsx}'],
        ...tseslint.configs.disableTypeChecked,
    },
    {
        files: ['**/*.cjs'],
        languageOptions: {
            sourceType: 'commonjs',
        },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
);
