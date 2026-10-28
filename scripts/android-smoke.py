"""Fresh emulator UI smoke. QA records exist only inside this temporary emulator."""
import subprocess,time,xml.etree.ElementTree as ET,re,pathlib,sys
out=pathlib.Path('qa-android');out.mkdir(exist_ok=True)
def adb(*args):return subprocess.check_output(['adb',*map(str,args)],stderr=subprocess.STDOUT)
def dump():
 adb('shell','uiautomator','dump','/sdcard/4emp-window.xml')
 raw=adb('exec-out','cat','/sdcard/4emp-window.xml').decode()
 return ET.fromstring(raw)
def locate(text):
 for node in dump().iter('node'):
  if text in [node.get('text'),node.get('content-desc')]:return node
 return None
def wait(text,seconds=50):
 until=time.monotonic()+seconds
 while time.monotonic()<until:
  node=locate(text)
  if node is not None:return node
  time.sleep(1)
 raise AssertionError('UI did not show: '+text)
def tap(text):
 node=wait(text);nums=list(map(int,re.findall(r'\d+',node.get('bounds'))));adb('shell','input','tap',(nums[0]+nums[2])//2,(nums[1]+nums[3])//2);time.sleep(.5)
def shot(name):
 time.sleep(1);(out/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
 adb('shell','uiautomator','dump','/sdcard/4emp-window.xml');(out/(name+'.xml')).write_bytes(adb('exec-out','cat','/sdcard/4emp-window.xml'))
def deep(path):
 adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','fouremp:///'+path,'com.fouremp.app');time.sleep(2)
try:
 adb('install','-r','android/app/build/outputs/apk/release/app-release.apk')
 adb('shell','pm','grant','com.fouremp.app','android.permission.POST_NOTIFICATIONS')
 adb('shell','am','start','-W','-n','com.fouremp.app/.MainActivity')
 wait('Get started');shot('01-welcome');tap('Get started');wait('TOTAL BALANCE');shot('02-dashboard-light')
 tap('＋ Add entry');wait('Quick entry')
 for key in ['1','2','3','4']:tap(key)
 tap('Done');wait('TOTAL BALANCE');shot('03-recorded-expense')
 for path,title,name in [('transactions','Transactions','04-transactions'),('planning','Plan your money','05-planning'),('salary','Salary','06-salary'),('loans','Loans & EMIs','07-loans'),('subscriptions','Subscriptions','08-subscriptions'),('budgets','Monthly budgets','09-budgets'),('goals','Savings goals','10-goals'),('finance-calendar','Money calendar','11-calendar'),('work','Your workday','12-work'),('work-settings','Work preferences','13-work-settings'),('insights','Insights','14-insights'),('more','More','15-more')]:
  deep(path);wait(title);shot(name)
 adb('shell','cmd','uimode','night','yes');deep('');wait('TOTAL BALANCE');shot('16-dashboard-dark')
 logs=adb('logcat','-d').decode(errors='replace');(out/'logcat.txt').write_text(logs)
 if 'FATAL EXCEPTION' in logs or 'Unable to resolve module' in logs:raise AssertionError('Runtime crash in logcat')
 print('Android UI smoke passed: onboarding, real expense entry, all primary flows and adaptive theme.')
except Exception:
 try:shot('failure');(out/'logcat.txt').write_bytes(adb('logcat','-d'))
 except Exception:pass
 raise
