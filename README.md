# Lead Meeting App

Eine Web-App für Lead-Management, in der sich Benutzer mit ihrem Microsoft-Unternehmenskonto anmelden können, Lead-Listen hochladen und Teams-Termineinladungen verschicken können.

## Lokale Entwicklung starten

1. Abhängigkeiten installieren:
   ```bash
   npm install
   ```

2. Prisma-Datenbank initialisieren:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. Entwicklungsserver starten:
   ```bash
   npm run dev
   ```

4. Öffne [http://localhost:3000](http://localhost:3000) in deinem Browser.

## Skripte

- `npm run dev`: Startet den Entwicklungsserver
- `npm run build`: Baut die App für die Produktion
- `npm run start`: Startet den Produktionsserver
- `npm run lint`: Führt ESLint aus

## Technologien

- Next.js 14 mit TypeScript
- Prisma mit SQLite (für lokale Entwicklung)
- Tailwind CSS
- ESLint

## Nächste Schritte

- Microsoft Azure AD Integration für Authentifizierung
- Microsoft Graph API für Teams-Termineinladungen
- Lead-Upload und -Verwaltung
- Geschützte Routen implementieren