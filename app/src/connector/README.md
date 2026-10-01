# Der Connector dieser App

```text
App (Toolkit-Komponenten + Hooks)
        │
        ▼
   DataInterface             ← die App kennt nur diesen Vertrag
        │
  mitBrettRegeln             ← brett-regeln.ts: die Regeln des Bretts, vor jedem Schreiben
        │
  SupabaseConnector          ← @real-life-stack/supabase-connector, exakt gepinnt
        │
  supabase.real-life-stack.de (Postgres, RLS-Policies, Realtime, Anmeldung)
```

`verbindung.ts` baut den Connector aus der Laufzeit-Konfiguration
(`config.json`, sonst `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) und legt
die Brett-Regeln darum.

`brett-regeln.ts` ist kein eigener Connector, sondern eine dünne Schicht
(Komposition, ein Proxy): Sie beantwortet nur `createItem`, `updateItem` und
`deleteItem` selbst und reicht alles andere durch. So gelten die Regeln für
jeden Schreibweg, auch die des Toolkits (Formular, Selbstaktion, ⋮-Menü):

- ein Faden läuft nie nach links, nie im Kreis, nie auf sich selbst;
- eine Karte gehört zu genau einem Ziel;
- Löschen nimmt mit, was ohne das Gelöschte keinen Halt hat (Karten eines
  Ziels, Fäden auf eine gelöschte Karte).

Die Regeln bleiben App-Prüfung: Der Stack ist backend-agnostisch, App-Logik
gehört nie ins Backend (Stopp-Punkt 5). Eine Prüfung vor dem Speichern im
Stack kommt mit rls#563.

Ein Brett ist eine Group mit `modules: ["karabirrdt"]`; die Adresse `/<slug>`
löst über `Group.data.slug` auf (`../brett.ts`). Den Connector zu tauschen
(etwa gegen den WoT-Connector) heißt: `verbindung.ts` ersetzen. Die
Oberfläche merkt davon nichts.
