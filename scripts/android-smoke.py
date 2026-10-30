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
def scroll_to(text):
 w,h=map(int,re.findall(r'\d+',adb('shell','wm','size').decode())[-2:])
 for _ in range(8):
  node=locate(text)
  if node is not None:return node
  adb('shell','input','swipe',w//2,int(h*.75),w//2,int(h*.3),400);time.sleep(.5)
 raise AssertionError('UI did not reveal after scrolling: '+text)
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
 tap('Expense');wait('New entry')
 for key in ['1','2','3','4']:tap(key)
 tap('Save entry');wait('TOTAL BALANCE');shot('03-recorded-expense')
 for path,title,name in [('transactions','Activity','04-transactions'),('plan','Plan','05-planning'),('salary','Salary','06-salary'),('loans','Loans & EMIs','07-loans'),('subscriptions','Subscriptions','08-subscriptions'),('budgets','Monthly budgets','09-budgets'),('goals','Savings goals','10-goals'),('finance-calendar','Money calendar','11-calendar'),('work','Your workday','12-work'),('work-settings','Work settings','13-work-settings'),('insights','Insights','14-insights'),('more','Settings','15-more'),('lending','Lending','15b-lending'),('salary-rules','Salary','15c-salary-rules')]:
  deep(path);wait(title);shot(name)
 # Verify simplified work modes and missed swipe-in native time entry.
 deep('work');wait('Your workday');wait('Focus timer');wait('Stopwatch')
 assert locate('WFH') is None and locate('HALF DAY') is None, 'Deprecated work modes remain selectable'
 scroll_to('Missed swipe in?');tap('Missed swipe in?');scroll_to('Choose time');tap('Choose time');wait('OK');shot('15d-missed-swipe-time');adb('shell','input','keyevent','KEYCODE_BACK')
 w,h=map(int,re.findall(r'\d+',adb('shell','wm','size').decode())[-2:])
 for _ in range(3):adb('shell','input','swipe',w//2,int(h*.3),w//2,int(h*.8),400)
 tap('Focus timer');wait('Hours');wait('Minutes');shot('15e-focus-timer')
 # Verify a real transaction's safe deletion dialog, then keep the expense for analytics QA.
 deep('transactions');wait('Activity');amount_node=next(n for n in dump().iter('node') if '1,234' in (n.get('text','')+' '+n.get('content-desc','')));amount_label=amount_node.get('text') if '1,234' in amount_node.get('text','') else amount_node.get('content-desc');tap(amount_label);wait('Transaction');scroll_to('Delete entry');tap('Delete entry');wait('Delete this transaction?');shot('15f-safe-delete');tap('CANCEL')
 # Validate focused native input screens and a complete multi-screen creation flow.
 deep('edit/settings/baseline');wait('Daily target');wait('Hours');wait('Minutes');shot('16-hours-minutes')
 deep('edit/settings/startOfDay');wait('Preferred start');tap('Choose time');wait('OK');shot('17-native-time-picker');adb('shell','input','keyevent','KEYCODE_BACK')
 deep('edit/settings/accent');wait('Accent');tap('Choose color #3B82F6');shot('18-color-picker');tap('Save')
 deep('categories');wait('Categories');tap('New category');wait('Name');
 node=wait('Name');
 # The editable field carries the same accessible name as the heading; target EditText.
 node=next(n for n in dump().iter('node') if n.get('class')=='android.widget.EditText')
 nums=list(map(int,re.findall(r'\d+',node.get('bounds'))));adb('shell','input','tap',(nums[0]+nums[2])//2,(nums[1]+nums[3])//2)
 time.sleep(1)
 for char in 'QA-Pets':
  adb('shell','input','text',char);time.sleep(.2)
 node=next(n for n in dump().iter('node') if n.get('class')=='android.widget.EditText')
 assert node.get('text')=='QA-Pets', 'Emulator failed to enter category name'
 tap('Continue')
 wait('Type');tap('Expense');tap('Continue');wait('Icon');tap('Continue');wait('Color');tap('Choose color #3B82F6');tap('Continue');wait('Review');shot('19-creation-review');tap('Create');wait('Categories');scroll_to('QA-Pets');shot('20-custom-category');tap('QA-Pets');wait('Color');shot('20b-saved-category')
 adb('shell','cmd','uimode','night','yes');deep('');wait('TOTAL BALANCE');shot('21-dashboard-dark')
 logs=adb('logcat','-d').decode(errors='replace');(out/'logcat.txt').write_text(logs)
 if 'FATAL EXCEPTION' in logs or 'Unable to resolve module' in logs:raise AssertionError('Runtime crash in logcat')
 print('Android UI smoke passed: onboarding, real expense entry, all primary flows and adaptive theme.')
except Exception:
 try:shot('failure');(out/'logcat.txt').write_bytes(adb('logcat','-d'))
 except Exception:pass
 raise
