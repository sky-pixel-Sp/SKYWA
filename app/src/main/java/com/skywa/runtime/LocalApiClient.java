package com.skywa.runtime;

import android.content.Context;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Shared authenticated HTTP client for the native UI's loopback API calls. */
public final class LocalApiClient {
    private static final String API_BASE = "http://127.0.0.1:3000";
    private LocalApiClient() {}

    public static JSONObject request(Context context, String method, String path, JSONObject body) throws Exception {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(API_BASE + path).openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(4000);
            connection.setReadTimeout(30000);
            connection.setRequestProperty("Accept", "application/json");
            String token = ApiTokenStore.read(context);
            if (token != null && !token.isEmpty()) {
                connection.setRequestProperty("X-Skywa-Token", token);
            } else if (!"/api/health".equals(path)) {
                throw new IOException("Token keamanan API belum siap. Tunggu runtime selesai menyala, lalu periksa status lagi.");
            }
            if (body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
            }
            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 400 ? connection.getInputStream() : connection.getErrorStream();
            String raw = stream == null ? "" : readString(stream);
            JSONObject result;
            try {
                result = raw.isEmpty() ? new JSONObject() : new JSONObject(raw);
            } catch (JSONException parseError) {
                if (status == 404 || raw.toLowerCase(java.util.Locale.ROOT).contains("<!doctype html")) {
                    throw new IOException("API runtime tidak cocok atau masih memakai bundle lama. Pasang APK terbaru, lalu Paksa berhenti SKYWA dan buka kembali agar bundle diperbarui.");
                }
                throw new IOException("Respons runtime bukan JSON (HTTP " + status + "). Periksa status runtime di halaman utama.");
            }
            if (status < 200 || status >= 300) {
                throw new IOException("HTTP " + status + ": " + result.optString("error", result.optString("message", "Permintaan gagal.")));
            }
            return result;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String readString(InputStream input) throws IOException {
        try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = stream.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }
}
