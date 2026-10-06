#!/usr/bin/env python3
import os
import sys
import subprocess
import shutil
import urllib.request

BUILD_DIR = "/tmp/android_apk_build"
OUTPUT_APK = os.path.abspath("public/VdStudio.apk")
APP_PACKAGE = "com.vdstudio.app"
APP_NAME = "Vd Studio"

os.environ["PATH"] = f"/usr/lib/jvm/java-17-openjdk-amd64/bin:{os.environ.get('PATH', '')}"

ANDROID_JAR_URL = "https://raw.githubusercontent.com/Sable/android-platforms/master/android-30/android.jar"
R8_JAR_URL = "https://dl.google.com/android/maven2/com/android/tools/r8/8.2.42/r8-8.2.42.jar"

TOOLS_DIR = "/tmp/android_tools"
ANDROID_JAR = os.path.join(TOOLS_DIR, "android.jar")
R8_JAR = os.path.join(TOOLS_DIR, "r8.jar")

def log(msg):
    print(f"[APK-BUILD] {msg}")

def ensure_tools():
    os.makedirs(TOOLS_DIR, exist_ok=True)
    if not os.path.exists(ANDROID_JAR) or os.path.getsize(ANDROID_JAR) < 1000000:
        log("Downloading android.jar platform...")
        urllib.request.urlretrieve(ANDROID_JAR_URL, ANDROID_JAR)
        log("android.jar downloaded.")
    if not os.path.exists(R8_JAR) or os.path.getsize(R8_JAR) < 1000000:
        log("Downloading Google D8/R8 compiler...")
        urllib.request.urlretrieve(R8_JAR_URL, R8_JAR)
        log("D8/R8 downloaded.")

def run_cmd(cmd, cwd=None):
    log(f"Running: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    res = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error stdout: {res.stdout}")
        print(f"Error stderr: {res.stderr}")
        raise RuntimeError(f"Command failed with code {res.returncode}")
    return res.stdout

