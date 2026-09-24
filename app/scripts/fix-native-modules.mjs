import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const roots = [path.join(repo, "node_modules"), path.join(repo, "app", "node_modules")];

const GRADLE_PROPS = ["canBePublished", "namespace", "ndkVersion", "ndkPath", "buildConfig", "prefab", "compose", "ignoreAssetsPattern"];
const PROP_CALL = new RegExp(`^([ \\t]*)(${GRADLE_PROPS.join("|")})[ \\t]+(?![=({ \\t])([^\\r\\n]+)`, "gm");
const MAP_DEPENDENCY = /^([ \t]*)(\w+)[ \t]+group:[ \t]*(['"])([^'"]+)\3,[ \t]*name:[ \t]*\3([^'"]+)\3,[ \t]*version:[ \t]*\3([^'"]+)\3[ \t]*(?=\r?$)/gm;
const HAS_NAMESPACE = /^[ \t]*namespace\b/m;
const MANIFEST_PACKAGE = /(<manifest\b[^>]*?)\s+package="([^"]*)"/;

const MANIFEST_FIXES = {
  "expo-file-system": [[/(<provider)\s+tools:replace="android:authorities"(\s+android:name="\.FileSystemFileProvider")/, "$1$2"]],
  "expo-modules-core": [[/(android:name="com\.facebook\.soloader\.enabled"\s+android:value="true")\s+tools:replace="android:value"/, "$1"]],
};

const ZEROCONF_ABIS = 'abiFilters(*(findProperty("reactNativeArchitectures") ?: "armeabi-v7a,arm64-v8a,x86,x86_64").toString().split(","))';

function appendLine(text, line) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  return `${text.replace(/\s+$/, "")}${eol}${line}${eol}`;
}

const SOURCE_FIXES = {
  "react-native-zeroconf": [
    ["android/build.gradle", (s) => s.replace('abiFilters "armeabi-v7a", "arm64-v8a", "x86", "x86_64"', ZEROCONF_ABIS)],
    ["android/src/main/jni/Application.mk", (s) => (s.includes("APP_CFLAGS") ? s : appendLine(s, "APP_CFLAGS += -Wno-address-of-packed-member"))],
    ["android/src/main/jni/mdnsresponder/mDNSPosix/mDNSPosix.c", (s) => s.replace("char keyword[10];", "char keyword[11];")],
  ],
  "expo-modules-core": [
    ["android/src/main/cpp/fabric/ExpoComponentDescriptorFactory.cpp", (s) => s.replace("react::RawPropsParser(/*useRawPropsJsiValue=*/true)", "react::RawPropsParser()")],
  ],
};

function packagesIn(root) {
  if (!fs.existsSync(root)) return [];
  const names = [];
  for (const entry of fs.readdirSync(root)) {
    if (entry.startsWith(".")) continue;
    if (entry.startsWith("@")) {
      for (const sub of fs.readdirSync(path.join(root, entry))) names.push(`${entry}/${sub}`);
    } else {
      names.push(entry);
    }
  }
  return names;
}

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

function write(file, before, after) {
  if (before === null || after === before) return 0;
  const tmp = `${file}.tz-tmp`;
  fs.writeFileSync(tmp, after);
  fs.renameSync(tmp, file);
  return 1;
}

function fixGradle(gradle, manifest) {
  let out = gradle.replace(PROP_CALL, "$1$2 = $3").replace(MAP_DEPENDENCY, "$1$2 '$4:$5:$6'");
  const pkg = manifest?.match(MANIFEST_PACKAGE)?.[2];
  if (pkg && /com\.android\.library/.test(out) && !HAS_NAMESPACE.test(out)) {
    out = out.replace(/^(android[ \t]*\{[ \t]*(\r?\n))/m, `$1    namespace = '${pkg}'$2`);
  }
  return out;
}

function fixManifest(name, manifest, gradle) {
  let out = manifest;
  if (gradle !== null && HAS_NAMESPACE.test(gradle)) out = out.replace(MANIFEST_PACKAGE, "$1");
  for (const [pattern, replacement] of MANIFEST_FIXES[name] ?? []) out = out.replace(pattern, replacement);
  return out;
}

let changed = 0;
for (const root of roots) {
  for (const name of packagesIn(root)) {
    const android = path.join(root, name, "android");
    const gradleFile = path.join(android, "build.gradle");
    const manifestFile = path.join(android, "src", "main", "AndroidManifest.xml");
    const gradle = read(gradleFile);
    if (gradle === null) continue;
    const manifest = read(manifestFile);
    const nextGradle = fixGradle(gradle, manifest);
    changed += write(gradleFile, gradle, nextGradle);
    if (manifest !== null) changed += write(manifestFile, manifest, fixManifest(name, manifest, nextGradle));
  }
}
for (const root of roots) {
  for (const [name, fixes] of Object.entries(SOURCE_FIXES)) {
    for (const [rel, fix] of fixes) {
      const file = path.join(root, name, rel);
      const text = read(file);
      if (text !== null) changed += write(file, text, fix(text));
    }
  }
}
console.log(`fix-native-modules: ${changed} file(s) updated`);
