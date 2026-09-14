// Code snippets for the Code tool. Persisted in localStorage only.
import { uid } from './id';

export type SnippetLanguage = 'javascript' | 'typescript' | 'python' | 'html' | 'css' | 'java' | 'cpp';

export interface Snippet {
  id: string;
  name: string;
  language: SnippetLanguage;
  code: string;
  updatedAt: number;
}

export const SNIPPETS_KEY = 'homework-todo:snippets';

export const LANGUAGES: { id: SnippetLanguage; label: string; ext: string }[] = [
  { id: 'javascript', label: 'JavaScript', ext: 'js' },
  { id: 'typescript', label: 'TypeScript', ext: 'ts' },
  { id: 'python', label: 'Python', ext: 'py' },
  { id: 'html', label: 'HTML', ext: 'html' },
  { id: 'css', label: 'CSS', ext: 'css' },
  { id: 'java', label: 'Java', ext: 'java' },
  { id: 'cpp', label: 'C++', ext: 'cpp' },
];

export function languageLabel(lang: SnippetLanguage): string {
  return LANGUAGES.find((l) => l.id === lang)?.label ?? lang;
}

export function languageExt(lang: SnippetLanguage): string {
  return LANGUAGES.find((l) => l.id === lang)?.ext ?? 'txt';
}

export const STARTERS: Record<SnippetLanguage, string> = {
  javascript: `// Hello from JavaScript
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('world'));

const squares = [1, 2, 3, 4].map((n) => n * n);
console.log('squares:', squares);
`,
  typescript: `// TypeScript runs here as plain JavaScript (type annotations are not checked).
// Keep to JS-compatible syntax when you want to press Run.
function add(a, b) {
  return a + b;
}

console.log('2 + 3 =', add(2, 3));
`,
  python: `# Hello from Python
def greet(name):
    return f"Hello, {name}!"

print(greet("world"))

squares = [n * n for n in range(1, 5)]
print("squares:", squares)
`,
  html: `<!-- Hello from HTML. Runs in a sandboxed preview. -->
<h1>Hello, world!</h1>
<p>Edit this page and press Run.</p>
<button id="b">Click me</button>
<script>
  document.getElementById('b').addEventListener('click', () => {
    document.querySelector('p').textContent = 'You clicked the button.';
  });
</script>
`,
  css: `/* Hello from CSS. Run shows the styles applied to a small sample page. */
body {
  font-family: system-ui, sans-serif;
  padding: 24px;
  background: #f6f7fb;
}

h1 {
  color: #6c5ce7;
}

.box {
  padding: 12px;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
`,
  java: `// Hello from Java. Copy into your IDE or an online compiler to run.
public class Main {
    public static void main(String[] args) {
        System.out.println(greet("world"));
    }

    static String greet(String name) {
        return "Hello, " + name + "!";
    }
}
`,
  cpp: `// Hello from C++. Copy into your IDE or an online compiler to run.
#include <iostream>
#include <string>

std::string greet(const std::string& name) {
    return "Hello, " + name + "!";
}

int main() {
    std::cout << greet("world") << std::endl;
    return 0;
}
`,
};

function isLanguage(v: unknown): v is SnippetLanguage {
  return typeof v === 'string' && LANGUAGES.some((l) => l.id === v);
}

function read(): Snippet[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SNIPPETS_KEY) : null;
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is Snippet => !!s && typeof s === 'object' && typeof (s as Snippet).id === 'string' && isLanguage((s as Snippet).language))
      .map((s) => ({
        id: s.id,
        name: typeof s.name === 'string' ? s.name : 'Untitled',
        language: s.language,
        code: typeof s.code === 'string' ? s.code : '',
        updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : 0,
      }));
  } catch {
    return [];
  }
}

function write(list: Snippet[]): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SNIPPETS_KEY, JSON.stringify(list));
  } catch {
    // quota or private mode: ignore
  }
}

/** All snippets, most recently updated first. */
export function listSnippets(): Snippet[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Insert or replace a snippet by id. Returns the stored copy (with a fresh updatedAt). */
export function saveSnippet(s: Snippet): Snippet {
  const list = read();
  const stored: Snippet = { ...s, updatedAt: Date.now() };
  const i = list.findIndex((x) => x.id === s.id);
  if (i >= 0) list[i] = stored;
  else list.push(stored);
  write(list);
  return stored;
}

export function deleteSnippet(id: string): void {
  write(read().filter((s) => s.id !== id));
}

/** A fresh, unsaved snippet with the starter template for the language. */
export function newSnippet(language: SnippetLanguage): Snippet {
  return {
    id: uid('snip'),
    name: `Untitled ${languageLabel(language)}`,
    language,
    code: STARTERS[language],
    updatedAt: Date.now(),
  };
}
