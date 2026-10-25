package com.skywa.runtime;

/** JNI bridge for the in-process Node.js runtime packaged inside the APK. */
public final class NodeRuntime {
    static {
        System.loadLibrary("node");
        System.loadLibrary("skywa-node-bridge");
    }

    private NodeRuntime() {
        // Utility class.
    }

    public static native int startNodeWithArguments(
            String[] arguments,
            String workingDirectory,
            String temporaryDirectory,
            String compileCacheDirectory,
            String apiToken);
}
