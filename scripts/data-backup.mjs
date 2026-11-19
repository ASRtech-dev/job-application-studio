import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { lockSync } from "proper-lockfile";

const MASTER = "data/master-cv.json";
const APPLICATIONS = "data/applications.json";
const CRM = "data/crm.json";
const STORES = [MASTER, APPLICATIONS, CRM];
const USAGE = "Usage: npm run backup -- [--verify <backup-directory> | --restore <backup-directory> [--without-crm]]";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const allowed = relative => /^(data\/(master-cv\.json|applications\.json|crm\.json|preparations\.json|imports\/[^/]+\.json|deliveries\/[^/]+\.json)|public\/(uploads|documents)\/.+)$/.test(relative)
  && !relative.split("/").some(part => part === ".." || part === "." || !part || part.includes(":")) && !relative.includes("\\");
const inside = (parent, child) => child === parent || child.startsWith(`${parent}${path.sep}`);

function lexists(file) {
  try { fs.lstatSync(file); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

/** Refuses symlinks/junctions on every existing component of base/relative, not only the leaf. */
function assertNoLinks(base, relative, message) {
  let current = base;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    if (!lexists(current)) return;
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(message);
  }
}

/*
 * Data contracts come from the application's own Zod schemas (src/lib/schemas.ts and
 * src/lib/crmSchemas.ts). Node cannot import those extensionless TypeScript modules
 * directly, so they are transpiled in memory with the project's `typescript` package,
 * as tests/helpers/source-loader.mjs does. Nothing is generated on disk. If the sources
 * or the compiler are missing, validation fails closed and nothing is replaced.
 */
const sourceRoot = path.resolve(import.meta.dirname, "..");
let contracts;
function loadContracts() {
  if (contracts) return contracts;
  const requireFromProject = createRequire(path.join(sourceRoot, "package.json"));
  let ts;
  try { ts = requireFromProject("typescript"); }
  catch { throw new Error("Data contract validation needs the project's 'typescript' package (run npm install). Nothing was changed."); }
  const cache = new Map();
  const load = request => {
    const filename = [request, `${request}.ts`].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    if (!filename) throw new Error(`Data contract source not found: ${path.relative(sourceRoot, request)}. Nothing was changed.`);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename);
    mod.filename = filename;
    cache.set(filename, mod);
    mod.require = specifier => {
      if (specifier.startsWith("@/")) return load(path.join(sourceRoot, "src", specifier.slice(2)));
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), specifier));
      return requireFromProject(specifier);
    };
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  };
  const { MasterCvSchema, ApplicationSchema } = load(path.join(sourceRoot, "src/lib/schemas.ts"));
  const { CrmStoreSchema } = load(path.join(sourceRoot, "src/lib/crmSchemas.ts"));
  if (![MasterCvSchema, ApplicationSchema, CrmStoreSchema].every(schema => typeof schema?.safeParse === "function")) {
    throw new Error("Data contract schemas could not be loaded. Nothing was changed.");
  }
  contracts = { [MASTER]: MasterCvSchema, [APPLICATIONS]: ApplicationSchema, [CRM]: CrmStoreSchema };
  return contracts;
}

/** JSON syntax for every JSON file; the application's schema for each primary store. */
function checkContract(relative, bytes) {
  const fail = detail => { throw new Error(`Backup data contract failed: ${relative} ${detail}. Nothing was changed.`); };
  let value;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { fail("is not valid JSON"); }
  if (!STORES.includes(relative)) return;
  const schema = loadContracts()[relative];
  const explain = result => {
    const issue = result.error.issues[0];
    return issue ? `${issue.path.join(".") || "(root)"}: ${issue.message}` : "schema mismatch";
  };
  if (relative === APPLICATIONS) {
    if (!Array.isArray(value)) fail("must be a list of applications");
    value.forEach((item, index) => {
      const result = schema.safeParse(item);
      if (!result.success) fail(`has an invalid application at position ${index} (${explain(result)})`);
    });
    return;
  }
  const result = schema.safeParse(value);
  if (!result.success) fail(`does not match its schema (${explain(result)})`);
}

