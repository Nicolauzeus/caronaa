package com.caronaa.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Dismiss ONLY this alert; does not cancel the passenger request or call any RPC. */
public class RideNotificationDismissReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String ride = intent.getStringExtra("rideId");
        if (!RideMessagingService.validRide(ride)) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.cancel(RideMessagingService.PREFIX + ride, 0);
    }
}
