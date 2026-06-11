import json, sys, io, os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open(r'D:\ManhuaWorks\docs\testing\frontend\retest_results.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print('=== Summary ===')
print(json.dumps(data['summary'], ensure_ascii=False, indent=2))

print('\n=== Per-site page info ===')
for r in data['results']:
    pi = r.get('pageInfo', {})
    title = pi.get('title', 'N/A')
    btns = pi.get('buttons', 0)
    links = pi.get('links', 0)
    inputs = pi.get('inputs', 0)
    body_len = len(pi.get('bodyText', ''))
    print(f"{r['site']:8s} {r['route']:30s} title='{title}' btns={btns} links={links} inputs={inputs} body={body_len}chars")

print('\n=== Pages with warnings ===')
for r in data['results']:
    if r['status'] == 'WARN' or r.get('notes'):
        print(f"{r['site']:8s} {r['route']:30s} {r['status']} - {'; '.join(r['notes'])}")

# Count screenshots
screenshots = [r for r in data['results'] if r.get('screenshot') and os.path.exists(r['screenshot'])]
print(f'\n=== Screenshots: {len(screenshots)} generated ===')
for s in screenshots[:5]:
    size = os.path.getsize(s['screenshot'])
    print(f"  {s['site']}/{os.path.basename(s['screenshot'])} ({size} bytes)")
print(f"  ... and {len(screenshots)-5} more")
