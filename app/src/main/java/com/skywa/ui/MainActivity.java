package com.skywa.ui;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ImageView;
import android.widget.ScrollView;
import android.widget.TextView;

import com.skywa.runtime.NodeService;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String API_BASE = "http://127.0.0.1:3000";
    private static final String PREFS_NAME = "skywa_control";
    private static final String PREF_SERVER_ENABLED = "server_enabled";
    private static final int BG = Color.rgb(8, 14, 26);
    private static final int PANEL = Color.rgb(18, 28, 47);
    private static final int PANEL_DARK = Color.rgb(10, 18, 32);
    private static final int BORDER = Color.rgb(41, 58, 86);
    private static final int WHITE = Color.rgb(239, 244, 255);
    private static final int MUTED = Color.rgb(158, 174, 199);
    private static final int ACCENT = Color.rgb(103, 134, 255);
    private static final int GREEN = Color.rgb(82, 213, 160);
    private static final int RED = Color.rgb(255, 128, 128);

    private final Handler handler = new Handler(Looper.getMainLooper());
    private volatile boolean refreshing = false;
    private boolean botConfigLoaded = false;
    private LinearLayout page;
    private LinearLayout activeSection;
    private LinearLayout homeSection;
    private LinearLayout whatsappSection;
    private LinearLayout automationSection;
    private LinearLayout aiSection;
    private LinearLayout bottomNavigation;
    private final Button[] navigationButtons = new Button[4];
    private Button serverToggleButton;
    private TextView homeWhatsAppStatus;
    private TextView buildInfoStatus;
    private SharedPreferences preferences;
    private boolean runtimeOnline = false;
    private String serverTransition = "";
    private String activeTab = "home";
    private TextView backendStatus;
    private TextView controllerStatus;
    private TextView whatsappStatus;
    private TextView pairingInfo;
    private TextView actionStatus;
    private EditText phoneInput;
    private EditText recipientInput;
    private EditText messageInput;
    private CheckBox autoReplyEnabled;
    private EditText triggerInput;
    private EditText replyInput;
    private boolean automationConfigLoaded = false;
    private CheckBox automationRulesEnabled;
    private CheckBox automationIgnoreGroups;
    private CheckBox automationHoursEnabled;
    private EditText automationRulesInput;
    private EditText automationAllowlistInput;
    private EditText automationBlocklistInput;
    private EditText automationCooldownInput;
    private EditText automationMaxRepliesInput;
    private EditText automationStartInput;
    private EditText automationEndInput;
    private TextView automationStats;

    private final Runnable periodicRefresh = new Runnable() {
        @Override public void run() {
            refreshStatus();
            handler.postDelayed(this, 5000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);

        preferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);

        LinearLayout appRoot = new LinearLayout(this);
        appRoot.setOrientation(LinearLayout.VERTICAL);
        appRoot.setBackgroundColor(BG);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setBackgroundColor(BG);
        scroll.addView(page, new ScrollView.LayoutParams(-1, -2));
        appRoot.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1f));

        homeSection = createSection();
        whatsappSection = createSection();
        automationSection = createSection();
        aiSection = createSection();
        page.addView(homeSection, new LinearLayout.LayoutParams(-1, -2));
        page.addView(whatsappSection, new LinearLayout.LayoutParams(-1, -2));
        page.addView(automationSection, new LinearLayout.LayoutParams(-1, -2));
        page.addView(aiSection, new LinearLayout.LayoutParams(-1, -2));
        activeSection = homeSection;

        bottomNavigation = createBottomNavigation();
        appRoot.addView(bottomNavigation, new LinearLayout.LayoutParams(-1, -2));
        setContentView(appRoot);

        ImageView brandArt = new ImageView(this);
        brandArt.setImageResource(com.skywa.R.drawable.skywa_logo);
        brandArt.setContentDescription("SKYWA logo");
        LinearLayout.LayoutParams artParams = new LinearLayout.LayoutParams(dp(76), dp(76));
        artParams.bottomMargin = dp(12);
        activeSection.addView(brandArt, artParams);
        TextView eyebrow = addText(activeSection, "WHATSAPP AUTOMATION  •  ANDROID", 11, ACCENT, true);
        eyebrow.setLetterSpacing(0.08f);
        addText(activeSection, "Control Center", 29, WHITE, true);
        addText(activeSection, "Kelola server, WhatsApp, dan AI dari satu aplikasi.", 14, MUTED, false);
        addText(activeSection, "Tidak perlu Termux atau membuka website terpisah.", 13, MUTED, false);
        addGap(activeSection, 10);

        LinearLayout statusCard = addCard("SERVER LOKAL");
        backendStatus = addText(statusCard, "Memeriksa server lokal…", 17, WHITE, true);
        controllerStatus = addText(statusCard, "Server mengelola API dan fitur SKYWA.", 13, MUTED, false);
        addText(statusCard, "Matikan server untuk menghentikan runtime lokal. Aplikasi dan tombol ON/OFF tetap tersedia.", 12, MUTED, false);
        serverToggleButton = addButton(statusCard, "NYALAKAN SERVER", ACCENT, this::toggleEmbeddedServer);
        addButton(statusCard, "PERIKSA STATUS", 0xFF293954, this::refreshStatus);
        buildInfoStatus = addText(statusCard, "Versi runtime: memeriksa…", 11, MUTED, false);
        homeWhatsAppStatus = addText(activeSection, "WhatsApp • memeriksa status…", 14, WHITE, true);

        addText(activeSection, "Urutan mudah: 1) Nyalakan server  2) Hubungkan WhatsApp  3) Atur AI atau balasan.", 12, MUTED, false);

        activeSection = whatsappSection;
        addText(activeSection, "WHATSAPP", 27, WHITE, true);
        addText(activeSection, "Hubungkan akun WhatsApp kamu dan uji pesan di sini.", 13, MUTED, false);
        LinearLayout connectCard = addCard("STATUS & PAIRING");
        whatsappStatus = addText(connectCard, "WhatsApp: belum diperiksa", 15, WHITE, true);
        pairingInfo = addText(connectCard, "Kode pairing akan muncul setelah kamu meminta pairing.", 13, MUTED, false);
        addText(connectCard, "Masukkan nomor dalam format internasional tanpa tanda +. Contoh Indonesia: 6281234567890.", 13, MUTED, false);
        phoneInput = addInput(connectCard, "Nomor WhatsApp (contoh 62812…)", false);
        phoneInput.setInputType(3);
        addButton(connectCard, "MINTA KODE PAIRING", ACCENT, this::startWhatsApp);
        addText(connectCard, "Di WhatsApp, buka Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon, lalu masukkan kode yang tampil.", 12, MUTED, false);
        addButton(connectCard, "HENTIKAN KONEKSI (SESI TETAP DISIMPAN)", 0xFF34425C, this::stopWhatsApp);

        LinearLayout sendCard = addCard("KIRIM PESAN");
        recipientInput = addInput(sendCard, "Nomor tujuan (contoh 62812…)", false);
        recipientInput.setInputType(3);
        messageInput = addInput(sendCard, "Tulis pesan yang akan dikirim", true);
        addButton(sendCard, "KIRIM PESAN", GREEN, this::sendMessage);

        activeSection = automationSection;
        addText(activeSection, "OTOMASI", 27, WHITE, true);
        addText(activeSection, "Mulai dari satu balasan sederhana, lalu pakai Automation Pro jika perlu.", 13, MUTED, false);
        LinearLayout botCard = addCard("AUTO-REPLY SEDERHANA");
        addText(botCard, "Aktifkan balasan otomatis untuk pesan masuk. Kata kunci kosong berarti semua pesan teks akan dibalas; gunakan dengan hati-hati.", 13, MUTED, false);
        autoReplyEnabled = new CheckBox(this);
        autoReplyEnabled.setText("Aktifkan auto-reply");
        autoReplyEnabled.setTextColor(WHITE);
        autoReplyEnabled.setButtonTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        LinearLayout.LayoutParams checkParams = new LinearLayout.LayoutParams(-1, -2);
        checkParams.bottomMargin = dp(8);
        botCard.addView(autoReplyEnabled, checkParams);
        triggerInput = addInput(botCard, "Kata kunci (boleh kosong untuk semua pesan)", false);
        replyInput = addInput(botCard, "Balasan otomatis", true);
        addButton(botCard, "SIMPAN ATURAN AUTO-REPLY", ACCENT, this::saveAutoReply);

        LinearLayout automationCard = addCard("AUTOMATION PRO • MULTI-RULE");
        addText(automationCard, "Buat banyak aturan balasan, batasi frekuensi, atur jam aktif, abaikan grup, dan whitelist/blacklist nomor. Format aturan per baris: contains: harga, produk => Balasan untuk harga/produk. Mode tersedia: contains, exact, startsWith.", 13, MUTED, false);
        automationRulesEnabled = addCheckBox(automationCard, "Aktifkan multi-rule automation");
        automationIgnoreGroups = addCheckBox(automationCard, "Abaikan pesan dari grup (disarankan)");
        automationHoursEnabled = addCheckBox(automationCard, "Batasi otomatisasi ke jam aktif");
        automationCooldownInput = addInput(automationCard, "Cooldown per chat dalam detik (default 10)", false);
        automationCooldownInput.setInputType(2);
        automationMaxRepliesInput = addInput(automationCard, "Maksimum balasan bot per menit (1–60)", false);
        automationMaxRepliesInput.setInputType(2);
        automationStartInput = addInput(automationCard, "Jam mulai format 24 jam, contoh 08:00", false);
        automationEndInput = addInput(automationCard, "Jam selesai format 24 jam, contoh 21:00", false);
        automationAllowlistInput = addInput(automationCard, "Whitelist nomor/JID (opsional, pisahkan koma/baris baru)", true);
        automationBlocklistInput = addInput(automationCard, "Blacklist nomor/JID (opsional, pisahkan koma/baris baru)", true);
        automationRulesInput = addInput(automationCard, "Aturan per baris: contains: halo => Halo!
exact: harga => Silakan sebut produk.\\nstartsWith: order => Kirim nomor pesanan.", true);
        addButton(automationCard, "SIMPAN AUTOMATION PRO", ACCENT, this::saveAutomation);
        automationStats = addText(automationCard, "Statistik otomatisasi: memuat…", 12, MUTED, false);
        addButton(automationCard, "JEDA SEMUA BALASAN OTOMATIS", 0xFF34425C, this::pauseAutomation);
        addButton(automationCard, "LANJUTKAN BALASAN OTOMATIS", GREEN, this::resumeAutomation);
        addButton(automationCard, "RESET STATISTIK AUTOMATION", 0xFF34425C, this::resetAutomationStats);

        activeSection = aiSection;
        addText(activeSection, "AI STUDIO", 27, WHITE, true);
        addText(activeSection, "Pilih penyedia AI, simpan kunci, lalu uji jawaban sebelum mengaktifkan balasan AI.", 13, MUTED, false);
        addButton(activeSection, "BUKA PENGATURAN AI", ACCENT, () -> startActivity(new Intent(this, AISettingsActivity.class)));
        LinearLayout infoCard = addCard("TENTANG RUNTIME");
        addText(infoCard, "Server Node.js, mesin WhatsApp, dan dependensinya disertakan dalam APK. SKYWA menyiapkan runtime di penyimpanan privat aplikasi dan mengelolanya lewat layanan latar depan Android. Tidak perlu browser, Termux, atau menjalankan perintah secara manual.", 13, MUTED, false);
        addText(infoCard, "Endpoint internal: 127.0.0.1:3000 • hanya untuk komunikasi aplikasi lokal.", 12, MUTED, false);

        actionStatus = addText(appRoot, "Menyiapkan SKYWA…", 12, MUTED, false);
        actionStatus.setPadding(dp(12), dp(9), dp(12), dp(9));
        actionStatus.setBackground(rounded(PANEL, BORDER, 12));
        appRoot.removeView(actionStatus);
        appRoot.addView(actionStatus, 1, new LinearLayout.LayoutParams(-1, -2));

        showTab("home");
        updateServerButton();
        ensureRuntimeService();
        refreshStatus();
    }

    @Override protected void onResume() {
        super.onResume();
        handler.removeCallbacks(periodicRefresh);
        handler.post(periodicRefresh);
    }

    @Override protected void onPause() {
        handler.removeCallbacks(periodicRefresh);
        super.onPause();
    }

    private LinearLayout createSection() {
        LinearLayout section = new LinearLayout(this);
        section.setOrientation(LinearLayout.VERTICAL);
        section.setPadding(dp(18), dp(18), dp(18), dp(26));
        section.setBackgroundColor(BG);
        section.setVisibility(View.GONE);
        return section;
    }

    private LinearLayout createBottomNavigation() {
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setPadding(dp(8), dp(6), dp(8), dp(8));
        bar.setGravity(Gravity.CENTER);
        bar.setBackground(rounded(PANEL, BORDER, 18));
        String[] labels = {"⌂\nBeranda", "◉\nWhatsApp", "↻\nOtomasi", "✦\nAI"};
        String[] keys = {"home", "whatsapp", "automation", "ai"};
        for (int i = 0; i < labels.length; i++) {
            final String key = keys[i];
            Button button = new Button(this);
            button.setText(labels[i]);
            button.setTextSize(11);
            button.setAllCaps(false);
            button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            button.setMinHeight(dp(52));
            button.setPadding(dp(2), dp(2), dp(2), dp(2));
            button.setOnClickListener(v -> showTab(key));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(54), 1f);
            params.setMargins(dp(2), 0, dp(2), 0);
            bar.addView(button, params);
            navigationButtons[i] = button;
        }
        return bar;
    }

    private void showTab(String tab) {
        activeTab = tab;
        if (homeSection != null) homeSection.setVisibility("home".equals(tab) ? View.VISIBLE : View.GONE);
        if (whatsappSection != null) whatsappSection.setVisibility("whatsapp".equals(tab) ? View.VISIBLE : View.GONE);
        if (automationSection != null) automationSection.setVisibility("automation".equals(tab) ? View.VISIBLE : View.GONE);
        if (aiSection != null) aiSection.setVisibility("ai".equals(tab) ? View.VISIBLE : View.GONE);
        int active = "home".equals(tab) ? 0 : "whatsapp".equals(tab) ? 1 : "automation".equals(tab) ? 2 : 3;
        for (int i = 0; i < navigationButtons.length; i++) {
            Button button = navigationButtons[i];
            if (button == null) continue;
            button.setTextColor(i == active ? WHITE : MUTED);
            button.setBackground(rounded(i == active ? ACCENT : PANEL, i == active ? ACCENT : PANEL, 13));
        }
        if (page != null) page.requestLayout();
    }

    private void toggleEmbeddedServer() {
        if (!serverTransition.isEmpty()) return;
        if (runtimeOnline) stopEmbeddedServer();
        else startEmbeddedServer();
    }

    private void startEmbeddedServer() {
        if (!serverTransition.isEmpty() || runtimeOnline) return;
        preferences.edit().putBoolean(PREF_SERVER_ENABLED, true).apply();
        serverTransition = "starting";
        runtimeOnline = false;
        updateServerButton();
        backendStatus.setText("SERVER SEDANG DINYALAKAN…");
        backendStatus.setTextColor(ACCENT);
        controllerStatus.setText("Menyiapkan runtime lokal. Biasanya perlu beberapa detik.");
        actionStatus.setText("Menyalakan server lokal…");
        actionStatus.setTextColor(MUTED);
        startRuntimeService();
        handler.postDelayed(() -> {
            if ("starting".equals(serverTransition) && !runtimeOnline) {
                serverTransition = "";
                updateServerButton();
                actionStatus.setText("Server belum merespons. Tekan Periksa Status atau buka ulang aplikasi untuk diagnosis.");
                actionStatus.setTextColor(RED);
                refreshStatus();
            }
        }, 15000);
    }

    private void stopEmbeddedServer() {
        if (!serverTransition.isEmpty()) return;
        preferences.edit().putBoolean(PREF_SERVER_ENABLED, false).apply();
        serverTransition = "stopping";
        updateServerButton();
        backendStatus.setText("SERVER SEDANG DIMATIKAN…");
        backendStatus.setTextColor(MUTED);
        controllerStatus.setText("Menghentikan runtime lokal; sesi dan pengaturan disimpan.");
        actionStatus.setText("Mematikan server lokal…");
        actionStatus.setTextColor(MUTED);
        try {
            Intent intent = new Intent(this, NodeService.class);
            intent.setAction(NodeService.ACTION_STOP_RUNTIME);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent);
            else startService(intent);
        } catch (RuntimeException error) {
            serverTransition = "";
            actionStatus.setText("Tidak dapat meminta server berhenti: " + safeMessage(error));
            actionStatus.setTextColor(RED);
            updateServerButton();
            return;
        }
        handler.postDelayed(() -> {
            serverTransition = "";
            refreshStatus();
            updateServerButton();
            actionStatus.setText("Server lokal dimatikan. Tekan Nyalakan Server untuk mengaktifkannya lagi.");
            actionStatus.setTextColor(MUTED);
        }, 1800);
    }

    private void updateServerButton() {
        if (serverToggleButton == null) return;
        if ("starting".equals(serverTransition)) {
            serverToggleButton.setText("MENYIAPKAN SERVER…");
            serverToggleButton.setEnabled(false);
            serverToggleButton.setBackground(rounded(0xFF34425C, 0xFF34425C, 11));
        } else if ("stopping".equals(serverTransition)) {
            serverToggleButton.setText("MEMATIKAN SERVER…");
            serverToggleButton.setEnabled(false);
            serverToggleButton.setBackground(rounded(0xFF34425C, 0xFF34425C, 11));
        } else if (runtimeOnline) {
            serverToggleButton.setText("MATIKAN SERVER");
            serverToggleButton.setEnabled(true);
            serverToggleButton.setBackground(rounded(0xFFB64252, 0xFFB64252, 11));
        } else {
            serverToggleButton.setText("NYALAKAN SERVER");
            serverToggleButton.setEnabled(true);
            serverToggleButton.setBackground(rounded(ACCENT, ACCENT, 11));
        }
    }

    private void startRuntimeService() {
        try {
            Intent intent = new Intent(this, NodeService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent);
            else startService(intent);
        } catch (RuntimeException error) {
            serverTransition = "";
            updateServerButton();
            if (actionStatus != null) {
                actionStatus.setText("Tidak dapat memulai runtime: " + safeMessage(error));
                actionStatus.setTextColor(RED);
            }
        }
    }

    private void ensureRuntimeService() {
        boolean wanted = preferences == null || preferences.getBoolean(PREF_SERVER_ENABLED, true);
        if (!wanted) {
            runtimeOnline = false;
            updateServerButton();
            backendStatus.setText("SERVER MATI");
            backendStatus.setTextColor(MUTED);
            controllerStatus.setText("Server dimatikan dari aplikasi. Tekan Nyalakan Server bila diperlukan.");
            return;
        }
        startRuntimeService();
    }

    private LinearLayout addCard(String title) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(15), dp(15), dp(15), dp(15));
        card.setBackground(rounded(PANEL, BORDER, 16));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.bottomMargin = dp(14);
        activeSection.addView(card, params);
        TextView heading = addText(card, title, 15, WHITE, true);
        heading.setLetterSpacing(0.025f);
        heading.setPadding(0, 0, 0, dp(5));
        return card;
    }

    private LinearLayout addCollapsibleCard(String title, boolean expanded) {
        LinearLayout card = addCard(title);
        TextView heading = (TextView) card.getChildAt(0);
        heading.setText(title + (expanded ? "   ▾" : "   ▸"));
        heading.setPadding(0, dp(2), 0, dp(10));
        heading.setMinHeight(dp(32));
        heading.setGravity(Gravity.CENTER_VERTICAL);
        heading.setFocusable(true);
        heading.setClickable(true);
        heading.setOnClickListener(view -> {
            boolean nextExpanded = Boolean.TRUE.equals(card.getTag()) ? false : true;
            card.setTag(nextExpanded);
            heading.setText(title + (nextExpanded ? "   ▾" : "   ▸"));
            for (int i = 1; i < card.getChildCount(); i++) {
                card.getChildAt(i).setVisibility(nextExpanded ? View.VISIBLE : View.GONE);
            }
        });
        card.setTag(expanded);
        card.post(() -> {
            for (int i = 1; i < card.getChildCount(); i++) {
                card.getChildAt(i).setVisibility(expanded ? View.VISIBLE : View.GONE);
            }
        });
        return card;
    }

    private TextView addText(LinearLayout parent, String text, int sizeSp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        view.setLineSpacing(dp(2), 1.0f);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.bottomMargin = dp(8);
        parent.addView(view, params);
        return view;
    }

    private EditText addInput(LinearLayout parent, String hint, boolean multiline) {
        EditText field = new EditText(this);
        field.setTextColor(WHITE);
        field.setHintTextColor(MUTED);
        field.setTextSize(14);
        field.setHint(hint);
        field.setSingleLine(!multiline);
        if (multiline) {
            field.setMinLines(3);
            field.setGravity(Gravity.TOP | Gravity.START);
        }
        field.setPadding(dp(12), dp(11), dp(12), dp(11));
        field.setBackground(rounded(PANEL_DARK, BORDER, 11));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.bottomMargin = dp(10);
        parent.addView(field, params);
        return field;
    }

    private CheckBox addCheckBox(LinearLayout parent, String label) {
        CheckBox checkBox = new CheckBox(this);
        checkBox.setText(label);
        checkBox.setTextColor(WHITE);
        checkBox.setButtonTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.bottomMargin = dp(8);
        parent.addView(checkBox, params);
        return checkBox;
    }

    private Button addButton(LinearLayout parent, String label, int color, Runnable action) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(WHITE);
        button.setTextSize(12);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setAllCaps(false);
        button.setPadding(dp(12), dp(6), dp(12), dp(6));
        button.setBackground(rounded(color, color, 11));
        button.setOnClickListener(view -> action.run());
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.bottomMargin = dp(9);
        parent.addView(button, params);
        return button;
    }

    private void addGap(LinearLayout parent, int height) {
        View gap = new View(this);
        parent.addView(gap, new LinearLayout.LayoutParams(1, dp(height)));
    }

    private GradientDrawable rounded(int color, int stroke, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private String digits(String value) {
        return value == null ? "" : value.replaceAll("[^0-9]", "");
    }

    private void startWhatsApp() {
        if (!runtimeOnline) {
            actionStatus.setText("Nyalakan Server lokal dulu dari tab Beranda.");
            actionStatus.setTextColor(RED);
            showTab("home");
            return;
        }
        String phone = digits(phoneInput.getText().toString());
        if (phone.length() < 10 || phone.length() > 15) {
            actionStatus.setText("Masukkan nomor internasional yang valid, misalnya 6281234567890.");
            actionStatus.setTextColor(RED);
            return;
        }
        JSONObject body = new JSONObject();
        try {
            body.put("usePairingCode", true);
            body.put("phoneNumber", phone);
        } catch (JSONException error) {
            actionStatus.setText("Tidak dapat menyiapkan permintaan pairing.");
            return;
        }
        actionStatus.setTextColor(MUTED);
        performAction("POST", "/api/whatsapp/start", body, "Meminta kode pairing");
    }

    private void stopWhatsApp() {
        performAction("POST", "/api/whatsapp/stop", new JSONObject(), "Menghentikan koneksi");
    }

    private void sendMessage() {
        if (!runtimeOnline) {
            actionStatus.setText("Nyalakan Server lokal dulu dari tab Beranda.");
            actionStatus.setTextColor(RED);
            showTab("home");
            return;
        }
        String number = digits(recipientInput.getText().toString());
        String text = messageInput.getText().toString().trim();
        if (number.length() < 8 || number.length() > 15 || text.isEmpty()) {
            actionStatus.setText("Isi nomor tujuan internasional dan teks pesan terlebih dahulu.");
            actionStatus.setTextColor(RED);
            return;
        }
        JSONObject body = new JSONObject();
        try {
            body.put("jid", number + "@s.whatsapp.net");
            body.put("text", text);
        } catch (JSONException error) {
            actionStatus.setText("Tidak dapat menyiapkan pesan.");
            return;
        }
        performAction("POST", "/api/message/send", body, "Mengirim pesan");
    }

    private void saveAutoReply() {
        if (!runtimeOnline) {
            actionStatus.setText("Nyalakan Server lokal dulu dari tab Beranda.");
            actionStatus.setTextColor(RED);
            showTab("home");
            return;
        }
        boolean enabled = autoReplyEnabled.isChecked();
        String trigger = triggerInput.getText().toString().trim();
        String reply = replyInput.getText().toString().trim();
        if (enabled && reply.isEmpty()) {
            actionStatus.setText("Isi teks balasan atau nonaktifkan auto-reply.");
            actionStatus.setTextColor(RED);
            return;
        }
        JSONObject body = new JSONObject();
        try {
            body.put("enabled", enabled);
            body.put("trigger", trigger);
            body.put("reply", reply);
        } catch (JSONException error) {
            actionStatus.setText("Tidak dapat menyiapkan aturan.");
            return;
        }
        performAction("POST", "/api/bot/config", body, "Menyimpan aturan auto-reply");
    }

    private org.json.JSONArray parseList(String raw) {
        org.json.JSONArray result = new org.json.JSONArray();
        java.util.LinkedHashSet<String> values = new java.util.LinkedHashSet<>();
        if (raw != null) {
            for (String part : raw.split("[,;\\n\\r]+")) {
                String value = part.trim();
                if (!value.isEmpty()) values.add(value);
            }
        }
        for (String value : values) result.put(value);
        return result;
    }

    private org.json.JSONArray parseAutomationRules(String raw) throws JSONException {
        org.json.JSONArray rules = new org.json.JSONArray();
        if (raw == null || raw.trim().isEmpty()) return rules;
        int index = 0;
        for (String line : raw.split("\\r?\\n")) {
            String value = line.trim();
            if (value.isEmpty() || value.startsWith("#")) continue;
            int separator = value.indexOf("=>");
            if (separator <= 0 || separator + 2 >= value.length()) {
                throw new IllegalArgumentException("Format aturan salah. Gunakan: contains: kata kunci => balasan");
            }
            String matcher = value.substring(0, separator).trim();
            String reply = value.substring(separator + 2).trim();
            String matchType = "contains";
            int colon = matcher.indexOf(':');
            if (colon > 0) {
                String mode = matcher.substring(0, colon).trim();
                if ("contains".equalsIgnoreCase(mode) || "exact".equalsIgnoreCase(mode) || "startsWith".equalsIgnoreCase(mode)) {
                    matchType = "startsWith".equalsIgnoreCase(mode) ? "startsWith" : mode.toLowerCase(java.util.Locale.ROOT);
                    matcher = matcher.substring(colon + 1).trim();
                }
            }
            org.json.JSONArray keywords = parseList(matcher);
            if (keywords.length() == 0 || reply.isEmpty()) {
                throw new IllegalArgumentException("Setiap aturan perlu kata kunci dan balasan.");
            }
            JSONObject rule = new JSONObject();
            rule.put("id", "rule-" + (++index));
            rule.put("enabled", true);
            rule.put("matchType", matchType);
            rule.put("keywords", keywords);
            rule.put("reply", reply);
            rules.put(rule);
            if (index >= 30) break;
        }
        return rules;
    }

    private String rulesToText(org.json.JSONArray rules) {
        if (rules == null) return "";
        StringBuilder output = new StringBuilder();
        for (int i = 0; i < rules.length(); i++) {
            JSONObject rule = rules.optJSONObject(i);
            if (rule == null) continue;
            if (i > 0) output.append('\n');
            String mode = rule.optString("matchType", "contains");
            output.append(mode).append(": ");
            org.json.JSONArray keywords = rule.optJSONArray("keywords");
            if (keywords != null) {
                for (int k = 0; k < keywords.length(); k++) {
                    if (k > 0) output.append(", ");
                    output.append(keywords.optString(k, ""));
                }
            }
            output.append(" => ").append(rule.optString("reply", ""));
        }
        return output.toString();
    }

    private String jsonArrayToLines(org.json.JSONArray values) {
        if (values == null) return "";
        StringBuilder output = new StringBuilder();
        for (int i = 0; i < values.length(); i++) {
            if (i > 0) output.append('\n');
            output.append(values.optString(i, ""));
        }
        return output.toString();
    }

    private void saveAutomation() {
        if (!runtimeOnline) {
            actionStatus.setText("Nyalakan Server lokal dulu dari tab Beranda.");
            actionStatus.setTextColor(RED);
            showTab("home");
            return;
        }
        try {
            int cooldown = Integer.parseInt(automationCooldownInput.getText().toString().trim());
            int maxReplies = Integer.parseInt(automationMaxRepliesInput.getText().toString().trim());
            if (cooldown < 0 || cooldown > 3600) throw new IllegalArgumentException("Cooldown harus 0–3600 detik.");
            if (maxReplies < 1 || maxReplies > 60) throw new IllegalArgumentException("Batas balasan harus 1–60 per menit.");
            JSONObject body = new JSONObject();
            body.put("rulesEnabled", automationRulesEnabled.isChecked());
            body.put("ignoreGroups", automationIgnoreGroups.isChecked());
            body.put("activeHoursEnabled", automationHoursEnabled.isChecked());
            body.put("cooldownSeconds", cooldown);
            body.put("maxRepliesPerMinute", maxReplies);
            body.put("activeStart", automationStartInput.getText().toString().trim());
            body.put("activeEnd", automationEndInput.getText().toString().trim());
            body.put("allowlist", parseList(automationAllowlistInput.getText().toString()));
            body.put("blocklist", parseList(automationBlocklistInput.getText().toString()));
            body.put("rules", parseAutomationRules(automationRulesInput.getText().toString()));
            performAction("POST", "/api/automation/config", body, "Menyimpan Automation Pro");
        } catch (NumberFormatException error) {
            actionStatus.setText("Isi cooldown dan batas balasan dengan angka.");
            actionStatus.setTextColor(RED);
        } catch (Exception error) {
            actionStatus.setText("Aturan belum valid: " + safeMessage(error));
            actionStatus.setTextColor(RED);
        }
    }

    private void pauseAutomation() {
        performAction("POST", "/api/automation/pause", new JSONObject(), "Menjeda otomatisasi");
    }

    private void resumeAutomation() {
        performAction("POST", "/api/automation/resume", new JSONObject(), "Melanjutkan otomatisasi");
    }

    private void resetAutomationStats() {
        performAction("POST", "/api/automation/stats/reset", new JSONObject(), "Mereset statistik otomatisasi");
    }

    private void performAction(String method, String path, JSONObject body, String label) {
        if (!runtimeOnline) {
            actionStatus.setText("Server lokal sedang mati. Nyalakan dari tab Beranda terlebih dahulu.");
            actionStatus.setTextColor(RED);
            return;
        }
        actionStatus.setText(label + "…");
        actionStatus.setTextColor(MUTED);
        new Thread(() -> {
            try {
                JSONObject result = apiRequest(method, path, body);
                String resultStatus = result.optString("status", "OK");
                String detail = result.optString("error", "");
                runOnUiThread(() -> {
                    actionStatus.setText(label + ": " + resultStatus + (detail.isEmpty() ? "" : " — " + detail));
                    actionStatus.setTextColor("failed".equalsIgnoreCase(resultStatus) ? RED : GREEN);
                    if ("/api/bot/config".equals(path)) botConfigLoaded = true;
                    if ("/api/automation/config".equals(path) || "/api/automation/pause".equals(path) || "/api/automation/resume".equals(path)) automationConfigLoaded = true;
                    refreshStatus();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    actionStatus.setText("Gagal: " + safeMessage(error));
                    actionStatus.setTextColor(RED);
                    backendStatus.setText("Runtime lokal belum siap di 127.0.0.1:3000.");
                    backendStatus.setTextColor(RED);
                });
            }
        }, "skywa-action").start();
    }

    private void refreshStatus() {
        if (refreshing) return;
        refreshing = true;
        new Thread(() -> {
            JSONObject system = null;
            JSONObject whatsapp = null;
            JSONObject config = null;
            JSONObject advancedConfig = null;
            JSONObject advancedStats = null;
            JSONObject buildInfo = null;
            String systemError = null;
            String whatsappError = null;
            try {
                system = apiRequest("GET", "/api/system/status", null);
            } catch (Exception error) {
                systemError = safeMessage(error);
            }
            if (system != null) {
                try {
                    buildInfo = apiRequest("GET", "/api/build", null);
                } catch (Exception ignored) {
                    buildInfo = null;
                }
                try {
                    whatsapp = apiRequest("GET", "/api/whatsapp/status", null);
                } catch (Exception error) {
                    whatsappError = safeMessage(error);
                }
                if (!botConfigLoaded) {
                    try {
                        config = apiRequest("GET", "/api/bot/config", null);
                    } catch (Exception ignored) {
                        config = null;
                    }
                }
                if (!automationConfigLoaded) {
                    try {
                        advancedConfig = apiRequest("GET", "/api/automation/config", null);
                    } catch (Exception ignored) {
                        advancedConfig = null;
                    }
                }
                try {
                    advancedStats = apiRequest("GET", "/api/automation/stats", null);
                } catch (Exception ignored) {
                    advancedStats = null;
                }
            }
            final JSONObject finalSystem = system;
            final JSONObject finalWhatsapp = whatsapp;
            final JSONObject finalConfig = config;
            final JSONObject finalAdvancedConfig = advancedConfig;
            final JSONObject finalAdvancedStats = advancedStats;
            final JSONObject finalBuildInfo = buildInfo;
            final String finalSystemError = systemError;
            final String finalWhatsappError = whatsappError;
            runOnUiThread(() -> {
                try {
                    if (finalSystem == null) {
                        runtimeOnline = false;
                        boolean wanted = preferences.getBoolean(PREF_SERVER_ENABLED, true);
                        backendStatus.setText(wanted ? "SERVER BELUM MERESPONS" : "SERVER MATI");
                        backendStatus.setTextColor(wanted ? RED : MUTED);
                        controllerStatus.setText(wanted
                                ? "Server belum siap atau gagal dimulai. Tunggu sebentar lalu tekan Periksa Status."
                                : "Server dimatikan dari aplikasi. Pengaturan tetap tersimpan.");
                        homeWhatsAppStatus.setText("WhatsApp • " + (wanted ? "status belum tersedia" : "server mati"));
                        homeWhatsAppStatus.setTextColor(MUTED);
                        if (!wanted && !"stopping".equals(serverTransition)) {
                            pairingInfo.setText("Server sedang mati. Nyalakan server dari tab Beranda untuk memakai fitur WhatsApp dan AI.");
                            whatsappStatus.setText("WhatsApp: server lokal mati");
                        }
                        updateServerButton();
                        if (buildInfoStatus != null) buildInfoStatus.setText("API lokal: " + API_BASE + " • tidak terhubung");
                    } else {
                        runtimeOnline = true;
                        if ("starting".equals(serverTransition)) serverTransition = "";
                        backendStatus.setText("SERVER AKTIF");
                        backendStatus.setTextColor(GREEN);
                        controllerStatus.setText("API aktif • database " + finalSystem.optString("database", "unknown")
                                + " • WhatsApp " + finalSystem.optString("whatsapp_state", "unknown"));
                        if (finalBuildInfo != null && buildInfoStatus != null) {
                            buildInfoStatus.setText("Versi " + finalBuildInfo.optString("appVersion", "unknown")
                                + " • runtime Node " + finalBuildInfo.optString("nodeVersion", "unknown"));
                        }
                        updateServerButton();
                        if (finalWhatsapp == null) {
                            whatsappStatus.setText("WhatsApp: status belum dapat dibaca. Tekan Periksa Status lagi.");
                            whatsappStatus.setTextColor(RED);
                            homeWhatsAppStatus.setText("WhatsApp • status belum tersedia");
                            homeWhatsAppStatus.setTextColor(MUTED);
                        } else {
                            boolean connected = finalWhatsapp.optBoolean("connected", false);
                            String state = finalWhatsapp.optString("state", "unknown");
                            whatsappStatus.setText("WhatsApp: " + (connected ? "TERHUBUNG" : state));
                            whatsappStatus.setTextColor(connected ? GREEN : WHITE);
                            homeWhatsAppStatus.setText("WhatsApp • " + (connected ? "TERHUBUNG" : "BELUM TERHUBUNG"));
                            homeWhatsAppStatus.setTextColor(connected ? GREEN : MUTED);
                            String code = finalWhatsapp.optString("pairing", "");
                            String qr = finalWhatsapp.optString("qr", "");
                            if (!code.isEmpty()) {
                                pairingInfo.setText("KODE PAIRING: " + code + "\nMasukkan kode tersebut di WhatsApp pada menu Perangkat tertaut.");
                                pairingInfo.setTextColor(GREEN);
                            } else if (!qr.isEmpty()) {
                                pairingInfo.setText("QR pairing tersedia di backend. Untuk kode yang mudah dipakai di ponsel ini, masukkan nomor di atas lalu pilih Minta Kode Pairing.");
                                pairingInfo.setTextColor(MUTED);
                            } else if (connected) {
                                pairingInfo.setText("Perangkat WhatsApp sudah terhubung.");
                                pairingInfo.setTextColor(GREEN);
                            } else {
                                pairingInfo.setText("Belum ada kode pairing aktif. Masukkan nomor, lalu pilih Minta Kode Pairing.");
                                pairingInfo.setTextColor(MUTED);
                            }
                        }
                        if (finalConfig != null && !botConfigLoaded) {
                            autoReplyEnabled.setChecked(finalConfig.optBoolean("enabled", false));
                            triggerInput.setText(finalConfig.optString("trigger", ""));
                            replyInput.setText(finalConfig.optString("reply", ""));
                            botConfigLoaded = true;
                        }
                        if (finalAdvancedConfig != null && !automationConfigLoaded) {
                            automationRulesEnabled.setChecked(finalAdvancedConfig.optBoolean("rulesEnabled", false));
                            automationIgnoreGroups.setChecked(finalAdvancedConfig.optBoolean("ignoreGroups", true));
                            automationHoursEnabled.setChecked(finalAdvancedConfig.optBoolean("activeHoursEnabled", false));
                            automationCooldownInput.setText(String.valueOf(finalAdvancedConfig.optInt("cooldownSeconds", 10)));
                            automationMaxRepliesInput.setText(String.valueOf(finalAdvancedConfig.optInt("maxRepliesPerMinute", 8)));
                            automationStartInput.setText(finalAdvancedConfig.optString("activeStart", "08:00"));
                            automationEndInput.setText(finalAdvancedConfig.optString("activeEnd", "21:00"));
                            automationAllowlistInput.setText(jsonArrayToLines(finalAdvancedConfig.optJSONArray("allowlist")));
                            automationBlocklistInput.setText(jsonArrayToLines(finalAdvancedConfig.optJSONArray("blocklist")));
                            automationRulesInput.setText(rulesToText(finalAdvancedConfig.optJSONArray("rules")));
                            automationConfigLoaded = true;
                        }
                        if (finalAdvancedStats != null) {
                            automationStats.setText("Pesan teks masuk: " + finalAdvancedStats.optInt("received", 0)
                                + " • Terfilter: " + finalAdvancedStats.optInt("filtered", 0)
                                + "\nBalasan rule: " + finalAdvancedStats.optInt("rulesReplied", 0)
                                + " • Balasan statis: " + finalAdvancedStats.optInt("staticReplied", 0)
                                + "\nBalasan AI: " + finalAdvancedStats.optInt("aiReplied", 0)
                                + " • Gagal: " + finalAdvancedStats.optInt("failures", 0)
                                + "\nBalasan dalam 60 detik: " + finalAdvancedStats.optInt("repliesLastMinute", 0)
                                + (finalAdvancedConfig != null && finalAdvancedConfig.optBoolean("paused", false) ? "\nSTATUS: DIJEDA" : ""));
                        }
                    }
                } finally {
                    refreshing = false;
                }
            });
        }, "skywa-status").start();
    }

    private JSONObject apiRequest(String method, String path, JSONObject body) throws Exception {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(API_BASE + path).openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(4000);
            connection.setReadTimeout(15000);
            connection.setRequestProperty("Accept", "application/json");
            if (body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(payload);
                }
            }
            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 400 ? connection.getInputStream() : connection.getErrorStream();
            String raw = stream == null ? "" : readString(stream);
            if (status < 200 || status >= 300) {
                String detail = "";
                try {
                    JSONObject errorJson = new JSONObject(raw);
                    detail = errorJson.optString("error", errorJson.optString("message", ""));
                } catch (JSONException ignored) {
                    // Express 404 pages are HTML, not machine-readable API errors.
                }
                if (detail.isEmpty()) {
                    if (status == 404 || raw.toLowerCase(java.util.Locale.ROOT).contains("<!doctype html")) {
                        detail = "API runtime tidak cocok atau masih memakai bundle lama. Pasang APK terbaru, lalu Paksa berhenti SKYWA dan buka kembali agar bundle diperbarui.";
                    } else {
                        detail = "Server lokal mengembalikan HTTP " + status + ".";
                    }
                }
                throw new IOException("HTTP " + status + ": " + detail);
            }
            try {
                return raw.isEmpty() ? new JSONObject() : new JSONObject(raw);
            } catch (JSONException parseError) {
                throw new IOException("Respons runtime bukan JSON. Coba Paksa berhenti SKYWA, buka ulang, lalu refresh status.");
            }
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String readString(InputStream input) throws IOException {
        try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = stream.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private String safeMessage(Exception error) {
        String value = error.getMessage();
        return value == null || value.trim().isEmpty() ? error.getClass().getSimpleName() : value;
    }
}
