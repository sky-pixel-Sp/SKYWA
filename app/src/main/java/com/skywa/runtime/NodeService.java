package com.skywa.runtime;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import com.skywa.BuildConfig;
import com.skywa.ui.MainActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public final class NodeService extends Service {
    private static final String TAG = "SKYWA-NodeService";
    private static final String CHANNEL_ID = "skywa_embedded_runtime";
    private static final int NOTIFICATION_ID = 4201;

    private static volatile boolean runtimeStartedInProcess = false;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForegroundCompat(buildNotification("Menyiapkan runtime lokal…"));
        acquireWakeLock();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!runtimeStartedInProcess) {
            runtimeStartedInProcess = true;
            Thread runtimeThread = new Thread(this::startEmbeddedNode, "skywa-node-runtime");
            runtimeThread.setDaemon(false);
            runtimeThread.start();
        }
        return START_STICKY;
    }

    private void startEmbeddedNode() {
        try {
            File runtimeRoot = new File(getNoBackupFilesDir(), "skywa-runtime");
            File cacheRoot = new File(getCacheDir(), "skywa-node");
            File tempRoot = new File(cacheRoot, "tmp");
            File compileCache = new File(cacheRoot, "compile-cache");
            if (!cacheRoot.exists() && !cacheRoot.mkdirs()) {
                throw new IOException("Tidak dapat membuat folder cache runtime");
            }
            if (!tempRoot.exists() && !tempRoot.mkdirs()) {
                throw new IOException("Tidak dapat membuat folder sementara runtime");
            }
            if (!compileCache.exists() && !compileCache.mkdirs()) {
                throw new IOException("Tidak dapat membuat folder compile cache");
            }

            prepareRuntimeBundle(runtimeRoot);
            updateNotification("Runtime Node.js tertanam aktif • menunggu server");

            String entryPoint = new File(runtimeRoot, "apps/server/src/runner/server.js").getAbsolutePath();
            Log.i(TAG, "Starting embedded Node.js from app-private storage");
            int result = NodeRuntime.startNodeWithArguments(
                    new String[]{"node", "--max-old-space-size-percentage=15", entryPoint},
                    runtimeRoot.getAbsolutePath(),
                    tempRoot.getAbsolutePath(),
                    compileCache.getAbsolutePath());
            Log.e(TAG, "Embedded Node.js exited with code " + result);
            updateNotification("Runtime berhenti (kode " + result + ") • buka ulang SKYWA");
        } catch (Throwable error) {
            Log.e(TAG, "Embedded Node.js could not start", error);
            updateNotification("Runtime gagal mulai • periksa log diagnostik");
        }
    }

    private void prepareRuntimeBundle(File runtimeRoot) throws IOException {
        File versionFile = new File(runtimeRoot, ".skywa-assets-version");
        String wantedVersion = Integer.toString(BuildConfig.VERSION_CODE);
        File entryPoint = new File(runtimeRoot, "apps/server/src/runner/server.js");
        if (entryPoint.isFile() && versionFile.isFile()
                && wantedVersion.equals(readText(versionFile).trim())) {
            return;
        }

        File parent = runtimeRoot.getParentFile();
        if (parent == null) {
            throw new IOException("Lokasi runtime tidak valid");
        }
        File stagingRoot = new File(parent, "skywa-runtime-staging");
        deleteRecursively(stagingRoot);
        if (!stagingRoot.mkdirs()) {
            throw new IOException("Tidak dapat menyiapkan folder runtime");
        }

        copyAssetTree("nodejs-project", stagingRoot);

        // Preserve WhatsApp credentials and user configuration across APK updates.
        File existingData = new File(runtimeRoot, "data");
        File stagedData = new File(stagingRoot, "data");
        if (existingData.isDirectory() && !stagedData.exists()
                && !existingData.renameTo(stagedData)) {
            copyDirectory(existingData, stagedData);
        }

        try (FileOutputStream output = new FileOutputStream(new File(stagingRoot, ".skywa-assets-version"))) {
            output.write(wantedVersion.getBytes(StandardCharsets.UTF_8));
            output.flush();
        }

        deleteRecursively(runtimeRoot);
        if (!stagingRoot.renameTo(runtimeRoot)) {
            copyDirectory(stagingRoot, runtimeRoot);
            deleteRecursively(stagingRoot);
        }
        if (!entryPoint.isFile()) {
            throw new IOException("Bundle backend SKYWA tidak ditemukan setelah ekstraksi");
        }
    }

    private void copyAssetTree(String assetPath, File destination) throws IOException {
        String[] children = getAssets().list(assetPath);
        if (children != null && children.length > 0) {
            if (!destination.exists() && !destination.mkdirs()) {
                throw new IOException("Tidak dapat membuat direktori " + destination.getName());
            }
            for (String child : children) {
                copyAssetTree(assetPath + "/" + child, new File(destination, child));
            }
            return;
        }

        try (InputStream input = getAssets().open(assetPath)) {
            File parent = destination.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                throw new IOException("Tidak dapat membuat direktori " + parent.getName());
            }
            try (FileOutputStream output = new FileOutputStream(destination)) {
                byte[] buffer = new byte[32 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    output.write(buffer, 0, count);
                }
            }
        } catch (IOException error) {
            if (children == null || children.length == 0) {
                throw new IOException("Gagal menyalin aset " + assetPath, error);
            }
            throw error;
        }
    }

    private void copyDirectory(File source, File destination) throws IOException {
        if (source.isDirectory()) {
            if (!destination.exists() && !destination.mkdirs()) {
                throw new IOException("Tidak dapat membuat direktori " + destination.getName());
            }
            File[] children = source.listFiles();
            if (children == null) {
                throw new IOException("Tidak dapat membaca direktori " + source.getName());
            }
            for (File child : children) {
                copyDirectory(child, new File(destination, child.getName()));
            }
        } else {
            File parent = destination.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                throw new IOException("Tidak dapat membuat direktori " + parent.getName());
            }
            try (InputStream input = new java.io.FileInputStream(source);
                 FileOutputStream output = new FileOutputStream(destination)) {
                byte[] buffer = new byte[32 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    output.write(buffer, 0, count);
                }
            }
        }
    }

    private String readText(File file) throws IOException {
        byte[] bytes = new byte[(int) file.length()];
        try (InputStream input = new java.io.FileInputStream(file)) {
            int offset = 0;
            while (offset < bytes.length) {
                int count = input.read(bytes, offset, bytes.length - offset);
                if (count < 0) break;
                offset += count;
            }
        }
        return new String(bytes, StandardCharsets.UTF_8);
    }

    private void deleteRecursively(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) deleteRecursively(child);
            }
        }
        if (file.exists() && !file.delete()) {
            Log.w(TAG, "Could not delete " + file.getAbsolutePath());
        }
    }

    private void acquireWakeLock() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SKYWA::EmbeddedNode");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire();
            }
        } catch (RuntimeException error) {
            Log.w(TAG, "Could not acquire partial wake lock", error);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "SKYWA Runtime", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Menampilkan status runtime lokal SKYWA");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification(String text) {
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 4202, openApp, pendingFlags);

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        return builder.setSmallIcon(android.R.drawable.stat_notify_sync_noanim)
                .setContentTitle("SKYWA berjalan")
                .setContentText(text)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build();
    }

    private void startForegroundCompat(Notification notification) {
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void updateNotification(String text) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification(text));
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (RuntimeException error) {
                Log.w(TAG, "Could not release wake lock", error);
            }
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