def build_apk():
    ensure_tools()
    
    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)
    os.makedirs(BUILD_DIR, exist_ok=True)
    
    res_dir = os.path.join(BUILD_DIR, "res")
    values_dir = os.path.join(res_dir, "values")
    os.makedirs(values_dir, exist_ok=True)
    
    # 1. Generate icon densities
    icon_src = os.path.abspath("public/icon.svg")
    densities = [
        ("mipmap-mdpi", 48),
        ("mipmap-hdpi", 72),
        ("mipmap-xhdpi", 96),
        ("mipmap-xxhdpi", 144),
        ("mipmap-xxxhdpi", 192)
    ]
    for folder, size in densities:
        d_dir = os.path.join(res_dir, folder)
        os.makedirs(d_dir, exist_ok=True)
        out_png = os.path.join(d_dir, "ic_launcher.png")
        subprocess.run(["ffmpeg", "-y", "-i", icon_src, "-vf", f"scale={size}:{size}", out_png], capture_output=True)

    # 2. strings.xml & styles.xml
    with open(os.path.join(values_dir, "strings.xml"), "w") as f:
        f.write(f'''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">{APP_NAME}</string>
</resources>''')

    with open(os.path.join(values_dir, "styles.xml"), "w") as f:
        f.write('''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="@android:style/Theme.NoTitleBar.Fullscreen">
        <item name="android:windowBackground">@android:color/black</item>
    </style>
</resources>''')

    # 3. AndroidManifest.xml
    manifest_path = os.path.join(BUILD_DIR, "AndroidManifest.xml")
    with open(manifest_path, "w") as f:
        f.write(f'''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="{APP_PACKAGE}"
    android:versionCode="450"
    android:versionName="4.5">

    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="33" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

    <application
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:theme="@style/AppTheme"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="true"
        android:largeHeap="true">

        <activity
            android:name="{APP_PACKAGE}.MainActivity"
            android:label="@string/app_name"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden|screenLayout|smallestScreenSize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>''')

    # 4. Generate R.java with aapt
    gen_dir = os.path.join(BUILD_DIR, "gen")
    os.makedirs(gen_dir, exist_ok=True)
    run_cmd([
        "aapt", "package", "-f", "-m",
        "-J", gen_dir,
        "-M", manifest_path,
        "-S", res_dir,
        "-I", ANDROID_JAR
    ])
    log("R.java generated.")

    # 5. Java Source code for MainActivity
    src_pkg_dir = os.path.join(BUILD_DIR, "src", "com", "vdstudio", "app")
    os.makedirs(src_pkg_dir, exist_ok=True)
    java_file = os.path.join(src_pkg_dir, "MainActivity.java")

    app_url = os.environ.get("APP_URL", "https://ais-dev-rnqjlps7hvpdxspawmom4m-684144802964.asia-southeast1.run.app")

    with open(java_file, "w") as f:
        f.write(f'''package com.vdstudio.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.webkit.PermissionRequest;
import android.net.Uri;
import android.content.Intent;

public class MainActivity extends Activity {{
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private final static int FILECHOOSER_RESULTCODE = 101;

    @Override
    protected void onCreate(Bundle savedInstanceState) {{
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.setWebViewClient(new WebViewClient() {{
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {{
                view.loadUrl(url);
                return true;
            }}
        }});

        webView.setWebChromeClient(new WebChromeClient() {{
            @Override
            public void onPermissionRequest(final PermissionRequest request) {{
                request.grant(request.getResources());
            }}

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {{
                MainActivity.this.filePathCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                try {{
                    startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                }} catch (Exception e) {{
                    MainActivity.this.filePathCallback = null;
                    return false;
                }}
                return true;
            }}
        }});

        webView.loadUrl("{app_url}");
    }}

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {{
        if (requestCode == FILECHOOSER_RESULTCODE) {{
            if (filePathCallback != null) {{
                Uri[] results = null;
                if (resultCode == Activity.RESULT_OK && data != null) {{
                    String dataString = data.getDataString();
                    if (dataString != null) {{
                        results = new Uri[]{{Uri.parse(dataString)}};
                    }} else if (data.getClipData() != null) {{
                        int num = data.getClipData().getItemCount();
                        results = new Uri[num];
                        for (int i = 0; i < num; i++) {{
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }}
                    }}
                }}
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }}
        }} else {{
            super.onActivityResult(requestCode, resultCode, data);
        }}
    }}

    @Override
    public void onBackPressed() {{
        if (webView != null && webView.canGoBack()) {{
            webView.goBack();
        }} else {{
            super.onBackPressed();
        }}
    }}
}}
''')
    log("MainActivity.java written.")

    # 6. Compile Java to .class files
    classes_dir = os.path.join(BUILD_DIR, "obj")
    os.makedirs(classes_dir, exist_ok=True)
    r_java = os.path.join(gen_dir, "com", "vdstudio", "app", "R.java")
    run_cmd([
        "javac", "-cp", ANDROID_JAR,
        "-d", classes_dir,
        r_java, java_file
    ])
    log("Java compiled to classes.")

    # 7. Convert .class to classes.dex using D8
    dex_dir = os.path.join(BUILD_DIR, "dex")
    os.makedirs(dex_dir, exist_ok=True)
    
    class_files = []
    for root, _, files in os.walk(classes_dir):
        for f in files:
            if f.endswith(".class"):
                class_files.append(os.path.join(root, f))

    run_cmd([
        "java", "-cp", R8_JAR,
        "com.android.tools.r8.D8",
        "--lib", ANDROID_JAR,
        "--output", dex_dir
    ] + class_files)
    log("classes.dex generated with D8.")

    # 8. Create Unaligned APK with aapt
    unaligned_apk = os.path.join(BUILD_DIR, "unaligned.apk")
    run_cmd([
        "aapt", "package", "-f",
        "-M", manifest_path,
        "-S", res_dir,
        "-I", ANDROID_JAR,
        "-F", unaligned_apk
    ])
    
    # Add classes.dex into unaligned apk
    run_cmd(["aapt", "add", "-k", unaligned_apk, "classes.dex"], cwd=dex_dir)
    log("classes.dex added into unaligned APK.")

    # 9. ZipAlign APK
    aligned_apk = os.path.join(BUILD_DIR, "aligned.apk")
    run_cmd(["zipalign", "-v", "-p", "4", unaligned_apk, aligned_apk])
    log("APK 4-byte zipaligned.")

    # 10. Generate Keystore & Sign APK
    keystore_path = os.path.join(BUILD_DIR, "release.keystore")
    if not os.path.exists(keystore_path):
        run_cmd([
            "keytool", "-genkeypair", "-v",
            "-keystore", keystore_path,
            "-alias", "vdstudio",
            "-keyalg", "RSA",
            "-keysize", "2048",
            "-validity", "10000",
            "-storepass", "vdstudio123",
            "-keypass", "vdstudio123",
            "-dname", "CN=VdStudio, OU=App, O=VdStudio, L=Global, S=Global, C=US"
        ])
    
    os.makedirs(os.path.dirname(OUTPUT_APK), exist_ok=True)
    shutil.copyfile(aligned_apk, OUTPUT_APK)

    run_cmd([
        "apksigner", "sign",
        "--ks", keystore_path,
        "--ks-pass", "pass:vdstudio123",
        "--key-pass", "pass:vdstudio123",
        "--ks-key-alias", "vdstudio",
        OUTPUT_APK
    ])
    log(f"APK successfully signed! Output: {OUTPUT_APK} (Size: {os.path.getsize(OUTPUT_APK)} bytes)")

    # Verify signature
    run_cmd(["apksigner", "verify", "--verbose", OUTPUT_APK])
    log("APK signature verified 100% valid for Android.")

if __name__ == "__main__":
    build_apk()
