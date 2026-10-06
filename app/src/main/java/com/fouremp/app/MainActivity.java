package com.fouremp.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

public class MainActivity extends Activity {
    private static final int BG=0xFF0B1016, CARD=0xFF151E28, TEXT=0xFFF1F5F9, MUTED=0xFF92A2B5, LIME=0xFFBEF264, CYAN=0xFF67E8F9;
    private Store store;
    private LinearLayout root, body, nav;
    private int tab=0;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private TextView elapsed;
    private final Runnable ticker=new Runnable() {
        public void run() {
            JSONObject active=store.active();
            if(elapsed!=null && active!=null) elapsed.setText(duration(ScheduleMath.duration(active.optLong("in"),0,System.currentTimeMillis())));
            handler.postDelayed(this,1000);
        }
    };
    @Override public void onCreate(Bundle state) {
        super.onCreate(state); store=new Store(this);
        if(state!=null) tab=state.getInt("tab",0);
        root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(BG);
        root.setOnApplyWindowInsetsListener((v,insets)-> {
            if(Build.VERSION.SDK_INT>=30) {
                android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                v.setPadding(bars.left,bars.top,bars.right,bars.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        setContentView(root); render();
    }
    @Override protected void onResume() { super.onResume(); ReminderScheduler.all(this); render(); handler.post(ticker); }
    @Override protected void onPause() { handler.removeCallbacks(ticker); super.onPause(); }
    @Override protected void onSaveInstanceState(Bundle state) { state.putInt("tab",tab); super.onSaveInstanceState(state); }
    private int dp(int n) { return Math.round(n*getResources().getDisplayMetrics().density); }
    private GradientDrawable shape(int color,int radius) { GradientDrawable d=new GradientDrawable(); d.setColor(color); d.setCornerRadius(dp(radius)); return d; }
    private TextView text(String value,int size,int color,boolean bold) {
        TextView t=new TextView(this); t.setText(value); t.setTextSize(size); t.setTextColor(color);
        if(bold) t.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));
        t.setPadding(0,dp(4),0,dp(4)); return t;
    }
    private LinearLayout column() { LinearLayout l=new LinearLayout(this); l.setOrientation(LinearLayout.VERTICAL); return l; }
    private LinearLayout row() { LinearLayout l=new LinearLayout(this); l.setOrientation(LinearLayout.HORIZONTAL); l.setGravity(Gravity.CENTER_VERTICAL); return l; }
    private void space(LinearLayout l,int height) { View v=new View(this); l.addView(v,new LinearLayout.LayoutParams(1,dp(height))); }
    private LinearLayout card(LinearLayout parent) {
        LinearLayout c=column(); c.setPadding(dp(20),dp(16),dp(20),dp(16)); c.setBackground(shape(CARD,20));
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2); p.bottomMargin=dp(14); parent.addView(c,p); return c;
    }
    private Button button(String title,boolean accent,Runnable action) {
        Button b=new Button(this); b.setText(title); b.setAllCaps(false); b.setTextSize(15); b.setTextColor(accent?BG:TEXT); b.setMinHeight(dp(52));
        b.setBackground(shape(accent?LIME:0xFF233140,14)); b.setPadding(dp(16),dp(8),dp(16),dp(8)); b.setOnClickListener(v->action.run()); return b;
    }
    private void fullButton(LinearLayout l,String title,boolean accent,Runnable action) { l.addView(button(title,accent,action),new LinearLayout.LayoutParams(-1,dp(52))); }
    private String time(int minutes) { return String.format(Locale.getDefault(),"%02d:%02d",minutes/60,minutes%60); }
    private String stamp(long epoch) { return Instant.ofEpochMilli(epoch).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("HH:mm")); }
    private String date(long epoch) { return Instant.ofEpochMilli(epoch).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("EEE, dd MMM")); }
    private String duration(long millis) { long min=millis/60000; return String.format(Locale.getDefault(),"%02dh %02dm",min/60,min%60); }
    private void render() {
        if(root==null) return;
        elapsed=null; root.removeAllViews();
        LinearLayout header=row(); header.setPadding(dp(24),dp(12),dp(24),dp(8));
        header.addView(text("4",30,LIME,true)); header.addView(text("Emp",30,TEXT,true));
        TextView badge=text(" YOUR WORKDAY, IN SYNC",10,MUTED,true); badge.setGravity(Gravity.RIGHT);
        header.addView(badge,new LinearLayout.LayoutParams(0,-2,1)); root.addView(header);
        ScrollView scroll=new ScrollView(this); scroll.setFillViewport(true);
        body=column(); body.setPadding(dp(24),dp(12),dp(24),dp(24)); scroll.addView(body);
        root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        switch(tab) { case 1: schedule(); break; case 2: history(); break; case 3: settings(); break; default: today(); }
        nav=row(); nav.setPadding(dp(10),dp(10),dp(10),dp(10)); nav.setBackgroundColor(CARD);
        String[] labels={"Today","Schedule","History","Settings"};
        for(int i=0;i<labels.length;i++) {
            final int index=i; TextView item=text(labels[i],13,tab==i?LIME:MUTED,tab==i); item.setGravity(Gravity.CENTER); item.setMinHeight(dp(48));
            item.setOnClickListener(v->{ tab=index; render(); }); nav.addView(item,new LinearLayout.LayoutParams(0,-2,1));
        }
        root.addView(nav);
    }
    private void title(String title,String sub) { body.addView(text(title,28,TEXT,true)); body.addView(text(sub,14,MUTED,false)); space(body,20); }
    private void today() {
        title("Make time for you.",LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE, dd MMMM")));
        JSONObject active=store.active();
        LinearLayout hero=card(body); hero.addView(text(active==null?"READY WHEN YOU ARE":"●  ON THE CLOCK",12,LIME,true));
        elapsed=text(active==null?"Let’s get started.":duration(ScheduleMath.duration(active.optLong("in"),0,System.currentTimeMillis())),active==null?27:40,TEXT,true);
        hero.addView(elapsed);
        hero.addView(text(active==null?"A focused day starts with one swipe.":"Swiped in "+date(active.optLong("in"))+" at "+stamp(active.optLong("in")),14,MUTED,false));
        space(hero,16);
        fullButton(hero,active==null?"Swipe in  →":"Swipe out  →",true,()-> {
            if(store.active()!=null) new AlertDialog.Builder(this).setTitle("Finish this shift?").setMessage("Your swipe out time will be recorded now.")
                .setNegativeButton("Keep working",null).setPositiveButton("Swipe out",(d,w)->recordSwipe()).show();
            else recordSwipe();
        });
        LinearLayout planned=card(body); planned.addView(text("YOUR WORK HOURS",11,MUTED,true));
        LinearLayout times=row();
        List<Store.Reminder> reminders=store.reminders();
        for(int id=1;id<=2;id++) for(Store.Reminder r:reminders) if(r.id==id) {
            LinearLayout half=column(); half.addView(text(r.title,13,MUTED,false)); half.addView(text(time(r.time),28,id==1?LIME:CYAN,true));
            half.setContentDescription("Edit "+r.title+" reminder time"); half.setOnClickListener(v->editReminder(r)); times.addView(half,new LinearLayout.LayoutParams(0,-2,1));
        }
        planned.addView(times); planned.addView(text("Tap a time to customize your reminder",12,MUTED,false));
        body.addView(text("Coming up",19,TEXT,true)); space(body,10);
        List<Store.Reminder> upcoming=new ArrayList<>();
        for(Store.Reminder r:reminders) if(r.enabled && store.prefs.getBoolean("notifications",true)) upcoming.add(r);
        upcoming.sort(Comparator.comparingLong(r->ScheduleMath.next(System.currentTimeMillis(),ZoneId.systemDefault(),r.time,r.days)));
        if(upcoming.isEmpty()) body.addView(text("No reminders enabled. Add one in Schedule.",14,MUTED,false));
        for(int i=0;i<Math.min(3,upcoming.size());i++) {
            Store.Reminder r=upcoming.get(i); long next=ScheduleMath.next(System.currentTimeMillis(),ZoneId.systemDefault(),r.time,r.days);
            LinearLayout c=card(body); c.addView(text(r.title,17,TEXT,true)); c.addView(text(date(next)+" · "+time(r.time),14,CYAN,false)); c.setOnClickListener(v->editReminder(r));
        }
        if(!getSystemService(NotificationManager.class).areNotificationsEnabled()) {
            fullButton(body,"Enable notifications",false,this::permission);
        }
    }
    private void recordSwipe() {
        boolean closing=store.active()!=null; store.swipe();
        ReminderScheduler.notify(this,900,closing?"Swiped out":"Swiped in",(closing?"Shift completed":"Shift started")+" at "+stamp(System.currentTimeMillis())); render();
    }
    private String days(int bits) {
        if(bits==31) return "Mon–Fri"; if(bits==127) return "Every day";
        String[] names={"Mon","Tue","Wed","Thu","Fri","Sat","Sun"}; List<String> selected=new ArrayList<>();
        for(int i=0;i<7;i++) if((bits&(1<<i))!=0) selected.add(names[i]); return String.join(" · ",selected);
    }
    private void schedule() {
        title("Your daily rhythm.","Work, breaks and a little breathing room.");
        for(Store.Reminder r:store.reminders()) {
            LinearLayout c=card(body), line=row(); LinearLayout details=column();
            details.addView(text(r.title,18,TEXT,true)); details.addView(text(time(r.time)+"  ·  "+days(r.days),13,CYAN,false));
            line.addView(details,new LinearLayout.LayoutParams(0,-2,1));
            Switch toggle=new Switch(this); toggle.setContentDescription("Enable "+r.title); toggle.setChecked(r.enabled);
            toggle.setOnCheckedChangeListener((b,checked)-> {
                List<Store.Reminder> all=store.reminders(); for(Store.Reminder item:all) if(item.id==r.id) item.enabled=checked;
                store.saveReminders(all); ReminderScheduler.all(this);
            }); line.addView(toggle); c.addView(line);
            c.addView(text(r.message,13,MUTED,false)); space(c,10); fullButton(c,"Edit reminder",false,()->editReminder(r));
        }
        fullButton(body,"+  Add a break or reminder",true,()->editReminder(new Store.Reminder(store.newId(),"","",840,31,true)));
    }
    private void pickTime(int minute, java.util.function.IntConsumer result) {
        new TimePickerDialog(this,(v,h,m)->result.accept(h*60+m),minute/60,minute%60,true).show();
    }
    private EditText input(LinearLayout l,String hint,String value) {
        EditText e=new EditText(this); e.setHint(hint); e.setText(value); e.setTextColor(TEXT); e.setHintTextColor(MUTED); e.setTextSize(16); e.setSingleLine(true); l.addView(e); return e;
    }
    private void editReminder(Store.Reminder original) {
        // Always reload: toggle changes may have happened since the card was rendered.
        Store.Reminder r=original; boolean exists=false;
        for(Store.Reminder saved:store.reminders()) if(saved.id==original.id) { r=saved; exists=true; break; }
        final Store.Reminder current=r; final boolean editing=exists;
        LinearLayout form=column(); form.setPadding(dp(24),dp(8),dp(24),dp(12));
        EditText name=input(form,"Reminder name",r.title), message=input(form,"Notification message",r.message);
        final int[] chosen={r.time,r.days};
        Button timeButton=button("Time: "+time(chosen[0]),false,()->{});
        timeButton.setOnClickListener(v->pickTime(chosen[0],m->{chosen[0]=m; timeButton.setText("Time: "+time(m));}));
        space(form,12); form.addView(timeButton); space(form,12);
        Button dayButton=button(days(chosen[1]),false,()->{});
        dayButton.setOnClickListener(v-> {
            boolean[] checked=new boolean[7]; for(int i=0;i<7;i++) checked[i]=(chosen[1]&(1<<i))!=0;
            new AlertDialog.Builder(this).setTitle("Repeat on").setMultiChoiceItems(new String[]{"Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"},checked,(d,w,c)->checked[w]=c)
                .setPositiveButton("Done",(d,w)-> { int mask=0; for(int i=0;i<7;i++) if(checked[i]) mask|=1<<i; chosen[1]=mask; dayButton.setText(mask==0?"Select at least one day":days(mask)); }).setNegativeButton("Cancel",null).show();
        }); form.addView(dayButton);
        Switch enabled=new Switch(this); enabled.setText("Reminder enabled"); enabled.setChecked(r.enabled); form.addView(enabled);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle(editing?"Edit reminder":"New reminder").setView(form)
            .setPositiveButton("Save",null).setNegativeButton("Cancel",null)
            .setNeutralButton(editing && r.id>3?"Delete":null,null).create();
        dialog.setOnShowListener(d-> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v-> {
                String title=name.getText().toString().trim(), msg=message.getText().toString().trim();
                if(title.isEmpty()) { name.setError("Enter a name"); return; }
                if(chosen[1]==0) { Toast.makeText(this,"Select at least one repeat day",Toast.LENGTH_SHORT).show(); return; }
                List<Store.Reminder> all=store.reminders(); all.removeIf(item->item.id==current.id);
                all.add(new Store.Reminder(current.id,title,msg.isEmpty()?"Time for "+title.toLowerCase(Locale.getDefault())+".":msg,chosen[0],chosen[1],enabled.isChecked()));
                all.sort(Comparator.comparingInt(item->item.id)); store.saveReminders(all); ReminderScheduler.all(this); dialog.dismiss(); render();
            });
            if(editing && current.id>3) dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v-> {
                List<Store.Reminder> all=store.reminders(); all.removeIf(item->item.id==current.id); store.saveReminders(all); ReminderScheduler.cancel(this,current.id); dialog.dismiss(); render();
            });
        }); dialog.show();
    }
    private void history() {
        title("Every hour counts.","Your swipe history, saved on this device.");
        JSONArray shifts=store.shifts();
        if(shifts.length()==0) { LinearLayout c=card(body); c.addView(text("A fresh start",21,TEXT,true)); c.addView(text("Swipe in on Today to start your first shift.",15,MUTED,false)); return; }
        for(int i=shifts.length()-1;i>=0;i--) {
            final int index=i; JSONObject shift=shifts.optJSONObject(i); long in=shift.optLong("in"), out=shift.optLong("out");
            LinearLayout c=card(body); c.addView(text(date(in),18,TEXT,true));
            c.addView(text(stamp(in)+"  →  "+(out==0?"In progress":stamp(out)+(date(in).equals(date(out))?"":" ("+date(out)+")")),15,CYAN,false));
            c.addView(text(duration(ScheduleMath.duration(in,out,System.currentTimeMillis()))+" elapsed",15,LIME,true));
            space(c,8); fullButton(c,"Correct swipe times",false,()->editShift(index,in,out));
        }
    }
    private void editShift(int index,long in,long out) {
        LinearLayout form=column(); form.setPadding(dp(24),dp(8),dp(24),dp(12));
        final long[] selected={in,out};
        form.addView(text("Select the date and time for each swipe.",14,MUTED,false));
        Button a=button("In: "+date(in)+" "+stamp(in),false,()->{}), b=button(out==0?"Out: still working":"Out: "+date(out)+" "+stamp(out),false,()->{});
        a.setOnClickListener(v->pickDateTime(selected[0],t->{selected[0]=t; a.setText("In: "+date(t)+" "+stamp(t));}));
        b.setOnClickListener(v->pickDateTime(selected[1]==0?System.currentTimeMillis():selected[1],t->{selected[1]=t; b.setText("Out: "+date(t)+" "+stamp(t));}));
        form.addView(a); space(form,10); form.addView(b);
        AlertDialog d=new AlertDialog.Builder(this).setTitle("Correct this shift").setView(form).setNegativeButton("Cancel",null).setPositiveButton("Save",null).create();
        d.setOnShowListener(x->d.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v-> {
            // Avoid overlapping shifts after manual corrections.
            JSONArray all=store.shifts();
            long end=selected[1]==0?Long.MAX_VALUE:selected[1];
            for(int i=0;i<all.length();i++) if(i!=index) {
                JSONObject other=all.optJSONObject(i); long otherEnd=other.optLong("out")==0?Long.MAX_VALUE:other.optLong("out");
                if(selected[0]<otherEnd && other.optLong("in")<end) { Toast.makeText(this,"This would overlap another shift",Toast.LENGTH_LONG).show(); return; }
            }
            try { store.editShift(index,selected[0],selected[1]); d.dismiss(); render(); }
            catch(IllegalArgumentException e) { Toast.makeText(this,e.getMessage(),Toast.LENGTH_LONG).show(); }
        })); d.show();
    }
    private void pickDateTime(long epoch, java.util.function.LongConsumer result) {
        ZonedDateTime z=Instant.ofEpochMilli(epoch).atZone(ZoneId.systemDefault());
        DatePickerDialog d=new DatePickerDialog(this,(v,y,m,day)->pickTime(z.getHour()*60+z.getMinute(),minutes->result.accept(LocalDate.of(y,m+1,day).atTime(minutes/60,minutes%60).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli())),z.getYear(),z.getMonthValue()-1,z.getDayOfMonth());
        d.getDatePicker().setMaxDate(System.currentTimeMillis()); d.show();
    }
    private void preference(LinearLayout l,String title,String key,boolean fallback) {
        Switch s=new Switch(this); s.setText(title); s.setTextColor(TEXT); s.setTextSize(16); s.setPadding(0,dp(12),0,dp(12)); s.setChecked(store.prefs.getBoolean(key,fallback));
        s.setOnCheckedChangeListener((v,checked)->{ store.prefs.edit().putBoolean(key,checked).apply(); ReminderScheduler.all(this); }); l.addView(s);
    }
    private void settings() {
        title("Make it yours.","Small reminders. Set up your way.");
        LinearLayout c=card(body); c.addView(text("NOTIFICATIONS",11,LIME,true));
        preference(c,"All reminders","notifications",true); preference(c,"Play sound","sound",true); preference(c,"Vibrate","vibration",true);
        c.addView(text("Sound and vibration also follow your phone’s notification and Do Not Disturb settings.",12,MUTED,false));
        space(c,12); fullButton(c,"Send a test notification",false,()-> {
            if(!store.prefs.getBoolean("notifications",true)) Toast.makeText(this,"Turn on All reminders first",Toast.LENGTH_SHORT).show();
            else if(!getSystemService(NotificationManager.class).areNotificationsEnabled()) permission();
            else ReminderScheduler.notify(this,999,"You’re all set","4Emp reminders are ready for your workday.");
        });
        space(c,10); fullButton(c,"Phone notification settings",false,()->startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName())));
        LinearLayout precision=card(body); precision.addView(text("REMINDER TIMING",11,CYAN,true));
        precision.addView(text(ReminderScheduler.precise(this)?"Precise reminders enabled":"Flexible reminders enabled",18,TEXT,true));
        precision.addView(text("Allow precise reminders for your chosen times. Otherwise Android may delay alerts to save battery. Force-stopping the app pauses reminders until you open it again.",13,MUTED,false));
        if(Build.VERSION.SDK_INT>=31 && !ReminderScheduler.precise(this)) { space(precision,12); fullButton(precision,"Allow precise reminders",false,()->startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName())))); }
        LinearLayout privacy=card(body); privacy.addView(text("Made for your workday.",18,TEXT,true)); privacy.addView(text("4Emp 1.0 · Android\nAttendance stays on this device. No account needed. Swipe actions are manual records; connect with your employer separately to submit attendance or timesheets. Elapsed time includes breaks.",13,MUTED,false));
    }
    private void permission() {
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},42);
        else startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()));
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results) {
        super.onRequestPermissionsResult(request,permissions,results); render();
    }
}
