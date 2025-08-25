# Discord Wine Bot - Setup Guide

Bygg en Discord-bot som använder Claude API för att svara på vinfrågor!

## Förutsättningar
- Claude API-nyckel från Anthropic
- Discord-server där du kan testa boten
- Samma wine_data.json som från MCP-projektet

## Steg 1: Skapa Discord-applikation

1. Gå till [Discord Developer Portal](https://discord.com/developers/applications)
2. Klicka "New Application"
3. Namnge den (t.ex. "Wine Sommelier")
4. Gå till fliken "Bot"
5. Klicka "Add Bot"
6. **Kopiera token** (behåll hemligt!)

## Steg 2: Konfigurera bot-behörigheter

I Developer Portal, under "Bot":
- **Privileged Gateway Intents:**
  - ✅ MESSAGE CONTENT INTENT (viktigt!)
  - ✅ GUILD_MESSAGES
  
I "OAuth2" > "URL Generator":
- **Scopes:** `bot`
- **Bot Permissions:**
  - ✅ Send Messages
  - ✅ Use Slash Commands  
  - ✅ Embed Links
  - ✅ Read Message History

Kopiera generated URL och bjud in boten till din server.

## Steg 3: Sätt upp projektet

```bash
# Skapa projekt
mkdir discord-wine-bot
cd discord-wine-bot

# Installera beroenden  
npm install

# Kopiera wine_data.json från MCP-projektet
cp ../systembolaget-mcp/wine_data.json .
```

## Steg 4: Miljövariabler

Skapa `.env`-fil:
```env
DISCORD_TOKEN=your_discord_bot_token_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

**VIKTIGT:** Lägg till `.env` i `.gitignore`!

## Steg 5: TypeScript-konfiguration

Samma `tsconfig.json` som MCP-projektet.

## Steg 6: Starta boten

```bash
# Bygg
npm run build

# Starta
npm start
```

Du bör se: "Bot logged in as Wine Sommelier#1234!"

## Användning

**I Discord-chatten:**

```
!vin italienskt rött under 200 kr
!vin vad passar till grillad lax?
!vin något från Bourgogne
!vin fylliga viner med mycket tanniner
@Wine Sommelier hitta något bubblande till nyår
```

## Exempel på svar

Bot svarar med snygga embeds som innehåller:
- 🍷 Personligt svar från Claude
- 📋 Top 3 vinrekommendationer  
- 💰 Priser och artikelnummer
- 🍇 Druvor och ursprung
- 🕐 Smakprofiler

## Fördelar med Discord-bot vs MCP

**Discord-bot:**
- ✅ Fungerar på alla enheter (telefon, dator, webb)
- ✅ Kan delas med vänner i samma server
- ✅ Persistent historik av rekommendationer
- ✅ Emoji och snygga embeds
- ✅ Asynkron - flera kan fråga samtidigt

**MCP:**
- ✅ Djupare integration med Claude Desktop
- ✅ Inget behov av Discord-server
- ✅ Mer privat (ingen Discord-logging)

## Avancerade funktioner (att lägga till)

```typescript
// Kommandoförslag:
// !vin random - slumpmässig rekommendation
// !vin pris <artikel> - kolla aktuellt pris
// !vin favoriter - spara/visa dina favoriter
// !vin topplista - mest populära denna vecka
```

## Kostnader

- **Discord:** Gratis
- **Claude API:** ~$0.001-0.003 per meddelande (väldigt billigt)
- **Hosting:** Kan köras gratis på Replit, Railway eller hem-server

## Felsökning

**Bot svarar inte:**
- Kontrollera att MESSAGE CONTENT INTENT är aktiverat
- Kontrollera bot-behörigheter i servern

**"Failed to load wine data":**
- Kontrollera att wine_data.json finns i projektmappen

**Claude API-fel:**
- Kontrollera API-nyckel
- Kolla att du har credits kvar

Nu kan du och dina vänner fråga boten om vin direkt i Discord! 🍷🤖