package com.caronaa.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/** Data-only messages for the new APK; existing Capacitor behavior remains for other messages. */
public class RideMessagingService extends MessagingService {
    static final String PREFIX = "caronaa-ride-";
    static boolean validRide(String id) {
        return id != null && id.matches("(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    }
    static boolean validOwner(String owner) {
        return owner != null && owner.matches("[0-9a-f]{64}");
    }
    static boolean validExpiry(long expiry) {
        long now = System.currentTimeMillis();
        return expiry > now && expiry <= now + 300000L;
    }
    private static String city(String value) {
        return value != null && value.matches("[\\p{L} ]{2,60}") ? value : "Consulte no app";
    }
    private static String money(String value) {
        return value != null && value.matches("[0-9]{1,10}\\.[0-9]{2}") ? "R$ " + value.replace('.', ',') : null;
    }
    private PendingIntent action(String id, String owner, long expiry, String kind) {
        Intent intent = new Intent(this, RideNotificationActionActivity.class)
            .setData(Uri.parse("caronaa-action://" + kind + "/" + id))
            .putExtra("rideId", id).putExtra("ownerHash", owner)
            .putExtra("expiresAtMs", expiry).putExtra("action", kind);
        return PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
    private PendingIntent dismiss(String id) {
        Intent intent = new Intent(this, RideNotificationDismissReceiver.class)
            .setData(Uri.parse("caronaa-action://dismiss/" + id)).putExtra("rideId", id);
        return PendingIntent.getBroadcast(this, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
    @Override public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> d = message.getData();
        if (!"flash_ride_action_v1".equals(d.get("kind"))) { super.onMessageReceived(message); return; }
        String id = d.get("rideId"), owner = d.get("ownerHash");
        long expiry;
        try { expiry = Long.parseLong(d.get("expiresAtMs")); } catch (Exception e) { return; }
        if (!validRide(id) || !validOwner(owner) || !validExpiry(expiry)) return;
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        String vehicle = d.get("vehicleType");
        if (!"MOTO".equals(vehicle) && !"CAR".equals(vehicle)) return;
        String kind = "MOTO".equals(vehicle) ? "Moto" : "Carro";
        String value = money(d.get("driverEarnings"));
        String price = value != null ? "Você recebe " + value : null;
        if (price == null) { value = money(d.get("estimatedFare")); price = value == null ? "Valor no aplicativo" : "Tarifa estimada " + value; }
        String origin = city(d.get("originCity")), destination = city(d.get("destinationCity"));
        String min = d.get("estimatedPickupMinutes");
        String eta = min != null && min.matches("[0-9]{1,3}") ? "\n~" + min + " min até o embarque" : "";
        String summary = "Origem: " + origin + "\nDestino: " + destination + eta;
        RideAlertChannel.ensure(this);
        Notification publicVersion = new NotificationCompat.Builder(this, RideAlertChannel.ID)
            .setSmallIcon(R.drawable.ic_stat_caronaa).setContentTitle("Nova corrida CARONAA")
            .setContentText("Desbloqueie para ver o pedido").build();
        NotificationCompat.Builder n = new NotificationCompat.Builder(this, RideAlertChannel.ID)
            .setSmallIcon(R.drawable.ic_stat_caronaa).setColor(Color.parseColor("#FFBB00"))
            .setContentTitle(kind + " · " + price).setContentText(origin + " → " + destination)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(summary))
            .setPriority(NotificationCompat.PRIORITY_MAX).setCategory(NotificationCompat.CATEGORY_EVENT)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setPublicVersion(publicVersion)
            .setAutoCancel(true).setTimeoutAfter(Math.max(1, expiry - System.currentTimeMillis()))
            .setContentIntent(action(id, owner, expiry, "open"))
            .addAction(0, "Dispensar", dismiss(id))
            .addAction(0, "Aceitar", action(id, owner, expiry, "accept"));
        if (Build.VERSION.SDK_INT < 26) {
            n.setSound(Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/" + R.raw.caronaa_ride_alert));
            n.setVibrate(new long[] {0,500,250,500});
        }
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            try { manager.notify(PREFIX + id, 0, n.build()); } catch (SecurityException ignored) { /* permission revoked */ }
        }
    }
}
