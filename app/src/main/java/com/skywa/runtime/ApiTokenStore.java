package com.skywa.runtime;

import android.content.Context;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

/** Stores the installation-scoped local API token in app-private storage. */
public final class ApiTokenStore {
    private static final String FILE_NAME = "skywa-api-token";
    private static final int TOKEN_BYTES = 32;
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private ApiTokenStore() {}

    public static synchronized String getOrCreate(Context context) throws IOException {
        String existing = read(context);
        if (isValid(existing)) return existing;
        byte[] bytes = new byte[TOKEN_BYTES];
        new SecureRandom().nextBytes(bytes);
        char[] encoded = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            encoded[i * 2] = HEX[(bytes[i] >>> 4) & 0x0f];
            encoded[i * 2 + 1] = HEX[bytes[i] & 0x0f];
        }
        String token = new String(encoded);
        File directory = context.getFilesDir();
        File target = new File(directory, FILE_NAME);
        File temporary = new File(directory, FILE_NAME + ".tmp");
        try (FileOutputStream output = new FileOutputStream(temporary, false)) {
            output.write(token.getBytes(StandardCharsets.UTF_8));
            output.flush();
            output.getFD().sync();
        }
        if (target.exists() && !target.delete()) {
            temporary.delete();
            throw new IOException("Tidak dapat memperbarui token API lokal.");
        }
        if (!temporary.renameTo(target)) {
            temporary.delete();
            throw new IOException("Tidak dapat menyimpan token API lokal.");
        }
        return token;
    }

    /** Returns null until NodeService has created the token. */
    public static String read(Context context) throws IOException {
        File file = new File(context.getFilesDir(), FILE_NAME);
        if (!file.isFile()) return null;
        try (FileInputStream input = new FileInputStream(file);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[128];
            int count;
            while ((count = input.read(buffer)) != -1) {
                output.write(buffer, 0, count);
                if (output.size() > 128) throw new IOException("Token API lokal tidak valid.");
            }
            String token = output.toString(StandardCharsets.UTF_8.name()).trim();
            return isValid(token) ? token : null;
        }
    }

    private static boolean isValid(String token) {
        if (token == null || token.length() != TOKEN_BYTES * 2) return false;
        for (int i = 0; i < token.length(); i++) {
            char c = token.charAt(i);
            if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
        }
        return true;
    }
}
