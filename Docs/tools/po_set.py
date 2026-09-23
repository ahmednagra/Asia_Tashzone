# Rewrites msgstr for given msgids in a .po, leaving msgid and every other entry untouched.
# Usage: po_set.py <locale> <pairs.json>   where pairs.json is {"<msgid>": "<new msgstr>"}
import sys, json, io

loc, pairs_file = sys.argv[1], sys.argv[2]
path = 'D:/tashzone/app/src/locales/%s/messages.po' % loc
pairs = json.load(open(pairs_file, encoding='utf-8'))

def esc(s):
    return s.replace('\\', '\\\\').replace('"', '\\"')

lines = open(path, encoding='utf-8').read().split('\n')
out, i, changed = [], 0, 0
while i < len(lines):
    line = lines[i]
    if line.startswith('msgid "'):
        # collect the full msgid, which may continue over several quoted lines
        mid, j = line[7:-1], i + 1
        while j < len(lines) and lines[j].startswith('"'):
            mid += lines[j][1:-1]
            j += 1
        mid_plain = mid.replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
        if mid_plain in pairs and j < len(lines) and lines[j].startswith('msgstr'):
            out.extend(lines[i:j])
            out.append('msgstr "%s"' % esc(pairs[mid_plain]))
            k = j + 1
            while k < len(lines) and lines[k].startswith('"'):
                k += 1
            changed += 1
            i = k
            continue
    out.append(line)
    i += 1

open(path, 'w', encoding='utf-8', newline='').write('\n'.join(out))
print('rewrote %d of %d' % (changed, len(pairs)))
