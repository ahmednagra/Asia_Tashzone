const { withAppBuildGradle, withGradleProperties, withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Signs release builds with the project's own keystore instead of the Android debug key.
 *
 * Why a config plugin rather than an edit to `android/app/build.gradle`: that file is *generated*. Expo
 * regenerates it on every `expo prebuild`, and `--clean` deletes the whole `android/` directory, so a
 * hand-edited signing block disappears without warning — and the next release quietly goes out signed with
 * the public debug key again. A plugin is re-applied every time the directory is generated, so the property
 * holds instead of needing to be remembered.
 *
 * The credentials live in `app/credentials/`, which is outside `android/` precisely because `android/` is
 * disposable, and is gitignored. If that directory is absent — a fresh clone, or CI — this plugin leaves the
 * debug signing in place and the build still works. It is never a build failure, because a missing keystore
 * should stop you *shipping*, not stop you compiling.
 *
 * What debug signing costs, and why this exists: the debug key is `android`/`androiddebugkey`, public in every
 * Android SDK, so anyone can sign an "update" to an app that carries it. Worse for this project, the signature
 * has to match for an in-place upgrade, so a tester who installed a debug-signed build must uninstall before a
 * properly signed one — and TashZone keeps XP, levels, unlocked table designs, stats, saved games and the
 * Parent PIN on the phone only (L38). Uninstalling loses all of it, with no cloud save in v1.0 to restore from.
 *
 * The keystore is irreplaceable. Losing it means no existing install can ever be updated again; the only
 * recovery is a new package name and everyone reinstalling. See `Docs/05_DEPLOYMENT_RUNBOOK.md` Part J.
 */

const LOADER = `
// Release signing, injected by app/plugins/with-release-signing.js. Credentials come from
// app/credentials/keystore.properties, which is gitignored; without it the build falls back to debug signing.
def tzKeystoreProps = new Properties()
def tzKeystoreFile = rootProject.file('../credentials/keystore.properties')
if (tzKeystoreFile.exists()) { tzKeystoreFile.withInputStream { tzKeystoreProps.load(it) } }
def tzSigned = tzKeystoreProps.containsKey('TASHZONE_UPLOAD_STORE_FILE')
`;

const SIGNING_CONFIG = `
        if (tzSigned) {
            release {
                storeFile file("../../credentials/" + tzKeystoreProps['TASHZONE_UPLOAD_STORE_FILE'])
                storePassword tzKeystoreProps['TASHZONE_UPLOAD_STORE_PASSWORD']
                keyAlias tzKeystoreProps['TASHZONE_UPLOAD_KEY_ALIAS']
                keyPassword tzKeystoreProps['TASHZONE_UPLOAD_KEY_PASSWORD']
            }
        }
`;

/**
 * The edit itself, as a pure function so it can be applied to an already-generated `build.gradle` as well as
 * through prebuild. Idempotent: applying it twice is a no-op.
 */
function addReleaseSigning(gradle) {
    if (gradle.includes('tzKeystoreProps')) return gradle; // already applied

    // 1. Load the properties before the `android { }` block, so both uses below can see them.
    const androidBlock = gradle.indexOf('android {');
    if (androidBlock === -1) throw new Error('with-release-signing: could not find the android block in build.gradle');
    gradle = gradle.slice(0, androidBlock) + LOADER.trim() + '\n\n' + gradle.slice(androidBlock);

    // 2. Add a `release` signing config beside the generated `debug` one.
    const debugSigning = gradle.indexOf("        debug {\n            storeFile file('debug.keystore')");
    if (debugSigning === -1) throw new Error('with-release-signing: could not find the debug signingConfig');
    const afterDebug = gradle.indexOf('        }\n', gradle.indexOf('keyPassword', debugSigning)) + '        }\n'.length;
    gradle = gradle.slice(0, afterDebug) + SIGNING_CONFIG + gradle.slice(afterDebug);

    // 3. Point the release build type at it, falling back to debug when there is no keystore.
    const before = 'signingConfig signingConfigs.debug\n            def enableShrinkResources';
    const after = 'signingConfig tzSigned ? signingConfigs.release : signingConfigs.debug\n            def enableShrinkResources';
    if (!gradle.includes(before)) throw new Error('with-release-signing: could not find the release buildType signingConfig');
    gradle = gradle.replace(before, after);

    return gradle;
}


/**
 * Gradle 9 deprecates the Groovy DSL's "space" assignment (`compileSdk 36`) in favour of `compileSdk = 36`, and the
 * warning becomes an error in Gradle 10. Expo's generated android/ template still uses the old form, and android/ is
 * regenerated (and gitignored), so editing it by hand does not last. This rewrites the template's property lines here,
 * where every prebuild re-applies it. Only names that are plain assignable properties are touched; method calls such
 * as proguardFiles(...) and buildConfigField(...) are left alone. Idempotent: `name = value` lines do not match.
 */
const ASSIGNABLE = [
  'ndkVersion', 'buildToolsVersion', 'compileSdk', 'namespace', 'applicationId', 'versionCode', 'versionName',
  'shrinkResources', 'minifyEnabled', 'crunchPngs', 'useLegacyPackaging', 'ignoreAssetsPattern', 'signingConfig',
  'storeFile', 'storePassword', 'keyAlias', 'keyPassword',
];
const RENAMED = { minSdkVersion: 'minSdk', targetSdkVersion: 'targetSdk' };

function useAssignmentSyntax(gradle) {
  const names = [...ASSIGNABLE, ...Object.keys(RENAMED)].join('|');
  const line = new RegExp('^([ \\t]*)(' + names + ')[ \\t]+(?![=(])(\\S.*)$', 'gm');
  return gradle.replace(line, (whole, indent, name, value) => `${indent}${RENAMED[name] ?? name} = ${value}`);
}

/** `maven { url 'x' }` is the same deprecated form; the assignment needs uri(). */
function useUriAssignment(gradle) {
  return gradle.replace(/^(\s*)url[ \t]+(?![=(])(['"][^'"]+['"])[ \t]*$/gm, (whole, indent, value) => `${indent}url = uri(${value})`)
    .replace(/(\{\s*)url[ \t]+(?![=(])(['"][^'"]+['"])(\s*\})/g, (whole, open, value, close) => `${open}url = uri(${value})${close}`);
}

const PHONE_ABIS = ['armeabi-v7a', 'arm64-v8a'];

const ABI_BLOCK = `
        ndk {
            abiFilters(*((findProperty('reactNativeArchitectures') ?: '${PHONE_ABIS.join(',')}').toString().split(',')))
        }
`;

function addPhoneAbis(gradle) {
  if (gradle.includes('abiFilters')) return gradle;
  const defaultConfig = gradle.match(/defaultConfig\s*\{/);
  if (!defaultConfig) throw new Error('with-release-signing: could not find the defaultConfig block in build.gradle');
  return gradle.replace(defaultConfig[0], `${defaultConfig[0]}
${ABI_BLOCK}`);
}

module.exports = function withReleaseSigning(config) {
  const withGradle = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = useAssignmentSyntax(addPhoneAbis(addReleaseSigning(cfg.modResults.contents)));
    return cfg;
  });
  const withRoot = withProjectBuildGradle(withGradle, (cfg) => {
    cfg.modResults.contents = useUriAssignment(cfg.modResults.contents);
    return cfg;
  });

  return withGradleProperties(withRoot, (cfg) => {
    const key = 'reactNativeArchitectures';
    const existing = cfg.modResults.find((item) => item.type === 'property' && item.key === key);
    if (existing) existing.value = PHONE_ABIS.join(',');
    else cfg.modResults.push({ type: 'property', key, value: PHONE_ABIS.join(',') });
    return cfg;
  });
};

module.exports.addReleaseSigning = addReleaseSigning;
module.exports.addPhoneAbis = addPhoneAbis;
module.exports.useAssignmentSyntax = useAssignmentSyntax;
module.exports.useUriAssignment = useUriAssignment;
module.exports.PHONE_ABIS = PHONE_ABIS;
