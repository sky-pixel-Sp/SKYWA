#include <jni.h>
#include <node.h>

#include <cerrno>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <unistd.h>

extern "C" JNIEXPORT jint JNICALL
Java_com_skywa_runtime_NodeRuntime_startNodeWithArguments(
        JNIEnv *env,
        jclass,
        jobjectArray arguments,
        jstring workingDirectory,
        jstring temporaryDirectory,
        jstring compileCacheDirectory,
        jstring apiToken) {
    if (arguments == nullptr || workingDirectory == nullptr) {
        return static_cast<jint>(-EINVAL);
    }

    const char *workingPath = env->GetStringUTFChars(workingDirectory, nullptr);
    if (workingPath == nullptr) {
        return static_cast<jint>(-ENOMEM);
    }

    if (chdir(workingPath) != 0) {
        const int errorCode = errno;
        env->ReleaseStringUTFChars(workingDirectory, workingPath);
        return static_cast<jint>(-errorCode);
    }

    setenv("HOME", workingPath, 1);
    env->ReleaseStringUTFChars(workingDirectory, workingPath);

    if (temporaryDirectory != nullptr) {
        const char *temporaryPath = env->GetStringUTFChars(temporaryDirectory, nullptr);
        if (temporaryPath != nullptr) {
            setenv("TMPDIR", temporaryPath, 1);
            env->ReleaseStringUTFChars(temporaryDirectory, temporaryPath);
        }
    }

    if (compileCacheDirectory != nullptr) {
        const char *cachePath = env->GetStringUTFChars(compileCacheDirectory, nullptr);
        if (cachePath != nullptr) {
            setenv("NODE_COMPILE_CACHE", cachePath, 1);
            env->ReleaseStringUTFChars(compileCacheDirectory, cachePath);
        }
    }

    setenv("NODE_COMPILE_CACHE_PORTABLE", "1", 1);
    setenv("UV_THREADPOOL_SIZE", "4", 0);

    if (apiToken == nullptr) return static_cast<jint>(-EINVAL);
    const char *tokenValue = env->GetStringUTFChars(apiToken, nullptr);
    if (tokenValue == nullptr) return static_cast<jint>(-ENOMEM);
    const int tokenSetResult = setenv("SKYWA_API_TOKEN", tokenValue, 1);
    const int tokenSetError = errno;
    env->ReleaseStringUTFChars(apiToken, tokenValue);
    if (tokenSetResult != 0) return static_cast<jint>(-tokenSetError);

    const jsize argumentCount = env->GetArrayLength(arguments);
    if (argumentCount <= 0) {
        return static_cast<jint>(-EINVAL);
    }

    std::vector<std::string> argumentStorage;
    argumentStorage.reserve(static_cast<size_t>(argumentCount));
    size_t argumentBytes = 0;

    for (jsize index = 0; index < argumentCount; ++index) {
        auto value = static_cast<jstring>(env->GetObjectArrayElement(arguments, index));
        if (value == nullptr) {
            argumentStorage.emplace_back();
            argumentBytes += 1;
            continue;
        }

        const char *utfValue = env->GetStringUTFChars(value, nullptr);
        if (utfValue == nullptr) {
            env->DeleteLocalRef(value);
            return static_cast<jint>(-ENOMEM);
        }

        argumentStorage.emplace_back(utfValue);
        argumentBytes += argumentStorage.back().size() + 1;
        env->ReleaseStringUTFChars(value, utfValue);
        env->DeleteLocalRef(value);
    }

    // libuv may rewrite argv during Node bootstrap; Node's mobile samples
    // therefore allocate the actual argument strings in one contiguous block.
    std::vector<char> argumentBuffer(argumentBytes, '\0');
    std::vector<char *> argv;
    argv.reserve(static_cast<size_t>(argumentCount) + 1);
    size_t offset = 0;
    for (const std::string &argument : argumentStorage) {
        const size_t bytes = argument.size() + 1;
        std::memcpy(argumentBuffer.data() + offset, argument.c_str(), bytes);
        argv.push_back(argumentBuffer.data() + offset);
        offset += bytes;
    }
    argv.push_back(nullptr);

    // Node.js Mobile supports one Node runtime instance per Android process.
    // This call intentionally blocks on the dedicated Node runtime thread.
    return static_cast<jint>(node::Start(static_cast<int>(argumentCount), argv.data()));
}
