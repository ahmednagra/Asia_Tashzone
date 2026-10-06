const { withAppBuildGradle, withGradleProperties, withProjectBuildGradle } = require('@expo/config-plugins');
const { PHONE_ABIS } = require('./with-release-signing');

const MARKER = 'ext.tashzoneQuietSubprojects = true';

const JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=1536m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

const ROOT_BLOCK = `
${MARKER}
subprojects { sub ->
    if (sub.name == 'app') return
    sub.tasks.withType(JavaCompile).configureEach {
        options.compilerArgs.addAll(['-Xlint:none', '-nowarn', '-XDsuppressNotes'])
        options.deprecation = false
        options.warnings = false
    }
    sub.tasks.matching { it.name.startsWith('compile') && it.name.endsWith('Kotlin') }.configureEach { t ->
        if (t.hasProperty('compilerOptions')) t.compilerOptions.suppressWarnings.set(true)
    }
    sub.plugins.withId('com.android.library') {
        sub.afterEvaluate {
            def cfg = sub.android.defaultConfig
            if (sub.android.externalNativeBuild.ndkBuild.path != null) {
                def abis = (rootProject.findProperty('reactNativeArchitectures') ?: '${PHONE_ABIS.join(',')}').toString().split(',').toList()
                cfg.ndk.abiFilters.clear()
                cfg.ndk.abiFilters.addAll(abis)
                cfg.externalNativeBuild.ndkBuild.abiFilters.clear()
                cfg.externalNativeBuild.ndkBuild.abiFilters.addAll(abis)
                cfg.externalNativeBuild.ndkBuild.cFlags.add('-w')
            }
            if (sub.android.externalNativeBuild.cmake.path != null) {
                cfg.externalNativeBuild.cmake.cFlags.add('-w')
                cfg.externalNativeBuild.cmake.cppFlags.add('-w')
            }
        }
    }
}
`;

function addQuietSubprojects(gradle) {
  if (gradle.includes(MARKER)) return gradle;
  return `${gradle.trimEnd()}\n${ROOT_BLOCK}`;
}

const LINT_BLOCK = `
    lint {
        checkReleaseBuilds = false
    }
`;

function skipReleaseLint(gradle) {
  if (gradle.includes('checkReleaseBuilds')) return gradle;
  const android = gradle.match(/\nandroid\s*\{\n/);
  if (!android) throw new Error('with-build-hygiene: could not find the android block in app/build.gradle');
  return gradle.replace(android[0], `${android[0]}${LINT_BLOCK}`);
}

function setProperty(items, key, value) {
  const existing = items.find((item) => item.type === 'property' && item.key === key);
  if (existing) existing.value = value;
  else items.push({ type: 'property', key, value });
}

module.exports = function withBuildHygiene(config) {
  const withApp = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = skipReleaseLint(cfg.modResults.contents);
    return cfg;
  });
  const withRoot = withProjectBuildGradle(withApp, (cfg) => {
    cfg.modResults.contents = addQuietSubprojects(cfg.modResults.contents);
    return cfg;
  });
  return withGradleProperties(withRoot, (cfg) => {
    setProperty(cfg.modResults, 'org.gradle.jvmargs', JVM_ARGS);
    setProperty(cfg.modResults, 'org.gradle.caching', 'true');
    setProperty(cfg.modResults, 'org.gradle.warning.mode', 'none');
    return cfg;
  });
};

module.exports.addQuietSubprojects = addQuietSubprojects;
module.exports.skipReleaseLint = skipReleaseLint;
module.exports.JVM_ARGS = JVM_ARGS;
