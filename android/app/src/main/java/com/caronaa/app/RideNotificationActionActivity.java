package com.caronaa.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.JSObject;

/** Private, immutable notification PendingIntent target. No externally supplied
 * extras on the exported MainActivity can initiate acceptance. No JWT persisted. */
public class RideNotificationActionActivity extends Activity {
    private static JSObject pending;
    static synchronized JSObject consume() {
        JSObject result = pending;
        pending = null;
        return result == null ? new JSObject() : result;
    }
    private static synchronized void remember(String ride, String owner, long expiry, String action) {
        JSObject value = new JSObject();
        value.put("rideId", ride); value.put("ownerHash", owner);
        value.put("expiresAtMs", expiry); value.put("action", action);
        pending = value;
    }
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        Intent input = getIntent();
        String ride = input.getStringExtra("rideId"), owner = input.getStringExtra("ownerHash");
        String action = input.getStringExtra("action");
        long expiry = input.getLongExtra("expiresAtMs", 0);
        if (RideMessagingService.validRide(ride) && RideMessagingService.validOwner(owner)
                && RideMessagingService.validExpiry(expiry) && ("accept".equals(action) || "open".equals(action))) {
            remember(ride, owner, expiry, action);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.cancel(RideMessagingService.PREFIX + ride, 0);
            startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP));
        }
        finish();
    }
}
