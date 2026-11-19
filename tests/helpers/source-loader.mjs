import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import ts from "typescript";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const requireDependency = createRequire(path.join(projectRoot, "package.json"));

// Compile the installed project's TS/TSX in memory, with its @/ alias. No test
// bundler or generated files are needed.
export function createSourceLoader(root = projectRoot) {
  const cache = new Map();

  function load(relativePath) {
    const candidate = path.resolve(root, relativePath);
    const filename = [candidate, `${candidate}.ts`, `${candidate}.tsx`]
      .find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
    if (!filename) throw new Error(`Source module not found: ${relativePath}`);
    if (cache.has(filename)) return cache.get(filename).exports;

    const mod = new Module(filename);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(projectRoot);
    cache.set(filename, mod);
    mod.require = (specifier) => {
      if (specifier.startsWith("@/")) return load(`src/${specifier.slice(2)}`);
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), specifier));
      return requireDependency(specifier);
    };
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }

  return load;
}

export { projectRoot };
