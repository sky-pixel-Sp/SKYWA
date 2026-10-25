package com.skywa.ui;
import android.app.Activity;import android.os.Bundle;import android.graphics.Color;import android.graphics.Typeface;import android.graphics.drawable.GradientDrawable;import android.view.Gravity;import android.widget.Button;import android.widget.CheckBox;import android.widget.EditText;import android.widget.LinearLayout;import android.widget.ScrollView;import android.widget.Spinner;import android.widget.ArrayAdapter;import android.widget.TextView;import android.widget.Toast;import org.json.JSONObject;import java.io.ByteArrayOutputStream;import java.io.InputStream;import java.io.OutputStream;import java.net.HttpURLConnection;import java.net.URL;import java.nio.charset.StandardCharsets;
public final class AISettingsActivity extends Activity{
 private static final String API="http://127.0.0.1:3000";private static final int BG=Color.rgb(8,14,26),PANEL=Color.rgb(18,28,47),BORDER=Color.rgb(41,58,86),WHITE=Color.rgb(239,244,255),MUTED=Color.rgb(158,174,199),ACCENT=Color.rgb(103,134,255);
 private Spinner provider;private CheckBox enabled;private EditText key,model,endpoint,prompt,testInput;private TextView status;
 @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().setStatusBarColor(BG);getWindow().setNavigationBarColor(BG);ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.setPadding(dp(18),dp(18),dp(18),dp(28));root.setBackgroundColor(BG);scroll.addView(root);setContentView(scroll);root.addView(text("SKYWA AI",30,WHITE,true));root.addView(text("Pusat AI • OpenRouter atau endpoint model lokal yang kompatibel dengan OpenAI API.",14,MUTED,false));root.addView(text("API key disimpan di penyimpanan privat aplikasi dan tidak ditampilkan kembali setelah tersimpan.",12,MUTED,false));
 LinearLayout card=card(root,"PROVIDER & MODEL");provider=new Spinner(this);provider.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"OpenRouter (online)","Local endpoint (Ollama / OpenAI-compatible)"}));card.addView(provider,params());enabled=new CheckBox(this);enabled.setText("Gunakan AI untuk balasan WhatsApp");enabled.setTextColor(WHITE);card.addView(enabled,params());key=input(card,"OpenRouter API key (kosongkan untuk mempertahankan key)",false);key.setInputType(129);model=input(card,"Model ID, contoh openai/gpt-4o-mini atau qwen2.5:3b",false);endpoint=input(card,"URL lokal, contoh http://127.0.0.1:11434/v1",false);prompt=input(card,"System prompt / karakter AI",true);
 LinearLayout test=card(root,"UJI AI TANPA MENGIRIM WHATSAPP");testInput=input(test,"Tulis pertanyaan untuk menguji provider",true);status=text("Memuat pengaturan AI…",13,MUTED,false);root.addView(status);Button save=button("SIMPAN PENGATURAN",ACCENT);root.addView(save);save.setOnClickListener(v->save());Button testButton=button("UJI KONEKSI & JAWABAN AI",0xff245d56);root.addView(testButton);testButton.setOnClickListener(v->testAI());Button back=button("KEMBALI",0xff34425c);root.addView(back);back.setOnClickListener(v->finish());load();}
 private void load(){new Thread(()->{try{JSONObject c=request("GET","/api/ai/config",null);runOnUiThread(()->{provider.setSelection("local".equals(c.optString("provider"))?1:0);enabled.setChecked(c.optBoolean("enabled",false));model.setText(c.optString("model","openai/gpt-4o-mini"));endpoint.setText(c.optString("baseUrl","http://127.0.0.1:11434/v1"));prompt.setText(c.optString("systemPrompt",""));key.setHint(c.optBoolean("hasApiKey",false)?"API key tersimpan (kosongkan agar tidak berubah)":"Masukkan API key jika memakai OpenRouter");status.setText("Pengaturan berhasil dimuat.");});}catch(Exception e){runOnUiThread(()->status.setText("Runtime belum siap: "+e.getMessage()));}},"skywa-ai-load").start();}
 private void save(){try{JSONObject b=new JSONObject();b.put("provider",provider.getSelectedItemPosition()==1?"local":"openrouter");b.put("enabled",enabled.isChecked());b.put("apiKey",key.getText().toString().trim());b.put("model",model.getText().toString().trim());b.put("baseUrl",endpoint.getText().toString().trim());b.put("systemPrompt",prompt.getText().toString().trim());new Thread(()->{try{JSONObject r=request("POST","/api/ai/config",b);runOnUiThread(()->{key.setText("");key.setHint(r.optBoolean("hasApiKey",false)?"API key tersimpan (kosongkan agar tidak berubah)":"Masukkan API key");status.setText("Pengaturan AI tersimpan.");Toast.makeText(this,"Pengaturan AI disimpan",Toast.LENGTH_SHORT).show();});}catch(Exception e){runOnUiThread(()->status.setText("Gagal menyimpan: "+e.getMessage()));}},"skywa-ai-save").start();}catch(Exception e){status.setText("Pengaturan tidak valid: "+e.getMessage());}}
 private void testAI(){try{JSONObject b=new JSONObject();b.put("prompt",testInput.getText().toString().trim());status.setText("Menghubungi provider AI…");new Thread(()->{try{JSONObject r=request("POST","/api/ai/test",b);runOnUiThread(()->status.setText("Tes berhasil:\n"+r.optString("reply","(jawaban kosong)")));}catch(Exception e){runOnUiThread(()->status.setText("Tes AI gagal: "+e.getMessage()));}},"skywa-ai-test").start();}catch(Exception e){status.setText(e.getMessage());}}
 private JSONObject request(String method,String path,JSONObject body)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL(API+path).openConnection();
  try{
   c.setRequestMethod(method);
   c.setConnectTimeout(5000);
   c.setReadTimeout(30000);
   c.setRequestProperty("Accept","application/json");
   if(body!=null){
    c.setDoOutput(true);
    c.setRequestProperty("Content-Type","application/json; charset=utf-8");
    try(OutputStream o=c.getOutputStream()){o.write(body.toString().getBytes(StandardCharsets.UTF_8));}
   }
   int code=c.getResponseCode();
   InputStream in=code>=200&&code<400?c.getInputStream():c.getErrorStream();
   String raw="";
   if(in!=null)try(InputStream s=in;ByteArrayOutputStream out=new ByteArrayOutputStream()){
    byte[] buf=new byte[2048];int n;
    while((n=s.read(buf))!=-1)out.write(buf,0,n);
    raw=out.toString("UTF-8");
   }
   JSONObject result=null;
   try{result=raw.isEmpty()?new JSONObject():new JSONObject(raw);}
   catch(org.json.JSONException parseError){
    if(code==404||raw.toLowerCase(java.util.Locale.ROOT).contains("<!doctype html")){
     throw new Exception("API runtime tidak cocok atau memakai bundle lama. Pasang APK terbaru, lalu Paksa berhenti SKYWA dan buka kembali.");
    }
    throw new Exception("Respons runtime bukan JSON (HTTP "+code+"). Periksa status runtime di halaman utama.");
   }
   if(code<200||code>=300){
    String detail=result.optString("error",result.optString("message","HTTP "+code));
    throw new Exception(detail);
   }
   return result;
  }finally{c.disconnect();}
 }
 private LinearLayout card(LinearLayout root,String title){LinearLayout c=new LinearLayout(this);c.setOrientation(1);c.setPadding(dp(15),dp(15),dp(15),dp(15));c.setBackground(bg(PANEL,BORDER,16));LinearLayout.LayoutParams p=params();p.bottomMargin=dp(14);root.addView(c,p);c.addView(text(title,14,WHITE,true));return c;}
 private EditText input(LinearLayout parent,String hint,boolean multi){EditText e=new EditText(this);e.setTextColor(WHITE);e.setHintTextColor(MUTED);e.setHint(hint);e.setTextSize(14);e.setSingleLine(!multi);if(multi){e.setMinLines(3);e.setGravity(Gravity.TOP|Gravity.START);}e.setPadding(dp(12),dp(10),dp(12),dp(10));e.setBackground(bg(Color.rgb(10,18,32),BORDER,10));LinearLayout.LayoutParams p=params();p.bottomMargin=dp(9);parent.addView(e,p);return e;}
 private TextView text(String s,int size,int color,boolean bold){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(color);t.setPadding(0,0,0,dp(8));if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;}
 private Button button(String s,int color){Button b=new Button(this);b.setText(s);b.setTextColor(WHITE);b.setAllCaps(false);b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);b.setBackground(bg(color,color,12));LinearLayout.LayoutParams p=params();p.bottomMargin=dp(9);b.setLayoutParams(p);return b;}
 private LinearLayout.LayoutParams params(){return new LinearLayout.LayoutParams(-1,-2);}private GradientDrawable bg(int color,int stroke,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));d.setStroke(dp(1),stroke);return d;}private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}
}