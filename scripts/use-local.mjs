import { spawn } from "node:child_process";

// Build before normal use so the launcher always runs the current source version.
function runNext(args, stdio = "inherit") {
  return spawn(process.execPath, ["node_modules/next/dist/bin/next", ...args], { stdio, windowsHide: true });
}

function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd.exe", ["/c", "start", "", url], { windowsHide: true, stdio: "ignore" });
  } else if (process.platform === "darwin") {
    spawn("open", [url], { stdio: "ignore" });
  } else {
    spawn("xdg-open", [url], { stdio: "ignore" });
  }
}

const build = runNext(["build", "--webpack"]);
build.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
build.on("exit", (code) => {
  if (code !== 0) {
    process.exitCode = code ?? 1;
    return;
  }
  const server = runNext(["start", "--hostname", "127.0.0.1"], ["inherit", "pipe", "inherit"]);
  let opened = false;
  server.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    if (!opened && /Ready/i.test(chunk.toString())) {
      opened = true;
      openBrowser("http://127.0.0.1:3000");
    }
  });
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
});
