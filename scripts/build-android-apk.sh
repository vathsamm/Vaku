#!/bin/bash
set -e

BUILD_DIR="/tmp/apk-build"
PROJECT_DIR="$(pwd)"
OUTPUT_APK="$PROJECT_DIR/public/vd-studio.apk"
KEYSTORE="$BUILD_DIR/vdstudio.keystore"
ANDROID_JAR="/usr/lib/android-sdk/platforms/android-23/android.jar"

echo "=== Building Android APK for Vd Studio ==="

# Clean build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/src/com/vdstudio/videoeditor"
mkdir -p "$BUILD_DIR/gen"
mkdir -p "$BUILD_DIR/bin"
mkdir -p "$BUILD_DIR/res/values"
mkdir -p "$BUILD_DIR/res/mipmap-hdpi"
mkdir -p "$BUILD_DIR/res/mipmap-xhdpi"
mkdir -p "$BUILD_DIR/res/mipmap-xxhdpi"
mkdir -p "$BUILD_DIR/res/mipmap-xxxhdpi"
mkdir -p "$BUILD_DIR/assets/www"

# 1. Launcher icons
echo "[1/7] Generating launcher mipmaps..."
ffmpeg -y -i "$PROJECT_DIR/public/pwa-512x512.png" -vf "scale=72:72" "$BUILD_DIR/res/mipmap-hdpi/ic_launcher.png" -loglevel error
ffmpeg -y -i "$PROJECT_DIR/public/pwa-512x512.png" -vf "scale=96:96" "$BUILD_DIR/res/mipmap-xhdpi/ic_launcher.png" -loglevel error
ffmpeg -y -i "$PROJECT_DIR/public/pwa-512x512.png" -vf "scale=144:144" "$BUILD_DIR/res/mipmap-xxhdpi/ic_launcher.png" -loglevel error
ffmpeg -y -i "$PROJECT_DIR/public/pwa-512x512.png" -vf "scale=192:192" "$BUILD_DIR/res/mipmap-xxxhdpi/ic_launcher.png" -loglevel error

# 2. Android Manifest & Strings
echo "[2/7] Writing Manifest and Resources..."
cat << 'MANIFEST_EOF' > "$BUILD_DIR/AndroidManifest.xml"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.vdstudio.videoeditor"
    android:versionCode="450"
    android:versionName="4.5.0">

    <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="33" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:hardwareAccelerated="true"
        android:largeHeap="true"
        android:allowBackup="true"
        android:theme="@android:style/Theme.NoTitleBar.Fullscreen">
        <activity
            android:name=".MainActivity"
            android:label="@string/app_name"
            android:configChanges="orientation|screenSize|keyboardHidden|screenLayout|smallestScreenSize"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
MANIFEST_EOF

cat << 'STRINGS_EOF' > "$BUILD_DIR/res/values/strings.xml"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Vd Studio</string>
</resources>
STRINGS_EOF

