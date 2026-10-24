package com.skywa.ui;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
public class MainActivity extends Activity {
  private WebView webView;
  @Override protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    webView = new WebView(this);
    webView.getSettings().setJavaScriptEnabled(true);
    webView.getSettings().setDomStorageEnabled(true);
    webView.getSettings().setAllowFileAccess(false);
    webView.getSettings().setAllowContentAccess(false);
    setContentView(webView);
    webView.loadDataWithBaseURL(null, "<html><body style='font-family:sans-serif;background:#101827;color:#fff;padding:24px'><h1>SKYWA</h1><p>Backend companion required. Start the SKYWA server in Termux, then connect the dashboard.</p></body></html>", "text/html", "UTF-8", null);
  }
  @Override protected void onDestroy() { if(webView!=null) webView.loadUrl("about:blank"); super.onDestroy(); }
}
