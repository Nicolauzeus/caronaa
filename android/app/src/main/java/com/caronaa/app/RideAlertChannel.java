package com.caronaa.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.Context;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

/** Creates the ride-alert channel once; never deletes or overrides user choices. */
final class RideAlertChannel {
    static final String ID = "corridas_urgentes";

    private RideAlertChannel() {}

    static void ensure(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return; // pre-26 uses per-notification priority
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(ID) != null) return;
        NotificationChannel channel = new NotificationChannel(ID, "Corridas urgentes", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Novos pedidos de corrida perto de você");
        channel.enableLights(true);
        channel.setLightColor(Color.parseColor("#FFBB00"));
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] { 0, 500, 250, 500 });
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
        Uri sound = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.getPackageName() + "/" + R.raw.caronaa_ride_alert);
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        channel.setSound(sound, attributes);
        manager.createNotificationChannel(channel);
    }
}
