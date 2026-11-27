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
        call.resolve(result);
    }

    private boolean trustedOrigin() {
        try {
            Uri uri = Uri.parse(getBridge().getWebView().getUrl());
            return "https".equals(uri.getScheme()) && "caronaa.com".equals(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (Exception e) { return false; }
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

    /** Opens this app's system settings page (battery, notifications) on explicit user tap. */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }
}
