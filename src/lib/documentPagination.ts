export interface DocumentPaginationResult {
  pages: number;
  height: number;
  warnings: string[];
}

/**
 * Runs in the preview's sandboxed document and in offline Chromium. Keep this
 * function self-contained: Playwright serializes it into the PDF browser.
 * Source React nodes are never changed; the preview uses a separate document.
 */
export function paginatePrintableDocument(target?: Document | void): DocumentPaginationResult {
  const doc = target || document;
  const view = doc.defaultView!;
  const policy = doc.querySelector<HTMLMetaElement>('meta[name="job-page-layout"]');
  const root = doc.querySelector<HTMLElement>("#cv-template-ats, #cv-template-modern, #cv-template-tabular, #letter-template-ats, #letter-template-sidebar, #letter-template-din");
  if (!root || !policy) return { pages: 0, height: 0, warnings: [] };
  if (root.dataset.paginated === "true") return { pages: root.children.length, height: root.offsetHeight, warnings: [] };
  const layout = JSON.parse(policy.content) as {
    top: number;
    right: number;
    bottom: number;
    left: number;
    sidebar: number;
    maxPages?: number | null;
    documentLabel?: string;
  };
  const warnings: string[] = [];
  const isCv = root.id.startsWith("cv-");
  const enforceTwoPageCeiling = isCv && layout.maxPages !== null && root.dataset.unboundedPages !== "true";
  const lang = doc.documentElement.lang;
  const continuation = lang === "de" ? "Fortsetzung" : lang === "es" ? "continuación" : "continued";
  const pageLabel = lang === "de" ? "Seite" : lang === "es" ? "Página" : "Page";
  const name = root.querySelector("h1")?.textContent?.trim() || "";
  const style = view.getComputedStyle(root);
  const sourceRoot = isCv ? (root.cloneNode(true) as HTMLElement) : null;
  let main = root.querySelector<HTMLElement>(".letter-content") || root;
  const sidebar = root.querySelector<HTMLElement>(".sidebar");
  const pages = doc.createElement("div");
  pages.id = root.id;
  pages.dataset.paginated = "true";
  pages.className = "document-pages";
  Object.assign(pages.style, { width: "210mm", margin: "0 auto", background: "white", color: style.color, fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: root.style.lineHeight || style.lineHeight, fontVariantLigatures: "none", fontFeatureSettings: '"liga" 0, "clig" 0', overflowWrap: "anywhere" });
  root.before(pages);
  // The original remains measurable until all fragments have been constructed.
  root.style.position = "absolute";
  root.style.left = "-10000px";
  root.style.top = "0";
  const sheets: HTMLElement[] = [];
  let content: HTMLElement;
  let sheet: HTMLElement;
  const newPage = () => {
    if (sheets.length >= 100) throw new Error("Document exceeds the 100-page limit.");
    sheet = doc.createElement("section");
    sheet.className = "document-page";
    sheet.setAttribute("aria-label", `${pageLabel} ${sheets.length + 1}`);
    Object.assign(sheet.style, { width: "210mm", height: "297mm", position: "relative", boxSizing: "border-box", background: "white", breakAfter: "page", pageBreakAfter: "always" });
    content = doc.createElement("div");
    content.className = "document-page-content";
    Object.assign(content.style, { position: "absolute", top: `${layout.top}mm`, left: `${layout.left}mm`, right: `${layout.right}mm`, bottom: `${layout.bottom}mm`, display: "flow-root", minWidth: "0", overflowWrap: "anywhere" });
    sheet.append(content);
    if (sidebar) {
      // Keep main reading flow before the decorative sidebar band in linear DOM order.
      const band = sidebar.cloneNode(true) as HTMLElement;
      band.removeAttribute("id");
      band.setAttribute("aria-hidden", "true");
      Object.assign(band.style, { position: "absolute", top: "0", left: "0", width: `${layout.sidebar}mm`, height: "297mm", minHeight: "0", gridArea: "auto" });
      sheet.append(band);
    }
    const footer = doc.createElement("div");
    footer.className = "document-page-footer";
    footer.setAttribute("aria-hidden", "true");
    Object.assign(footer.style, { position: "absolute", left: `${layout.left}mm`, right: `${layout.right}mm`, bottom: "7mm", display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "8.5pt", lineHeight: "1.3", color: "#526176", borderTop: "0.5px solid #d8dee8", paddingTop: "3px" });
    const identity = doc.createElement("span");
    const cvSuffix = layout.documentLabel
      ? ` · ${layout.documentLabel}`
      : isCv
      ? (lang === "de" ? " · Lebenslauf" : lang === "es" ? " · Currículum" : " · CV")
      : "";
    identity.textContent = `${name}${cvSuffix}`;
    const number = doc.createElement("span");
    number.className = "document-page-number";
    number.style.whiteSpace = "nowrap";
    footer.append(identity, number);
    sheet.append(footer);
    sheets.push(sheet);
    pages.append(sheet);
  };
  newPage();
  const fits = () => content.scrollHeight <= content.clientHeight + 1 && content.scrollWidth <= content.clientWidth + 1;
  const availableHeight = () => content.clientHeight;
  const hasContent = () => Boolean(content.textContent?.trim() || content.querySelector("img"));
  const cleanClone = (node: HTMLElement, deep = true) => {
    const clone = node.cloneNode(deep) as HTMLElement;
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    return clone;
  };
  const place = (node: HTMLElement) => {
    content.append(node);
    if (fits()) return true;
    node.remove();
    return false;
  };
  // Create an exact slice of a rich-text block, preserving emphasis and links.
  const textSlice = (node: HTMLElement, from: number, to: number) => {
    const walker = doc.createTreeWalker(node, 4);
    const texts: Text[] = [];
    let next: Node | null;
    while ((next = walker.nextNode())) texts.push(next as Text);
    const point = (offset: number): [Node, number] => {
      for (const text of texts) {
        if (offset <= text.length) return [text, offset];
        offset -= text.length;
      }
      return [node, node.childNodes.length];
    };
    const range = doc.createRange();
    range.setStart(...point(from));
    range.setEnd(...point(to));
    const clone = cleanClone(node, false);
    clone.append(range.cloneContents());
    return clone;
  };
  const wordBoundaries = (node: HTMLElement) => [...(node.textContent || "").matchAll(/\S+\s*/g)].map((match) => match.index! + match[0].length);
  // Returns the last fragment placed, so a following block can share its page.
  const splitText = (node: HTMLElement, label?: string) => {
    const boundaries = wordBoundaries(node);
    let start = 0;
    let index = 0;
    let last: { element: HTMLElement; from: number; to: number } | null = null;
    while (index < boundaries.length) {
      let low = index, high = boundaries.length - 1, best = -1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = textSlice(node, start, boundaries[middle]);
        if (place(candidate)) { candidate.remove(); best = middle; low = middle + 1; }
        else high = middle - 1;
      }
      if (best < index) {
        if (!hasContent()) throw new Error("An element does not fit inside the printable area. Review its layout before exporting.");
        newPage();
        if (label) addContinuation(label);
        continue;
      }
      // Pull one extra word onto the next page rather than leaving a 1-word orphan tail across a page break.
      if (best > index && boundaries.length - 1 - best === 1) best -= 1;
      const element = textSlice(node, start, boundaries[best]);
      content.append(element);
      last = { element, from: start, to: boundaries[best] };
      start = boundaries[best];
      index = best + 1;
      if (index < boundaries.length) { newPage(); if (label) addContinuation(label); }
    }
    return last;
  };
  const addContinuation = (label: string) => {
    const heading = doc.createElement("p");
    heading.className = "document-entry-continuation";
    heading.textContent = `${label} (${continuation})`;
    Object.assign(heading.style, { fontSize: "9.5pt", fontWeight: "600", color: "#374151", margin: "0 0 7px", lineHeight: "1.4" });
    content.append(heading);
  };
  const appendAtomic = (node: HTMLElement, label?: string) => {
    const clone = cleanClone(node);
    if (place(clone)) return;
    // If a block is taller than a whole page, fill the current page first.
    // This also keeps the greeting/context above its first actual text.
    if (node.getBoundingClientRect().height > content.clientHeight && !node.querySelector("img")) {
      splitText(node, label);
      warnings.push("A long block continues onto another page; review its layout.");
      return;
    }
    if (hasContent()) { newPage(); if (label) addContinuation(label); }
    if (place(clone)) return;
    if (node.textContent?.trim() && !node.querySelector("img")) {
      splitText(node, label);
      warnings.push("A long block continues onto another page; review its layout.");
    } else throw new Error("A graphic asset exceeds the printable area.");
  };
  const lineHeightOf = (node: HTMLElement) => {
    const computed = view.getComputedStyle(node);
    return parseFloat(computed.lineHeight) || (parseFloat(computed.fontSize) || 14) * 1.4;
  };
  // The signature is validated on its own, so a long paragraph is never
  // reported as an image problem and a valid image is never rejected for it.
  const checkSignature = (signature: HTMLElement) => {
    const image = signature.querySelector("img")?.getBoundingClientRect();
    if (image && (image.height > content.clientHeight || image.width > content.clientWidth + 2)) throw new Error("The signature image exceeds the printable area. Reduce its width before exporting.");
    const box = signature.getBoundingClientRect();
    const margin = parseFloat(view.getComputedStyle(signature).marginTop) || 0;
    if (box.height + margin > content.clientHeight || box.width > content.clientWidth + 2) throw new Error("The signature block exceeds the printable area. Review its layout before exporting.");
  };
  // Last paragraph + signature: kept together when they fit a page; otherwise
  // the paragraph is split and its final lines move with the closing block.
  const appendEnding = (paragraph: HTMLElement, signature: HTMLElement) => {
    checkSignature(signature);
    const together = () => {
      const group = doc.createElement("div");
      group.append(cleanClone(paragraph), cleanClone(signature));
      return group;
    };
    if (place(together())) return;
    const height = signature.getBoundingClientRect().bottom - paragraph.getBoundingClientRect().top;
    if (height <= content.clientHeight && hasContent()) {
      newPage();
      if (place(together())) return;
    }
    warnings.push("A long block continues onto another page; review its layout.");
    const last = splitText(paragraph);
    const closing = cleanClone(signature);
    content.append(closing);
    if (fits()) return;
    closing.remove();
    if (!last) { newPage(); content.append(closing); return; }
    const previous = content;
    last.element.remove();
    const shared = hasContent();
    newPage();
    // Candidate start offsets of the tail; a later start means a shorter tail.
    const starts = [last.from, ...wordBoundaries(paragraph).filter((offset) => offset > last.from && offset < last.to)];
    const measure = (index: number) => {
      const tail = textSlice(paragraph, starts[index], last.to);
      content.append(tail, closing);
      const result = { fits: fits(), height: tail.getBoundingClientRect().height };
      tail.remove();
      closing.remove();
      return result;
    };
    // Keep text on the previous page unless it shares that page with other content.
    const first = shared || starts.length === 1 ? 0 : 1;
    const minimum = 2 * lineHeightOf(paragraph) - 1;
    let low = first, high = starts.length - 1, chosen = first;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (measure(middle).height >= minimum) { chosen = middle; low = middle + 1; }
      else high = middle - 1;
    }
    if (!measure(chosen).fits) {
      low = chosen + 1; high = starts.length - 1; chosen = -1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (measure(middle).fits) { chosen = middle; high = middle - 1; }
        else low = middle + 1;
      }
    }
    if (chosen < 0) {
      // Exceptionally tall closing blocks: keep all text, then the signature.
      previous.append(last.element);
      content.append(closing);
      return;
    }
    if (starts[chosen] > last.from) previous.append(textSlice(paragraph, last.from, starts[chosen]));
    content.append(textSlice(paragraph, starts[chosen], last.to), closing);
  };
  const paginateEntry = (entry: HTMLElement) => {
    const cloneEntry = (deep: boolean) => {
      const result = cleanClone(entry, deep);
      const gap = parseFloat(view.getComputedStyle(entry.parentElement!).rowGap) || 0;
      const margin = parseFloat(view.getComputedStyle(entry).marginBottom) || 0;
      result.style.marginBottom = `${Math.max(gap, margin)}px`;
      return result;
    };
    const clone = cloneEntry(true);
    if (place(clone)) return;
    const items = [...entry.querySelectorAll<HTMLElement>("[data-layout-item]")].filter((item) => !item.parentElement?.closest("[data-layout-item]"));
    const heading = entry.querySelector<HTMLElement>("[data-entry-heading]");
    if (!items.length) { appendAtomic(entry); return; }
    const label = entry.dataset.continuationLabel || heading?.textContent?.trim() || "";
    let placedItems = false;
    let fragment = cloneEntry(false);
    let nodes = new Map<HTMLElement, HTMLElement>([[entry, fragment]]);
    const include = (node: HTMLElement) => {
      const path: HTMLElement[] = [];
      let parent = node.parentElement;
      while (parent && parent !== entry) { path.unshift(parent); parent = parent.parentElement; }
      let into = fragment;
      for (const original of path) {
        let copy = nodes.get(original);
        if (!copy) { copy = cleanClone(original, false); into.append(copy); nodes.set(original, copy); }
        into = copy;
      }
      const copy = cleanClone(node);
      into.append(copy);
      return copy;
    };
    if (heading) include(heading);
    content.append(fragment);
    for (const item of items) {
      let copy = include(item);
      if (fits()) { placedItems = true; continue; }
      copy.remove();
      if (!fragment.querySelector("[data-layout-item]")) fragment.remove();
      newPage();
      fragment = cloneEntry(false);
      nodes = new Map([[entry, fragment]]);
      content.append(fragment);
      if (heading) include(heading);
      if (label && placedItems) {
        const marker = doc.createElement("span");
        marker.textContent = ` (${continuation})`;
        marker.style.fontSize = "9pt";
        marker.style.fontWeight = "400";
        marker.style.color = "#4b5563";
        (fragment.querySelector("[data-entry-title]") || fragment.querySelector("[data-entry-heading]") || fragment).append(marker);
      }
      copy = include(item);
      if (fits()) { placedItems = true; continue; }
      copy.remove();
      // An unusually long individual bullet/paragraph can itself span pages.
      splitText(item, label);
      placedItems = true;
    }
  };
  const process = (node: HTMLElement) => {
    if (node.classList.contains("page-break-indicator") || node.classList.contains("sidebar")) return;
    const clone = cleanClone(node);
    if (place(clone)) return;
    if (node.hasAttribute("data-layout-entry")) { paginateEntry(node); return; }
    const columns = [...node.children].filter((child) => child.hasAttribute("data-layout-column"));
    if (columns.length) {
      const queues = columns.map((column) => ({ source: column as HTMLElement, entries: [...column.querySelectorAll<HTMLElement>("[data-layout-entry]")], index: 0 }));
      while (queues.some((queue) => queue.index < queue.entries.length)) {
        const active = queues.filter((queue) => queue.index < queue.entries.length);
        const hadContent = hasContent();
        const grid = cleanClone(node, false);
        grid.style.gridTemplateColumns = active.length === 1 ? "1fr" : "1fr 1fr";
        content.append(grid);
        let placed = false;
        for (const queue of active) {
          const column = cleanClone(queue.source, false);
          const heading = queue.source.querySelector<HTMLElement>("[data-section-heading]");
          if (heading) column.append(cleanClone(heading));
          grid.append(column);
          const initial = queue.index;
          while (queue.index < queue.entries.length) {
            const copy = cleanClone(queue.entries[queue.index]);
            column.append(copy);
            if (!fits()) { copy.remove(); break; }
            queue.index++;
            placed = true;
          }
          if (initial === queue.index) column.replaceChildren();
        }
        if (!placed) {
          grid.remove();
          if (hadContent) { newPage(); continue; }
          // Exceptionally large entries use the same safe text splitting path.
          for (const queue of active) {
            const heading = queue.source.querySelector<HTMLElement>("[data-section-heading]");
            if (heading) appendAtomic(heading);
            while (queue.index < queue.entries.length) paginateEntry(queue.entries[queue.index++]);
          }
          break;
        }
        if (queues.some((queue) => queue.index < queue.entries.length)) newPage();
      }
      return;
    }
    if (node.hasAttribute("data-layout-section")) {
      const heading = node.querySelector<HTMLElement>("[data-section-heading]");
      const entries = [...node.querySelectorAll<HTMLElement>("[data-layout-entry]")].filter((entry) => !entry.parentElement?.closest("[data-layout-entry]"));
      if (entries.length) {
        if (heading) {
          const group = doc.createElement("div");
          const first = cleanClone(entries[0]);
          const items = [...first.querySelectorAll("[data-layout-item]")];
          items.slice(1).forEach((item) => item.remove());
          group.append(cleanClone(heading), first);
          if (!place(group) && hasContent()) newPage();
          else group.remove();
          appendAtomic(heading);
        }
        entries.forEach(paginateEntry);
        return;
      }
      // Simple sections (profile, skills, achievements) retain their nesting.
      const children = [...node.children] as HTMLElement[];
      if (children.length > 1 && node.offsetHeight > content.clientHeight) { children.forEach(process); return; }
    }
    appendAtomic(node);
  };
  const composePages = () => {
    pages.replaceChildren();
    sheets.length = 0;
    warnings.length = 0;
    newPage();
    const blocks = [...main.children].filter((node) => node instanceof view.HTMLElement && !node.classList.contains("page-break-indicator")) as HTMLElement[];
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.dataset.keepWithNext === "true" && i + 1 < blocks.length) {
        const group = doc.createElement("div");
        let j = i;
        do {
          const next = blocks[j];
          const source = next.classList.contains("letter-body") ? next.firstElementChild as HTMLElement | null : next;
          if (!source) continue;
          const copy = cleanClone(source);
          // A paragraph taller than a page is split anyway: the context only
          // needs its first two lines beside it, not the whole paragraph.
          if (source !== next && source.getBoundingClientRect().height > availableHeight()) {
            Object.assign(copy.style, { maxHeight: `${2 * lineHeightOf(source)}px`, overflow: "hidden", marginBottom: "0" });
          }
          group.append(copy);
        } while (blocks[j++].dataset.keepWithNext === "true" && j < blocks.length);
        if (!place(group)) { if (hasContent()) newPage(); }
        else group.remove();
      }
      if (block.classList.contains("letter-body")) {
        const paragraphs = [...block.children] as HTMLElement[];
        const signature = blocks[i + 1]?.classList.contains("signature-block") ? blocks[i + 1] : null;
        if (!paragraphs.length && signature) { checkSignature(signature); appendAtomic(signature); }
        paragraphs.forEach((paragraph, index) => {
          if (index === paragraphs.length - 1 && signature) appendEnding(paragraph, signature);
          else appendAtomic(paragraph);
        });
        if (signature) i++;
      } else process(block);
    }
  };

  const applyCvCompaction = (
    targetRoot: HTMLElement,
    step: { fontScale: number; maxLineHeight: number; spaceScale: number; maxSectionMarginPx: number; maxPhotoWidthPx: number }
  ) => {
    const scalePx = (value: string, factor: number, minPx = 0, maxPx = Infinity) => {
      const parsed = parseFloat(value);
      if (!Number.isFinite(parsed) || parsed <= 0) return value;
      return `${Math.max(minPx, Math.min(maxPx, +(parsed * factor).toFixed(2)))}px`;
    };
    const clampLineHeight = (value: string) => {
      if (!value || value === "normal") return undefined;
      const parsed = parseFloat(value);
      if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
      if (value.endsWith("px") || value.endsWith("pt")) return undefined;
      if (parsed > step.maxLineHeight) return String(step.maxLineHeight);
      return undefined;
    };

    if (targetRoot.style.fontSize.endsWith("pt") && step.fontScale < 1) {
      const basePt = parseFloat(targetRoot.style.fontSize);
      if (Number.isFinite(basePt) && basePt > 0) {
        targetRoot.style.fontSize = `${Math.max(8.8, +(basePt * step.fontScale).toFixed(2))}pt`;
      }
    }
    const rootLh = clampLineHeight(targetRoot.style.lineHeight);
    if (rootLh) targetRoot.style.lineHeight = rootLh;

    const headerPhoto = targetRoot.querySelector<HTMLImageElement>('[data-layout-section="header"] img');
    if (headerPhoto) {
      const w = parseFloat(headerPhoto.style.width);
      const h = parseFloat(headerPhoto.style.height);
      if (Number.isFinite(w) && w > step.maxPhotoWidthPx && Number.isFinite(h) && h > 0) {
        const ratio = h / w;
        const nextW = Math.round(step.maxPhotoWidthPx);
        const nextH = Math.round(nextW * ratio);
        headerPhoto.style.width = `${nextW}px`;
        headerPhoto.style.height = `${nextH}px`;
      }
    }

    targetRoot.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const isTitle = el.tagName === "H1" || Boolean(el.closest("h1"));
      if (!isTitle && el.style.fontSize.endsWith("pt") && step.fontScale < 1) {
        const pt = parseFloat(el.style.fontSize);
        if (Number.isFinite(pt) && pt > 0) {
          const floorPt = pt >= 8.8 ? 8.8 : Math.min(pt, 8.0);
          el.style.fontSize = `${Math.max(floorPt, +(pt * step.fontScale).toFixed(2))}pt`;
        }
      }
      if (!isTitle && el.style.lineHeight) {
        const nextLh = clampLineHeight(el.style.lineHeight);
        if (nextLh) el.style.lineHeight = nextLh;
      }
      if (el.hasAttribute("data-layout-section")) {
        if (el.style.marginBottom) {
          el.style.marginBottom = scalePx(el.style.marginBottom, step.spaceScale, 2.5, step.maxSectionMarginPx);
        }
        if (el.style.paddingBottom) {
          el.style.paddingBottom = scalePx(el.style.paddingBottom, step.spaceScale, 2.5);
        }
      } else {
        if (el.style.marginBottom) {
          el.style.marginBottom = scalePx(el.style.marginBottom, step.spaceScale, 0.8);
        }
        if (el.style.marginTop) {
          el.style.marginTop = scalePx(el.style.marginTop, step.spaceScale, 0.8);
        }
        if (el.style.paddingTop) {
          el.style.paddingTop = scalePx(el.style.paddingTop, step.spaceScale, 0.8);
        }
        if (el.style.paddingBottom) {
          el.style.paddingBottom = scalePx(el.style.paddingBottom, step.spaceScale, 0.8);
        }
      }
      if (el.style.rowGap) {
        el.style.rowGap = scalePx(el.style.rowGap, step.spaceScale, 1.2);
      }
    });
  };

  composePages();

  if (enforceTwoPageCeiling && sheets.length > 2 && sourceRoot) {
    // Readable typography floor (>= 0.93 scale / ~9.3pt) so a dense CV never gets crushed into tiny text.
    const CV_COMPACTION_STEPS = [
      { fontScale: 1.0, maxLineHeight: 1.35, spaceScale: 0.82, maxSectionMarginPx: 10, maxPhotoWidthPx: 104 },
      { fontScale: 0.975, maxLineHeight: 1.32, spaceScale: 0.72, maxSectionMarginPx: 8.5, maxPhotoWidthPx: 94 },
      { fontScale: 0.95, maxLineHeight: 1.29, spaceScale: 0.62, maxSectionMarginPx: 7, maxPhotoWidthPx: 86 },
      { fontScale: 0.93, maxLineHeight: 1.26, spaceScale: 0.54, maxSectionMarginPx: 6, maxPhotoWidthPx: 80 },
    ];
    for (const step of CV_COMPACTION_STEPS) {
      const freshRoot = sourceRoot.cloneNode(true) as HTMLElement;
      root.setAttribute("style", freshRoot.getAttribute("style") || "");
      root.style.position = "absolute";
      root.style.left = "-10000px";
      root.style.top = "0";
      root.replaceChildren(...[...freshRoot.childNodes].map((n) => n.cloneNode(true)));
      main = root.querySelector<HTMLElement>(".letter-content") || root;
      applyCvCompaction(root, step);
      const compactedStyle = view.getComputedStyle(root);
      pages.style.fontSize = compactedStyle.fontSize;
      pages.style.lineHeight = root.style.lineHeight || compactedStyle.lineHeight;
      composePages();
      if (sheets.length <= 2) {
        warnings.push(
          step.fontScale < 0.95
            ? "Spacing adjusted to the minimum readable scale (93%) to fit within the 2-page A4 ceiling."
            : "Layout compacted automatically to keep the CV within 2 A4 pages."
        );
        break;
      }
    }
    if (sheets.length > 2) {
      warnings.push(
        `The CV spans ${sheets.length} A4 pages at readable typography (recommended max: 2). Trim 1–2 bullets or tighten a summary rather than shrinking text.`
      );
    }
  }

  root.remove();
  sheets.forEach((page, index) => {
    page.style.breakAfter = index === sheets.length - 1 ? "auto" : "page";
    page.style.pageBreakAfter = index === sheets.length - 1 ? "auto" : "always";
    page.querySelector(".document-page-number")!.textContent = `${pageLabel} ${index + 1} / ${sheets.length}`;
    if (sheets.length === 1 && !isCv) (page.querySelector(".document-page-footer") as HTMLElement).style.display = "none";
  });
  return { pages: sheets.length, height: pages.offsetHeight, warnings: [...new Set(warnings)] };
}
