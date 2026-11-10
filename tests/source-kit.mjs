// Layout-independent view of a source file, so tests that must read source text
// do not break when the code is reformatted. The result has comments removed,
// insignificant whitespace removed (esbuild minifyWhitespace: no renaming, no
// syntax rewriting) and every plain string literal written with single quotes.
// Write regexes against this form: no spaces around operators, `case'x':`, `'x'`, and the last
// statement of a block has no `;` (match `[;}]`).
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const BS = String.fromCharCode(92);
const REGEX_PRECEDERS = '(,=:[!&|?{};+-*%<>~^';

// Re-quote "..." literals as '...' when that needs no extra escaping. Regex
// literals are copied untouched; template literals are copied but the code inside
// their ${ } holes is re-quoted too.
function requote(code) {
  const n = code.length;
  let i = 0;
  // Scans code from i; in a ${ } hole it stops after the closing brace.
  function scan(hole) {
    let out = '';
    let last = '';
    let depth = 0;
    while (i < n) {
      const c = code[i];
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && code[j] !== c) j += code[j] === BS ? 2 : 1;
        const body = code.slice(i + 1, j);
        out += c === '"' && !body.includes("'") ? "'" + body.split(BS + '"').join('"') + "'" : code.slice(i, j + 1);
        i = j + 1;
        last = "'";
      } else if (c === '`') {
        out += '`';
        i++;
        while (i < n && code[i] !== '`') {
          if (code[i] === BS) {
            out += code.slice(i, i + 2);
            i += 2;
          } else if (code[i] === '$' && code[i + 1] === '{') {
            out += '${';
            i += 2;
            out += scan(true);
          } else out += code[i++];
        }
        out += '`';
        i++;
        last = '`';
      } else if (c === '/' && code[i + 1] !== '/' && (last === '' || REGEX_PRECEDERS.includes(last) || /(return|typeof)$/.test(out.slice(-8)))) {
        let j = i + 1;
        let cls = false;
        while (j < n && (code[j] !== '/' || cls)) {
          if (code[j] === BS) j++;
          else if (code[j] === '[') cls = true;
          else if (code[j] === ']') cls = false;
          j++;
        }
        out += code.slice(i, j + 1);
        i = j + 1;
        last = '/';
      } else if (c === '{') {
        depth++;
        out += c;
        last = c;
        i++;
      } else if (c === '}') {
        if (hole && depth === 0) {
          i++;
          return out + '}';
        }
        depth--;
        out += c;
        last = c;
        i++;
      } else {
        out += c;
        last = c;
        i++;
      }
    }
    return out;
  }
  return scan(false);
}

export function normalise(code, loader = 'js') {
  const min = transformSync(code, { loader, minifyWhitespace: true, legalComments: 'none', charset: 'utf8' }).code;
  const flat = min.replace(/\n/g, '');
  return loader === 'js' ? requote(flat) : flat;
}

// src('src/main.mjs') -> normalised text of that file (path relative to the repo root).
export function src(path) {
  const loader = path.endsWith('.css') ? 'css' : 'js';
  return normalise(readFileSync(new URL('../' + path.replace(/^\.?\//, ''), import.meta.url), 'utf8'), loader);
}

// The text of a class method or function `name(...){...}` found in normalised source
// (brace-matched; strings, templates and regexes are skipped). Returns null when absent.
export function methodText(text, name) {
  const re = new RegExp(String.raw`(?:^|[;{},])((?:async\s+)?(?:static\s+)?(?:function\s+)?` + name + String.raw`\([^()]*\)\{)`);
  const m = re.exec(text);
  if (!m) return null;
  const start = m.index + m[0].indexOf(m[1]);
  let i = start + m[1].length;
  let depth = 1;
  while (i < text.length && depth > 0) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') {
      i++;
      while (i < text.length && text[i] !== c) i += text[i] === String.fromCharCode(92) ? 2 : 1;
    } else if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return text.slice(start, i);
}
