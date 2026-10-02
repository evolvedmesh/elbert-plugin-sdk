# Runtime packs: native programs on Android

Android runs only files that arrived inside an installed APK (SELinux W^X for apps targeting
API 29+). A plugin therefore cannot download an executable and run it. A plugin that needs native
programs ships them in a **runtime pack**: an ordinary companion APK whose native libraries Elbert
runs by absolute path out of the pack's `nativeLibraryDir`.

On desktop none of this applies: `process.run` and `process.start` run whatever the user has, such
as Docker or a binary the plugin downloaded.

## What a pack is

An APK, installed separately from Elbert, that:

1. declares an exported component with the intent action
   `com.evolvedmesh.elbert.action.RUNTIME_PACK`. Elbert's `<queries>` entry names the same action,
   which is what makes the package visible to Elbert on Android 11+;
2. carries its programs as `lib*.so` files under `lib/<abi>/`. That is the only kind of file
   Android extracts into `nativeLibraryDir`, so executables are simply **named** `lib<name>.so`;
3. is built with extracted native libraries and **unstripped**, so the bytes reach the device
   unchanged.

Minimal manifest:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application android:hasCode="true" android:extractNativeLibs="true">
    <activity android:name=".PackActivity" android:exported="true"
              android:theme="@android:style/Theme.NoDisplay">
      <intent-filter>
        <action android:name="com.evolvedmesh.elbert.action.RUNTIME_PACK" />
        <category android:name="android.intent.category.DEFAULT" />
      </intent-filter>
    </activity>
  </application>
</manifest>
```

(`PackActivity` is a one-line `Activity` that calls `finish()`.) In Gradle:

```kotlin
android {
    packaging {
        jniLibs {
            useLegacyPackaging = true          // extract at install, don't map from the APK
            keepDebugSymbols += "**/*.so"      // never let AGP's release strip rewrite them
        }
    }
}
```

AGP's release build runs `llvm-strip` over every `.so` it packages. That rewrote 88 of 106 files in
one real pack and broke a bundled `proot`, so keep the symbols.

## Using a pack from a plugin

List the pack's package name in the manifest:

```json
{
  "permissions": ["process"],
  "android": { "runtimePackages": ["com.example.myplugin.runtime"] }
}
```

Then resolve it and run its programs:

```ts
const pack = await elbert.native.runtime('com.example.myplugin.runtime');
if (!pack) throw new Error('Install the runtime pack first.');
if (!pack.extracted) throw new Error('The pack was built with compressed libraries.');

const exe = elbert.fs.join(pack.nativeLibraryDir, 'libtool.so');
const proc = await elbert.process.start(exe, ['--serve'], { env: { TOOL_HOME: (await elbert.fs.paths()).data } });
proc.onOutput((line) => console.log(line));
```

`native.runtime` returns `null` when the pack is not installed and on every non-Android platform.
`process` on Android may exec only files inside a pack directory resolved this way, and a plugin's
processes are killed when it stops.

Use `native.platform()` to branch between the desktop path and the Android path.

## Things that bite

- **Programs that need other files** (a loader, a rootfs) can't be extracted next to themselves: a
  runtime pack has no writable install directory. Pass writable locations (the plugin's `data` or
  `cache` folder) through environment variables or arguments.
- **A static Go or Rust binary has no resolver on Android.** One that does its own DNS reads
  `/etc/resolv.conf`, which Android does not have. Build against the NDK with cgo so name
  resolution goes through Android's own resolver.
- **Ports bound on loopback are reachable by every app on the phone.** Anything a pack starts that
  listens on `127.0.0.1` must authenticate its callers.
- **Not yet verified on a device:** that exec from another app's `nativeLibraryDir` is permitted on
  every current Android release. Test on the versions you support.
