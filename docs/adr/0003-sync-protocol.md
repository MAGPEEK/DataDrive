# ADR 0003 – Sync-Protokoll (Entwurf)

Status: Entwurf, wird mit den Beobachtungen am Original und mit M4 verfeinert. Datum: 2026-10-14.

## Ziele
Zwei-Wege-Sync zwischen Server und Clients sowie zwischen Servern (ShareSync) mit demselben Protokoll.
Robust bei Abbrüchen, gleichzeitigen Änderungen, Umbenennen/Verschieben/Löschen.

## Bausteine
- **Change-Log:** pro Sync-Wurzel ein monoton steigender Zähler (`seq`). Jede Änderung (anlegen, ändern,
  umbenennen, verschieben, löschen) erzeugt einen Eintrag. Clients holen Änderungen ab ihrem letzten `seq` (Cursor).
- **Blöcke:** Dateien werden in Blöcke zerlegt und über SHA-256 adressiert. Ein Client lädt nur fehlende Blöcke hoch
  oder herunter (Delta, Deduplizierung, Resume).
- **Dateiversion:** geordnete Blockliste + Metadaten (Größe, Änderungszeit, Hash, Autor). Neue Version = neue Blockliste.
- **Konflikte:** Änderung an einer Datei aus zwei Quellen auf derselben Basisversion → die später eintreffende wird
  als Konfliktkopie (`Name (Konflikt Benutzer Zeit).ext`) abgelegt, nichts geht verloren.
- **Push:** WebSocket meldet neue `seq`-Werte; der Client holt dann das Delta.
- **Identität:** stabile Knoten-IDs (nicht Pfade), damit Umbenennen/Verschieben als eine Operation erkennbar ist.

## Offen
- Blockgröße (fest oder inhaltsabhängig, z. B. FastCDC).
- Verhalten bei Zeitabweichung der Uhren, Groß-/Kleinschreibung auf Windows/macOS, Sonderzeichen in Namen.
- Rechte- und Metadaten-Sync bei ShareSync.
