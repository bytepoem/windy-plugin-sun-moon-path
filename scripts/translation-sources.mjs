import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Read source patterns from the actual English catalogs, excluding control values and
 * interpolation arguments. Message IDs depend on text, so wording changes require translation. */
export const readTranslationSources = async () => {
    const root = new URL('../', import.meta.url);
    const files = ['src/pluginTranslations.ts', ...(await readdir(new URL('src/locales/', root)))
        .filter(file => file.endsWith('.ts') && file !== 'packedTranslations.ts').map(file => 'src/locales/' + file)];
    const messages = new Map();
    const add = text => {
        if (!text) { return; }
        const id = 'm_' + createHash('sha256').update(text).digest('hex').slice(0, 12);
        if (messages.has(id) && messages.get(id) !== text) { throw new Error('Message ID collision'); }
        messages.set(id, text);
    };
    const collectCalls = node => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
            const pattern = node.arguments[0];
            if (!ts.isStringLiteral(pattern)) { throw new Error('Translation patterns must be string literals'); }
            add(pattern.text);
        }
        ts.forEachChild(node, collectCalls);
    };
    const collect = node => {
        if (ts.isPropertyAssignment(node)) { collect(node.initializer); return; }
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
            if (node.expression.text === 'localized') { collectCalls(node); return; }
            if (node.expression.text === 'localizedText') { add(node.arguments[0].text); return; }
        }
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) { add(node.text); return; }
        if (ts.isArrowFunction(node) || ts.isTemplateExpression(node)) {
            throw new Error('Use localized/localizedText for interpolated English messages');
        }
        ts.forEachChild(node, collect);
    };
    for (const file of files) {
        const source = ts.createSourceFile(file, await readFile(new URL(file, root), 'utf8'), ts.ScriptTarget.Latest, true);
        const visit = node => {
            if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'en' && ts.isObjectLiteralExpression(node.initializer)) {
                collect(node.initializer);
            } else { ts.forEachChild(node, visit); }
        };
        visit(source);
    }
    return Object.fromEntries([...messages].sort(([first], [second]) => first.localeCompare(second)));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    console.log(JSON.stringify(await readTranslationSources(), null, 2));
}
