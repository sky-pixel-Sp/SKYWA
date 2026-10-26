package com.skywa.ui;

import com.skywa.runtime.LocalApiClient;
import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONObject;

public final class AISettingsActivity extends Activity {
    private static final int BG=Color.rgb(8,14,26), PANEL=Color.rgb(18,28,47), BORDER=Color.rgb(41,58,86);
    private static final int WHITE=Color.rgb(239,244,255), MUTED=Color.rgb(158,174,199), ACCENT=Color.rgb(103,134,255);
    private static final String[] PROVIDERS={"OpenRouter","Google Gemini","Local endpoint"};
    private Spinner provider, fallbackProvider;
    private CheckBox enabled, fallbackEnabled;
    private EditText key, model, endpoint, fallbackKey, fallbackModel, prompt, testInput;
    private TextView status;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout root=new LinearLayout(this);
        root.setOrientation(1);
        root.setPadding(dp(18),dp(18),dp(18),dp(28));
        root.setBackgroundColor(BG);
        scroll.addView(root);
        setContentView(scroll);

        root.addView(text("SKYWA AI",30,WHITE,true));
        root.addView(text("Pilih provider utama, lalu siapkan provider cadangan jika API utama mengalami rate limit, gangguan jaringan, atau error.",14,MUTED,false));
        root.addView(text("Pesan dan konteks percakapan dapat dikirim ke provider cloud saat AI aktif. API key tidak ditampilkan kembali setelah disimpan.",12,MUTED,false));

        LinearLayout primary=card(root,"PROVIDER UTAMA");
        provider=spinner(primary,PROVIDERS);
        enabled=new CheckBox(this);
        enabled.setText("Gunakan AI untuk balasan WhatsApp");
        enabled.setTextColor(WHITE);
        primary.addView(enabled,params());
        key=input(primary,"API key provider utama (OpenRouter atau Gemini)",false);
        key.setInputType(129);
        model=input(primary,"Model ID (contoh openai/gpt-4o-mini atau gemini-2.5-flash)",false);
        endpoint=input(primary,"URL endpoint lokal (contoh http://127.0.0.1:11434/v1)",false);

        LinearLayout fallback=card(root,"PROVIDER FALLBACK");
        fallbackEnabled=new CheckBox(this);
        fallbackEnabled.setText("Aktifkan fallback otomatis jika provider utama gagal");
        fallbackEnabled.setTextColor(WHITE);
        fallback.addView(fallbackEnabled,params());
        fallbackProvider=spinner(fallback,PROVIDERS);
        fallbackKey=input(fallback,"API key provider fallback (wajib untuk OpenRouter/Gemini)",false);
        fallbackKey.setInputType(129);
        fallbackModel=input(fallback,"Model ID provider fallback",false);
        fallback.addView(text("Pilih provider fallback yang berbeda dari provider utama. Untuk fallback Local, gunakan endpoint lokal di bagian provider utama.",12,MUTED,false));

        LinearLayout persona=card(root,"KARAKTER AI");
        prompt=input(persona,"System prompt / instruksi karakter AI",true);

