import re, sys, os

LATIN = re.compile(r'[A-Za-z]{2,}')
PLACEHOLDER = re.compile(r'\{[A-Za-z0-9_]+\}')          # {count}, {base}
ICU_KEYWORD = re.compile(r'\b(plural|select|selectordinal|one|other|few|many|zero|two|offset)\b')
ICU_OPEN = re.compile(r'\{[A-Za-z0-9_]+\s*,')            # {count,

def unquote(line, prefix_len):
    s = line[prefix_len:].strip()
    if s.startswith('"') and s.endswith('"'):
        s = s[1:-1]
    return s.replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')

def parse(path):
    entries, cur, mode = [], None, None
    for raw in open(path, encoding='utf-8'):
        line = raw.rstrip('\n')
        if line.startswith('msgid '):
            if cur: entries.append(cur)
            cur = {'id': unquote(line, 6), 'str': ''}
            mode = 'id'
        elif line.startswith('msgstr '):
            if cur is not None:
                cur['str'] = unquote(line, 7)
                mode = 'str'
        elif line.startswith('"') and cur is not None and mode:
            cur['id' if mode == 'id' else 'str'] += unquote(line, 0)
        elif not line.strip():
            mode = None
    if cur: entries.append(cur)
    return [e for e in entries if e['id']]

# Proper nouns and technical terms that stay Latin in every language.
ALLOW = {'TashZone', 'Wi', 'Fi', 'WiFi', 'Google', 'Apple', 'Bluetooth', 'QR', 'PIN', 'OK',
         'Bhabhi', 'Callbreak', 'Court', 'Piece', 'Android', 'iOS', 'Play', 'Store', 'Hotspot'}

def strip_icu(s):
    s = ICU_OPEN.sub(' ', s)
    s = PLACEHOLDER.sub(' ', s)
    s = ICU_KEYWORD.sub(' ', s)
    return s

def audit(loc, out):
    path = os.path.join('D:/tashzone/app/src/locales', loc, 'messages.po')
    es = parse(path)
    empty = [e for e in es if not e['str'].strip()]
    roman = []
    for e in es:
        s = e['str'].strip()
        if not s:
            continue
        found = [w for w in LATIN.findall(strip_icu(s)) if w not in ALLOW]
        if found:
            roman.append((e['id'], s, found))
    w = out.write
    w('=' * 74 + '\n')
    w('locale: %s    total strings: %d\n' % (loc, len(es)))
    w('  untranslated (user sees English): %d\n' % len(empty))
    w('  genuinely Roman text in translation: %d\n' % len(roman))
    if empty:
        w('\n  -- UNTRANSLATED --\n')
        for e in empty:
            w('     %s\n' % e['id'])
    if roman:
        w('\n  -- ROMAN / LATIN TEXT SHOWN TO AN URDU READER --\n')
        for mid, s, found in roman:
            w('\n     msgid : %s\n' % mid)
            w('     urdu  : %s\n' % s)
            w('     latin : %s\n' % ', '.join(sorted(set(found))))
    w('\n')

out = open('D:/tashzone/Docs/Mobile live app screenshots/urdu-latin-audit.txt', 'w', encoding='utf-8')
for loc in sys.argv[1:] or ['ur']:
    audit(loc, out)
out.close()
print('report written')
