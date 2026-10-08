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
    private YearMonth calendarMonth=YearMonth.now();
    private Set<LocalDate> calendarWorked=new HashSet<>();
    private JSONObject calendarMarks=new JSONObject();
    private LocalDate selectedDay=LocalDate.now(), renderedDay=LocalDate.now();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private TextView elapsed, remaining;
    private ProgressRing ring;
    private JSONObject displayedShift;
    private final Runnable ticker=new Runnable() {
        public void run() {
            if(!renderedDay.equals(LocalDate.now())) { ReminderScheduler.all(MainActivity.this); render(); }
            updateTimer();
            handler.postDelayed(this,1000);
        }
    };
    @Override public void onCreate(Bundle state) {
        super.onCreate(state); store=new Store(this);
        if(state!=null) {
            tab=state.getInt("tab",0);
            calendarMonth=YearMonth.parse(state.getString("calendarMonth",YearMonth.now().toString()));
            selectedDay=LocalDate.parse(state.getString("selectedDay",LocalDate.now().toString()));
        }
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
    @Override protected void onSaveInstanceState(Bundle state) { state.putInt("tab",tab); state.putString("calendarMonth",calendarMonth.toString()); state.putString("selectedDay",selectedDay.toString()); super.onSaveInstanceState(state); }
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
        elapsed=null; remaining=null; ring=null; displayedShift=null; renderedDay=LocalDate.now(); root.removeAllViews();
        LinearLayout header=row(); header.setPadding(dp(24),dp(12),dp(24),dp(8));
        header.addView(text("4",30,LIME,true)); header.addView(text("Emp",30,TEXT,true));
        TextView badge=text(" YOUR WORKDAY, IN SYNC",10,MUTED,true); badge.setGravity(Gravity.RIGHT);
        header.addView(badge,new LinearLayout.LayoutParams(0,-2,1)); root.addView(header);
        ScrollView scroll=new ScrollView(this); scroll.setFillViewport(true);
        body=column(); body.setPadding(dp(24),dp(12),dp(24),dp(24)); scroll.addView(body);
        root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        switch(tab) { case 1: schedule(); break; case 2: calendar(); break; case 3: settings(); break; default: today(); }
        nav=row(); nav.setPadding(dp(10),dp(10),dp(10),dp(10)); nav.setBackgroundColor(CARD);
        String[] labels={"Today","Schedule","Calendar","Settings"};
        for(int i=0;i<labels.length;i++) {
            final int index=i; TextView item=text(labels[i],13,tab==i?LIME:MUTED,tab==i); item.setGravity(Gravity.CENTER); item.setMinHeight(dp(48));
            item.setOnClickListener(v->{ tab=index; render(); }); nav.addView(item,new LinearLayout.LayoutParams(0,-2,1));
        }
        root.addView(nav);
    }
    private void title(String title,String sub) { body.addView(text(title,28,TEXT,true)); body.addView(text(sub,14,MUTED,false)); space(body,20); }
    private String hours(int minutes) { return minutes/60+"h"+(minutes%60==0?"":" "+minutes%60+"m"); }
    private String targetStamp(long epoch,long start) { return stamp(epoch)+(date(epoch).equals(date(start))?"":" · "+date(epoch)); }
    private void updateTimer() {
        if(ring==null) return;
        int minutes=displayedShift==null?store.workMinutes():store.shiftMinutes(displayedShift);
        long spent=displayedShift==null?0:ScheduleMath.duration(displayedShift.optLong("in"),displayedShift.optLong("out"),System.currentTimeMillis());
        elapsed.setText(duration(spent)); ring.progress(WorkMath.progress(spent,minutes));
        long left=minutes*60000L-spent;
        remaining.setText(displayedShift!=null && displayedShift.optLong("out")>0?"Shift finished":left<=0?"Work goal reached":duration(left)+" remaining");
    }
    private String guidance() {
        int minutes=store.workMinutes();
        if(minutes>WorkMath.windowMinutes(store.dayStart(),store.dayEnd())) return "Your work goal is longer than your day window. Adjust it in Settings.";
        long[] window=WorkMath.window(System.currentTimeMillis(),ZoneId.systemDefault(),store.dayStart(),store.dayEnd());
        long latest=window[1]-minutes*60000L;
        return "Swipe in by "+targetStamp(latest,System.currentTimeMillis())+" to finish by "+stamp(window[1])+". You can swipe in at any time.";
    }
    private void today() {
        title("Your workday.",LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE, dd MMMM")));
        if(store.silent(LocalDate.now())) {
            LinearLayout leave=card(body); leave.addView(text(store.dayMark(LocalDate.now()).equals("leave")?"On leave today":"Holiday today",26,CYAN,true));
            leave.addView(text("All notifications are paused for today.",14,MUTED,false)); space(leave,16);
            fullButton(leave,"Resume work today",true,()->setDay(LocalDate.now(),"")); return;
        }
        JSONObject active=store.active(); displayedShift=active;
        if(displayedShift==null) {
            JSONArray shifts=store.shifts();
            if(shifts.length()>0) {
                JSONObject last=shifts.optJSONObject(shifts.length()-1);
                if(Instant.ofEpochMilli(last.optLong("out")).atZone(ZoneId.systemDefault()).toLocalDate().equals(LocalDate.now())) displayedShift=last;
            }
        }
        LinearLayout hero=card(body);
        TextView status=text(active!=null?"●  ON THE CLOCK":displayedShift!=null?"SHIFT COMPLETE":"READY WHEN YOU ARE",12,LIME,true);
        status.setGravity(Gravity.CENTER); hero.addView(status);
        FrameLayout timer=new FrameLayout(this); ring=new ProgressRing(this);
        timer.addView(ring,new FrameLayout.LayoutParams(-1,-1));
        LinearLayout center=column(); center.setGravity(Gravity.CENTER);
        elapsed=text("00h 00m",32,TEXT,true); elapsed.setGravity(Gravity.CENTER); center.addView(elapsed);
        int goal=displayedShift==null?store.workMinutes():store.shiftMinutes(displayedShift);
        TextView goalLabel=text(hours(goal)+" work goal",14,CYAN,false); goalLabel.setGravity(Gravity.CENTER); center.addView(goalLabel);
        remaining=text("",12,MUTED,false); remaining.setGravity(Gravity.CENTER); center.addView(remaining);
        timer.addView(center,new FrameLayout.LayoutParams(-1,-1)); hero.addView(timer,new LinearLayout.LayoutParams(-1,dp(250)));
        if(displayedShift!=null) {
            long in=displayedShift.optLong("in"),out=displayedShift.optLong("out");
            LinearLayout times=row();
            LinearLayout start=column(),end=column();
            start.addView(text("Swipe in",12,MUTED,false)); start.addView(text(stamp(in),22,TEXT,true));
            end.addView(text(out>0?"Swipe out":"Expected out",12,MUTED,false));
            end.addView(text(targetStamp(out>0?out:store.target(displayedShift),in),22,CYAN,true));
            times.addView(start,new LinearLayout.LayoutParams(0,-2,1)); times.addView(end,new LinearLayout.LayoutParams(0,-2,1)); hero.addView(times);
            if(active!=null) {
                long[] window=WorkMath.window(in,ZoneId.systemDefault(),store.dayStart(),store.dayEnd());
                if(store.target(active)>window[1]) hero.addView(text("Expected finish is after your day end of "+stamp(window[1])+".",12,MUTED,false));
            }
        } else {
            TextView hint=text(guidance(),13,MUTED,false); hint.setGravity(Gravity.CENTER); hero.addView(hint);
        }
        space(hero,16);
        fullButton(hero,active==null?"Swipe in  →":"Swipe out  →",true,()-> {
            if(store.active()!=null) new AlertDialog.Builder(this).setTitle("Finish this shift?").setMessage("Your swipe out time will be recorded now.")
                .setNegativeButton("Keep working",null).setPositiveButton("Swipe out",(d,w)->recordSwipe()).show();
            else recordSwipe();
        });
        updateTimer();
        TextView leaveAction=text("On leave today",14,MUTED,false); leaveAction.setGravity(Gravity.CENTER); leaveAction.setMinHeight(dp(48));
        leaveAction.setOnClickListener(v->markDay(LocalDate.now(),"leave")); body.addView(leaveAction);
        if(!getSystemService(NotificationManager.class).areNotificationsEnabled()) fullButton(body,"Enable notifications",false,this::permission);
    }
    private void recordSwipe() {
        boolean closing=store.active()!=null; store.swipe(); ReminderScheduler.all(this);
        ReminderScheduler.notify(this,900,closing?"Swiped out":"Swiped in",(closing?"Shift completed":"Shift started")+" at "+stamp(System.currentTimeMillis())); render();
    }
    private String days(int bits) {
        if(bits==31) return "Mon–Fri"; if(bits==127) return "Every day";
        String[] names={"Mon","Tue","Wed","Thu","Fri","Sat","Sun"}; List<String> selected=new ArrayList<>();
        for(int i=0;i<7;i++) if((bits&(1<<i))!=0) selected.add(names[i]); return String.join(" · ",selected);
    }
    private void schedule() {
        title("Schedule.","Your hours. Your reminders.");
        LinearLayout goal=card(body), goalRow=row(); LinearLayout goalText=column();
        goalText.addView(text("Work duration",12,MUTED,false)); goalText.addView(text(hours(store.workMinutes()),23,LIME,true));
        goalRow.addView(goalText,new LinearLayout.LayoutParams(0,-2,1)); goalRow.addView(editIcon("Edit work duration",this::chooseWorkHours)); goal.addView(goalRow);
        goal.addView(text(time(store.dayStart())+" – "+time(store.dayEnd())+" day window",13,MUTED,false));
        for(Store.Reminder r:store.reminders()) {
            LinearLayout c=card(body), line=row(); LinearLayout details=column();
            details.addView(text(r.title,18,TEXT,true)); String timing=r.id==2?(store.active()==null?"Swipe in + "+hours(store.workMinutes()):"Expected "+stamp(store.target(store.active()))+" · "+hours(store.shiftMinutes(store.active()))):r.id==1?(store.workMinutes()>WorkMath.windowMinutes(store.dayStart(),store.dayEnd())?"Adjust day window in Settings":"By "+time(WorkMath.latestMinute(store.dayEnd(),store.workMinutes()))+" · "+days(r.days)):time(r.time)+"  ·  "+days(r.days);
            details.addView(text(timing,13,CYAN,false));
            line.addView(details,new LinearLayout.LayoutParams(0,-2,1));
            Switch toggle=new Switch(this); toggle.setContentDescription("Enable "+r.title); toggle.setChecked(r.enabled);
            toggle.setOnCheckedChangeListener((b,checked)-> {
                List<Store.Reminder> all=store.reminders(); for(Store.Reminder item:all) if(item.id==r.id) item.enabled=checked;
                store.saveReminders(all); ReminderScheduler.all(this);
            }); line.addView(toggle); line.addView(editIcon("Edit "+r.title,()->editReminder(r))); c.addView(line);
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
        space(form,12);
        if(r.id<=2) form.addView(text(r.id==1?"Swipe-in time is calculated from day end minus your work goal. Change these in Settings.":"Notifies when your actual swipe-in time plus your work goal is reached, on any day you work.",14,CYAN,false));
        else form.addView(timeButton);
        space(form,12);
        Button dayButton=button(days(chosen[1]),false,()->{});
        dayButton.setOnClickListener(v-> {
            boolean[] checked=new boolean[7]; for(int i=0;i<7;i++) checked[i]=(chosen[1]&(1<<i))!=0;
            new AlertDialog.Builder(this).setTitle("Repeat on").setMultiChoiceItems(new String[]{"Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"},checked,(d,w,c)->checked[w]=c)
                .setPositiveButton("Done",(d,w)-> { int mask=0; for(int i=0;i<7;i++) if(checked[i]) mask|=1<<i; chosen[1]=mask; dayButton.setText(mask==0?"Select at least one day":days(mask)); }).setNegativeButton("Cancel",null).show();
        }); if(r.id!=2) form.addView(dayButton);
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
    private ImageButton editIcon(String description,Runnable action) {
        ImageButton icon=new ImageButton(this); icon.setImageResource(R.drawable.ic_edit); icon.setContentDescription(description);
        icon.setBackground(shape(0xFF233140,12)); icon.setPadding(dp(12),dp(12),dp(12),dp(12));
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(dp(48),dp(48)); p.leftMargin=dp(10); icon.setLayoutParams(p);
        icon.setOnClickListener(v->action.run()); return icon;
    }
    private int dayColor(LocalDate day) {
        String mark=calendarMarks.optString(day.toString());
        if(mark.equals("leave")) return 0xFFF9A8D4;
        if(mark.equals("holiday")) return CYAN;
        if(calendarWorked.contains(day)) return LIME;
        return store.weekend(day)?0xFFC4B5FD:MUTED;
    }
    private String dayStatus(LocalDate day) {
        List<String> labels=new ArrayList<>(); String mark=calendarMarks.optString(day.toString());
        if(calendarWorked.contains(day)) labels.add("Worked");
        if(mark.equals("leave")) labels.add("Leave");
        if(mark.equals("holiday")) labels.add("Holiday");
        if(store.weekend(day)) labels.add("Weekend");
        return labels.isEmpty()?"No record":String.join(" · ",labels);
    }
    private void calendar() {
        calendarWorked=store.workedDates(calendarMonth); calendarMarks=store.calendarDays();
        title("Calendar.","Your workdays at a glance.");
        LinearLayout c=card(body), heading=row();
        Button previous=button("‹",false,()->{calendarMonth=calendarMonth.minusMonths(1); selectedDay=calendarMonth.atDay(1); render();});
        previous.setContentDescription("Previous month"); heading.addView(previous,new LinearLayout.LayoutParams(dp(48),dp(48)));
        TextView month=text(calendarMonth.format(DateTimeFormatter.ofPattern("MMMM yyyy")),19,TEXT,true); month.setGravity(Gravity.CENTER); heading.addView(month,new LinearLayout.LayoutParams(0,-2,1));
        Button next=button("›",false,()->{calendarMonth=calendarMonth.plusMonths(1); selectedDay=calendarMonth.atDay(1); render();}); next.setContentDescription("Next month"); heading.addView(next,new LinearLayout.LayoutParams(dp(48),dp(48))); c.addView(heading); space(c,12);
        LinearLayout weekdays=row(); for(String name:new String[]{"M","T","W","T","F","S","S"}) { TextView t=text(name,12,MUTED,true); t.setGravity(Gravity.CENTER); weekdays.addView(t,new LinearLayout.LayoutParams(0,dp(32),1)); } c.addView(weekdays);
        int offset=calendarMonth.atDay(1).getDayOfWeek().getValue()-1;
        int cells=((offset+calendarMonth.lengthOfMonth()+6)/7)*7;
        for(int i=0;i<cells;i+=7) {
            LinearLayout week=row();
            for(int j=0;j<7;j++) {
                int day=i+j-offset+1; TextView cell=text("",14,MUTED,false); cell.setGravity(Gravity.CENTER); cell.setMinHeight(dp(48));
                if(day>0 && day<=calendarMonth.lengthOfMonth()) {
                    LocalDate date=calendarMonth.atDay(day); cell.setText(Integer.toString(day)); cell.setTextColor(dayColor(date));
                    if(date.equals(selectedDay)) cell.setBackground(shape(0xFF304152,12));
                    if(date.equals(LocalDate.now())) cell.setTypeface(Typeface.DEFAULT_BOLD);
                    cell.setContentDescription(date+", "+dayStatus(date)); cell.setOnClickListener(v->{selectedDay=date; render();});
                }
                week.addView(cell,new LinearLayout.LayoutParams(0,dp(48),1));
            } c.addView(week);
        }
        LinearLayout legend=row(); String[] labels={"Worked","Leave","Holiday","Weekend"}; int[] colors={LIME,0xFFF9A8D4,CYAN,0xFFC4B5FD};
        for(int i=0;i<labels.length;i++) { TextView label=text("● "+labels[i],11,colors[i],false); label.setGravity(Gravity.CENTER); legend.addView(label,new LinearLayout.LayoutParams(0,-2,1)); } c.addView(legend);
        LinearLayout detail=card(body), detailRow=row(); LinearLayout label=column();
        label.addView(text(selectedDay.format(DateTimeFormatter.ofPattern("EEE, dd MMM yyyy")),18,TEXT,true)); label.addView(text(dayStatus(selectedDay),13,dayColor(selectedDay),false));
        detailRow.addView(label,new LinearLayout.LayoutParams(0,-2,1)); detailRow.addView(editIcon("Set status for "+selectedDay,this::chooseDayStatus)); detail.addView(detailRow);
        JSONArray shifts=store.shifts();
        for(int i=0;i<shifts.length();i++) {
            JSONObject shift=shifts.optJSONObject(i); long in=shift.optLong("in"),out=shift.optLong("out");
            if(!DayMath.worked(selectedDay,in,out,System.currentTimeMillis(),ZoneId.systemDefault())) continue;
            final int index=i; LinearLayout shiftRow=row();
            TextView times=text(date(in)+" · "+stamp(in)+" → "+(out>0?targetStamp(out,in):"Working")+"\n"+duration(ScheduleMath.duration(in,out,System.currentTimeMillis()))+" / "+hours(store.shiftMinutes(shift)),13,MUTED,false);
            shiftRow.addView(times,new LinearLayout.LayoutParams(0,-2,1)); shiftRow.addView(editIcon("Correct swipe times",()->editShift(index,in,out))); detail.addView(shiftRow);
        }
    }
    private void chooseDayStatus() {
        new AlertDialog.Builder(this).setTitle(selectedDay.toString())
            .setItems(new String[]{"Mark worked","Mark leave","Mark holiday","Clear manual status"},(d,which)-> {
                if(which==0 && selectedDay.isAfter(LocalDate.now())) { Toast.makeText(this,"Worked dates must be today or earlier",Toast.LENGTH_SHORT).show(); return; }
                markDay(selectedDay,new String[]{"worked","leave","holiday",""}[which]);
            }).setNegativeButton("Cancel",null).show();
    }
    private void markDay(LocalDate day,String mark) {
        boolean silent=mark.equals("leave") || mark.equals("holiday");
        String message=silent?"All notifications for this date will be paused.":"Update this date’s status? Recorded swipes will be kept.";
        boolean close=silent && day.equals(LocalDate.now()) && store.active()!=null;
        if(close) message="This will record swipe out now, keep your worked time, and pause all notifications for today.";
        final boolean closeShift=close;
        new AlertDialog.Builder(this).setTitle(silent?(mark.equals("leave")?"Mark leave?":"Mark holiday?"):"Update date?").setMessage(message)
            .setNegativeButton("Cancel",null).setPositiveButton(close?"Swipe out and mark":"Confirm",(d,w)->{if(closeShift) store.swipe(); setDay(day,mark);}).show();
    }
    private void setDay(LocalDate day,String mark) {
        store.markDay(day,mark);
        if(day.equals(LocalDate.now()) && store.silent(day)) getSystemService(NotificationManager.class).cancelAll();
        ReminderScheduler.all(this); render();
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
            try { store.editShift(index,selected[0],selected[1]); ReminderScheduler.all(this); d.dismiss(); render(); }
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
        LinearLayout work=card(body); work.addView(text("WORKDAY",11,LIME,true));
        fullButton(work,"Work hours: "+hours(store.workMinutes()),false,this::chooseWorkHours);
        work.addView(text("Set any duration. You can also apply changes to an active shift.",12,MUTED,false));
        space(work,12);
        fullButton(work,"Start of day: "+time(store.dayStart()),false,()->pickTime(store.dayStart(),m->{ store.prefs.edit().putInt("dayStart",m).apply(); ReminderScheduler.all(this); render(); }));
        space(work,10);
        fullButton(work,"End of day: "+time(store.dayEnd()),false,()->pickTime(store.dayEnd(),m->{ store.prefs.edit().putInt("dayEnd",m).apply(); ReminderScheduler.all(this); render(); }));
        work.addView(text(guidance(),13,CYAN,false));
        space(work,10); fullButton(work,"Weekend days",false,this::chooseWeekends);
        work.addView(text("Weekend colors are for the calendar. Reminder repeat days are set in Schedule.",12,MUTED,false));
        LinearLayout c=card(body); c.addView(text("NOTIFICATIONS",11,LIME,true));
        preference(c,"All reminders","notifications",true); preference(c,"Play sound","sound",true); preference(c,"Vibrate","vibration",true);
        c.addView(text("Sound and vibration also follow your phone’s notification and Do Not Disturb settings.",12,MUTED,false));
        space(c,12); fullButton(c,"Send a test notification",false,()-> {
            if(store.silent(LocalDate.now())) Toast.makeText(this,"Notifications are paused today",Toast.LENGTH_SHORT).show();
            else if(!store.prefs.getBoolean("notifications",true)) Toast.makeText(this,"Turn on All reminders first",Toast.LENGTH_SHORT).show();
            else if(!getSystemService(NotificationManager.class).areNotificationsEnabled()) permission();
            else ReminderScheduler.notify(this,999,"You’re all set","4Emp reminders are ready for your workday.");
        });
        space(c,10); fullButton(c,"Phone notification settings",false,()->startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName())));
        LinearLayout precision=card(body); precision.addView(text("REMINDER TIMING",11,CYAN,true));
        precision.addView(text(ReminderScheduler.precise(this)?"Precise reminders enabled":"Flexible reminders enabled",18,TEXT,true));
        precision.addView(text("Allow precise reminders for your chosen times. Otherwise Android may delay alerts to save battery. Force-stopping the app pauses reminders until you open it again.",13,MUTED,false));
        if(Build.VERSION.SDK_INT>=31 && !ReminderScheduler.precise(this)) { space(precision,12); fullButton(precision,"Allow precise reminders",false,()->startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName())))); }
        LinearLayout privacy=card(body); privacy.addView(text("Made for your workday.",18,TEXT,true)); privacy.addView(text("4Emp 1.2 · Android\nAttendance stays on this device. No account needed. Swipe actions are manual records; connect with your employer separately to submit attendance or timesheets. Elapsed time includes breaks.",13,MUTED,false));
    }
    private void chooseWorkHours() {
        LinearLayout form=column(); form.setPadding(dp(24),dp(8),dp(24),dp(16));
        form.addView(text("Hours",13,MUTED,false)); EditText h=input(form,"Hours",Integer.toString(store.workMinutes()/60)); h.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        form.addView(text("Minutes",13,MUTED,false)); EditText m=input(form,"Minutes",Integer.toString(store.workMinutes()%60)); m.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        Switch apply=new Switch(this); apply.setText("Apply to active shift too"); apply.setChecked(false); if(store.active()!=null) form.addView(apply);
        form.addView(text("Choose between 1 minute and 24 hours. Saved for future shifts.",12,MUTED,false));
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Work duration").setView(form).setPositiveButton("Save",null).setNegativeButton("Cancel",null).create();
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v-> {
            try {
                int hour=Integer.parseInt(h.getText().toString()),minute=Integer.parseInt(m.getText().toString());
                if(hour<0 || hour>24 || minute<0 || minute>59 || hour*60+minute<1 || hour*60+minute>1440) throw new IllegalArgumentException();
                store.changeWorkMinutes(hour*60+minute,apply.isChecked()); ReminderScheduler.all(this); dialog.dismiss(); render();
            } catch(IllegalArgumentException invalid) { Toast.makeText(this,"Enter 0–24 hours and 0–59 minutes, totaling 1 minute to 24 hours",Toast.LENGTH_LONG).show(); }
        })); dialog.show();
    }
    private void chooseWeekends() {
        int mask=store.prefs.getInt("weekends",96); boolean[] checked=new boolean[7]; for(int i=0;i<7;i++) checked[i]=(mask&(1<<i))!=0;
        new AlertDialog.Builder(this).setTitle("Weekend days").setMultiChoiceItems(new String[]{"Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"},checked,(d,w,c)->checked[w]=c)
            .setPositiveButton("Save",(d,w)->{int result=0; for(int i=0;i<7;i++) if(checked[i]) result|=1<<i; store.prefs.edit().putInt("weekends",result).apply(); render();})
            .setNegativeButton("Cancel",null).show();
    }
    private void permission() {
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},42);
        else startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()));
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results) {
        super.onRequestPermissionsResult(request,permissions,results); render();
    }
}
