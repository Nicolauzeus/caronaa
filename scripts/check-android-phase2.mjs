import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
for (const [name, v] of [["@capacitor/push-notifications","6.0.5"],["@capacitor/local-notifications","6.1.3"],["@capacitor/app","6.0.3"]]) {
  assert.equal(pkg.dependencies[name], v, name);
  assert.match(read("package-lock.json"), new RegExp(`"node_modules/${name.replace("/", "\\/")}"`), name + " npm lock");
  assert.match(read("bun.lock"), new RegExp(`"${name.replace("/", "\\/")}@${v.replace(/\./g, "\\.")}"`), name + " bun lock");
}
assert.equal(pkg.dependencies["@capacitor/geolocation"], undefined, "geolocation is a later phase");
const manifest = read("android/app/src/main/AndroidManifest.xml");
assert.match(manifest, /default_notification_channel_id"\s+android:value="corridas_urgentes"/);
assert.match(manifest, /default_notification_icon"\s+android:resource="@drawable\/ic_stat_caronaa"/);
for (const bad of ["SYSTEM_ALERT_WINDOW", "USE_FULL_SCREEN_INTENT", "ACCESS_NOTIFICATION_POLICY"]) assert.doesNotMatch(manifest, new RegExp(bad));
const channel = read("android/app/src/main/java/com/caronaa/app/RideAlertChannel.java");
assert.match(channel, /"corridas_urgentes"/);
assert.match(channel, /new long\[\] \{ 0, 500, 250, 500 \}/);
assert.match(channel, /VISIBILITY_PRIVATE/);
assert.match(channel, /USAGE_NOTIFICATION/);
assert.match(channel, /getNotificationChannel\(ID\) != null\) return/);
assert.doesNotMatch(channel, /deleteNotificationChannel|setBypassDnd|FullScreen/);
const main = read("android/app/src/main/java/com/caronaa/app/MainActivity.java");
assert.match(main, /registerPlugin\(CaronaaNativePlugin\.class\);\s+super\.onCreate/);
assert.match(main, /RideAlertChannel\.ensure\(this\)/);
assert.ok(statSync(new URL("../android/app/src/main/res/raw/caronaa_ride_alert.wav", import.meta.url)).size < 200_000);
const config = read("capacitor.config.ts");
assert.doesNotMatch(config, /allowNavigation\s*:/);
assert.match(config, /cleartext: false/);
console.log("Android phase 2 static checks passed.");
