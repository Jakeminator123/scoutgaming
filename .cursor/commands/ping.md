# Ping

Skicka en fråga till en kollega eller kollegans agent i en annan gren eller på en
annan dator, via teaminboxen (GitHub Issues). Läs `.agents/skills/ping-croupier/SKILL.md`.

Argument: `<namn> <text>`, till exempel `/ping kevin Vilken API-väg använder team-vyn?`
Namn: jakob, john, kevin, emil, eller `me` för ägaren av den aktuella grenen.

Kör `node tools/inbox.mjs ping --to <namn> --message "<text>"` och visa länken.
Utan argument: kör `node tools/inbox.mjs list --to me` och sammanfatta öppna ärenden.
Agenter i samma checkout når du i stället med `node tools/agent-talk.mjs ping`.
