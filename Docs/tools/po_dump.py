# Dumps msgid/msgstr pairs for review. Usage: po_dump.py ur [maxlen]
import sys, os

def unquote(line, n):
    s = line[n:].strip()
    if s.startswith('"') and s.endswith('"'):
        s = s[1:-1]
    return s.replace('\\"', '"').replace('\\n', ' ').replace('\\\\', '\\')

def parse(path):
    out, cur, mode = [], None, None
    for raw in open(path, encoding='utf-8'):
        line = raw.rstrip('\n')
        if line.startswith('msgid '):
            if cur: out.append(cur)
            cur, mode = {'id': unquote(line, 6), 'str': ''}, 'id'
        elif line.startswith('msgstr '):
            if cur is not None:
                cur['str'], mode = unquote(line, 7), 'str'
        elif line.startswith('"') and cur is not None and mode:
            cur['id' if mode == 'id' else 'str'] += unquote(line, 0)
        elif not line.strip():
            mode = None
    if cur: out.append(cur)
    return [e for e in out if e['id']]

loc = sys.argv[1] if len(sys.argv) > 1 else 'ur'
maxlen = int(sys.argv[2]) if len(sys.argv) > 2 else 10000
es = parse('D:/tashzone/app/src/locales/%s/messages.po' % loc)
es = [e for e in es if len(e['str']) <= maxlen]
es.sort(key=lambda e: len(e['str']))
w = open('D:/tashzone/Docs/tools/_review_%s.txt' % loc, 'w', encoding='utf-8')
for i, e in enumerate(es):
    w.write('%d\nEN: %s\nUR: %s\n\n' % (i, e['id'], e['str']))
w.close()
print('%d strings written' % len(es))
