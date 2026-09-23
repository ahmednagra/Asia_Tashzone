# TashZone: Urdu Language Standard

Owner decision, 18 Sep 2026. This governs every Urdu string in `app/src/locales/ur/messages.po`.
Where this document and a translator disagree, this document wins.

## 1. Register

**Karachi Urdu, as spoken by purely Urdu-speaking households.**

The copy should read as if Pakistani card players wrote it themselves — not as if an English app were
translated. Standard Urdu, conversational, short. No Punjabi loanwords or Punjabi verb inflections, and
no Lahore-style gaming slang: those belong to a different register and read as borrowed here.

Friendly, competitive, familiar. Not literary, not bureaucratic.

## 2. Terminology

Use the terms card players actually say. Do not replace a familiar term with formal Urdu.

| Term | Urdu |
|---|---|
| Bhabhi | بھابی |
| Rang (suit) | رنگ |
| Patta (card) | پتہ |
| Hukam (trump) | حکم |
| Chaal (move) | چال |
| Haath (trick) | ہاتھ |
| Khel (game) | کھیل |
| Jori (pair) | جوڑی |
| Cut | کٹ |
| Deal | ڈیل |
| Turn | ٹرن |
| Baari (turn) | باری |
| Jeet (win) | جیت |
| Haar (loss) | ہار |
| Point | پوائنٹ |
| Card | کارڈ |
| Khiladi (player) | کھلاڑی |
| Table | میز |

**Loanword rule.** Where Pakistani players normally say the English word — Deal, Cut, Turn, Point, Card,
Game, Player — keep it. Write it in Urdu script (ڈیل، کٹ، ٹرن، پوائنٹ) rather than Latin, so the sentence
stays in one script. The app already does this for لیول and ایکس پی.

## 3. Sentence style

**Sentences must be short. This is a hard rule, not a preference.**

A player reads these mid-hand, with a timer running and cards in the other hand. Anything long is not
read at all. Write the shortest sentence that still carries the meaning, then cut a word.

- One idea per sentence. If it needs a comma to hold two ideas, it is two sentences or it is too long.
- Cut politeness scaffolding outright: براہِ کرم, اگر آپ چاہیں تو, یہ بات نوٹ کریں.
- Cut anything the player can already see on screen.
- Buttons and statuses: two or three words.
- Body text: one line. Two only when a rule genuinely needs it.

Natural. Immediately clear mid-game. Closer to how people write in WhatsApp than to a manual.

| Avoid | Use |
|---|---|
| براہِ کرم اپنا کارڈ کھیلنے کے لیے منتخب کریں۔ | اپنا پتہ چلائیں۔ |
| اب آپ کی باری ہے کہ آپ کون سا پتہ استعمال کرتے ہیں۔ | آپ کی باری ہے۔ |
| اس رنگ کے کارڈ کا انتخاب کرنا ضروری ہے۔ | رنگ دینا ہے۔ |
| آپ اس ہاتھ میں کامیاب ہو گئے ہیں۔ | یہ ہاتھ آپ کا ہے۔ |
| کھیل میں حصہ لینے والے کھلاڑی کی باری مکمل ہو گئی ہے۔ | اس کی باری ختم۔ |

## 4. UI microcopy

Buttons, statuses, toasts and alerts stay very short:

آپ کی باری ہے · پتہ چلائیں · رنگ دیں · حکم چلائیں · کھیل جاری ہے · ہاتھ ختم · آپ جیت گئے ·
آپ ہار گئے · کھیل ختم · دوبارہ کھیلیں · انتظار کریں · کھلاڑی کی باری ہے

## 5. Do not use

- Literary or poetic Urdu
- Archaic Persian vocabulary
- Hindi-specific wording
- Machine-translated phrasing
- Long formal sentences
- Punjabi loanwords or inflections
- Latin script in running text, except the brand name TashZone and URLs

## 6. Review checklist

A string passes when all of these hold:

- [ ] A Karachi player would say it out loud this way
- [ ] It is short — a word could not be removed without losing meaning
- [ ] It carries one idea, not two joined by a comma
- [ ] It uses the glossary term, not a formal synonym
- [ ] It is entirely in Urdu script
- [ ] It carries no Punjabi or Hindi colouring
- [ ] It fits its control without wrapping to a third line

## 7. Checking the catalogue

The audit script reports untranslated strings and any Latin left in a translation:

```bash
python "Docs/tools/po_audit.py" ur
```

It cannot judge register or grammar. Those need a human read against §3 and §6, or a review pass by a
model given this document.

## 8. Known gaps

- `NICKNAME_ADJECTIVES` / `NICKNAME_NOUNS` in `shared/protocol` generate English nicknames such as
  "Lucky Mango", shown on the home screen and at every table. They need per-language word lists.
