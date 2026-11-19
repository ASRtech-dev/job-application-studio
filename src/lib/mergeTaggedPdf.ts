import {
  PDFArray, PDFBool, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber,
  PDFObject, PDFObjectCopier, PDFPage, PDFPageLeaf, PDFRef, PDFStream, PDFString,
} from "pdf-lib";

const name = PDFName.of;
const MAX_TREE_OBJECTS = 50000;
const MAX_PARENT_KEY = 2147483647;
type Entry = [number, PDFObject];
type IdEntry = [PDFString | PDFHexString, PDFObject];
interface DonorStructure {
  object: PDFObject;
  parents: Entry[];
  roles: [PDFName, PDFObject][];
  classes: [PDFName, PDFObject][];
  ids: IdEntry[];
  suspects: boolean;
}
export type PdfTaggingStatus = "preserved" | "partial" | "untagged";

function dereference(document: PDFDocument, object: PDFObject): PDFObject {
  const value = object instanceof PDFRef ? document.context.lookup(object) : object;
  if (!value) throw new Error("Dangling PDF object reference");
  return value;
}

/** Walk page resources/annotations without entering the containing page tree. */
function visitPageObjects(document: PDFDocument, roots: PDFObject[], callback: (dict: PDFDict) => void): void {
  const pending = [...roots];
  const seen = new Set<PDFObject>();
  while (pending.length) {
    const object = dereference(document, pending.pop()!);
    if (!object || seen.has(object)) continue;
    seen.add(object);
    if (seen.size > MAX_TREE_OBJECTS) throw new Error("PDF object graph exceeds tagging inspection limit");
    const dictionary = object instanceof PDFStream ? object.dict : object instanceof PDFDict ? object : null;
    if (dictionary) {
      callback(dictionary);
      for (const [key, value] of dictionary.entries()) if (key !== name("Parent")) pending.push(value);
    } else if (object instanceof PDFArray) {
      for (let i = 0; i < object.size(); i++) pending.push(object.get(i));
    }
  }
}

function readTree(document: PDFDocument, root: PDFDict, kind: "number"): Entry[];
function readTree(document: PDFDocument, root: PDFDict, kind: "name"): IdEntry[];
function readTree(document: PDFDocument, root: PDFDict, kind: "number" | "name"): Entry[] | IdEntry[] {
  const pending = [root];
  const seen = new Set<PDFDict>();
  const result: [number | PDFString | PDFHexString, PDFObject][] = [];
  const keys = new Set<string>();
  while (pending.length) {
    const node = pending.pop()!;
    if (seen.has(node) || seen.size >= MAX_TREE_OBJECTS) throw new Error("Invalid PDF structure tree");
    seen.add(node);
    const entries = node.lookupMaybe(name(kind === "number" ? "Nums" : "Names"), PDFArray);
    const kids = node.lookupMaybe(name("Kids"), PDFArray);
    if (entries && kids || !entries && !kids) throw new Error("Invalid PDF structure tree node");
    if (kids) for (let i = 0; i < kids.size(); i++) pending.push(kids.lookup(i, PDFDict));
    if (!entries) continue;
    if (entries.size() % 2 !== 0) throw new Error("Invalid PDF structure tree pairs");
    for (let i = 0; i < entries.size(); i += 2) {
      if (result.length >= MAX_TREE_OBJECTS) throw new Error("PDF structure tree exceeds inspection limit");
      const key = dereference(document, entries.get(i));
      const value = entries.get(i + 1);
      if (kind === "number") {
        if (!(key instanceof PDFNumber) || !Number.isSafeInteger(key.asNumber()) || key.asNumber() < 0 || key.asNumber() > MAX_PARENT_KEY) throw new Error("Invalid PDF parent tree key");
        if (keys.has(String(key.asNumber()))) throw new Error("Duplicate PDF parent tree key");
        keys.add(String(key.asNumber()));
        result.push([key.asNumber(), value]);
      } else {
        if (!(key instanceof PDFString || key instanceof PDFHexString)) throw new Error("Invalid PDF structure ID");
        const token = Buffer.from(key.asBytes()).toString("hex");
        if (keys.has(token)) throw new Error("Duplicate PDF structure ID");
        keys.add(token);
        result.push([key, value]);
      }
    }
  }
  return result as Entry[] | IdEntry[];
}

