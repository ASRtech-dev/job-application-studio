import { celebrate as confetti } from "./celebration";

interface SaveFileHandle {
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}

type SaveFilePicker = (options: {
  suggestedName: string;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<SaveFileHandle>;

/** Saves a PDF using the native picker when supported, or an anchor download. */
export async function downloadPdfBlob(blob: Blob, defaultFilename: string, particleCount = 150): Promise<void> {
    let saved = false;
    
    // Attempt to use showSaveFilePicker to let user choose target directory and filename
    if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
      try {
        const handle = await (window as Window & { showSaveFilePicker: SaveFilePicker }).showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [
            {
              description: "PDF Document",
              accept: {
                "application/pdf": [".pdf"]
              }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        saved = true;

        confetti({
          particleCount,
          spread: particleCount === 200 ? 100 : 80,
          origin: { y: 0.5 }
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          console.log("User cancelled save dialog");
          return; // Stop execution on explicit user cancel
        }
        console.warn("showSaveFilePicker failed, falling back to standard download:", err);
      }
    }

    if (!saved) {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      confetti({
        particleCount,
        spread: particleCount === 200 ? 100 : 80,
        origin: { y: 0.5 }
      });
    }
  }
