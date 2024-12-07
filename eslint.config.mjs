import globals from "globals"
import pluginJs from "@eslint/js"
import tseslint from "typescript-eslint"
import eslintConfigPrettier from "eslint-config-prettier"

export default tseslint.config(
    { files: ["**/*.{js,mjs,cjs,ts}"] },
    { ignores: ["eslint.config.mjs"] },
    {
        languageOptions: {
            globals: globals.browser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    pluginJs.configs.recommended,
    tseslint.configs.strictTypeChecked,
    eslintConfigPrettier,
)
