package com.caronaa.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;

/**
 * Driver-consented location FGS. Never starts from boot, receives a short-lived
 * user JWT in process memory only, and never stores a location history.
 * The existing WebView publishes while visible; the native service publishes
 * while the activity is paused, even if JavaScript is suspended.
 */
public final class CaronaaLocationService extends Service {
    private static final String CHANNEL = "caronaa_driver_location";
    private static final int NOTIFICATION_ID = 7097;
    private static final long INTERVAL_MS = 30_000L;
    private static final String ENDPOINT = "https://caronaa.com/api/native/driver-location";
    private static volatile boolean uiForeground = false;
    private static volatile Credentials credentials;
    private static volatile CaronaaLocationService instance;
    private static volatile String currentState = "STOPPED";
    private static final class Credentials {
        final String owner;
        final String accessToken;
        final long expiresAtMs;
        final long generation;
        Credentials(String owner, String accessToken, long expiresAtMs, long generation) {
            this.owner = owner; this.accessToken = accessToken;
            this.expiresAtMs = expiresAtMs; this.generation = generation;
        }
    }
    private static long generation = 0L;
    private final ExecutorService sender = Executors.newSingleThreadExecutor();
    private final AtomicBoolean sending = new AtomicBoolean(false);
    private volatile HttpsURLConnection connection;
    private volatile long lastAttempt = -INTERVAL_MS;
    private FusedLocationProviderClient fused;
    private LocationCallback callback;
    private long myGeneration = -1L;
    private boolean foregroundStarted;

    public static boolean isUiForeground() { return uiForeground; }
    public static void setUiForeground(boolean foreground) { uiForeground = foreground; }
    public static boolean isConfigured() { return credentials != null; }
    public static String status() { return currentState; }