function walk(root, relative, entries) {
  const absolute = path.join(root, relative);
  if (!lexists(absolute)) return;
  const info = fs.lstatSync(absolute);
  if (info.isSymbolicLink()) throw new Error("Backups cannot follow symbolic links.");
  if (info.isDirectory()) {
    for (const name of fs.readdirSync(absolute)) walk(root, `${relative}/${name}`, entries);
  } else if (allowed(relative)) {
    const bytes = fs.readFileSync(absolute);
    entries.push({ relative, bytes, sha256: digest(bytes), size: bytes.length });
  }
}

/** Local private snapshots include originals and assets; no network is used. */
export function createDataBackup(root, destination, { rescue = false } = {}) {
  root = path.resolve(root);
  destination = path.resolve(destination);
  if (fs.existsSync(destination)) throw new Error("Backup destination must be new.");
  const entries = [];
  for (const relative of [MASTER, APPLICATIONS, CRM, "data/preparations.json", "data/imports", "data/deliveries", "public/uploads", "public/documents"]) {
    assertNoLinks(root, relative, "Backups cannot follow symbolic links.");
    walk(root, relative, entries);
  }
  const present = new Set(entries.map(entry => entry.relative));
  if (!rescue) {
    if (!present.has(MASTER) || !present.has(APPLICATIONS)) throw new Error("Both primary data files are required.");
    // Validate every contract before writing anything; a raw rescue snapshot keeps files as they are.
    for (const entry of entries) if (entry.relative.endsWith(".json")) checkContract(entry.relative, entry.bytes);
  }
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of entries) {
    const target = path.join(destination, entry.relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.bytes, { flag: "wx", mode: 0o600 });
  }
  const manifest = {
    version: 2,
    rescue,
    createdAt: new Date().toISOString(),
    stores: Object.fromEntries(STORES.map(store => [store, present.has(store) ? "present" : "absent"])),
    files: entries.map(({ relative, sha256, size }) => ({ relative, sha256, size })),
  };
  fs.writeFileSync(path.join(destination, "manifest.json"), JSON.stringify(manifest, null, 2), { flag: "wx", mode: 0o600 });
  verifyDataBackup(destination, { allowRescue: rescue });
  return destination;
}

/** "present" | "absent" (declared by a v2 manifest) | "undeclared" (v1 copy without crm.json). */
export function backupCrmState(manifest) {
  if (manifest.files.some(entry => entry.relative === CRM)) return "present";
  return manifest.version >= 2 ? "absent" : "undeclared";
}

export function verifyDataBackup(source, { allowRescue = false } = {}) {
  source = fs.realpathSync(source);
  const manifest = JSON.parse(fs.readFileSync(path.join(source, "manifest.json"), "utf8"));
  if (![1, 2].includes(manifest.version) || !Array.isArray(manifest.files)) throw new Error("Invalid backup manifest.");
  if (manifest.rescue && !allowRescue) throw new Error("This is a raw rescue snapshot, not a validated restore source.");
  const seen = new Set();
  for (const entry of manifest.files) {
    if (typeof entry.relative !== "string" || !allowed(entry.relative) || seen.has(entry.relative)) throw new Error("Invalid or duplicate backup path.");
    if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error(`Invalid backup checksum entry: ${entry.relative}`);
    seen.add(entry.relative);
    const target = path.join(source, entry.relative);
    assertNoLinks(source, entry.relative, "Backup contains a symbolic link.");
    if (!inside(source, fs.realpathSync(target)) || fs.realpathSync(target) === source) throw new Error("Backup path leaves its directory.");
    const bytes = fs.readFileSync(target);
    if (digest(bytes) !== entry.sha256) throw new Error(`Backup checksum mismatch: ${entry.relative}`);
    if (manifest.version >= 2 && (!Number.isInteger(entry.size) || entry.size !== bytes.length)) throw new Error(`Backup size mismatch: ${entry.relative}`);
    if (!manifest.rescue && entry.relative.endsWith(".json")) checkContract(entry.relative, bytes);
  }
  if (manifest.version >= 2) {
    const stores = manifest.stores;
    if (!stores || typeof stores !== "object" || Object.keys(stores).sort().join() !== [...STORES].sort().join()) throw new Error("Backup manifest must declare every data store.");
    for (const store of STORES) {
      if (!["present", "absent"].includes(stores[store])) throw new Error(`Backup manifest has an invalid store state: ${store}`);
      if ((stores[store] === "present") !== seen.has(store)) throw new Error(`Backup manifest declares ${store} as ${stores[store]}, but its file list disagrees.`);
    }
  }
  if (!manifest.rescue && (!seen.has(MASTER) || !seen.has(APPLICATIONS))) throw new Error("Backup is missing primary data.");
  return manifest;
}

