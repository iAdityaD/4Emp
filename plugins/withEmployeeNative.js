const {
  withMainApplication,
  withDangerousMod,
  withAndroidManifest,
} = require("@expo/config-plugins");
const fs = require("fs"),
  path = require("path");
module.exports = function (config) {
  config = withMainApplication(config, (c) => {
    if (
      !c.modResults.contents.includes(
        "packages.add(com.fouremp.app.EmployeeNativePackage())",
      )
    ) {
      const marker = "val packages = PackageList(this).packages";
      if (!c.modResults.contents.includes(marker))
        throw new Error(
          "Employee native registration needs a MainApplication template update",
        );
      c.modResults.contents = c.modResults.contents.replace(
        marker,
        marker +
          "\n            packages.add(com.fouremp.app.EmployeeNativePackage())",
      );
    }
    return c;
  });
  config = withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application[0];
    app.receiver = app.receiver || [];
    if (!app.receiver.some((r) => r.$["android:name"] === ".CutoffReceiver"))
      app.receiver.push({
        $: { "android:name": ".CutoffReceiver", "android:exported": "false" },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
              { $: { "android:name": "android.intent.action.TIME_SET" } },
              {
                $: { "android:name": "android.intent.action.TIMEZONE_CHANGED" },
              },
              {
                $: {
                  "android:name":
                    "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED",
                },
              },
            ],
          },
        ],
      });
    return c;
  });
  return withDangerousMod(config, [
    "android",
    async (c) => {
      const dir = path.join(
        c.modRequest.platformProjectRoot,
        "app/src/main/java/com/fouremp/app",
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, "EmployeeNativePackage.java"),
        `package com.fouremp.app;
import com.facebook.react.*; import com.facebook.react.bridge.*; import com.facebook.react.uimanager.*; import java.util.*;
public class EmployeeNativePackage implements ReactPackage {
 public List<NativeModule> createNativeModules(ReactApplicationContext c){return Arrays.asList(new EmployeeNativeModule(c));}
 public List<ViewManager> createViewManagers(ReactApplicationContext c){return Collections.emptyList();}
}`,
      );
      fs.writeFileSync(
        path.join(dir, "EmployeeNativeModule.java"),
        `package com.fouremp.app;
import android.app.*; import android.content.*; import android.net.Uri; import android.os.Build; import android.provider.Settings; import android.view.WindowManager; import com.facebook.react.bridge.*; import org.json.JSONObject;
public class EmployeeNativeModule extends ReactContextBaseJavaModule {
 EmployeeNativeModule(ReactApplicationContext c){super(c);} public String getName(){return "EmployeeNative";}
 @ReactMethod public void getLegacy(Promise p){try{p.resolve(new JSONObject(getReactApplicationContext().getSharedPreferences("4emp",Context.MODE_PRIVATE).getAll()).toString());}catch(Exception e){p.reject("IMPORT",e);}}
 @ReactMethod public void cancelLegacy(Promise p){Context c=getReactApplicationContext();int count=c.getSharedPreferences("4emp",0).getInt("nextId",100);AlarmManager a=c.getSystemService(AlarmManager.class);for(int i=1;i<=Math.min(count,10000);i++){Intent intent=new Intent().setClassName(c,"com.fouremp.app.ReminderReceiver");PendingIntent existing=PendingIntent.getBroadcast(c,i,intent,PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE);if(existing!=null){a.cancel(existing);existing.cancel();}}p.resolve(null);}
 @ReactMethod public void canExact(Promise p){p.resolve(Build.VERSION.SDK_INT<31 || getReactApplicationContext().getSystemService(AlarmManager.class).canScheduleExactAlarms());}
 @ReactMethod public void requestExact(Promise p){try{if(Build.VERSION.SDK_INT>=31)getReactApplicationContext().startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getReactApplicationContext().getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));p.resolve(null);}catch(Exception e){p.reject("ALARM",e);}}
 @ReactMethod public void syncCutoffs(String json,Promise p){try{CutoffReceiver.sync(getReactApplicationContext(),json);p.resolve(null);}catch(Exception e){p.reject("CUTOFF",e);}}
 @ReactMethod public void protect(boolean enabled){Activity a=getCurrentActivity();if(a!=null)a.runOnUiThread(()->{if(enabled)a.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);else a.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);});}
}`,
      );
      fs.writeFileSync(
        path.join(dir, "CutoffReceiver.java"),
        `package com.fouremp.app;
import android.app.*; import android.content.*; import android.os.Build; import android.database.sqlite.SQLiteDatabase; import org.json.*; import java.io.File; import java.util.concurrent.*;
public class CutoffReceiver extends BroadcastReceiver {
 static PendingIntent pending(Context c,String id){return PendingIntent.getBroadcast(c,id.hashCode(),new Intent(c,CutoffReceiver.class).putExtra("shift",id),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 static void lock(Context c,String id){File file=new File(c.getFilesDir(),"SQLite/employee.db");if(!file.exists())return;SQLiteDatabase d=SQLiteDatabase.openDatabase(file.toString(),null,SQLiteDatabase.OPEN_READWRITE|SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING);try{d.execSQL("PRAGMA busy_timeout=5000");ContentValues values=new ContentValues();values.put("status","NEEDS_REVIEW");d.update("work_shifts",values,"id=? AND status='ACTIVE'",new String[]{id});}finally{d.close();}}
 static void schedule(Context c,String id,long at){if(at<=System.currentTimeMillis()){lock(c,id);return;}AlarmManager a=c.getSystemService(AlarmManager.class);try{if(Build.VERSION.SDK_INT<31||a.canScheduleExactAlarms())a.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending(c,id));else a.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending(c,id));}catch(SecurityException denied){a.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending(c,id));}}
 static void sync(Context c,String json)throws JSONException{SharedPreferences prefs=c.getSharedPreferences("employee-native",0);JSONArray old=new JSONArray(prefs.getString("cutoffs","[]"));AlarmManager a=c.getSystemService(AlarmManager.class);for(int i=0;i<old.length();i++)a.cancel(pending(c,old.getJSONObject(i).getString("id")));prefs.edit().putString("cutoffs",json).apply();JSONArray plans=new JSONArray(json);for(int i=0;i<plans.length();i++){JSONObject p=plans.getJSONObject(i);schedule(c,p.getString("id"),p.getLong("at"));}}
 @Override public void onReceive(Context c,Intent intent){PendingResult result=goAsync();ExecutorService executor=Executors.newSingleThreadExecutor();executor.execute(()->{try{String id=intent.getStringExtra("shift");if(id!=null)lock(c,id);else sync(c,c.getSharedPreferences("employee-native",0).getString("cutoffs","[]"));}catch(Exception e){android.util.Log.e("4Employee","Cutoff reconciliation failed",e);}finally{result.finish();executor.shutdown();}});}
}`,
      );
      return c;
    },
  ]);
};
