# SKYWA Automation Pro

## Included behavior

- Up to 30 keyword reply rules with `contains`, `exact`, and `startsWith` matching.
- Optional allowlist and blocklist using phone numbers or full WhatsApp JIDs.
- Group chats are ignored by default.
- Per-chat cooldown plus a global reply cap per minute guard against accidental loops and bursts.
- Optional local-device active hours, including schedules that span midnight.
- Pause and resume controls exposed in the native Android UI.
- Runtime counters for incoming text, filtered messages, rules/static/AI replies, failures and replies in the last minute.

## Rule syntax

Each line is `mode: keyword1, keyword2 => reply`. For example:

```text
contains: harga, price => Sebutkan produk yang ingin kamu ketahui harganya.
exact: halo => Halo! Ada yang bisa dibantu?
startsWith: order => Kirim nomor pesanan untuk dibantu.
```

Lines beginning with `#` are ignored. Replies are plain text. Multi-line reply templates, attachments, CRM integrations, message scheduling, backups, and persistent analytics are not included in this iteration.

## Safety behavior

Automation Pro defaults to disabled for custom rules, ignores groups, allows 10 seconds between replies to the same chat, and caps total automation replies at 8 per minute. The standard auto-reply and AI settings remain separately configurable. The safety gate is applied whenever automatic responses are active. An empty allowlist permits any private chat except blocked chats; a non-empty allowlist restricts replies to the listed identifiers.

A successful CI run verifies JavaScript tests and APK compilation only. It does not test a live WhatsApp account, OEM background restrictions, or crash recovery on a physical Android device.
