package com.caronaa.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Native bridge for the trusted CARONAA WebView. */
@CapacitorPlugin(name = "CaronaaNative", permissions = {
    @Permission(alias = "trackingLocation", strings = {
        Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION
    })
})
public class CaronaaNativePlugin extends Plugin {
    @PluginMethod
    public void firebaseStatus(PluginCall call) {
        // google_app_id is generated only when a real google-services.json is built in.
        int id = getContext().getResources().getIdentifier("google_app_id", "string", getContext().getPackageName());
        JSObject result = new JSObject();
        result.put("configured", id != 0);
        // Stable candidate: retain notification payload delivery until data-only is device-validated.
        result.put("rideActions", false);
        call.resolve(result);
    }

    private boolean trustedOrigin() {
        try {
            Uri uri = Uri.parse(getBridge().getWebView().getUrl());
            return "https".equals(uri.getScheme()) && "caronaa.com".equals(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (Exception e) { return false; }
    }

    @PluginMethod
    public void consumeRideNotificationAction(PluginCall call) {
        if (!trustedOrigin()) { call.reject("ORIGIN_DENIED"); return; }
        call.resolve(RideNotificationActionActivity.consume());
    }

    private boolean precisePermission() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    }

    private void result(PluginCall call, boolean running, String state) {
        JSObject data = new JSObject();
        data.put("running", running);
        data.put("state", state);
        call.resolve(data);
    }

    @PluginMethod
    public void startForegroundTracking(PluginCall call) {
        if (!trustedOrigin() || !CaronaaLocationService.isUiForeground()) {
            result(call, false, "FOREGROUND_REQUIRED"); return;
        }
        if (!precisePermission()) {
            if (Boolean.TRUE.equals(call.getBoolean("requestPermission", false))) {
                requestPermissionForAlias("trackingLocation", call, "trackingPermissionResult");
            } else result(call, false, "PERMISSION_REQUIRED");
            return;
        }
        startTrackingGranted(call);
    }

    @PermissionCallback
    private void trackingPermissionResult(PluginCall call) {
        if (!precisePermission()) { result(call, false, "PRECISE_PERMISSION_REQUIRED"); return; }
        startTrackingGranted(call);
    }

    private void startTrackingGranted(PluginCall call) {
        if (!trustedOrigin() || !CaronaaLocationService.isUiForeground()) {
            result(call, false, "FOREGROUND_REQUIRED"); return;
        }
        String owner = call.getString("owner");
        String access = call.getString("accessToken");
        Long expiry = call.getLong("expiresAtMs");
        if (owner == null || access == null || expiry == null ||
            !CaronaaLocationService.validSession(owner, access, expiry)) {
            result(call, false, "SESSION_REQUIRED"); return;
        }
        try {
            CaronaaLocationService.configure(owner, access, expiry);
            ContextCompat.startForegroundService(getContext(), new Intent(getContext(), CaronaaLocationService.class));
            result(call, true, "START_REQUESTED");
        } catch (Exception ignored) {
            CaronaaLocationService.revoke(getContext());
            result(call, false, "START_FAILED");
        }
    }

    @PluginMethod
    public void updateForegroundTrackingSession(PluginCall call) {
        if (!trustedOrigin()) { result(call, false, "ORIGIN_DENIED"); return; }
        String owner = call.getString("owner");
        String access = call.getString("accessToken");
        Long expiry = call.getLong("expiresAtMs");
        boolean updated = owner != null && access != null && expiry != null &&
            CaronaaLocationService.updateSession(owner, access, expiry);
        result(call, updated, updated ? "SESSION_UPDATED" : "NOT_RUNNING");
    }

    @PluginMethod
    public void foregroundTrackingStatus(PluginCall call) {
        if (!trustedOrigin()) { result(call, false, "ORIGIN_DENIED"); return; }
        result(call, CaronaaLocationService.isConfigured(), CaronaaLocationService.status());
    }

    @PluginMethod
    public void stopForegroundTracking(PluginCall call) {
        // Stopping is safe even after the authenticated session has been lost.
        CaronaaLocationService.revoke(getContext());
        result(call, false, "STOPPED");
    }


    /** Read only: Android settings, never a location sample or a tracking request. */
    private JSObject permissionSnapshot() {
        JSObject data = new JSObject();
        data.put("preciseLocation", precisePermission());
        data.put("approximateLocation", ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED);
        android.location.LocationManager location = (android.location.LocationManager)
            getContext().getSystemService(android.content.Context.LOCATION_SERVICE);
        data.put("gpsEnabled", location != null && androidx.core.location.LocationManagerCompat.isLocationEnabled(location));
        data.put("notifications", androidx.core.app.NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        android.app.NotificationManager manager = getContext().getSystemService(android.app.NotificationManager.class);
        if (android.os.Build.VERSION.SDK_INT >= 26 && manager != null) {
            android.app.NotificationChannel channel = manager.getNotificationChannel(RideAlertChannel.ID);
            data.put("rideChannel", channel != null && channel.getImportance() >= android.app.NotificationManager.IMPORTANCE_HIGH
                && channel.getSound() != null && channel.shouldVibrate());
        }
        android.os.PowerManager power = (android.os.PowerManager)
            getContext().getSystemService(android.content.Context.POWER_SERVICE);
        if (power != null) data.put("batteryExempt", power.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        return data;
    }

    @PluginMethod
    public void permissionSetupStatus(PluginCall call) {
        if (!trustedOrigin()) { call.reject("ORIGIN_DENIED"); return; }
        call.resolve(permissionSnapshot());
    }

    @PluginMethod
    public void requestSetupLocation(PluginCall call) {
        if (!trustedOrigin() || !CaronaaLocationService.isUiForeground()) {
            call.reject("FOREGROUND_REQUIRED"); return;
        }
        if (precisePermission()) { call.resolve(permissionSnapshot()); return; }
        requestPermissionForAlias("trackingLocation", call, "setupLocationResult");
    }

    @PermissionCallback
    private void setupLocationResult(PluginCall call) {
        if (!trustedOrigin()) { call.reject("ORIGIN_DENIED"); return; }
        call.resolve(permissionSnapshot());
    }

    /** Settings only, fixed destinations, explicit user action. No settings are changed silently. */
    @PluginMethod
    public void openPermissionSetupSettings(PluginCall call) {
        if (!trustedOrigin()) { call.reject("ORIGIN_DENIED"); return; }
        String target = call.getString("target", "app");
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:" + getContext().getPackageName()));
        if ("gps".equals(target)) intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        else if ("network".equals(target)) intent = new Intent(Settings.ACTION_WIRELESS_SETTINGS);
        else if ("battery".equals(target)) intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        else if ("notifications".equals(target) && android.os.Build.VERSION.SDK_INT >= 26) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        } else if ("channel".equals(target) && android.os.Build.VERSION.SDK_INT >= 26) {
            intent = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName())
                .putExtra(Settings.EXTRA_CHANNEL_ID, RideAlertChannel.ID);
        }
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            try {
                getContext().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getContext().getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                call.resolve();
            } catch (Exception ignored) { call.reject("SETTINGS_UNAVAILABLE"); }
        }
    }

    /** Opens this app's system settings page (battery, notifications) on explicit user tap. */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }
}