/**
 * Preserve compatible donor structure rather than merely setting /Marked true.
 * Unsupported foreign root extensions/conflicting maps remain visually intact,
 * but are explicitly reported as partial. This is not a PDF/UA certification.
 */
export class TaggedPdfMerger {
  private readonly root: PDFDict;
  private readonly rootRef: PDFRef;
  private readonly children: PDFArray;
  private readonly parentEntries: Entry[] = [];
  private readonly roles = new Map<string, [PDFName, PDFObject]>();
  private readonly classes = new Map<string, [PDFName, PDFObject]>();
  private readonly ids: IdEntry[] = [];
  private nextParentKey = 0;
  private taggedParts = 0;
  private untaggedParts = 0;
  private uncertainParts = 0;

  constructor(private readonly target: PDFDocument) {
    if (target.getPageCount() !== 0) throw new Error("TaggedPdfMerger requires an empty target document");
    this.children = target.context.obj([]);
    this.root = target.context.obj({ Type: "StructTreeRoot", K: this.children });
    this.rootRef = target.context.register(this.root);
  }

  get taggingStatus(): PdfTaggingStatus {
    if (!this.taggedParts) return this.uncertainParts ? "partial" : "untagged";
    return this.untaggedParts || this.uncertainParts ? "partial" : "preserved";
  }

  private inspect(donor: PDFDocument): DonorStructure | null {
    const object = donor.catalog.get(name("StructTreeRoot"));
    if (!object) return null;
    const root = dereference(donor, object);
    if (!(root instanceof PDFDict)) throw new Error("Invalid PDF structure root");
    const supported = new Set(["Type", "K", "ParentTree", "ParentTreeNextKey", "RoleMap", "ClassMap", "IDTree"]);
    if (root.keys().some((key) => !supported.has(key.decodeText()))) throw new Error("Unsupported PDF structure root extension");
    const kids = root.get(name("K"));
    if (!kids) throw new Error("Missing PDF structure children");
    const kidObjects = dereference(donor, kids);
    const top = kidObjects instanceof PDFArray ? kidObjects.asArray() : [kids];
    if (!top.length || top.some((child) => !(dereference(donor, child) instanceof PDFDict))) throw new Error("Invalid PDF structure children");
    const tree = root.lookupMaybe(name("ParentTree"), PDFDict);
    if (!tree) throw new Error("Missing PDF parent tree");
    const parents = readTree(donor, tree, "number");
    const parentKeys = new Set(parents.map(([key]) => key));
    for (const [key, value] of parents) {
      const actual = dereference(donor, value);
      if (!(actual instanceof PDFDict || actual instanceof PDFArray) || key + this.nextParentKey > MAX_PARENT_KEY) throw new Error("Invalid PDF parent tree value");
    }
    visitPageObjects(donor, donor.getPages().map((page) => page.node), (dictionary) => {
      for (const key of ["StructParents", "StructParent"]) {
        const value = dictionary.get(name(key));
        if (!value) continue;
        const number = dereference(donor, value);
        if (!(number instanceof PDFNumber) || !parentKeys.has(number.asNumber())) throw new Error("Dangling PDF structure parent");
      }
    });
    const roles = root.lookupMaybe(name("RoleMap"), PDFDict)?.entries() || [];
    if (roles.some(([key, value]) => !(value instanceof PDFName) || this.roles.has(key.decodeText()) && this.roles.get(key.decodeText())![1].toString() !== value.toString())) throw new Error("Unsupported or conflicting PDF role map");
    const classes = root.lookupMaybe(name("ClassMap"), PDFDict)?.entries() || [];
    if (classes.some(([key]) => this.classes.has(key.decodeText()))) throw new Error("Conflicting PDF class map");
    const idTree = root.lookupMaybe(name("IDTree"), PDFDict);
    const ids = idTree ? readTree(donor, idTree, "name") : [];
    const knownIds = new Set(this.ids.map(([key]) => Buffer.from(key.asBytes()).toString("hex")));
    if (ids.some(([key]) => knownIds.has(Buffer.from(key.asBytes()).toString("hex")))) throw new Error("Conflicting PDF structure IDs");
    const marked = donor.catalog.lookupMaybe(name("MarkInfo"), PDFDict);
    return { object, parents, roles, classes, ids, suspects: marked?.get(name("Suspects")) === PDFBool.True };
  }