    static boolean validSession(String owner, String token, long expiry) {
        return owner.matches("[0-9a-fA-F-]{36}") && token.length() <= 8192 &&
            token.matches("[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+") &&
            expiry > System.currentTimeMillis() + 5_000L;
    }
    static synchronized void configure(String owner, String token, long expiry) {
        Credentials previous = credentials;
        if (previous != null && previous.owner.equals(owner)) {
            credentials = new Credentials(owner, token, expiry, previous.generation);
        } else {
            credentials = new Credentials(owner, token, expiry, ++generation);
        }
        currentState = "START_REQUESTED";
    }
    static synchronized boolean updateSession(String owner, String token, long expiry) {
        Credentials previous = credentials;
        if (previous == null || !previous.owner.equals(owner) || !validSession(owner, token, expiry)) return false;
        credentials = new Credentials(owner, token, expiry, previous.generation);
        if ("SESSION_EXPIRED".equals(currentState)) currentState = "TRACKING";
        return true;
    }
    static void revoke(Context context) {
        synchronized (CaronaaLocationService.class) {
            credentials = null; generation++; currentState = "STOPPED";
        }
        CaronaaLocationService active = instance;
        if (active != null) active.disconnect();
        context.stopService(new Intent(context, CaronaaLocationService.class));
    }
    private void disconnect() {
        HttpsURLConnection c = connection;
        if (c != null) c.disconnect();
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public void onCreate() {
        super.onCreate();
        instance = this;
        createChannel();
        fused = LocationServices.getFusedLocationProviderClient(this);
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        Credentials session = credentials;
        if (session == null || !hasPrecisePermission()) {
            stopSelf(); return START_NOT_STICKY;
        }
        myGeneration = session.generation;
        try {
            Notification notification = notification("Você está disponível para corridas Flash.");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else startForeground(NOTIFICATION_ID, notification);
            foregroundStarted = true;
            currentState = "TRACKING";
            if (callback == null) beginLocations();
        } catch (Exception ignored) {
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private boolean hasPrecisePermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED;
    }
    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Disponibilidade do motorista", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Localização compartilhada durante a disponibilidade Flash");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        manager.createNotificationChannel(channel);
    }
    private Notification notification(String body) {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(this, 7097, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_caronaa)
            .setContentTitle("CARONAA Motorista")
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pending).addAction(R.drawable.ic_stat_caronaa, "Abrir CARONAA", pending)
            .setOngoing(true).setOnlyAlertOnce(true).setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setCategory(NotificationCompat.CATEGORY_SERVICE).build();
    }
    private void changeStatus(String state, String body, long expectedGeneration) {
        Credentials s = credentials;
        if (s == null || s.generation != expectedGeneration || instance != this) return;
        if (state.equals(currentState)) return;
        currentState = state;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null && foregroundStarted) {
            try { manager.notify(NOTIFICATION_ID, notification(body)); } catch (Exception ignored) {}
        }
    }
    @SuppressWarnings("MissingPermission")
    private void beginLocations() {
        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000L)
            .setMinUpdateIntervalMillis(5_000L).setMaxUpdateAgeMillis(5_000L).build();
        callback = new LocationCallback() {
            @Override public void onLocationResult(LocationResult result) {
                Location fix = result.getLastLocation();
                if (fix != null) publishIfNeeded(fix);
            }
        };
        fused.requestLocationUpdates(request, callback, Looper.getMainLooper())
            .addOnFailureListener(ignored -> stopSelf());
    }

    private boolean sameGeneration(long expected) {
        Credentials s = credentials;
        return s != null && s.generation == expected && instance == this && !uiForeground;
    }
    @SuppressWarnings("deprecation")
    private void publishIfNeeded(Location fix) {
        Credentials session = credentials;
        if (session == null || session.generation != myGeneration || !hasPrecisePermission()) {
            stopSelf(); return;
        }
        // WebView owns foreground publication; FGS owns paused/background publication.
        if (uiForeground) return;
        if (session.expiresAtMs <= System.currentTimeMillis() + 5_000L) {
            changeStatus("SESSION_EXPIRED", "Abra o CARONAA para renovar sua sessão e continuar disponível.", session.generation);
            return;
        }
        if ((Build.VERSION.SDK_INT >= 31 ? fix.isMock() : fix.isFromMockProvider()) ||
            !fix.hasAccuracy() || !Float.isFinite(fix.getAccuracy()) ||
            fix.getAccuracy() <= 0 || fix.getAccuracy() > 150 ||
            !Double.isFinite(fix.getLatitude()) || !Double.isFinite(fix.getLongitude()) ||
            Math.abs(fix.getLatitude()) > 90 || Math.abs(fix.getLongitude()) > 180) return;
        long age = System.currentTimeMillis() - fix.getTime();
        if (age < -5_000L || age > 25_000L) return;
        long elapsed = SystemClock.elapsedRealtime();
        if (elapsed - lastAttempt < INTERVAL_MS || !sending.compareAndSet(false, true)) return;
        lastAttempt = elapsed;
        final Location snapshot = new Location(fix);
        final long expected = session.generation;
        try {
            sender.execute(() -> {
                try { send(snapshot, expected); }
                catch (Exception ignored) {
                    changeStatus("RECONNECTING", "GPS ativo. Reconectando ao CARONAA.", expected);
                } finally { sending.set(false); }
            });
        } catch (Exception ignored) { sending.set(false); }
    }

    private void send(Location fix, long expected) throws Exception {
        Credentials session = credentials;
        if (!sameGeneration(expected) || session == null ||
            session.expiresAtMs <= System.currentTimeMillis() + 5_000L ||
            System.currentTimeMillis() - fix.getTime() > 25_000L) return;
        JSONObject body = new JSONObject();
        body.put("lat", fix.getLatitude()); body.put("lng", fix.getLongitude());
        body.put("accuracyM", fix.getAccuracy()); body.put("sampledAtMs", fix.getTime());
        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
        HttpsURLConnection conn = (HttpsURLConnection) new URL(ENDPOINT).openConnection();
        connection = conn;
        try {
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(10_000); conn.setReadTimeout(15_000);
            conn.setRequestMethod("POST"); conn.setDoOutput(true);
            conn.setRequestProperty("Authorization", "Bearer " + session.accessToken);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setFixedLengthStreamingMode(bytes.length);
            if (!sameGeneration(expected)) return;
            try (java.io.OutputStream stream = conn.getOutputStream()) { stream.write(bytes); }
            int status = conn.getResponseCode();
            if (!sameGeneration(expected)) return;
            if (status == 401) {
                // A refreshed JWT may have arrived during this request.
                if (credentials == session)
                    changeStatus("SESSION_EXPIRED", "Abra o CARONAA para renovar sua sessão.", expected);
            } else if (status == 403 || status == 409) {
                // Authorization/role/availability revoked on server. Do not re-enable.
                synchronized (CaronaaLocationService.class) {
                    if (credentials != null && credentials.generation == expected) {
                        credentials = null; generation++; currentState = "STOPPED";
                    }
                }
                stopSelf();
            } else if (status == 200) {
                changeStatus("TRACKING", "Você está disponível para corridas Flash.", expected);
            } else if (status == 202) {
                changeStatus("GPS_PENDING", "GPS ativo. Aguardando localização verificada.", expected);
            } else {
                changeStatus("RECONNECTING", "GPS ativo. Reconectando ao CARONAA.", expected);
            }
            // No response body, token, GPS or raw provider errors are logged.
        } finally {
            conn.disconnect();
            if (connection == conn) connection = null;
        }
    }

    @Override public void onTaskRemoved(Intent rootIntent) {
        revoke(this);
        super.onTaskRemoved(rootIntent);
    }
    @Override public void onDestroy() {
        if (fused != null && callback != null) fused.removeLocationUpdates(callback);
        callback = null;
        disconnect(); sender.shutdownNow();
        synchronized (CaronaaLocationService.class) {
            if (credentials != null && credentials.generation == myGeneration) credentials = null;
            if (instance == this) { instance = null; currentState = "STOPPED"; }
        }
        if (foregroundStarted) stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }
}
