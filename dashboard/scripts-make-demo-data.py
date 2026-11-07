"""Build dashboard/public/demo-data from ../sample-data for the static demo.
Servers without a public sample get a copy of a similar server with shifted numbers."""
import json, os, random, re, shutil, copy
random.seed(7)
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, '..', 'sample-data')
out = os.path.join(here, 'public', 'demo-data')
shutil.rmtree(out, ignore_errors=True)
index = {}

def add(app, table, name, data):
    d = os.path.join(out, app, table); os.makedirs(d, exist_ok=True)
    json.dump(data, open(os.path.join(d, name), 'w'), ensure_ascii=False)
    index.setdefault(app, {}).setdefault(table, []).append(name)

for app in sorted(os.listdir(src)):
    for table in sorted(os.listdir(os.path.join(src, app))):
        for dp, _, fn in os.walk(os.path.join(src, app, table)):
            for f in sorted(fn):
                add(app, table.lower(), f, json.load(open(os.path.join(dp, f))))

def jitter(o):
    if isinstance(o, dict): return {k: jitter(v) for k, v in o.items()}
    if isinstance(o, list): return [jitter(x) for x in o]
    if isinstance(o, str) and re.fullmatch(r'\d{1,2}%', o):
        return f"{max(1, min(97, int(o[:-1]) + random.randint(-15, 15)))}%"
    if isinstance(o, float) and 0 <= o <= 100: return round(max(1, min(97, o + random.uniform(-12, 12))), 1)
    return o

clones = {'RETAIL-DB': 'DB-01', 'CORE-DB': 'DB-01', 'HELPDESK-01': 'DOCS-01', 'HELPDESK-02': 'DOCS-01',
          'CORE-APP': 'APP-01', 'RETAIL-APP': 'APP-01'}
for new, base in clones.items():
    for table, files in index.get(base, {}).items():
        if new.endswith('APP') or new.startswith('HELPDESK'):
            if table == 'tablespace': continue
        for f in files:
            add(new, table, f, jitter(json.load(open(os.path.join(out, base, table, f)))))

# a small AIX error-report sample (structure from docs/SYSTEM_DOCUMENTATION.md)
err = {"system": {"hostname": "aix-erp-01", "log_type": "ERROR_REPORT_ERRPT"},
       "error_list": [
         {"identifier": "4865FA9B", "timestamp": "Wed Mar 11 01:32:00 THAIST 2026", "type": "P", "class": "H", "resource": "rmt0", "description": "TAPE OPERATION ERROR"},
         {"identifier": "C69F5C9B", "timestamp": "Tue Mar 10 10:01:00 THAIST 2026", "type": "P", "class": "S", "resource": "SYSPROC", "description": "SOFTWARE PROGRAM ABNORMALLY TERMINATED"},
         {"identifier": "DE3B8540", "timestamp": "Mon Mar 09 22:14:00 THAIST 2026", "type": "P", "class": "H", "resource": "hdisk1", "description": "PATH HAS FAILED"}],
       "raw_stdout": "(raw command output removed from the public sample)"}
for name in ["errpt_more_Wed Mar 11 09:20:44 THAIST 2026.json"]:
    add('ERP-AIX', 'errpt_more', name, err)

json.dump(index, open(os.path.join(out, 'index.json'), 'w'), indent=1)
print({a: {t: len(f) for t, f in v.items()} for a, v in index.items()})
