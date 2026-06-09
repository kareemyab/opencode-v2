import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, statSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import * as http2 from "node:http";
import { createServer } from "node:net";
import { homedir, userInfo, tmpdir } from "node:os";
import { extname, dirname, join, resolve, relative, isAbsolute, basename } from "node:path";
import { setDefaultCACertificates, getCACertificates } from "node:tls";
import { app, crashReporter, netLog, shell, protocol, net, BrowserWindow, nativeTheme, nativeImage, dialog, ipcMain, clipboard, Notification, Menu, utilityProcess } from "electron";
import contextMenu from "electron-context-menu";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { readdir, readFile, access } from "node:fs/promises";
import util from "node:util";
import windowState from "electron-window-state";
import { fileURLToPath, pathToFileURL } from "node:url";
import log from "electron-log/main.js";
import { ZipWriter, BlobWriter, BlobReader } from "@zip.js/zip.js";
import Store from "electron-store";
import { Effect, Deferred, Fiber } from "effect";
import { marked } from "marked";
import pkg from "electron-updater";
const execFilePromise = util.promisify(execFile);
const exists = (path) => access(path).then(() => true).catch(() => false);
function checkAppExists(appName) {
  if (process.platform === "win32") return true;
  if (process.platform === "linux") return true;
  return checkMacosApp(appName);
}
function resolveAppPath(appName) {
  if (process.platform !== "win32") return appName;
  return resolveWindowsAppPath(appName);
}
function wslPath(path, mode) {
  if (process.platform !== "win32") return path;
  const flag = mode === "windows" ? "-w" : "-u";
  try {
    if (path.startsWith("~")) {
      const suffix = path.slice(1);
      const cmd = `wslpath ${flag} "$HOME${suffix.replace(/"/g, '\\"')}"`;
      const output2 = execFileSync("wsl", ["-e", "sh", "-lc", cmd]);
      return output2.toString().trim();
    }
    const output = execFileSync("wsl", ["-e", "wslpath", flag, path]);
    return output.toString().trim();
  } catch (error) {
    throw new Error(`Failed to run wslpath: ${String(error)}`, { cause: error });
  }
}
async function checkMacosApp(appName) {
  const locations = [`/Applications/${appName}.app`, `/System/Applications/${appName}.app`];
  const home = process.env.HOME;
  if (home) locations.push(`${home}/Applications/${appName}.app`);
  for (const location of locations) {
    if (await exists(location)) return true;
  }
  return execFilePromise("which", [appName]).then(() => true).catch(() => false);
}
async function resolveWindowsAppPath(appName) {
  let output;
  try {
    output = await execFilePromise("where", [appName]).then((r) => r.stdout.toString());
  } catch {
    return null;
  }
  const paths = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  const hasExt = (path, ext) => extname(path).toLowerCase() === `.${ext}`;
  const exe = paths.find((path) => hasExt(path, "exe"));
  if (exe) return exe;
  const resolveCmd = async (path) => {
    const content = await readFile(path, "utf8");
    for (const token of content.split('"').map((value) => value.trim())) {
      const lower = token.toLowerCase();
      if (!lower.includes(".exe")) continue;
      const index = lower.indexOf("%~dp0");
      if (index >= 0) {
        const base2 = dirname(path);
        const suffix = token.slice(index + 5);
        const resolved = suffix.replace(/\//g, "\\").split("\\").filter((part) => part && part !== ".").reduce((current, part) => {
          if (part === "..") return dirname(current);
          return join(current, part);
        }, base2);
        if (await exists(resolved)) return resolved;
      }
      if (await exists(token)) return token;
    }
    return null;
  };
  for (const path of paths) {
    if (hasExt(path, "cmd") || hasExt(path, "bat")) {
      const resolved = await resolveCmd(path);
      if (resolved) return resolved;
    }
    if (!extname(path)) {
      const cmd = `${path}.cmd`;
      if (await exists(cmd)) {
        const resolved = await resolveCmd(cmd);
        if (resolved) return resolved;
      }
      const bat = `${path}.bat`;
      if (await exists(bat)) {
        const resolved = await resolveCmd(bat);
        if (resolved) return resolved;
      }
    }
  }
  const key = appName.split("").filter((value) => /[a-z0-9]/i.test(value)).map((value) => value.toLowerCase()).join("");
  if (key) {
    for (const path of paths) {
      const dirs = [dirname(path), dirname(dirname(path)), dirname(dirname(dirname(path)))];
      for (const dir of dirs) {
        try {
          for (const entry of await readdir(dir)) {
            const candidate = join(dir, entry);
            if (!hasExt(candidate, "exe")) continue;
            const stem = entry.replace(/\.exe$/i, "");
            const name = stem.split("").filter((value) => /[a-z0-9]/i.test(value)).map((value) => value.toLowerCase()).join("");
            if (name.includes(key) || key.includes(name)) return candidate;
          }
        } catch {
          continue;
        }
      }
    }
  }
  return paths[0] ?? null;
}
const PRODUCT_NAME = "orgn";
const DOCS_URL = "https://orgn.com/docs";
const SUPPORT_URL = "https://orgn.com/support";
const DEEP_LINK_SCHEME = "orgn";
const LEGACY_DEEP_LINK_SCHEME = "opencode";
const STORAGE_PREFIX = "orgn";
const LEGACY_STORAGE_PREFIX = "opencode";
const APP_IDS = {
  dev: "com.orgn.desktop.dev",
  beta: "com.orgn.desktop.beta",
  prod: "com.orgn.desktop"
};
const APP_NAMES = {
  dev: "Orgn CDE Dev",
  beta: "Orgn CDE Beta",
  prod: "Orgn CDE"
};
const UPDATE_PUBLISH_URLS = {
  beta: "https://origin-agent.sfo3.digitaloceanspaces.com/orgn-desktop-beta",
  prod: "https://origin-agent.sfo3.digitaloceanspaces.com/orgn-desktop"
};
function updatePublishUrl(channel) {
  const env = process.env.ORGN_UPDATE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  return UPDATE_PUBLISH_URLS[channel];
}
const ORGN_THEME_COLORS = {
  surfaceVoid: "#000000",
  metaThemeColorLight: "#fafafa"
};
function storageKey(suffix) {
  return `${STORAGE_PREFIX}.${suffix}`;
}
function legacyStorageKey(suffix) {
  return `${LEGACY_STORAGE_PREFIX}.${suffix}`;
}
const DESKTOP_STORAGE = {
  settings: storageKey("settings"),
  globalDat: storageKey("global.dat")
};
const LEGACY_DESKTOP_STORAGE = {
  settings: legacyStorageKey("settings"),
  globalDat: legacyStorageKey("global.dat")
};
function deepLinkPrefix(scheme = DEEP_LINK_SCHEME) {
  return `${scheme}://`;
}
function isDeepLink(url, scheme = DEEP_LINK_SCHEME) {
  return url.startsWith(deepLinkPrefix(scheme));
}
function isAnyDeepLink(url) {
  return isDeepLink(url, DEEP_LINK_SCHEME) || isDeepLink(url, LEGACY_DEEP_LINK_SCHEME);
}
const raw = "prod";
const CHANNEL = raw;
const SETTINGS_STORE = DESKTOP_STORAGE.settings;
const LEGACY_SETTINGS_STORE = LEGACY_DESKTOP_STORAGE.settings;
const DEFAULT_SERVER_URL_KEY = "defaultServerUrl";
const WSL_ENABLED_KEY = "wslEnabled";
const PINCH_ZOOM_ENABLED_KEY = "pinchZoomEnabled";
const UPDATER_ENABLED = app.isPackaged && CHANNEL !== "dev";
const DEEP_LINK_SCHEMES = [DEEP_LINK_SCHEME, LEGACY_DEEP_LINK_SCHEME];
function registerDeepLinkProtocolHandlers(register) {
  return DEEP_LINK_SCHEMES.map((scheme) => register(scheme));
}
function extractDeepLinkUrls(args) {
  return args.filter((arg) => isAnyDeepLink(arg));
}
const MAX_LOG_AGE_DAYS = 7;
const EXPORT_WINDOW = 24 * 60 * 60 * 1e3;
const MAX_EXPORT_FILE_SIZE = 50 * 1024 * 1024;
const NET_LOG_SIZE = 20 * 1024 * 1024;
let root$1 = "";
let run = "";
let netLogPath;
let logger$1;
const getLogger = () => logger$1;
function initLogging() {
  initRunDirectory();
  log.transports.file.maxSize = 5 * 1024 * 1024;
  log.transports.file.resolvePathFn = (_vars, message) => join(
    run,
    `${safeLogName(message?.scope ?? (message?.variables?.processType === "renderer" ? "renderer" : "main"))}.log`
  );
  log.initialize({ preload: false, spyRendererConsole: true });
  initConsoleTransport();
  cleanup();
  return logger$1 = log;
}
function initCrashReporter() {
  const dir = join(app.getPath("userData"), "Crashpad");
  mkdirSync(dir, { recursive: true });
  app.setPath("crashDumps", dir);
  crashReporter.start({ uploadToServer: false, compress: true });
  write("crash", "crash reporter started", { path: dir });
}
async function startNetLog() {
  if (netLog.currentlyLogging) return;
  netLogPath = join(run, "network.netlog");
  await netLog.startLogging(netLogPath, { captureMode: "default", maxFileSize: NET_LOG_SIZE });
  write("network", "net log started", { path: netLogPath });
}
async function exportDebugLogs() {
  const restartNetLog = netLog.currentlyLogging;
  if (restartNetLog) {
    await netLog.stopLogging().catch((error) => write("network", "failed to stop net log", { error }));
  }
  const output = join(app.getPath("downloads"), `opencode-debug-${stamp()}.zip`);
  try {
    write("main", "exporting debug logs", { output });
    await writeZip(output, [
      { name: "manifest.json", data: Buffer.from(JSON.stringify(manifest(), null, 2)) },
      ...collect(root$1, "desktop"),
      ...serverLogRoots().flatMap((dir, i) => collect(dir, `server-${i + 1}`)),
      ...collect(app.getPath("crashDumps"), "crashpad")
    ]);
    shell.showItemInFolder(output);
    return output;
  } finally {
    if (restartNetLog) {
      await startNetLog().catch((error) => write("network", "failed to restart net log", { error }));
    }
  }
}
function write(name, message, extra, level = "info") {
  if (!run) return;
  const scoped = log.scope(safeLogName(name));
  if (extra !== void 0) {
    scoped[level](message, extra);
    return;
  }
  scoped[level](message);
}
function initRunDirectory() {
  root$1 = join(app.getPath("userData"), "logs");
  run = join(root$1, stamp());
  mkdirSync(run, { recursive: true });
}
function stamp() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "");
}
function safeLogName(name) {
  return name.replace(/[^a-z0-9_.-]/gi, "_") || "main";
}
function cleanup() {
  const dir = root$1 || dirname(log.transports.file.getFile().path);
  const cutoff = Date.now() - MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1e3;
  for (const entry of readdirSync(dir)) {
    const file = join(dir, entry);
    try {
      const info = statSync(file);
      if (info.mtimeMs < cutoff) rmSync(file, { recursive: true, force: true });
    } catch {
      continue;
    }
  }
}
function manifest() {
  return {
    generated: (/* @__PURE__ */ new Date()).toISOString(),
    version: app.getVersion(),
    name: app.getName(),
    packaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch,
    versions: process.versions,
    uptime: process.uptime(),
    userData: app.getPath("userData"),
    logs: root$1,
    currentRun: run,
    crashDumps: app.getPath("crashDumps"),
    serverLogs: serverLogRoots(),
    netLog: netLogPath
  };
}
function serverLogRoots() {
  const xdgData = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return [.../* @__PURE__ */ new Set([join(xdgData, "opencode", "log"), join(app.getPath("userData"), "opencode", "log")])];
}
function collect(dir, prefix) {
  if (!existsSync(dir)) return [];
  const cutoff = Date.now() - EXPORT_WINDOW;
  const result = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const file = join(current, entry);
      const info = statSync(file);
      if (info.isDirectory()) {
        walk(file);
        continue;
      }
      if (info.mtimeMs < cutoff) continue;
      if (info.size > MAX_EXPORT_FILE_SIZE) continue;
      if (file.endsWith(".heapsnapshot")) continue;
      result.push({ name: join(prefix, file.slice(dir.length + 1)).replace(/\\/g, "/"), path: file });
    }
  };
  walk(dir);
  return result;
}
async function writeZip(output, entries) {
  const writer = new ZipWriter(new BlobWriter("application/zip"));
  for (const entry of entries) {
    const data = entry.data ?? readFileSync(entry.path);
    await writer.add(entry.name, new BlobReader(new Blob([new Uint8Array(data)])));
  }
  const zip = await writer.close();
  writeFileSync(output, Buffer.from(await zip.arrayBuffer()));
}
function initConsoleTransport() {
  const write2 = log.transports.console.writeFn.bind(log.transports.console);
  log.transports.console.writeFn = (options) => {
    try {
      write2(options);
    } catch (err) {
      if (!isBrokenPipe(err)) throw err;
      log.transports.console.level = false;
    }
  };
}
function isBrokenPipe(err) {
  return typeof err === "object" && err !== null && "code" in err && err.code === "EPIPE";
}
const cache = /* @__PURE__ */ new Map();
function getStore(name = SETTINGS_STORE) {
  const cached = cache.get(name);
  if (cached) return cached;
  const next = new Store({
    name,
    cwd: app.getPath("userData"),
    fileExtension: "",
    accessPropertiesByDotNotation: false
  });
  cache.set(name, next);
  return next;
}
const sampleInterval = 1e3;
const samplePeriod = 15e3;
function createUnresponsiveSampler(win, name) {
  let sampleTimer;
  let stopTimer;
  let sampling = false;
  const samples = /* @__PURE__ */ new Map();
  const active = () => sampling && !win.isDestroyed() && !win.webContents.isDestroyed();
  const clearTimers = () => {
    if (sampleTimer) clearTimeout(sampleTimer);
    if (stopTimer) clearTimeout(stopTimer);
    sampleTimer = void 0;
    stopTimer = void 0;
  };
  const schedule = () => {
    sampleTimer = setTimeout(() => {
      void collect2();
    }, sampleInterval);
  };
  const collect2 = async () => {
    if (!active()) return;
    const stack = await win.webContents.mainFrame.collectJavaScriptCallStack().catch((error) => {
      write("window", "failed to collect unresponsive sample", { window: name, error }, "error");
      return void 0;
    });
    if (!active()) return;
    if (stack) samples.set(stack, (samples.get(stack) ?? 0) + 1);
    schedule();
  };
  const stopAndFlush = () => {
    const wasSampling = sampling;
    sampling = false;
    clearTimers();
    if (samples.size === 0) return wasSampling;
    const entries = [...samples.entries()].sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, entry) => sum + entry[1], 0);
    const message = [
      "renderer unresponsive samples",
      `Window: ${name}`,
      `URL: ${win.isDestroyed() ? "<destroyed>" : win.webContents.getURL()}`,
      ...entries.map((entry) => `<${entry[1]}> ${entry[0]}`),
      `Total Samples: ${total}`
    ].join("\n");
    write("window", message, void 0, "error");
    samples.clear();
    return wasSampling;
  };
  const start = () => {
    if (sampling || win.isDestroyed() || win.webContents.isDestroyed() || win.webContents.isDevToolsOpened()) return;
    sampling = true;
    samples.clear();
    schedule();
    stopTimer = setTimeout(stopAndFlush, samplePeriod);
  };
  win.on("closed", stopAndFlush);
  return { start, stopAndFlush };
}
const root = dirname(fileURLToPath(import.meta.url));
const rendererRoot = join(root, "../renderer");
const rendererProtocol = "oc";
const rendererHost = "renderer";
const clipboardWritePermission = "clipboard-sanitized-write";
const notificationPermission = "notifications";
const rendererPermissions = /* @__PURE__ */ new Set([clipboardWritePermission, notificationPermission]);
const orgnBackground = {
  light: ORGN_THEME_COLORS.metaThemeColorLight,
  dark: ORGN_THEME_COLORS.surfaceVoid
};
const documentPolicyHeader = "Document-Policy";
const jsCallStacksDocumentPolicy = "include-js-call-stacks-in-crash-reports";
protocol.registerSchemesAsPrivileged([
  {
    scheme: rendererProtocol,
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true
    }
  }
]);
let backgroundColor;
let relaunchHandler = () => {
  app.relaunch();
  app.exit(0);
};
const titlebarThemes = /* @__PURE__ */ new WeakMap();
const pinchZoomEnabled = /* @__PURE__ */ new WeakMap();
const titlebarHeight = 40;
const maxZoomLevel = 10;
const minZoomLevel = 0.2;
function setRelaunchHandler(handler) {
  relaunchHandler = handler;
}
function setBackgroundColor(color) {
  backgroundColor = color;
  BrowserWindow.getAllWindows().forEach((win) => win.setBackgroundColor(color));
}
function resolveChannel() {
  const raw2 = process.env.OPENCODE_CHANNEL;
  if (raw2 === "dev" || raw2 === "beta" || raw2 === "prod") return raw2;
  return "dev";
}
function iconsDir() {
  const channel = resolveChannel();
  const candidates = app.isPackaged ? [
    join(process.resourcesPath, "icons"),
    join(app.getAppPath(), "resources", "icons")
  ] : [
    join(app.getAppPath(), "icons", channel),
    join(root, "../../icons", channel),
    join(app.getAppPath(), "resources", "icons")
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "icon.png")) || existsSync(join(dir, "icon.icns")) || existsSync(join(dir, "icon.ico"))) {
      return dir;
    }
  }
  return candidates[0];
}
function loadIconFromDir(dir, names) {
  for (const name of names) {
    const path = resolve(dir, name);
    if (!existsSync(path)) continue;
    const image = nativeImage.createFromPath(path);
    if (!image.isEmpty()) return image;
  }
  return nativeImage.createEmpty();
}
function loadMacIcon() {
  const dir = iconsDir();
  const image = loadIconFromDir(dir, ["icon.icns", "icon.png"]);
  if (!image.isEmpty()) return image;
  write("main", "failed to load macOS app icon", { dir, channel: resolveChannel() }, "warn");
  return nativeImage.createEmpty();
}
function loadWindowIcon() {
  if (process.platform === "darwin") return loadMacIcon();
  const dir = iconsDir();
  const names = process.platform === "win32" ? ["icon.ico", "icon.png"] : ["icon.png"];
  const image = loadIconFromDir(dir, names);
  if (!image.isEmpty()) return image;
  write("main", "failed to load window icon", { dir, channel: resolveChannel() }, "warn");
  return nativeImage.createEmpty();
}
function tone() {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}
function defaultBackgroundColor() {
  return orgnBackground[tone()];
}
function overlay(theme = {}, zoom = 1) {
  const mode = theme.mode ?? tone();
  return {
    color: "#00000000",
    symbolColor: mode === "dark" ? "white" : "black",
    height: Math.max(titlebarHeight, Math.round(titlebarHeight * zoom))
  };
}
function setTitlebar(win, theme = {}) {
  titlebarThemes.set(win, theme);
  updateTitlebar(win);
}
function updateTitlebar(win) {
  if (process.platform !== "win32") return;
  win.setTitleBarOverlay(overlay(titlebarThemes.get(win), win.webContents.getZoomFactor()));
}
function setPinchZoomEnabled(enabled) {
  getStore().set(PINCH_ZOOM_ENABLED_KEY, enabled);
  for (const win of BrowserWindow.getAllWindows()) {
    pinchZoomEnabled.set(win, enabled);
    win.webContents.send("pinch-zoom-enabled-changed", enabled);
    if (!enabled && win.webContents.getZoomFactor() !== 1) win.webContents.setZoomFactor(1);
    updateZoom(win);
  }
}
function getPinchZoomEnabled() {
  return getStore().get(PINCH_ZOOM_ENABLED_KEY) === true;
}
function createMainWindow() {
  const state = windowState({
    defaultWidth: 1280,
    defaultHeight: 800
  });
  const mode = tone();
  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    show: false,
    autoHideMenuBar: true,
    title: PRODUCT_NAME,
    icon: loadWindowIcon(),
    backgroundColor: backgroundColor ?? defaultBackgroundColor(),
    ...process.platform === "darwin" ? {
      titleBarStyle: "hidden",
      trafficLightPosition: { x: 12, y: 14 }
    } : {},
    ...process.platform === "win32" ? {
      frame: false,
      titleBarStyle: "hidden",
      titleBarOverlay: overlay({ mode })
    } : {},
    webPreferences: {
      preload: join(root, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  allowRendererPermissions(win);
  wireWindowRecovery(win, "main");
  win.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    const { requestHeaders } = details;
    upsertKeyValue(requestHeaders, "Access-Control-Allow-Origin", ["*"]);
    callback({ requestHeaders });
  });
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const { responseHeaders = {} } = details;
    addRendererHeaders(details.url, responseHeaders);
    callback({ responseHeaders });
  });
  state.manage(win);
  loadWindow(win, "index.html");
  wireZoom(win);
  win.once("ready-to-show", () => {
    win.show();
  });
  return win;
}
function registerRendererProtocol() {
  if (protocol.isProtocolHandled(rendererProtocol)) return;
  protocol.handle(rendererProtocol, async (request) => {
    const url = new URL(request.url);
    if (url.host !== rendererHost) {
      write("protocol", "rejected host", { url: request.url }, "warn");
      return new Response("Not found", { status: 404 });
    }
    const file = resolve(rendererRoot, `.${decodeURIComponent(url.pathname)}`);
    const rel = relative(rendererRoot, file);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      write("protocol", "rejected path", { url: request.url, file }, "warn");
      return new Response("Not found", { status: 404 });
    }
    try {
      const response = await net.fetch(pathToFileURL(file).toString());
      if (response.status >= 400) {
        write(
          "protocol",
          "fetch failed",
          {
            url: request.url,
            file,
            status: response.status,
            statusText: response.statusText
          },
          "error"
        );
      }
      return addDocumentPolicy(response, file);
    } catch (error) {
      write("protocol", "fetch error", { url: request.url, file, error }, "error");
      return new Response("Not found", { status: 404 });
    }
  });
}
function loadWindow(win, html) {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    const url = new URL(html, devUrl);
    void win.loadURL(url.toString());
    return;
  }
  void win.loadURL(`${rendererProtocol}://${rendererHost}/${html}`);
}
function wireWindowRecovery(win, name) {
  let showing = false;
  const sampler = createUnresponsiveSampler(win, name);
  const handle = async (button, wait) => {
    if (button === "Export Logs") {
      const sampling = sampler.stopAndFlush();
      await exportDebugLogs().catch((error) => write("main", "failed to export debug logs", { error }, "error"));
      if (wait && sampling) sampler.start();
      return true;
    }
    if (button === "Relaunch") {
      sampler.stopAndFlush();
      relaunchHandler();
      return false;
    }
    if (button === "Quit") {
      sampler.stopAndFlush();
      app.quit();
    }
    return false;
  };
  const show = async (message, detail, wait) => {
    if (showing || win.isDestroyed()) return;
    showing = true;
    try {
      while (!win.isDestroyed()) {
        const buttons = wait ? ["Relaunch", "Export Logs", "Keep Waiting"] : ["Relaunch", "Export Logs", "Quit"];
        const result = await dialog.showMessageBox(win, {
          type: "warning",
          buttons,
          defaultId: 0,
          cancelId: 2,
          message,
          detail
        });
        if (await handle(buttons[result.response], wait)) continue;
        return;
      }
    } finally {
      showing = false;
    }
  };
  const failed = (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    write(
      "window",
      "renderer load failed",
      {
        window: name,
        event,
        errorCode,
        errorDescription,
        validatedURL,
        currentURL: win.webContents.getURL(),
        isMainFrame
      },
      "error"
    );
    if (!isMainFrame || errorCode === -3) return;
    void show(
      `${PRODUCT_NAME} failed to load`,
      [`Window: ${name}`, `URL: ${validatedURL}`, `Error: ${errorCode} ${errorDescription}`].join("\n"),
      false
    );
  };
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    failed("did-fail-load", errorCode, errorDescription, validatedURL, isMainFrame);
  });
  win.webContents.on("did-fail-provisional-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    failed("did-fail-provisional-load", errorCode, errorDescription, validatedURL, isMainFrame);
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    sampler.stopAndFlush();
    write(
      "window",
      "renderer process gone",
      { window: name, currentURL: win.webContents.getURL(), details },
      "error"
    );
    void show(
      `${PRODUCT_NAME} window terminated unexpectedly`,
      [`Window: ${name}`, `Reason: ${details.reason}`, `Code: ${details.exitCode ?? "<unknown>"}`].join("\n"),
      false
    );
  });
  win.on("unresponsive", () => {
    write("window", "renderer unresponsive", { window: name, currentURL: win.webContents.getURL() }, "error");
    sampler.start();
    void show(`${PRODUCT_NAME} is not responding`, "You can relaunch the app, open the logs, or keep waiting.", true);
  });
  win.on("responsive", () => {
    write("window", "renderer responsive", { window: name, currentURL: win.webContents.getURL() }, "error");
    sampler.stopAndFlush();
  });
  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (message.toLowerCase().includes("terminal") || sourceId.toLowerCase().includes("terminal")) {
      write("pty", "console", { window: name, level, message, line, sourceId });
    }
  });
  win.webContents.on("preload-error", (_event, preloadPath, error) => {
    write("preload", "preload error", { window: name, preloadPath, error }, "error");
  });
}
function addDocumentPolicy(response, file) {
  if (!file.toLowerCase().endsWith(".html")) return response;
  const headers = new Headers(response.headers);
  headers.set(documentPolicyHeader, jsCallStacksDocumentPolicy);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function allowRendererPermissions(win) {
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(
      rendererPermissions.has(permission) && isTrustedRendererUrl(details.requestingUrl) && webContents.id === win.webContents.id
    );
  });
  win.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (!rendererPermissions.has(permission)) return false;
    if (webContents && webContents.id !== win.webContents.id) return false;
    return isTrustedRendererUrl(details.requestingUrl) || isTrustedRendererUrl(requestingOrigin);
  });
}
function isTrustedRendererUrl(value) {
  return isRendererUrl(value);
}
function addRendererHeaders(value, headers) {
  upsertKeyValue(headers, "Access-Control-Allow-Origin", ["*"]);
  upsertKeyValue(headers, "Access-Control-Allow-Headers", ["*"]);
  if (isRendererUrl(value, true)) upsertKeyValue(headers, documentPolicyHeader, [jsCallStacksDocumentPolicy]);
}
function isRendererUrl(value, html = false) {
  if (!value || !URL.canParse(value)) return false;
  const url = new URL(value);
  if (html && !url.pathname.endsWith(".html")) return false;
  if (url.protocol === `${rendererProtocol}:` && url.host === rendererHost) return true;
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (!devUrl || !URL.canParse(devUrl)) return false;
  return url.origin === new URL(devUrl).origin;
}
function wireZoom(win) {
  pinchZoomEnabled.set(win, getPinchZoomEnabled());
  win.webContents.setZoomFactor(1);
  win.webContents.on("zoom-changed", (event, zoomDirection) => {
    event.preventDefault();
    if (pinchZoomEnabled.get(win)) {
      win.webContents.setZoomFactor(clampZoom(win.webContents.getZoomFactor() + (zoomDirection === "in" ? 0.2 : -0.2)));
      updateZoom(win);
      return;
    }
    if (win.webContents.getZoomFactor() !== 1) win.webContents.setZoomFactor(1);
    updateZoom(win);
  });
}
function clampZoom(value) {
  return Math.min(Math.max(value, minZoomLevel), maxZoomLevel);
}
function updateZoom(win) {
  updateTitlebar(win);
  win.webContents.send("zoom-factor-changed", win.webContents.getZoomFactor());
}
function upsertKeyValue(obj, keyToChange, value) {
  const keyToChangeLower = keyToChange.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === keyToChangeLower) {
      obj[key] = value;
      return;
    }
  }
  obj[keyToChange] = value;
}
function runDesktopMenuAction(win, action, handlers = {}) {
  switch (action) {
    case "app.checkForUpdates":
      handlers.checkForUpdates?.();
      return;
    case "app.relaunch":
      handlers.relaunch?.();
      return;
    case "window.new":
      createMainWindow();
      return;
    case "window.close":
      win?.close();
      return;
    case "window.minimize":
      win?.minimize();
      return;
    case "window.toggleMaximize":
      if (win?.isMaximized()) {
        win.unmaximize();
        return;
      }
      win?.maximize();
      return;
    case "view.reload":
      win?.reload();
      return;
    case "view.toggleDevTools":
      win?.webContents.toggleDevTools();
      return;
    case "view.resetZoom":
      setZoom(win, 1);
      return;
    case "view.zoomIn":
      setZoom(win, (win?.webContents.getZoomFactor() ?? 1) + 0.2);
      return;
    case "view.zoomOut":
      setZoom(win, (win?.webContents.getZoomFactor() ?? 1) - 0.2);
      return;
    case "view.toggleFullscreen":
      win?.setFullScreen(!win.isFullScreen());
      return;
    case "edit.undo":
      win?.webContents.undo();
      return;
    case "edit.redo":
      win?.webContents.redo();
      return;
    case "edit.cut":
      win?.webContents.cut();
      return;
    case "edit.copy":
      win?.webContents.copy();
      return;
    case "edit.paste":
      win?.webContents.paste();
      return;
    case "edit.delete":
      win?.webContents.delete();
      return;
    case "edit.selectAll":
      win?.webContents.selectAll();
      return;
  }
}
function setZoom(win, value) {
  if (!win) return;
  win.webContents.setZoomFactor(Math.min(Math.max(value, 0.2), 10));
  updateTitlebar(win);
}
const pickerFilters = (ext) => {
  if (!ext || ext.length === 0) return void 0;
  return [{ name: "Files", extensions: ext }];
};
function registerIpcHandlers(deps) {
  ipcMain.handle("kill-sidecar", () => deps.killSidecar());
  ipcMain.handle("await-initialization", () => deps.awaitInitialization());
  ipcMain.handle("get-window-config", () => deps.getWindowConfig());
  ipcMain.handle("consume-initial-deep-links", () => deps.consumeInitialDeepLinks());
  ipcMain.handle("get-default-server-url", () => deps.getDefaultServerUrl());
  ipcMain.handle(
    "set-default-server-url",
    (_event, url) => deps.setDefaultServerUrl(url)
  );
  ipcMain.handle("get-wsl-config", () => deps.getWslConfig());
  ipcMain.handle("set-wsl-config", (_event, config) => deps.setWslConfig(config));
  ipcMain.handle("get-display-backend", () => deps.getDisplayBackend());
  ipcMain.handle(
    "set-display-backend",
    (_event, backend) => deps.setDisplayBackend(backend)
  );
  ipcMain.handle("parse-markdown", (_event, markdown) => deps.parseMarkdown(markdown));
  ipcMain.handle("check-app-exists", (_event, appName) => deps.checkAppExists(appName));
  ipcMain.handle(
    "wsl-path",
    (_event, path, mode) => deps.wslPath(path, mode)
  );
  ipcMain.handle("resolve-app-path", (_event, appName) => deps.resolveAppPath(appName));
  ipcMain.handle("run-updater", (_event, alertOnFail) => deps.runUpdater(alertOnFail));
  ipcMain.handle("check-update", () => deps.checkUpdate());
  ipcMain.handle("install-update", () => deps.installUpdate());
  ipcMain.handle("set-background-color", (_event, color) => deps.setBackgroundColor(color));
  ipcMain.handle("export-debug-logs", () => deps.exportDebugLogs());
  ipcMain.handle(
    "record-fatal-renderer-error",
    (_event, error) => deps.recordFatalRendererError(error)
  );
  ipcMain.handle("store-get", (_event, name, key) => {
    try {
      const store = getStore(name);
      const value = store.get(key);
      if (value === void 0 || value === null) return null;
      return typeof value === "string" ? value : JSON.stringify(value);
    } catch {
      return null;
    }
  });
  ipcMain.handle("store-set", (_event, name, key, value) => {
    getStore(name).set(key, value);
  });
  ipcMain.handle("store-delete", (_event, name, key) => {
    getStore(name).delete(key);
  });
  ipcMain.handle("store-clear", (_event, name) => {
    getStore(name).clear();
  });
  ipcMain.handle("store-keys", (_event, name) => {
    const store = getStore(name);
    return Object.keys(store.store);
  });
  ipcMain.handle("store-length", (_event, name) => {
    const store = getStore(name);
    return Object.keys(store.store).length;
  });
  ipcMain.handle(
    "open-directory-picker",
    async (_event, opts) => {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory", ...opts?.multiple ? ["multiSelections"] : [], "createDirectory"],
        title: opts?.title ?? "Choose a folder",
        defaultPath: opts?.defaultPath
      });
      if (result.canceled) return null;
      return opts?.multiple ? result.filePaths : result.filePaths[0];
    }
  );
  ipcMain.handle(
    "open-file-picker",
    async (_event, opts) => {
      const result = await dialog.showOpenDialog({
        properties: ["openFile", ...opts?.multiple ? ["multiSelections"] : []],
        title: opts?.title ?? "Choose a file",
        defaultPath: opts?.defaultPath,
        filters: pickerFilters(opts?.extensions)
      });
      if (result.canceled) return null;
      return opts?.multiple ? result.filePaths : result.filePaths[0];
    }
  );
  ipcMain.handle(
    "save-file-picker",
    async (_event, opts) => {
      const result = await dialog.showSaveDialog({
        title: opts?.title ?? "Save file",
        defaultPath: opts?.defaultPath
      });
      if (result.canceled) return null;
      return result.filePath ?? null;
    }
  );
  ipcMain.on("open-link", (_event, url) => {
    void shell.openExternal(url);
  });
  ipcMain.handle("open-path", async (_event, path, app2) => {
    if (!app2) return shell.openPath(path);
    await new Promise((resolve2, reject) => {
      const [cmd, args] = process.platform === "darwin" ? ["open", ["-a", app2, path]] : [app2, [path]];
      execFile(cmd, args, (err) => err ? reject(err) : resolve2());
    });
  });
  ipcMain.handle("read-clipboard-image", () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) return null;
    const buffer = image.toPNG().buffer;
    const size = image.getSize();
    return { buffer, width: size.width, height: size.height };
  });
  ipcMain.on("show-notification", (_event, title, body) => {
    new Notification({ title, body }).show();
  });
  ipcMain.handle("get-window-count", () => BrowserWindow.getAllWindows().length);
  ipcMain.handle("get-window-focused", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win?.isFocused() ?? false;
  });
  ipcMain.handle("set-window-focus", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.focus();
  });
  ipcMain.handle("show-window", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.show();
  });
  ipcMain.on("relaunch", () => {
    app.relaunch();
    app.exit(0);
  });
  ipcMain.handle("get-zoom-factor", (event) => event.sender.getZoomFactor());
  ipcMain.handle("set-zoom-factor", (event, factor) => {
    event.sender.setZoomFactor(factor);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    updateTitlebar(win);
  });
  ipcMain.handle("get-pinch-zoom-enabled", () => getPinchZoomEnabled());
  ipcMain.handle("set-pinch-zoom-enabled", (_event, enabled) => {
    setPinchZoomEnabled(enabled);
  });
  ipcMain.handle("set-titlebar", (event, theme) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    setTitlebar(win, theme);
  });
  ipcMain.handle("run-desktop-menu-action", (event, action) => {
    runDesktopMenuAction(BrowserWindow.fromWebContents(event.sender), action);
  });
}
function sendMenuCommand(win, id) {
  win.webContents.send("menu-command", id);
}
function sendDeepLinks(win, urls) {
  win.webContents.send("deep-link", urls);
}
function forwardInitializationFailure(initialization) {
  return (effect) => effect.pipe(Effect.tapCause((cause) => Deferred.failCause(initialization, cause)));
}
const renderer = new marked.Renderer();
renderer.link = ({ href, title, text }) => {
  const titleAttr = title ? ` title="${title}"` : "";
  return `<a href="${href}"${titleAttr} class="external-link" target="_blank" rel="noopener noreferrer">${text}</a>`;
};
function parseMarkdown(input) {
  return marked(input, {
    renderer,
    breaks: false,
    gfm: true
  });
}
const DESKTOP_MENU = [
  {
    id: "app",
    label: PRODUCT_NAME,
    platforms: ["macos"],
    items: [
      { type: "item", role: "about" },
      { type: "item", label: "Check for Updates...", action: "app.checkForUpdates", enabled: "updater" },
      { type: "item", label: "Settings", command: "settings.open", accelerator: { macos: "Cmd+," } },
      { type: "item", label: "Reload Webview", action: "view.reload" },
      { type: "item", label: "Restart", action: "app.relaunch" },
      { type: "item", label: "Export Logs...", command: "logs.export" },
      { type: "separator" },
      { type: "item", role: "hide" },
      { type: "item", role: "hideOthers" },
      { type: "item", role: "unhide" },
      { type: "separator" },
      { type: "item", role: "quit" }
    ]
  },
  {
    id: "file",
    label: "File",
    items: [
      {
        type: "item",
        label: "New Session",
        command: "session.new",
        accelerator: { macos: "Shift+Cmd+S" }
      },
      { type: "item", label: "Open Project...", command: "project.open", accelerator: { macos: "Cmd+O" } },
      {
        type: "item",
        label: "Settings",
        command: "settings.open",
        accelerator: { windows: "Ctrl+," },
        platforms: ["windows"]
      },
      {
        type: "item",
        label: "New Window",
        action: "window.new",
        accelerator: { macos: "Cmd+Shift+N", windows: "Ctrl+Shift+N" }
      },
      { type: "separator" },
      { type: "item", label: "Close Window", action: "window.close", role: "close" }
    ]
  },
  {
    id: "edit",
    label: "Edit",
    items: [
      { type: "item", label: "Undo", action: "edit.undo", role: "undo", accelerator: { windows: "Ctrl+Z" } },
      { type: "item", label: "Redo", action: "edit.redo", role: "redo", accelerator: { windows: "Ctrl+Y" } },
      { type: "separator" },
      { type: "item", label: "Cut", action: "edit.cut", role: "cut", accelerator: { windows: "Ctrl+X" } },
      { type: "item", label: "Copy", action: "edit.copy", role: "copy", accelerator: { windows: "Ctrl+C" } },
      { type: "item", label: "Paste", action: "edit.paste", role: "paste", accelerator: { windows: "Ctrl+V" } },
      { type: "item", label: "Delete", action: "edit.delete" },
      {
        type: "item",
        label: "Select All",
        action: "edit.selectAll",
        role: "selectAll",
        accelerator: { windows: "Ctrl+A" }
      }
    ]
  },
  {
    id: "view",
    label: "View",
    items: [
      { type: "item", label: "Toggle Sidebar", command: "sidebar.toggle", accelerator: { macos: "Cmd+B" } },
      { type: "item", label: "Toggle Terminal", command: "terminal.toggle", accelerator: { macos: "Ctrl+`" } },
      { type: "item", label: "Toggle File Tree", command: "fileTree.toggle" },
      { type: "separator" },
      { type: "item", label: "Reload", action: "view.reload", role: "reload" },
      { type: "item", label: "Toggle Developer Tools", action: "view.toggleDevTools", role: "toggleDevTools" },
      { type: "separator" },
      {
        type: "item",
        label: "Actual Size",
        action: "view.resetZoom",
        role: "resetZoom",
        accelerator: { windows: "Ctrl+0" }
      },
      { type: "item", label: "Zoom In", action: "view.zoomIn", role: "zoomIn", accelerator: { windows: "Ctrl++" } },
      { type: "item", label: "Zoom Out", action: "view.zoomOut", role: "zoomOut", accelerator: { windows: "Ctrl+-" } },
      { type: "separator" },
      { type: "item", label: "Toggle Full Screen", action: "view.toggleFullscreen", role: "togglefullscreen" }
    ]
  },
  {
    id: "go",
    label: "Go",
    items: [
      { type: "item", label: "Back", command: "common.goBack", accelerator: { macos: "Cmd+[" } },
      { type: "item", label: "Forward", command: "common.goForward", accelerator: { macos: "Cmd+]" } },
      { type: "separator" },
      { type: "item", label: "Previous Session", command: "session.previous", accelerator: { macos: "Option+Up" } },
      { type: "item", label: "Next Session", command: "session.next", accelerator: { macos: "Option+Down" } },
      { type: "separator" },
      {
        type: "item",
        label: "Previous Project",
        command: "project.previous",
        accelerator: { macos: "Cmd+Option+Up" }
      },
      {
        type: "item",
        label: "Next Project",
        command: "project.next",
        accelerator: { macos: "Cmd+Option+Down" }
      }
    ]
  },
  {
    id: "window",
    label: "Window",
    role: "windowMenu",
    items: [
      { type: "item", label: "Minimize", action: "window.minimize" },
      { type: "item", label: "Maximize", action: "window.toggleMaximize" },
      { type: "separator" },
      { type: "item", label: "Close Window", action: "window.close" }
    ]
  },
  {
    id: "help",
    label: "Help",
    items: [
      { type: "item", label: "orgn Documentation", href: DOCS_URL },
      { type: "item", label: "Support", href: SUPPORT_URL },
      { type: "item", label: "Export Logs...", command: "logs.export" },
      { type: "separator" },
      {
        type: "item",
        label: "Share Feedback",
        href: SUPPORT_URL
      },
      {
        type: "item",
        label: "Report a Bug",
        href: SUPPORT_URL
      }
    ]
  }
];
function desktopMenuVisible(item, platform) {
  return !item.platforms || item.platforms.includes(platform);
}
function createMenu(deps) {
  if (process.platform !== "darwin") return;
  const template = DESKTOP_MENU.filter((menu) => desktopMenuVisible(menu, "macos")).map((menu) => {
    if (menu.role) return { role: nativeRole(menu.role) };
    return {
      label: menu.label,
      submenu: menu.items?.filter((entry) => desktopMenuVisible(entry, "macos")).map((entry) => nativeItem(entry, deps))
    };
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
function nativeItem(entry, deps) {
  if (entry.type === "separator") return { type: "separator" };
  if (entry.role) return { role: nativeRole(entry.role) };
  const item = {
    label: entry.label,
    accelerator: entry.accelerator?.macos,
    enabled: entry.enabled === "updater" ? UPDATER_ENABLED : void 0
  };
  if (entry.command) {
    const command = entry.command;
    item.click = () => deps.trigger(command);
  }
  if (entry.action) {
    const action = entry.action;
    item.click = () => runDesktopMenuAction(BrowserWindow.getFocusedWindow(), action, {
      checkForUpdates: deps.checkForUpdates,
      relaunch: deps.relaunch
    });
  }
  if (entry.href) {
    const href = entry.href;
    item.click = () => shell.openExternal(href);
  }
  return item;
}
function nativeRole(role) {
  return role;
}
const TIMEOUT = 5e3;
function resolveUserShell(envShell, loginShell) {
  const resolvedLoginShell = loginShell && loginShell !== "unknown" ? loginShell : void 0;
  return envShell || resolvedLoginShell || "/bin/sh";
}
function getUserShell() {
  try {
    return resolveUserShell(process.env.SHELL, userInfo().shell);
  } catch {
    return resolveUserShell(process.env.SHELL, void 0);
  }
}
function parseShellEnv(out) {
  const env = {};
  for (const line of out.toString("utf8").split("\0")) {
    if (!line) continue;
    const ix = line.indexOf("=");
    if (ix <= 0) continue;
    env[line.slice(0, ix)] = line.slice(ix + 1);
  }
  return env;
}
function probe(shell2, mode) {
  const out = spawnSync(shell2, [mode, "-c", "env -0"], {
    stdio: ["ignore", "pipe", "ignore"],
    timeout: TIMEOUT,
    windowsHide: true
  });
  const err = out.error;
  if (err) {
    if (err.code === "ETIMEDOUT") return { type: "Timeout" };
    console.log(`[server] Shell env probe failed for ${shell2} ${mode}: ${err.message}`);
    return { type: "Unavailable" };
  }
  if (out.status !== 0) {
    console.log(`[server] Shell env probe exited with non-zero status for ${shell2} ${mode}`);
    return { type: "Unavailable" };
  }
  const env = parseShellEnv(out.stdout);
  if (Object.keys(env).length === 0) {
    console.log(`[server] Shell env probe returned empty env for ${shell2} ${mode}`);
    return { type: "Unavailable" };
  }
  return { type: "Loaded", value: env };
}
function isNushell(shell2) {
  const name = basename(shell2).toLowerCase();
  const raw2 = shell2.toLowerCase();
  return name === "nu" || name === "nu.exe" || raw2.endsWith("\\nu.exe");
}
function loadShellEnv(shell2) {
  const logger2 = getLogger();
  if (isNushell(shell2)) {
    logger2.log(`[server] Skipping shell env probe for nushell: ${shell2}`);
    return null;
  }
  const interactive = probe(shell2, "-il");
  if (interactive.type === "Loaded") {
    logger2.log(`[server] Loaded shell environment with -il (${Object.keys(interactive.value).length} vars)`);
    return interactive.value;
  }
  if (interactive.type === "Timeout") {
    logger2.log(`[server] Interactive shell env probe timed out: ${shell2}`);
    return null;
  }
  const login = probe(shell2, "-l");
  if (login.type === "Loaded") {
    logger2.log(`[server] Loaded shell environment with -l (${Object.keys(login.value).length} vars)`);
    return login.value;
  }
  logger2.log(`[server] Falling back to app environment: ${shell2}`);
  return null;
}
const SIDECAR_SERVICE_NAME = "opencode server";
const SIDECAR_START_STALL_TIMEOUT = 6e4;
const SIDECAR_STOP_TIMEOUT = 6e3;
function getDefaultServerUrl() {
  const value = getStore().get(DEFAULT_SERVER_URL_KEY);
  return typeof value === "string" ? value : null;
}
function setDefaultServerUrl(url) {
  if (url) {
    getStore().set(DEFAULT_SERVER_URL_KEY, url);
    return;
  }
  getStore().delete(DEFAULT_SERVER_URL_KEY);
}
function getWslConfig() {
  const value = getStore().get(WSL_ENABLED_KEY);
  return { enabled: typeof value === "boolean" ? value : false };
}
function setWslConfig(config) {
  getStore().set(WSL_ENABLED_KEY, config.enabled);
}
function preferAppEnv(userDataPath) {
  const shell2 = process.platform === "win32" ? null : getUserShell();
  Object.assign(process.env, {
    ...shell2 ? loadShellEnv(shell2) : null,
    OPENCODE_EXPERIMENTAL_ICON_DISCOVERY: "true",
    OPENCODE_EXPERIMENTAL_FILEWATCHER: "true",
    OPENCODE_CLIENT: "desktop",
    XDG_STATE_HOME: process.env.XDG_STATE_HOME ?? userDataPath
  });
}
async function spawnLocalServer(hostname, port, password, options) {
  const sidecar = join(dirname(fileURLToPath(import.meta.url)), "sidecar.js");
  const child = utilityProcess.fork(sidecar, [], {
    cwd: process.cwd(),
    env: createSidecarEnv(),
    serviceName: SIDECAR_SERVICE_NAME,
    stdio: "pipe"
  });
  let exited = false;
  const exit = defer();
  const onProcessGone = (_event, details) => {
    if (details.type !== "Utility" || details.name !== SIDECAR_SERVICE_NAME) return;
    options.onStderr?.(`utility process gone reason=${details.reason} exitCode=${details.exitCode}`);
  };
  app.on("child-process-gone", onProcessGone);
  child.once("exit", (code) => {
    exited = true;
    app.off("child-process-gone", onProcessGone);
    options.onExit?.(code);
    exit.resolve(code);
  });
  child.on("error", (error) => options.onStderr?.(`utility process error: ${serializeError(error).message}`));
  child.stdout?.on("data", (chunk) => options.onStdout?.(chunk.toString("utf8").trimEnd()));
  child.stderr?.on("data", (chunk) => options.onStderr?.(chunk.toString("utf8").trimEnd()));
  await new Promise((resolve2, reject) => {
    let done = false;
    let timeout;
    const fail = (error) => {
      if (done) return;
      done = true;
      cleanup2();
      reject(error);
    };
    const refreshTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        fail(new Error(`Sidecar did not become ready within ${SIDECAR_START_STALL_TIMEOUT}ms: ${sidecar}`));
      }, SIDECAR_START_STALL_TIMEOUT);
    };
    const onMessage = (message) => {
      if (message.type === "ready") {
        if (done) return;
        done = true;
        cleanup2();
        resolve2();
        return;
      }
      if (message.type === "error") {
        fail(Object.assign(new Error(message.error.message), { stack: message.error.stack }));
      }
    };
    const onExit = (code) => {
      fail(new Error(`Sidecar exited before ready with code ${code}`));
    };
    const cleanup2 = () => {
      clearTimeout(timeout);
      child.off("message", onMessage);
      child.off("exit", onExit);
    };
    child.on("message", onMessage);
    child.on("exit", onExit);
    refreshTimeout();
    child.postMessage({
      type: "start",
      hostname,
      port,
      password,
      userDataPath: options.userDataPath
    });
  }).catch((error) => {
    if (!exited) child.kill();
    throw error;
  });
  const wait = (async () => {
    const url = `http://${hostname}:${port}`;
    let healthy = false;
    const gone = exit.promise.then((code) => {
      if (healthy) return;
      throw new Error(`Sidecar exited before health check passed with code ${code}`);
    });
    const ready = async () => {
      while (true) {
        await new Promise((resolve2) => setTimeout(resolve2, 100));
        if (await checkHealth(url, password)) {
          healthy = true;
          return;
        }
      }
    };
    await Promise.race([ready(), gone]);
  })();
  let stopping;
  return {
    listener: {
      stop: () => {
        if (stopping) return stopping;
        if (exited) return Promise.resolve();
        child.postMessage({ type: "stop" });
        stopping = Promise.race([
          exit.promise.then(() => void 0),
          delay(SIDECAR_STOP_TIMEOUT).then(() => {
            if (!exited) child.kill();
          })
        ]);
        return stopping;
      }
    },
    health: { wait }
  };
}
async function checkHealth(url, password) {
  let healthUrl;
  try {
    healthUrl = new URL("/global/health", url);
  } catch {
    return false;
  }
  const headers = new Headers();
  if (password) {
    const auth = Buffer.from(`opencode:${password}`).toString("base64");
    headers.set("authorization", `Basic ${auth}`);
  }
  try {
    const res = await fetch(healthUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(3e3)
    });
    return res.ok;
  } catch {
    return false;
  }
}
function createSidecarEnv() {
  const env = Object.fromEntries(
    Object.entries(process.env).flatMap(([key, value]) => value === void 0 ? [] : [[key, String(value)]])
  );
  delete env.DEBUG;
  if (process.platform === "linux") delete env.LD_PRELOAD;
  if (!app.isPackaged) env.OPENCODE_DISABLE_CHANNEL_DB = "1";
  return env;
}
function delay(ms) {
  return new Promise((resolve2) => setTimeout(resolve2, ms));
}
function serializeError(error) {
  if (error instanceof Error) return { message: error.message, stack: error.stack };
  return { message: String(error) };
}
function defer() {
  let resolve2;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve2 = res;
    reject = rej;
  });
  return { promise, resolve: resolve2, reject };
}
const TAURI_MIGRATED_KEY = "tauriMigrated";
const SETTINGS_MIGRATED_KEY = "settingsStoreMigrated";
function tauriDir(id) {
  switch (process.platform) {
    case "darwin":
      return join(homedir(), "Library", "Application Support", id);
    case "win32":
      return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), id);
    default:
      return join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), id);
  }
}
const LEGACY_TAURI_APP_IDS = {
  dev: "ai.opencode.desktop.dev",
  beta: "ai.opencode.desktop.beta",
  prod: "ai.opencode.desktop"
};
function tauriAppIds() {
  const current = app.isPackaged ? APP_IDS[CHANNEL] : APP_IDS.dev;
  const legacy = LEGACY_TAURI_APP_IDS[CHANNEL];
  return legacy === current ? [current] : [current, legacy];
}
function migrateFile(datPath, filename) {
  let data;
  try {
    data = JSON.parse(readFileSync(datPath, "utf-8"));
  } catch (err) {
    log.warn("tauri migration: failed to parse", filename, err);
    return;
  }
  const legacySettingsName = `${LEGACY_SETTINGS_STORE}.dat`;
  const nextSettingsName = `${SETTINGS_STORE}.dat`;
  const storeName = filename === legacySettingsName || filename === nextSettingsName ? SETTINGS_STORE : filename === LEGACY_DESKTOP_STORAGE.globalDat || filename === "opencode.global.dat" ? DESKTOP_STORAGE.globalDat : filename;
  const target = getStore(storeName);
  const migrated = [];
  const skipped = [];
  for (const [key, value] of Object.entries(data)) {
    if (target.has(key)) {
      skipped.push(key);
      continue;
    }
    target.set(key, value);
    migrated.push(key);
  }
  log.log("tauri migration: migrated", filename, "→", storeName, { migrated, skipped });
}
function migrateSettingsStore() {
  if (getStore().get(SETTINGS_MIGRATED_KEY)) return;
  const legacy = getStore(LEGACY_SETTINGS_STORE);
  const next = getStore(SETTINGS_STORE);
  const migrated = [];
  for (const key of Object.keys(legacy.store)) {
    if (next.has(key)) continue;
    next.set(key, legacy.get(key));
    migrated.push(key);
  }
  if (migrated.length > 0) {
    log.log("settings migration: copied legacy store keys", { migrated });
  }
  getStore().set(SETTINGS_MIGRATED_KEY, true);
}
const GLOBAL_DAT_MIGRATED_KEY = "globalDatMigrated";
function migrateGlobalDatStore() {
  if (getStore().get(GLOBAL_DAT_MIGRATED_KEY)) return;
  const legacy = getStore(LEGACY_DESKTOP_STORAGE.globalDat);
  const next = getStore(DESKTOP_STORAGE.globalDat);
  const migrated = [];
  for (const key of Object.keys(legacy.store)) {
    if (next.has(key)) continue;
    next.set(key, legacy.get(key));
    migrated.push(key);
  }
  if (migrated.length > 0) {
    log.log("global dat migration: copied legacy store keys", { migrated });
  }
  getStore().set(GLOBAL_DAT_MIGRATED_KEY, true);
}
function migrate() {
  migrateSettingsStore();
  migrateGlobalDatStore();
  if (getStore().get(TAURI_MIGRATED_KEY)) {
    log.log("tauri migration: already done, skipping");
    return;
  }
  for (const id of tauriAppIds()) {
    const dir = tauriDir(id);
    log.log("tauri migration: checking", { dir, id });
    if (!existsSync(dir)) continue;
    for (const filename of readdirSync(dir)) {
      if (!filename.endsWith(".dat")) continue;
      migrateFile(join(dir, filename), filename);
    }
  }
  log.log("tauri migration: complete");
  getStore().set(TAURI_MIGRATED_KEY, true);
}
const isDict = (value) => value != null && (value = Object.getPrototypeOf(value), value === Array.prototype || value === Object.prototype);
function visitDict(flat_dict, dict2, path) {
  for (const [key, value] of Object.entries(dict2)) {
    const key_path = `${path}.${key}`;
    flat_dict[key_path] = value;
    isDict(value) && visitDict(flat_dict, value, key_path);
  }
}
function flatten(dict2) {
  const flat_dict = { ...dict2 };
  for (const [key, value] of Object.entries(dict2)) {
    isDict(value) && visitDict(flat_dict, value, key);
  }
  return flat_dict;
}
const resolveTemplate = (string, args) => {
  if (args)
    for (const [key, value] of Object.entries(args))
      string = string.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), value);
  return string;
};
const identityResolveTemplate = ((v) => v);
function translator(dict2, resolveTemplate2 = identityResolveTemplate) {
  return (path, ...args) => {
    if (path[0] === ".")
      path = path.slice(1);
    const value = dict2()?.[path];
    switch (typeof value) {
      case "function":
        return value(...args);
      case "string":
        return resolveTemplate2(value, args[0]);
      default:
        return value;
    }
  };
}
const dict$f = {
  "desktop.menu.checkForUpdates": "Check for Updates...",
  "desktop.menu.installCli": "Install CLI...",
  "desktop.menu.reloadWebview": "Reload Webview",
  "desktop.menu.restart": "Restart",
  "desktop.dialog.chooseFolder": "Choose a folder",
  "desktop.dialog.chooseFile": "Choose a file",
  "desktop.dialog.saveFile": "Save file",
  "desktop.updater.checkFailed.title": "Update Check Failed",
  "desktop.updater.checkFailed.message": "Failed to check for updates",
  "desktop.updater.none.title": "No Update Available",
  "desktop.updater.none.message": "You are already using the latest version of orgn",
  "desktop.updater.downloadFailed.title": "Update Failed",
  "desktop.updater.downloadFailed.message": "Failed to download update",
  "desktop.updater.downloaded.title": "Update Downloaded",
  "desktop.updater.downloaded.prompt": "Version {{version}} of orgn has been downloaded, would you like to install it and relaunch?",
  "desktop.updater.downloaded.restart": "Restart",
  "desktop.updater.downloaded.later": "Later",
  "desktop.updater.installFailed.title": "Update Failed",
  "desktop.updater.installFailed.message": "Failed to install update",
  "desktop.cli.installed.title": "CLI Installed",
  "desktop.cli.installed.message": "CLI installed to {{path}}\n\nRestart your terminal to use the 'opencode' command.",
  "desktop.cli.failed.title": "Installation Failed",
  "desktop.cli.failed.message": "Failed to install CLI: {{error}}"
};
const dict$e = {
  "desktop.menu.checkForUpdates": "检查更新...",
  "desktop.menu.installCli": "安装 CLI...",
  "desktop.menu.reloadWebview": "重新加载 Webview",
  "desktop.menu.restart": "重启",
  "desktop.dialog.chooseFolder": "选择文件夹",
  "desktop.dialog.chooseFile": "选择文件",
  "desktop.dialog.saveFile": "保存文件",
  "desktop.updater.checkFailed.title": "检查更新失败",
  "desktop.updater.checkFailed.message": "无法检查更新",
  "desktop.updater.none.title": "没有可用更新",
  "desktop.updater.none.message": "你已经在使用最新版本的 orgn",
  "desktop.updater.downloadFailed.title": "更新失败",
  "desktop.updater.downloadFailed.message": "无法下载更新",
  "desktop.updater.downloaded.title": "更新已下载",
  "desktop.updater.downloaded.prompt": "已下载 orgn {{version}} 版本，是否安装并重启？",
  "desktop.updater.installFailed.title": "更新失败",
  "desktop.updater.downloaded.restart": "重启",
  "desktop.updater.downloaded.later": "稍后",
  "desktop.updater.installFailed.message": "无法安装更新",
  "desktop.cli.installed.title": "CLI 已安装",
  "desktop.cli.installed.message": "CLI 已安装到 {{path}}\n\n重启终端以使用 'opencode' 命令。",
  "desktop.cli.failed.title": "安装失败",
  "desktop.cli.failed.message": "无法安装 CLI: {{error}}"
};
const dict$d = {
  "desktop.menu.checkForUpdates": "檢查更新...",
  "desktop.menu.installCli": "安裝 CLI...",
  "desktop.menu.reloadWebview": "重新載入 Webview",
  "desktop.menu.restart": "重新啟動",
  "desktop.dialog.chooseFolder": "選擇資料夾",
  "desktop.dialog.chooseFile": "選擇檔案",
  "desktop.dialog.saveFile": "儲存檔案",
  "desktop.updater.checkFailed.title": "檢查更新失敗",
  "desktop.updater.checkFailed.message": "無法檢查更新",
  "desktop.updater.none.title": "沒有可用更新",
  "desktop.updater.none.message": "你已在使用最新版的 orgn",
  "desktop.updater.downloadFailed.title": "更新失敗",
  "desktop.updater.downloadFailed.message": "無法下載更新",
  "desktop.updater.downloaded.title": "更新已下載",
  "desktop.updater.downloaded.prompt": "已下載 orgn {{version}} 版本，是否安裝並重新啟動？",
  "desktop.updater.installFailed.title": "更新失敗",
  "desktop.updater.downloaded.restart": "重新啟動",
  "desktop.updater.downloaded.later": "稍後",
  "desktop.updater.installFailed.message": "無法安裝更新",
  "desktop.cli.installed.title": "CLI 已安裝",
  "desktop.cli.installed.message": "CLI 已安裝到 {{path}}\n\n重新啟動終端機以使用 'opencode' 命令。",
  "desktop.cli.failed.title": "安裝失敗",
  "desktop.cli.failed.message": "無法安裝 CLI: {{error}}"
};
const dict$c = {
  "desktop.menu.checkForUpdates": "업데이트 확인...",
  "desktop.menu.installCli": "CLI 설치...",
  "desktop.menu.reloadWebview": "Webview 새로고침",
  "desktop.menu.restart": "다시 시작",
  "desktop.dialog.chooseFolder": "폴더 선택",
  "desktop.dialog.chooseFile": "파일 선택",
  "desktop.dialog.saveFile": "파일 저장",
  "desktop.updater.checkFailed.title": "업데이트 확인 실패",
  "desktop.updater.checkFailed.message": "업데이트를 확인하지 못했습니다",
  "desktop.updater.none.title": "사용 가능한 업데이트 없음",
  "desktop.updater.none.message": "이미 최신 버전의 orgn를 사용하고 있습니다",
  "desktop.updater.downloadFailed.title": "업데이트 실패",
  "desktop.updater.downloadFailed.message": "업데이트를 다운로드하지 못했습니다",
  "desktop.updater.downloaded.title": "업데이트 다운로드 완료",
  "desktop.updater.downloaded.prompt": "orgn {{version}} 버전을 다운로드했습니다. 설치하고 다시 실행할까요?",
  "desktop.updater.installFailed.title": "업데이트 실패",
  "desktop.updater.downloaded.restart": "다시 시작",
  "desktop.updater.downloaded.later": "나중에",
  "desktop.updater.installFailed.message": "업데이트를 설치하지 못했습니다",
  "desktop.cli.installed.title": "CLI 설치됨",
  "desktop.cli.installed.message": "CLI가 {{path}}에 설치되었습니다\n\n터미널을 다시 시작하여 'opencode' 명령을 사용하세요.",
  "desktop.cli.failed.title": "설치 실패",
  "desktop.cli.failed.message": "CLI 설치 실패: {{error}}"
};
const dict$b = {
  "desktop.menu.checkForUpdates": "Nach Updates suchen...",
  "desktop.menu.installCli": "CLI installieren...",
  "desktop.menu.reloadWebview": "Webview neu laden",
  "desktop.menu.restart": "Neustart",
  "desktop.dialog.chooseFolder": "Ordner auswählen",
  "desktop.dialog.chooseFile": "Datei auswählen",
  "desktop.dialog.saveFile": "Datei speichern",
  "desktop.updater.checkFailed.title": "Updateprüfung fehlgeschlagen",
  "desktop.updater.checkFailed.message": "Updates konnten nicht geprüft werden",
  "desktop.updater.none.title": "Kein Update verfügbar",
  "desktop.updater.none.message": "Sie verwenden bereits die neueste Version von orgn",
  "desktop.updater.downloadFailed.title": "Update fehlgeschlagen",
  "desktop.updater.downloadFailed.message": "Update konnte nicht heruntergeladen werden",
  "desktop.updater.downloaded.title": "Update heruntergeladen",
  "desktop.updater.downloaded.prompt": "Version {{version}} von orgn wurde heruntergeladen. Möchten Sie sie installieren und neu starten?",
  "desktop.updater.downloaded.restart": "Neu starten",
  "desktop.updater.downloaded.later": "Später",
  "desktop.updater.installFailed.title": "Update fehlgeschlagen",
  "desktop.updater.installFailed.message": "Update konnte nicht installiert werden",
  "desktop.cli.installed.title": "CLI installiert",
  "desktop.cli.installed.message": "CLI wurde in {{path}} installiert\n\nStarten Sie Ihr Terminal neu, um den Befehl 'opencode' zu verwenden.",
  "desktop.cli.failed.title": "Installation fehlgeschlagen",
  "desktop.cli.failed.message": "CLI konnte nicht installiert werden: {{error}}"
};
const dict$a = {
  "desktop.menu.checkForUpdates": "Buscar actualizaciones...",
  "desktop.menu.installCli": "Instalar CLI...",
  "desktop.menu.reloadWebview": "Recargar Webview",
  "desktop.menu.restart": "Reiniciar",
  "desktop.dialog.chooseFolder": "Elegir una carpeta",
  "desktop.dialog.chooseFile": "Elegir un archivo",
  "desktop.dialog.saveFile": "Guardar archivo",
  "desktop.updater.checkFailed.title": "Comprobación de actualizaciones fallida",
  "desktop.updater.checkFailed.message": "No se pudieron buscar actualizaciones",
  "desktop.updater.none.title": "No hay actualizaciones disponibles",
  "desktop.updater.none.message": "Ya estás usando la versión más reciente de orgn",
  "desktop.updater.downloadFailed.title": "Actualización fallida",
  "desktop.updater.downloadFailed.message": "No se pudo descargar la actualización",
  "desktop.updater.downloaded.title": "Actualización descargada",
  "desktop.updater.downloaded.prompt": "Se ha descargado la versión {{version}} de orgn. ¿Quieres instalarla y reiniciar?",
  "desktop.updater.downloaded.restart": "Reiniciar",
  "desktop.updater.downloaded.later": "Más tarde",
  "desktop.updater.installFailed.title": "Actualización fallida",
  "desktop.updater.installFailed.message": "No se pudo instalar la actualización",
  "desktop.cli.installed.title": "CLI instalada",
  "desktop.cli.installed.message": "CLI instalada en {{path}}\n\nReinicia tu terminal para usar el comando 'opencode'.",
  "desktop.cli.failed.title": "Instalación fallida",
  "desktop.cli.failed.message": "No se pudo instalar la CLI: {{error}}"
};
const dict$9 = {
  "desktop.menu.checkForUpdates": "Vérifier les mises à jour...",
  "desktop.menu.installCli": "Installer la CLI...",
  "desktop.menu.reloadWebview": "Recharger la Webview",
  "desktop.menu.restart": "Redémarrer",
  "desktop.dialog.chooseFolder": "Choisir un dossier",
  "desktop.dialog.chooseFile": "Choisir un fichier",
  "desktop.dialog.saveFile": "Enregistrer le fichier",
  "desktop.updater.checkFailed.title": "Échec de la vérification des mises à jour",
  "desktop.updater.checkFailed.message": "Impossible de vérifier les mises à jour",
  "desktop.updater.none.title": "Aucune mise à jour disponible",
  "desktop.updater.none.message": "Vous utilisez déjà la dernière version d'orgn",
  "desktop.updater.downloadFailed.title": "Échec de la mise à jour",
  "desktop.updater.downloadFailed.message": "Impossible de télécharger la mise à jour",
  "desktop.updater.downloaded.title": "Mise à jour téléchargée",
  "desktop.updater.downloaded.prompt": "La version {{version}} d'orgn a été téléchargée. Voulez-vous l'installer et redémarrer ?",
  "desktop.updater.downloaded.restart": "Redémarrer",
  "desktop.updater.downloaded.later": "Plus tard",
  "desktop.updater.installFailed.title": "Échec de la mise à jour",
  "desktop.updater.installFailed.message": "Impossible d'installer la mise à jour",
  "desktop.cli.installed.title": "CLI installée",
  "desktop.cli.installed.message": "CLI installée dans {{path}}\n\nRedémarrez votre terminal pour utiliser la commande 'opencode'.",
  "desktop.cli.failed.title": "Échec de l'installation",
  "desktop.cli.failed.message": "Impossible d'installer la CLI : {{error}}"
};
const dict$8 = {
  "desktop.menu.checkForUpdates": "Tjek for opdateringer...",
  "desktop.menu.installCli": "Installer CLI...",
  "desktop.menu.reloadWebview": "Genindlæs Webview",
  "desktop.menu.restart": "Genstart",
  "desktop.dialog.chooseFolder": "Vælg en mappe",
  "desktop.dialog.chooseFile": "Vælg en fil",
  "desktop.dialog.saveFile": "Gem fil",
  "desktop.updater.checkFailed.title": "Opdateringstjek mislykkedes",
  "desktop.updater.checkFailed.message": "Kunne ikke tjekke for opdateringer",
  "desktop.updater.none.title": "Ingen opdatering tilgængelig",
  "desktop.updater.none.message": "Du bruger allerede den nyeste version af orgn",
  "desktop.updater.downloadFailed.title": "Opdatering mislykkedes",
  "desktop.updater.downloadFailed.message": "Kunne ikke downloade opdateringen",
  "desktop.updater.downloaded.title": "Opdatering downloadet",
  "desktop.updater.downloaded.prompt": "Version {{version}} af orgn er blevet downloadet. Vil du installere den og genstarte?",
  "desktop.updater.downloaded.restart": "Genstart",
  "desktop.updater.downloaded.later": "Senere",
  "desktop.updater.installFailed.title": "Opdatering mislykkedes",
  "desktop.updater.installFailed.message": "Kunne ikke installere opdateringen",
  "desktop.cli.installed.title": "CLI installeret",
  "desktop.cli.installed.message": "CLI installeret i {{path}}\n\nGenstart din terminal for at bruge 'opencode'-kommandoen.",
  "desktop.cli.failed.title": "Installation mislykkedes",
  "desktop.cli.failed.message": "Kunne ikke installere CLI: {{error}}"
};
const dict$7 = {
  "desktop.menu.checkForUpdates": "アップデートを確認...",
  "desktop.menu.installCli": "CLI をインストール...",
  "desktop.menu.reloadWebview": "Webview を再読み込み",
  "desktop.menu.restart": "再起動",
  "desktop.dialog.chooseFolder": "フォルダーを選択",
  "desktop.dialog.chooseFile": "ファイルを選択",
  "desktop.dialog.saveFile": "ファイルを保存",
  "desktop.updater.checkFailed.title": "アップデートの確認に失敗しました",
  "desktop.updater.checkFailed.message": "アップデートを確認できませんでした",
  "desktop.updater.none.title": "利用可能なアップデートはありません",
  "desktop.updater.none.message": "すでに最新バージョンの orgn を使用しています",
  "desktop.updater.downloadFailed.title": "アップデートに失敗しました",
  "desktop.updater.downloadFailed.message": "アップデートをダウンロードできませんでした",
  "desktop.updater.downloaded.title": "アップデートをダウンロードしました",
  "desktop.updater.downloaded.prompt": "orgn のバージョン {{version}} がダウンロードされました。インストールして再起動しますか？",
  "desktop.updater.downloaded.restart": "再起動",
  "desktop.updater.downloaded.later": "後で",
  "desktop.updater.installFailed.title": "アップデートに失敗しました",
  "desktop.updater.installFailed.message": "アップデートをインストールできませんでした",
  "desktop.cli.installed.title": "CLI をインストールしました",
  "desktop.cli.installed.message": "CLI を {{path}} にインストールしました\n\nターミナルを再起動して 'opencode' コマンドを使用してください。",
  "desktop.cli.failed.title": "インストールに失敗しました",
  "desktop.cli.failed.message": "CLI のインストールに失敗しました: {{error}}"
};
const dict$6 = {
  "desktop.menu.checkForUpdates": "Sprawdź aktualizacje...",
  "desktop.menu.installCli": "Zainstaluj CLI...",
  "desktop.menu.reloadWebview": "Przeładuj Webview",
  "desktop.menu.restart": "Restartuj",
  "desktop.dialog.chooseFolder": "Wybierz folder",
  "desktop.dialog.chooseFile": "Wybierz plik",
  "desktop.dialog.saveFile": "Zapisz plik",
  "desktop.updater.checkFailed.title": "Nie udało się sprawdzić aktualizacji",
  "desktop.updater.checkFailed.message": "Nie udało się sprawdzić aktualizacji",
  "desktop.updater.none.title": "Brak dostępnych aktualizacji",
  "desktop.updater.none.message": "Korzystasz już z najnowszej wersji orgn",
  "desktop.updater.downloadFailed.title": "Aktualizacja nie powiodła się",
  "desktop.updater.downloadFailed.message": "Nie udało się pobrać aktualizacji",
  "desktop.updater.downloaded.title": "Aktualizacja pobrana",
  "desktop.updater.downloaded.prompt": "Pobrano wersję {{version}} orgn. Czy chcesz ją zainstalować i uruchomić ponownie?",
  "desktop.updater.downloaded.restart": "Uruchom ponownie",
  "desktop.updater.downloaded.later": "Później",
  "desktop.updater.installFailed.title": "Aktualizacja nie powiodła się",
  "desktop.updater.installFailed.message": "Nie udało się zainstalować aktualizacji",
  "desktop.cli.installed.title": "CLI zainstalowane",
  "desktop.cli.installed.message": "CLI zainstalowane w {{path}}\n\nUruchom ponownie terminal, aby użyć polecenia 'opencode'.",
  "desktop.cli.failed.title": "Instalacja nie powiodła się",
  "desktop.cli.failed.message": "Nie udało się zainstalować CLI: {{error}}"
};
const dict$5 = {
  "desktop.menu.checkForUpdates": "Проверить обновления...",
  "desktop.menu.installCli": "Установить CLI...",
  "desktop.menu.reloadWebview": "Перезагрузить Webview",
  "desktop.menu.restart": "Перезапустить",
  "desktop.dialog.chooseFolder": "Выберите папку",
  "desktop.dialog.chooseFile": "Выберите файл",
  "desktop.dialog.saveFile": "Сохранить файл",
  "desktop.updater.checkFailed.title": "Не удалось проверить обновления",
  "desktop.updater.checkFailed.message": "Не удалось проверить обновления",
  "desktop.updater.none.title": "Обновлений нет",
  "desktop.updater.none.message": "Вы уже используете последнюю версию orgn",
  "desktop.updater.downloadFailed.title": "Обновление не удалось",
  "desktop.updater.downloadFailed.message": "Не удалось скачать обновление",
  "desktop.updater.downloaded.title": "Обновление загружено",
  "desktop.updater.downloaded.prompt": "Версия orgn {{version}} загружена. Хотите установить и перезапустить?",
  "desktop.updater.installFailed.title": "Обновление не удалось",
  "desktop.updater.downloaded.restart": "Перезапустить",
  "desktop.updater.downloaded.later": "Позже",
  "desktop.updater.installFailed.message": "Не удалось установить обновление",
  "desktop.cli.installed.title": "CLI установлен",
  "desktop.cli.installed.message": "CLI установлен в {{path}}\n\nПерезапустите терминал, чтобы использовать команду 'opencode'.",
  "desktop.cli.failed.title": "Ошибка установки",
  "desktop.cli.failed.message": "Не удалось установить CLI: {{error}}"
};
const dict$4 = {
  "desktop.menu.checkForUpdates": "Перевірити оновлення...",
  "desktop.menu.installCli": "Встановити CLI...",
  "desktop.menu.reloadWebview": "Перезавантажити Webview",
  "desktop.menu.restart": "Перезапустити",
  "desktop.dialog.chooseFolder": "Виберіть теку",
  "desktop.dialog.chooseFile": "Виберіть файл",
  "desktop.dialog.saveFile": "Зберегти файл",
  "desktop.updater.checkFailed.title": "Не вдалося перевірити оновлення",
  "desktop.updater.checkFailed.message": "Не вдалося перевірити наявність оновлень",
  "desktop.updater.none.title": "Немає доступних оновлень",
  "desktop.updater.none.message": "Ви вже використовуєте найновішу версію orgn",
  "desktop.updater.downloadFailed.title": "Помилка оновлення",
  "desktop.updater.downloadFailed.message": "Не вдалося завантажити оновлення",
  "desktop.updater.downloaded.title": "Оновлення завантажено",
  "desktop.updater.downloaded.prompt": "Версію {{version}} orgn завантажено. Бажаєте встановити її та перезапустити?",
  "desktop.updater.downloaded.restart": "Перезапустити",
  "desktop.updater.downloaded.later": "Пізніше",
  "desktop.updater.installFailed.title": "Помилка оновлення",
  "desktop.updater.installFailed.message": "Не вдалося встановити оновлення",
  "desktop.cli.installed.title": "CLI встановлено",
  "desktop.cli.installed.message": "CLI встановлено до {{path}}\n\nПерезапустіть термінал, щоб використовувати команду 'opencode'.",
  "desktop.cli.failed.title": "Не вдалося встановити",
  "desktop.cli.failed.message": "Не вдалося встановити CLI: {{error}}"
};
const dict$3 = {
  "desktop.menu.checkForUpdates": "التحقق من وجود تحديثات...",
  "desktop.menu.installCli": "تثبيت CLI...",
  "desktop.menu.reloadWebview": "إعادة تحميل Webview",
  "desktop.menu.restart": "إعادة تشغيل",
  "desktop.dialog.chooseFolder": "اختر مجلدًا",
  "desktop.dialog.chooseFile": "اختر ملفًا",
  "desktop.dialog.saveFile": "حفظ ملف",
  "desktop.updater.checkFailed.title": "فشل التحقق من التحديثات",
  "desktop.updater.checkFailed.message": "فشل التحقق من وجود تحديثات",
  "desktop.updater.none.title": "لا توجد تحديثات متاحة",
  "desktop.updater.none.message": "أنت تستخدم بالفعل أحدث إصدار من orgn",
  "desktop.updater.downloadFailed.title": "فشل التحديث",
  "desktop.updater.downloadFailed.message": "فشل تنزيل التحديث",
  "desktop.updater.downloaded.title": "تم تنزيل التحديث",
  "desktop.updater.downloaded.prompt": "تم تنزيل إصدار {{version}} من orgn، هل ترغب في تثبيته وإعادة تشغيله؟",
  "desktop.updater.installFailed.title": "فشل التحديث",
  "desktop.updater.downloaded.restart": "إعادة التشغيل",
  "desktop.updater.downloaded.later": "لاحقًا",
  "desktop.updater.installFailed.message": "فشل تثبيت التحديث",
  "desktop.cli.installed.title": "تم تثبيت CLI",
  "desktop.cli.installed.message": "تم تثبيت CLI في {{path}}\n\nأعد تشغيل الطرفية لاستخدام الأمر 'opencode'.",
  "desktop.cli.failed.title": "فشل التثبيت",
  "desktop.cli.failed.message": "فشل تثبيت CLI: {{error}}"
};
const dict$2 = {
  "desktop.menu.checkForUpdates": "Se etter oppdateringer...",
  "desktop.menu.installCli": "Installer CLI...",
  "desktop.menu.reloadWebview": "Last inn Webview på nytt",
  "desktop.menu.restart": "Start på nytt",
  "desktop.dialog.chooseFolder": "Velg en mappe",
  "desktop.dialog.chooseFile": "Velg en fil",
  "desktop.dialog.saveFile": "Lagre fil",
  "desktop.updater.checkFailed.title": "Oppdateringssjekk mislyktes",
  "desktop.updater.checkFailed.message": "Kunne ikke se etter oppdateringer",
  "desktop.updater.none.title": "Ingen oppdatering tilgjengelig",
  "desktop.updater.none.message": "Du bruker allerede den nyeste versjonen av orgn",
  "desktop.updater.downloadFailed.title": "Oppdatering mislyktes",
  "desktop.updater.downloadFailed.message": "Kunne ikke laste ned oppdateringen",
  "desktop.updater.downloaded.title": "Oppdatering lastet ned",
  "desktop.updater.downloaded.prompt": "Versjon {{version}} av orgn er lastet ned. Vil du installere den og starte på nytt?",
  "desktop.updater.downloaded.restart": "Start på nytt",
  "desktop.updater.downloaded.later": "Senere",
  "desktop.updater.installFailed.title": "Oppdatering mislyktes",
  "desktop.updater.installFailed.message": "Kunne ikke installere oppdateringen",
  "desktop.cli.installed.title": "CLI installert",
  "desktop.cli.installed.message": "CLI installert til {{path}}\n\nStart terminalen på nytt for å bruke 'opencode'-kommandoen.",
  "desktop.cli.failed.title": "Installasjon mislyktes",
  "desktop.cli.failed.message": "Kunne ikke installere CLI: {{error}}"
};
const dict$1 = {
  "desktop.menu.checkForUpdates": "Verificar atualizações...",
  "desktop.menu.installCli": "Instalar CLI...",
  "desktop.menu.reloadWebview": "Recarregar Webview",
  "desktop.menu.restart": "Reiniciar",
  "desktop.dialog.chooseFolder": "Escolher uma pasta",
  "desktop.dialog.chooseFile": "Escolher um arquivo",
  "desktop.dialog.saveFile": "Salvar arquivo",
  "desktop.updater.checkFailed.title": "Falha ao verificar atualizações",
  "desktop.updater.checkFailed.message": "Falha ao verificar atualizações",
  "desktop.updater.none.title": "Nenhuma atualização disponível",
  "desktop.updater.none.message": "Você já está usando a versão mais recente do orgn",
  "desktop.updater.downloadFailed.title": "Falha na atualização",
  "desktop.updater.downloadFailed.message": "Falha ao baixar a atualização",
  "desktop.updater.downloaded.title": "Atualização baixada",
  "desktop.updater.downloaded.prompt": "A versão {{version}} do orgn foi baixada. Você gostaria de instalá-la e reiniciar?",
  "desktop.updater.downloaded.restart": "Reiniciar",
  "desktop.updater.downloaded.later": "Depois",
  "desktop.updater.installFailed.title": "Falha na atualização",
  "desktop.updater.installFailed.message": "Falha ao instalar a atualização",
  "desktop.cli.installed.title": "CLI instalada",
  "desktop.cli.installed.message": "CLI instalada em {{path}}\n\nReinicie seu terminal para usar o comando 'opencode'.",
  "desktop.cli.failed.title": "Falha na instalação",
  "desktop.cli.failed.message": "Falha ao instalar a CLI: {{error}}"
};
const dict = {
  "desktop.menu.checkForUpdates": "Provjeri ažuriranja...",
  "desktop.menu.installCli": "Instaliraj CLI...",
  "desktop.menu.reloadWebview": "Ponovo učitavanje webview-a",
  "desktop.menu.restart": "Restartuj",
  "desktop.dialog.chooseFolder": "Odaberi folder",
  "desktop.dialog.chooseFile": "Odaberi datoteku",
  "desktop.dialog.saveFile": "Sačuvaj datoteku",
  "desktop.updater.checkFailed.title": "Provjera ažuriranja nije uspjela",
  "desktop.updater.checkFailed.message": "Nije moguće provjeriti ažuriranja",
  "desktop.updater.none.title": "Nema dostupnog ažuriranja",
  "desktop.updater.none.message": "Već koristiš najnoviju verziju orgn-a",
  "desktop.updater.downloadFailed.title": "Ažuriranje nije uspjelo",
  "desktop.updater.downloadFailed.message": "Neuspjelo preuzimanje ažuriranja",
  "desktop.updater.downloaded.title": "Ažuriranje preuzeto",
  "desktop.updater.downloaded.prompt": "Verzija {{version}} orgn-a je preuzeta. Želiš li da je instaliraš i ponovo pokreneš aplikaciju?",
  "desktop.updater.downloaded.restart": "Ponovo pokreni",
  "desktop.updater.downloaded.later": "Kasnije",
  "desktop.updater.installFailed.title": "Ažuriranje nije uspjelo",
  "desktop.updater.installFailed.message": "Neuspjela instalacija ažuriranja",
  "desktop.cli.installed.title": "CLI instaliran",
  "desktop.cli.installed.message": "CLI je instaliran u {{path}}\n\nRestartuj terminal da bi koristio komandu 'opencode'.",
  "desktop.cli.failed.title": "Instalacija nije uspjela",
  "desktop.cli.failed.message": "Neuspjela instalacija CLI-a: {{error}}"
};
const base = flatten(dict$f);
function build(locale) {
  if (locale === "en") return base;
  if (locale === "zh") return { ...base, ...flatten(dict$e) };
  if (locale === "zht") return { ...base, ...flatten(dict$d) };
  if (locale === "de") return { ...base, ...flatten(dict$b) };
  if (locale === "es") return { ...base, ...flatten(dict$a) };
  if (locale === "fr") return { ...base, ...flatten(dict$9) };
  if (locale === "da") return { ...base, ...flatten(dict$8) };
  if (locale === "ja") return { ...base, ...flatten(dict$7) };
  if (locale === "pl") return { ...base, ...flatten(dict$6) };
  if (locale === "ru") return { ...base, ...flatten(dict$5) };
  if (locale === "uk") return { ...base, ...flatten(dict$4) };
  if (locale === "ar") return { ...base, ...flatten(dict$3) };
  if (locale === "no") return { ...base, ...flatten(dict$2) };
  if (locale === "br") return { ...base, ...flatten(dict$1) };
  if (locale === "bs") return { ...base, ...flatten(dict) };
  return { ...base, ...flatten(dict$c) };
}
function parseLocale(value) {
  if (typeof value === "string" && value.length > 0) {
    if (value === "en" || value.startsWith("en-")) return "en";
    if (value === "zh" || value.startsWith("zh-Hans")) return "zh";
    if (value === "zht" || value.startsWith("zh-Hant")) return "zht";
    if (value === "ko" || value.startsWith("ko")) return "ko";
    if (value === "de" || value.startsWith("de")) return "de";
    if (value === "es" || value.startsWith("es")) return "es";
    if (value === "fr" || value.startsWith("fr")) return "fr";
    if (value === "da" || value.startsWith("da")) return "da";
    if (value === "ja" || value.startsWith("ja")) return "ja";
    if (value === "pl" || value.startsWith("pl")) return "pl";
    if (value === "ru" || value.startsWith("ru")) return "ru";
    if (value === "uk" || value.startsWith("uk")) return "uk";
    if (value === "ar" || value.startsWith("ar")) return "ar";
    if (value === "no" || value.startsWith("no") || value.startsWith("nb") || value.startsWith("nn")) return "no";
    if (value === "br" || value.startsWith("pt")) return "br";
    if (value === "bs" || value.startsWith("bs")) return "bs";
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value;
    return parseLocale(record.locale);
  }
  if (typeof value === "string") {
    try {
      return parseLocale(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return null;
}
function readLocale() {
  const store = getStore(DESKTOP_STORAGE.globalDat);
  const legacy = getStore(LEGACY_DESKTOP_STORAGE.globalDat);
  const raw2 = store.get("language") ?? legacy.get("language");
  return parseLocale(raw2) ?? "en";
}
function tDesktop(key, params) {
  const dict2 = build(readLocale());
  const translate = translator(() => dict2, resolveTemplate);
  return translate(key, params);
}
const { autoUpdater } = pkg;
let downloadedVersion;
let pendingCheck;
function setupAutoUpdater() {
  if (!UPDATER_ENABLED) return;
  const logger2 = getLogger();
  autoUpdater.logger = logger2;
  autoUpdater.channel = "latest";
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  const feedUrl = updatePublishUrl(CHANNEL) ?? process.env.ORGN_UPDATE_URL?.trim();
  logger2.log("auto updater configured", {
    channel: autoUpdater.channel,
    allowPrerelease: autoUpdater.allowPrerelease,
    allowDowngrade: autoUpdater.allowDowngrade,
    currentVersion: app.getVersion(),
    feedUrl: feedUrl ?? null
  });
}
async function checkUpdate() {
  if (!UPDATER_ENABLED) return { updateAvailable: false };
  if (downloadedVersion) return { updateAvailable: true, version: downloadedVersion };
  if (pendingCheck) return pendingCheck;
  pendingCheck = checkAndDownloadUpdate().finally(() => {
    pendingCheck = void 0;
  });
  return pendingCheck;
}
async function checkAndDownloadUpdate() {
  const logger2 = getLogger();
  logger2.log("checking for updates", {
    currentVersion: app.getVersion(),
    channel: autoUpdater.channel,
    allowPrerelease: autoUpdater.allowPrerelease,
    allowDowngrade: autoUpdater.allowDowngrade
  });
  try {
    const result = await autoUpdater.checkForUpdates();
    const updateInfo = result?.updateInfo;
    logger2.log("update metadata fetched", {
      releaseVersion: updateInfo?.version ?? null,
      releaseDate: updateInfo?.releaseDate ?? null,
      releaseName: updateInfo?.releaseName ?? null,
      files: updateInfo?.files?.map((file) => file.url) ?? []
    });
    const version = result?.updateInfo?.version;
    if (result?.isUpdateAvailable === false || !version) {
      logger2.log("no update available", {
        reason: "provider returned no newer version"
      });
      return { updateAvailable: false };
    }
    logger2.log("update available", { version });
    await autoUpdater.downloadUpdate();
    downloadedVersion = version;
    logger2.log("update download completed", { version });
    return { updateAvailable: true, version };
  } catch (error) {
    logger2.error("update check failed", error);
    return { updateAvailable: false, failed: true };
  }
}
async function installUpdate(killSidecar2) {
  const result = downloadedVersion ? { updateAvailable: true, version: downloadedVersion } : await checkUpdate();
  const logger2 = getLogger();
  if (!result.updateAvailable || !downloadedVersion) {
    logger2.log("install update skipped", {
      reason: result.failed ? "update check failed" : "no update available"
    });
    return;
  }
  logger2.log("installing downloaded update", {
    version: result.version ?? null
  });
  await killSidecar2();
  autoUpdater.quitAndInstall();
}
async function checkForUpdates(alertOnFail, killSidecar2) {
  if (!UPDATER_ENABLED) return;
  const logger2 = getLogger();
  logger2.log("checkForUpdates invoked", { alertOnFail });
  const result = await checkUpdate();
  if (!result.updateAvailable) {
    if (result.failed) {
      logger2.log("no update decision", { reason: "update check failed" });
      if (!alertOnFail) return;
      await dialog.showMessageBox({
        type: "error",
        message: tDesktop("desktop.updater.checkFailed.message"),
        title: tDesktop("desktop.updater.checkFailed.title")
      });
      return;
    }
    logger2.log("no update decision", { reason: "already up to date" });
    if (!alertOnFail) return;
    await dialog.showMessageBox({
      type: "info",
      message: tDesktop("desktop.updater.none.message"),
      title: tDesktop("desktop.updater.none.title")
    });
    return;
  }
  const response = await dialog.showMessageBox({
    type: "info",
    message: tDesktop("desktop.updater.downloaded.prompt", { version: result.version ?? "" }),
    title: tDesktop("desktop.updater.downloaded.title"),
    buttons: [
      tDesktop("desktop.updater.downloaded.restart"),
      tDesktop("desktop.updater.downloaded.later")
    ],
    defaultId: 0,
    cancelId: 1
  });
  logger2.log("update prompt response", {
    version: result.version ?? null,
    restartNow: response.response === 0
  });
  if (response.response === 0) {
    await installUpdate(killSidecar2);
  }
}
const TEST_ONBOARDING = process.env.OPENCODE_TEST_ONBOARDING === "1";
const jsCallStackFeature = "DocumentPolicyIncludeJSCallStacksInCrashReports";
let logger;
let mainWindow = null;
let server = null;
const pendingDeepLinks = [];
function useEnvProxy() {
  try {
    ;
    http2.setGlobalProxyFromEnv();
  } catch (error) {
    logger.warn("failed to load proxy environment", error);
  }
}
function emitDeepLinks(urls) {
  if (urls.length === 0) return;
  pendingDeepLinks.push(...urls);
  if (mainWindow) sendDeepLinks(mainWindow, urls);
}
async function killSidecar() {
  if (!server) return;
  const current = server;
  server = null;
  await current.stop();
}
function ensureLoopbackNoProxy() {
  const loopback = ["127.0.0.1", "localhost", "::1"];
  const upsert = (key) => {
    const items = (process.env[key] ?? "").split(",").map((value) => value.trim()).filter((value) => Boolean(value));
    for (const host of loopback) {
      if (items.some((value) => value.toLowerCase() === host)) continue;
      items.push(host);
    }
    process.env[key] = items.join(",");
  };
  upsert("NO_PROXY");
  upsert("no_proxy");
}
const main = Effect.gen(function* () {
  contextMenu({ showSaveImageAs: true, showLookUpSelection: false, showSearchWithGoogle: false });
  try {
    process.chdir(homedir());
  } catch {
  }
  process.env.OPENCODE_DISABLE_EMBEDDED_WEB_UI = "true";
  const appId = app.isPackaged ? APP_IDS[CHANNEL] : APP_IDS.dev;
  const onboardingTestRoot = (() => {
    if (!TEST_ONBOARDING) return;
    const root2 = join(tmpdir(), `opencode-onboarding-${randomUUID()}`);
    rmSync(root2, { recursive: true, force: true });
    ["data", "config", "cache", "state", "desktop", "session"].forEach(
      (dir) => mkdirSync(join(root2, dir), { recursive: true })
    );
    process.env.OPENCODE_DB = ":memory:";
    process.env.XDG_DATA_HOME = join(root2, "data");
    process.env.XDG_CONFIG_HOME = join(root2, "config");
    process.env.XDG_CACHE_HOME = join(root2, "cache");
    process.env.XDG_STATE_HOME = join(root2, "state");
    return root2;
  })();
  app.setName(app.isPackaged ? APP_NAMES[CHANNEL] : APP_NAMES.dev);
  app.setAppUserModelId(appId);
  app.setPath(
    "userData",
    onboardingTestRoot ? join(onboardingTestRoot, "desktop") : join(app.getPath("appData"), appId)
  );
  if (onboardingTestRoot) app.setPath("sessionData", join(onboardingTestRoot, "session"));
  logger = initLogging();
  initCrashReporter();
  try {
    setDefaultCACertificates([.../* @__PURE__ */ new Set([...getCACertificates("default"), ...getCACertificates("system")])]);
  } catch (error) {
    logger.warn("failed to load system certificates", error);
  }
  logger.log("app starting", {
    version: app.getVersion(),
    packaged: app.isPackaged,
    onboardingTest: Boolean(onboardingTestRoot)
  });
  ensureLoopbackNoProxy();
  useEnvProxy();
  app.commandLine.appendSwitch("proxy-bypass-list", "<-loopback>");
  const features = app.commandLine.getSwitchValue("enable-features");
  app.commandLine.appendSwitch("enable-features", features ? `${jsCallStackFeature},${features}` : jsCallStackFeature);
  if (!app.isPackaged) app.commandLine.appendSwitch("remote-debugging-port", "9222");
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  preferAppEnv(app.getPath("userData"));
  app.on("second-instance", (_event, argv) => {
    const urls = extractDeepLinkUrls(argv);
    if (urls.length) {
      logger.log("deep link received via second-instance", { urls });
      emitDeepLinks(urls);
    }
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.on("open-url", (event, url2) => {
    event.preventDefault();
    logger.log("deep link received via open-url", { url: url2 });
    emitDeepLinks([url2]);
  });
  app.on("before-quit", () => {
    void killSidecar();
  });
  app.on("will-quit", () => {
    void killSidecar();
  });
  app.on("child-process-gone", (_event, details) => {
    write("utility", "child process gone", { details }, "error");
  });
  app.on("render-process-gone", (_event, webContents, details) => {
    write("window", "app render process gone", { url: webContents.getURL(), details }, "error");
  });
  setRelaunchHandler(() => {
    void killSidecar().finally(() => {
      app.relaunch();
      app.exit(0);
    });
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      void killSidecar().finally(() => app.exit(0));
    });
  }
  const serverReady = Deferred.makeUnsafe();
  registerIpcHandlers({
    killSidecar: () => killSidecar(),
    awaitInitialization: Effect.fnUntraced(
      function* () {
        logger.log("awaiting server ready");
        const res = yield* Deferred.await(serverReady);
        logger.log("server ready", { url: res.url });
        return res;
      },
      (e) => Effect.runPromise(e)
    ),
    getWindowConfig: () => ({ updaterEnabled: UPDATER_ENABLED }),
    consumeInitialDeepLinks: () => pendingDeepLinks.splice(0),
    getDefaultServerUrl: () => getDefaultServerUrl(),
    setDefaultServerUrl: (url2) => setDefaultServerUrl(url2),
    getWslConfig: () => Promise.resolve(getWslConfig()),
    setWslConfig: (config) => setWslConfig(config),
    getDisplayBackend: async () => null,
    setDisplayBackend: async () => void 0,
    parseMarkdown: async (markdown) => parseMarkdown(markdown),
    checkAppExists: (appName) => checkAppExists(appName),
    wslPath: async (path, mode) => wslPath(path, mode),
    resolveAppPath: async (appName) => resolveAppPath(appName),
    runUpdater: async (alertOnFail) => checkForUpdates(alertOnFail, killSidecar),
    checkUpdate: async () => checkUpdate(),
    installUpdate: async () => installUpdate(killSidecar),
    setBackgroundColor: (color) => setBackgroundColor(color),
    exportDebugLogs: () => exportDebugLogs(),
    recordFatalRendererError: (error) => write("renderer", "fatal renderer error", { ...error }, "error")
  });
  yield* Effect.promise(() => app.whenReady());
  if (!TEST_ONBOARDING) migrate();
  registerDeepLinkProtocolHandlers((scheme) => app.setAsDefaultProtocolClient(scheme));
  registerRendererProtocol();
  setupAutoUpdater();
  yield* Effect.promise(() => startNetLog()).pipe(
    Effect.catch(
      (error) => Effect.sync(() => {
        logger.warn("failed to start net log", error);
      })
    )
  );
  const port = yield* Effect.gen(function* () {
    const fromEnv = process.env.OPENCODE_PORT;
    if (fromEnv) {
      const parsed = Number.parseInt(fromEnv, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
    const res = yield* Deferred.make();
    const server2 = createServer();
    server2.on("error", (e) => Deferred.failSync(res, () => e));
    server2.listen(0, "127.0.0.1", () => {
      const address = server2.address();
      if (typeof address !== "object" || !address) {
        server2.close();
        Deferred.failSync(res, () => new Error("Failed to get port"));
        return;
      }
      const port2 = address.port;
      server2.close(() => Effect.runSync(Deferred.succeed(res, port2)));
    });
    return yield* Deferred.await(res);
  });
  const hostname = "127.0.0.1";
  const url = `http://${hostname}:${port}`;
  const password = randomUUID();
  const loadingTask = yield* Effect.gen(function* () {
    logger.log("sidecar connection started", { url });
    ensureLoopbackNoProxy();
    useEnvProxy();
    logger.log("spawning sidecar", { url });
    const { listener, health } = yield* Effect.promise(
      () => spawnLocalServer(hostname, port, password, {
        userDataPath: app.getPath("userData"),
        onStdout: (message) => write("server", "stdout", { message }),
        onStderr: (message) => write("server", "stderr", { message }, "warn"),
        onExit: (code) => write("utility", "sidecar exited", { code }, "warn")
      })
    );
    server = listener;
    yield* Deferred.succeed(serverReady, {
      url,
      username: "opencode",
      password
    });
    yield* Effect.promise(() => health.wait).pipe(
      Effect.timeout("30 seconds"),
      Effect.catch(
        (e) => Effect.sync(() => {
          logger.error("sidecar health check failed", e.toString());
        })
      )
    );
    logger.log("loading task finished");
  }).pipe(forwardInitializationFailure(serverReady), Effect.forkChild);
  yield* Fiber.await(loadingTask);
  mainWindow = createMainWindow();
  if (mainWindow) {
    createMenu({
      trigger: (id) => {
        const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
        if (win) sendMenuCommand(win, id);
      },
      checkForUpdates: () => {
        void checkForUpdates(true, killSidecar);
      },
      relaunch: () => {
        void killSidecar().finally(() => {
          app.relaunch();
          app.exit(0);
        });
      }
    });
  }
});
Effect.runFork(main);