/**
 * Validates a restore without changing anything: backup integrity and contracts, the CRM
 * policy and destination paths. Policy: a copy that has no crm.json (declared absent in v2,
 * or a historical v1 copy) is refused when the destination has one, because keeping it would
 * mix CRM history from a later period with older applications. `withoutCrm` is the explicit
 * opt-in: the current crm.json is moved into the rescue snapshot, never deleted.
 */
export function checkRestore(source, root, { withoutCrm = false } = {}) {
  const manifest = verifyDataBackup(source);
  const realRoot = fs.realpathSync(root);
  const crmState = backupCrmState(manifest);
  const liveCrm = path.join(realRoot, CRM);
  if (withoutCrm && crmState === "present") throw new Error("--without-crm only applies to backups without data/crm.json; this backup contains a CRM. Nothing was changed.");
  const displaceCrm = crmState !== "present" && lexists(liveCrm);
  if (displaceCrm && !withoutCrm) {
    const reason = crmState === "absent" ? "declares that it had no CRM" : "is a historical copy without a CRM";
    throw new Error(`This backup ${reason} (data/crm.json), but the destination has data/crm.json. Restoring it would mix CRM history from a later period with older applications. Nothing was changed. To restore without CRM, re-run with --without-crm: the current crm.json is moved into the rescue snapshot, not deleted.`);
  }
  // Check all existing parent directories before replacing the first live file.
  for (const relative of [...manifest.files.map(entry => entry.relative), ...(displaceCrm ? [CRM] : [])]) {
    let parent = path.dirname(path.join(realRoot, relative));
    while (!fs.existsSync(parent)) parent = path.dirname(parent);
    if (!inside(realRoot, fs.realpathSync(parent))) throw new Error("Restore path leaves the application directory.");
    const target = path.join(realRoot, relative);
    if (lexists(target) && !fs.lstatSync(target).isFile()) throw new Error(`Restore target is not a regular file: ${relative}`);
  }
  return { manifest, realRoot, displaceCrm };
}