  append(donor: PDFDocument): void {
    let structure: DonorStructure | null = null;
    let unsupported = false;
    try { structure = this.inspect(donor); } catch { unsupported = true; }
    // One copier memoizes both page refs and the structure's /Pg and OBJR refs.
    const copier = PDFObjectCopier.for(donor.context, this.target.context);
    const pages = donor.getPages().map((page) => {
      const ref = copier.copy(page.ref);
      const node = this.target.context.lookup(ref);
      if (!(node instanceof PDFPageLeaf)) throw new Error("Invalid copied PDF page");
      const copiedPage = PDFPage.of(node, ref, this.target);
      this.target.addPage(copiedPage);
      return node;
    });
    if (!structure) {
      visitPageObjects(this.target, pages, (dictionary) => {
        dictionary.delete(name("StructParents"));
        dictionary.delete(name("StructParent"));
      });
      if (unsupported) this.uncertainParts++; else this.untaggedParts++;
      this.commit();
      return;
    }
    const copiedRoot = dereference(this.target, copier.copy(structure.object)) as PDFDict;
    const kids = copiedRoot.get(name("K"))!;
    const actualKids = dereference(this.target, kids);
    const top = actualKids instanceof PDFArray ? actualKids.asArray() : [kids];
    const donorLanguage = donor.catalog.get(name("Lang"));
    for (const child of top) {
      const element = dereference(this.target, child) as PDFDict;
      element.set(name("P"), this.rootRef);
      if (donorLanguage && !element.has(name("Lang"))) element.set(name("Lang"), copier.copy(donorLanguage));
      this.children.push(child);
    }
    const offset = this.nextParentKey;
    visitPageObjects(this.target, pages, (dictionary) => {
      for (const key of ["StructParents", "StructParent"]) {
        const value = dictionary.lookupMaybe(name(key), PDFNumber);
        if (value) dictionary.set(name(key), PDFNumber.of(value.asNumber() + offset));
      }
    });
    for (const [key, value] of structure.parents) this.parentEntries.push([key + offset, copier.copy(value)]);
    this.nextParentKey = structure.parents.reduce((next, [key]) => Math.max(next, key + offset + 1), this.nextParentKey);
    for (const [key, value] of structure.roles) this.roles.set(key.decodeText(), [key, copier.copy(value)]);
    for (const [key, value] of structure.classes) this.classes.set(key.decodeText(), [key, copier.copy(value)]);
    for (const [key, value] of structure.ids) this.ids.push([copier.copy(key), copier.copy(value)]);
    this.taggedParts++;
    if (structure.suspects) this.uncertainParts++;
    this.commit();
  }

  private commit(): void {
    if (!this.taggedParts) return;
    const context = this.target.context;
    const nums = context.obj([]);
    for (const [key, value] of [...this.parentEntries].sort(([a], [b]) => a - b)) { nums.push(PDFNumber.of(key)); nums.push(value); }
    this.root.set(name("ParentTree"), context.obj({ Nums: nums }));
    this.root.set(name("ParentTreeNextKey"), PDFNumber.of(this.nextParentKey));
    if (this.roles.size) { const map = context.obj({}); for (const [, [key, value]] of this.roles) map.set(key, value); this.root.set(name("RoleMap"), map); }
    if (this.classes.size) { const map = context.obj({}); for (const [, [key, value]] of this.classes) map.set(key, value); this.root.set(name("ClassMap"), map); }
    if (this.ids.length) {
      const names = context.obj([]);
      const sorted = [...this.ids].sort(([a], [b]) => Buffer.compare(Buffer.from(a.asBytes()), Buffer.from(b.asBytes())));
      for (const [key, value] of sorted) { names.push(key); names.push(value); }
      this.root.set(name("IDTree"), context.obj({ Names: names }));
    }
    this.target.catalog.set(name("StructTreeRoot"), this.rootRef);
    this.target.catalog.set(name("MarkInfo"), context.obj({ Marked: true, Suspects: this.taggingStatus === "partial" }));
  }
}