        LinearLayout test=card(root,"UJI AI TANPA MENGIRIM WHATSAPP");
        testInput=input(test,"Tulis pertanyaan untuk menguji provider",true);
        status=text("Memuat pengaturan AI…",13,MUTED,false);
        root.addView(status);
        Button save=button("SIMPAN PENGATURAN",ACCENT);
        root.addView(save);
        save.setOnClickListener(v->save());
        Button testButton=button("UJI KONEKSI & FALLBACK",0xff245d56);
        root.addView(testButton);
        testButton.setOnClickListener(v->testAI());
        Button back=button("KEMBALI",0xff34425c);
        root.addView(back);
        back.setOnClickListener(v->finish());
        load();
    }

    private Spinner spinner(LinearLayout parent,String[] values) {
        Spinner s=new Spinner(this);
        s.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,values));
        parent.addView(s,params());
        return s;
    }

    private int providerIndex(String value) {
        if ("gemini".equals(value)) return 1;
        if ("local".equals(value)) return 2;
        return 0;
    }

    private String providerValue(Spinner s) {
        int position=s.getSelectedItemPosition();
        return position==1?"gemini":position==2?"local":"openrouter";
    }

    private void load() {
        new Thread(()->{
            try {
                JSONObject c=request("GET","/api/ai/config",null);
                runOnUiThread(()->{
                    provider.setSelection(providerIndex(c.optString("provider","openrouter")));
                    fallbackProvider.setSelection(providerIndex(c.optString("fallbackProvider","gemini")));
                    enabled.setChecked(c.optBoolean("enabled",false));
                    fallbackEnabled.setChecked(c.optBoolean("fallbackEnabled",false));
                    model.setText(c.optString("model","openai/gpt-4o-mini"));
                    endpoint.setText(c.optString("baseUrl","http://127.0.0.1:11434/v1"));
                    fallbackModel.setText(c.optString("fallbackModel","gemini-2.5-flash"));
                    prompt.setText(c.optString("systemPrompt",""));
                    key.setHint(c.optBoolean("hasApiKey",false)?"API key tersimpan; kosongkan agar tidak berubah":"Masukkan API key provider utama");
                    fallbackKey.setHint(c.optBoolean("hasFallbackApiKey",false)?"API key fallback tersimpan; kosongkan agar tidak berubah":"Masukkan API key fallback bila memakai provider cloud");
                    status.setText("Pengaturan AI berhasil dimuat.");
                });
            } catch(Exception e) {
                runOnUiThread(()->status.setText("Server lokal tidak aktif atau belum siap. Nyalakan runtime lalu buka pengaturan AI lagi."));
            }
        },"skywa-ai-load").start();
    }

    private void save() {
        try {
            JSONObject body=new JSONObject();
            body.put("provider",providerValue(provider));
            body.put("enabled",enabled.isChecked());
            body.put("apiKey",key.getText().toString().trim());
            body.put("model",model.getText().toString().trim());
            body.put("baseUrl",endpoint.getText().toString().trim());
            body.put("fallbackEnabled",fallbackEnabled.isChecked());
            body.put("fallbackProvider",providerValue(fallbackProvider));
            body.put("fallbackApiKey",fallbackKey.getText().toString().trim());
            body.put("fallbackModel",fallbackModel.getText().toString().trim());
            body.put("systemPrompt",prompt.getText().toString().trim());
            status.setText("Menyimpan pengaturan…");
            new Thread(()->{
                try {
                    JSONObject response=request("POST","/api/ai/config",body);
                    runOnUiThread(()->{
                        key.setText("");
                        fallbackKey.setText("");
                        key.setHint(response.optBoolean("hasApiKey",false)?"API key tersimpan; kosongkan agar tidak berubah":"Masukkan API key provider utama");
                        fallbackKey.setHint(response.optBoolean("hasFallbackApiKey",false)?"API key fallback tersimpan; kosongkan agar tidak berubah":"Masukkan API key fallback bila memakai provider cloud");
                        status.setText("Pengaturan AI tersimpan. Provider utama: "+provider.getSelectedItem().toString()+".");
                        Toast.makeText(this,"Pengaturan AI disimpan",Toast.LENGTH_SHORT).show();
                    });
                } catch(Exception e) {
                    runOnUiThread(()->status.setText("Gagal menyimpan pengaturan: "+e.getMessage()));
                }
            },"skywa-ai-save").start();
        } catch(Exception e) {
            status.setText("Pengaturan tidak valid: "+e.getMessage());
        }
    }

    private void testAI() {
        try {
            JSONObject body=new JSONObject();
            body.put("prompt",testInput.getText().toString().trim());
            status.setText("Menghubungi provider utama dan fallback bila diperlukan…");
            new Thread(()->{
                try {
                    JSONObject response=request("POST","/api/ai/test",body);
                    runOnUiThread(()->status.setText("Tes berhasil ("+response.optString("provider","provider")+"/"+response.optString("model","model")+"):\n"+response.optString("reply","(jawaban kosong)")));
                } catch(Exception e) {
                    runOnUiThread(()->status.setText("Tes AI gagal. Periksa provider, model, API key, dan koneksi. Detail: "+e.getMessage()));
                }
            },"skywa-ai-test").start();
        } catch(Exception e) {
            status.setText(e.getMessage());
        }
    }

    private JSONObject request(String method,String path,JSONObject body)throws Exception {
        return LocalApiClient.request(this,method,path,body);
    }

    private LinearLayout card(LinearLayout root,String title) {
        LinearLayout c=new LinearLayout(this);
        c.setOrientation(1);
        c.setPadding(dp(15),dp(15),dp(15),dp(15));
        c.setBackground(bg(PANEL,BORDER,16));
        LinearLayout.LayoutParams p=params();
        p.bottomMargin=dp(14);
        root.addView(c,p);
        c.addView(text(title,14,WHITE,true));
        return c;
    }

    private EditText input(LinearLayout parent,String hint,boolean multi) {
        EditText e=new EditText(this);
        e.setTextColor(WHITE);
        e.setHintTextColor(MUTED);
        e.setHint(hint);
        e.setTextSize(14);
        e.setSingleLine(!multi);
        if(multi){e.setMinLines(3);e.setGravity(Gravity.TOP|Gravity.START);}
        e.setPadding(dp(12),dp(10),dp(12),dp(10));
        e.setBackground(bg(Color.rgb(10,18,32),BORDER,10));
        LinearLayout.LayoutParams p=params();
        p.bottomMargin=dp(9);
        parent.addView(e,p);
        return e;
    }

    private TextView text(String value,int size,int color,boolean bold) {
        TextView t=new TextView(this);
        t.setText(value);
        t.setTextSize(size);
        t.setTextColor(color);
        t.setPadding(0,0,0,dp(8));
        if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        return t;
    }

    private Button button(String value,int color) {
        Button b=new Button(this);
        b.setText(value);
        b.setTextColor(WHITE);
        b.setAllCaps(false);
        b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        b.setBackground(bg(color,color,12));
        LinearLayout.LayoutParams p=params();
        p.bottomMargin=dp(9);
        b.setLayoutParams(p);
        return b;
    }

    private LinearLayout.LayoutParams params(){return new LinearLayout.LayoutParams(-1,-2);}
    private GradientDrawable bg(int color,int stroke,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));d.setStroke(dp(1),stroke);return d;}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
}