export function restoreDataBackup(source, root, { withoutCrm = false, rescueDirectory } = {}) {
  source = fs.realpathSync(source);
  const { manifest, realRoot, displaceCrm } = checkRestore(source, root, { withoutCrm }); // Validate everything before replacing anything.
  const liveCrm = path.join(realRoot, CRM);
  let displacedTarget;
  if (displaceCrm) {
    if (!rescueDirectory) throw new Error("--without-crm needs a rescue snapshot to keep the current crm.json. Nothing was changed.");
    rescueDirectory = fs.realpathSync(rescueDirectory);
    const captured = verifyDataBackup(rescueDirectory, { allowRescue: true }).files.find(entry => entry.relative === CRM);
    if (!captured || captured.sha256 !== digest(fs.readFileSync(liveCrm))) throw new Error("The rescue snapshot does not hold the current data/crm.json. Nothing was changed.");
    displacedTarget = path.join(rescueDirectory, "displaced", CRM);
    if (lexists(displacedTarget)) throw new Error("The rescue snapshot already holds a displaced crm.json. Nothing was changed.");
  }

  const id = randomUUID();
  const staged = [];
  const cleanup = () => { for (const { temporary } of staged) if (lexists(temporary)) fs.unlinkSync(temporary); };
  try {
    // Stage and re-hash every copy next to its target first, so a copy failure changes nothing.
    for (const entry of manifest.files) {
      const target = path.join(realRoot, entry.relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      // Refuse directory symlinks that could redirect writes outside the target root.
      if (!inside(realRoot, fs.realpathSync(path.dirname(target))) || path.dirname(target) === realRoot) throw new Error("Restore path leaves the application directory.");
      const temporary = `${target}.${id}.tmp`;
      staged.push({ target, temporary });
      fs.copyFileSync(path.join(source, entry.relative), temporary, fs.constants.COPYFILE_EXCL);
      if (digest(fs.readFileSync(temporary)) !== entry.sha256) throw new Error(`Staged copy differs from the backup: ${entry.relative}`);
    }
  } catch (error) {
    cleanup();
    throw error;
  }

  // Swap: each live file is set aside as *.previous, so a failure can be rolled back completely.
  const steps = [];
  try {
    for (const { target, temporary } of staged) {
      const step = { target, previous: null, installed: false };
      steps.push(step);
      if (lexists(target)) { fs.renameSync(target, `${target}.${id}.previous`); step.previous = `${target}.${id}.previous`; }
      fs.renameSync(temporary, target);
      step.installed = true;
    }
    if (displaceCrm) {
      const step = { target: liveCrm, previous: null, installed: false, displaced: true };
      steps.push(step);
      fs.renameSync(liveCrm, `${liveCrm}.${id}.previous`);
      step.previous = `${liveCrm}.${id}.previous`;
    }
  } catch (error) {
    const unrecovered = [];
    for (const step of steps.reverse()) {
      try {
        if (step.previous) fs.renameSync(step.previous, step.target);
        else if (step.installed) fs.unlinkSync(step.target);
      } catch { unrecovered.push(step.previous ?? step.target); }
    }
    try { cleanup(); } catch { /* temporaries are inert copies of the backup */ }
    if (unrecovered.length) {
      throw new Error(`Restore failed (${error.message}) and rollback could not put back every file. Previous versions remain at: ${unrecovered.join(", ")}. The rescue snapshot ${rescueDirectory ?? "(none was given)"} holds the full previous state.`, { cause: error });
    }
    throw new Error(`Restore failed and was rolled back; the previous files are unchanged (${error.message}).`, { cause: error });
  }

  // Committed. Previous files are already captured in the rescue snapshot; the CRM is moved there.
  for (const step of steps) {
    if (!step.previous) continue;
    if (!step.displaced) { fs.unlinkSync(step.previous); continue; }
    fs.mkdirSync(path.dirname(displacedTarget), { recursive: true });
    try { fs.renameSync(step.previous, displacedTarget); }
    catch (error) {
      if (error.code !== "EXDEV") throw new Error(`Restore completed, but the previous crm.json stays at ${step.previous}: ${error.message}`, { cause: error });
      fs.copyFileSync(step.previous, displacedTarget, fs.constants.COPYFILE_EXCL);
      fs.unlinkSync(step.previous);
    }
  }
}

function parseArguments(args) {
  if (args.length === 0) return { mode: "backup" };
  if (args[0] === "--verify" && args.length === 2) return { mode: "verify", source: path.resolve(args[1]) };
  if (args[0] === "--restore" && (args.length === 2 || (args.length === 3 && args[2] === "--without-crm"))) {
    return { mode: "restore", source: path.resolve(args[1]), withoutCrm: args.length === 3 };
  }
  throw new Error(USAGE);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const root = process.env.JOB_DATA_DIR ? path.dirname(path.resolve(process.env.JOB_DATA_DIR)) : process.cwd();
    const stamp = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
    fs.mkdirSync(path.join(root, "data"), { recursive: true });
    const lock = path.join(root, "data", ".write.lock");
    let release;
    try {
      release = lockSync(path.join(root, "data"), { lockfilePath: lock, stale: 60_000, update: 30_000 });
    } catch (lockError) {
      if (lockError?.code === "ELOCKED") {
        throw new Error("Another save or backup is currently using data/.write.lock. Wait a moment and retry.");
      }
      throw lockError;
    }
    try {
      if (options.mode === "verify") {
        verifyDataBackup(options.source);
        console.log("Backup checksums, store declarations and data contracts verified.");
      } else if (options.mode === "backup") {
        console.log(`Verified backup: ${createDataBackup(root, path.join(root, ".local", "backups", stamp))}`);
      } else {
        checkRestore(options.source, root, { withoutCrm: options.withoutCrm }); // Refuse before taking a rescue snapshot.
        const rescue = createDataBackup(root, path.join(root, ".local", "backups", stamp), { rescue: true });
        console.log(`Rescue snapshot of the current state: ${rescue}`);
        restoreDataBackup(options.source, root, { withoutCrm: options.withoutCrm, rescueDirectory: rescue });
        console.log(options.withoutCrm
          ? "Restored backup without CRM. The previous crm.json was moved to displaced/data/crm.json inside the rescue snapshot above."
          : "Restored backup. The previous state is preserved in the rescue snapshot above.");
      }
    } finally { release(); }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