# 3. MainActivity.java
echo "[3/7] Generating Native Android MainActivity..."
cat << 'JAVA_EOF' > "$BUILD_DIR/src/com/vdstudio/videoeditor/MainActivity.java"
package com.vdstudio.videoeditor;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView webView;
    private ValueCallback<Uri[]> uploadMessage;
    private final static int FILE_CHOOSER_RESULT_CODE = 1001;
    private static final String ONLINE_URL = "https://ais-dev-rnqjlps7hvpdxspawmom4m-684144802964.asia-southeast1.run.app";
    private static final String OFFLINE_URL = "file:///android_asset/www/index.html";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            ws.setAllowFileAccessFromFileURLs(true);
            ws.setAllowUniversalAccessFromFileURLs(true);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
            ws.setMediaPlaybackRequiresUserGesture(false);
        }
        ws.setUseWideViewPort(true);
        ws.setLoadWithOverviewMode(true);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (failingUrl != null && failingUrl.startsWith("http")) {
                    view.loadUrl(OFFLINE_URL);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")) {
                    return false;
                }
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    return true;
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                return true;
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (uploadMessage != null) {
                    uploadMessage.onReceiveValue(null);
                    uploadMessage = null;
                }
                uploadMessage = filePathCallback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                String[] mimetypes = {"video/*", "audio/*", "image/*"};
                intent.putExtra(Intent.EXTRA_MIME_TYPES, mimetypes);
                try {
                    startActivityForResult(Intent.createChooser(intent, "Select Media"), FILE_CHOOSER_RESULT_CODE);
                } catch (Exception e) {
                    uploadMessage = null;
                    return false;
                }
                return true;
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimetype != null ? mimetype : "video/mp4");
                    request.allowScanningByMediaScanner();
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    String fileName = URLUtil.guessFileName(url, contentDisposition, mimetype);
                    if (fileName == null || !fileName.contains(".")) {
                        fileName = "vd-export-" + System.currentTimeMillis() + ".mp4";
                    }
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    dm.enqueue(request);
                    Toast.makeText(getApplicationContext(), "Saving video to Downloads...", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setData(Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception ignored) {}
                }
            }
        });

        if (isNetworkAvailable()) {
            webView.loadUrl(ONLINE_URL);
        } else {
            webView.loadUrl(OFFLINE_URL);
        }
    }

    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo netInfo = cm.getActiveNetworkInfo();
            return netInfo != null && netInfo.isConnected();
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (uploadMessage != null) {
                Uri[] results = null;
                if (resultCode == Activity.RESULT_OK && data != null) {
                    String dataString = data.getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    } else if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
                uploadMessage.onReceiveValue(results);
                uploadMessage = null;
            }
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
JAVA_EOF

# 4. Copy offline web app assets
echo "[4/7] Bundling offline assets..."
if [ -d "$PROJECT_DIR/dist" ]; then
    cp -r "$PROJECT_DIR/dist/"* "$BUILD_DIR/assets/www/" 2>/dev/null || true
    # Avoid putting the APK itself inside the APK assets
    rm -f "$BUILD_DIR/assets/www/vd-studio.apk"
fi

# 5. Compile R.java & Java sources
echo "[5/7] Compiling Java source code..."
/usr/bin/aapt package -f -m -J "$BUILD_DIR/gen" -M "$BUILD_DIR/AndroidManifest.xml" -S "$BUILD_DIR/res" -I "$ANDROID_JAR"
/usr/bin/javac -source 1.8 -target 1.8 -d "$BUILD_DIR/bin" -cp "$ANDROID_JAR" "$BUILD_DIR/gen/com/vdstudio/videoeditor/R.java" "$BUILD_DIR/src/com/vdstudio/videoeditor/MainActivity.java"
/usr/bin/dalvik-exchange --dex --output="$BUILD_DIR/bin/classes.dex" "$BUILD_DIR/bin"

# 6. Package APK
echo "[6/7] Packaging APK with AAPT and classes.dex..."
/usr/bin/aapt package -f -M "$BUILD_DIR/AndroidManifest.xml" -S "$BUILD_DIR/res" -A "$BUILD_DIR/assets" -I "$ANDROID_JAR" -F "$BUILD_DIR/bin/unaligned.apk"
cd "$BUILD_DIR/bin" && /usr/bin/aapt add unaligned.apk classes.dex
/usr/bin/zipalign -f -p 4 "$BUILD_DIR/bin/unaligned.apk" "$BUILD_DIR/bin/aligned.apk"

# 7. Sign APK
echo "[7/7] Signing APK with keystore..."
if [ ! -f "$KEYSTORE" ]; then
    keytool -genkey -v -keystore "$KEYSTORE" -alias vdstudio -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=VDStudio, OU=Mobile, O=VDStudio, L=MountainView, ST=CA, C=US"
fi
/usr/bin/apksigner sign --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android --out "$OUTPUT_APK" "$BUILD_DIR/bin/aligned.apk"
/usr/bin/apksigner verify "$OUTPUT_APK"

# Copy to dist if dist exists
if [ -d "$PROJECT_DIR/dist" ]; then
    cp "$OUTPUT_APK" "$PROJECT_DIR/dist/vd-studio.apk"
fi

echo "=== SUCCESS! Android APK built at: $OUTPUT_APK ==="
ls -lh "$OUTPUT_APK"
