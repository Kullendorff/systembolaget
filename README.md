# 🍷 Systembolaget Wine Tools

AI-drivna verktyg för vinrekommendationer baserat på Systembolagets sortiment. Tre olika sätt att interagera med 20,000+ produkter från Systembolaget.

## 📦 Vad ingår?

### 1. **PoC Script** - Testa direkt i terminalen
- Enkel sökning på land, druvor, region
- Interaktivt CLI-gränssnitt
- Perfekt för att testa att allt fungerar

### 2. **MCP Server** - Integration med Claude Desktop
- Direkt tillgång till vindata i Claude
- Avancerad filtrering och matmatchning
- AI-driven vinrådgivning

### 3. **Discord Bot** - Social vinrådgivning
- Naturlig språkförståelse med Claude API
- Snygga embeds med vinrekommendationer
- Dela med vänner i Discord

## 🚀 Snabbstart

### Installation
```bash
# Klona eller kopiera projektet
cd C:\systemet

# Installera alla dependencies (redan gjort)
npm install

# Ladda ner senaste vindata (redan gjort)
npm run download-data
```

### Testa PoC-scriptet direkt
```bash
# Interaktiv sökning
npm run poc

# Direkt sökning
node poc/index.js Italien
node poc/index.js "Pinot Noir"
node poc/index.js Champagne
```

## 🤖 MCP Server Setup (Claude Desktop)

### 1. Bygg servern
```bash
cd mcp-server
npm run build
```

### 2. Konfigurera Claude Desktop

**Windows:** Öppna `%APPDATA%\Claude\claude_desktop_config.json`

**macOS:** Öppna `~/Library/Application Support/Claude/claude_desktop_config.json`

Lägg till:
```json
{
  "mcpServers": {
    "systembolaget": {
      "command": "node",
      "args": ["C:\\systemet\\mcp-server\\dist\\index.js"],
      "env": {}
    }
  }
}
```

### 3. Starta om Claude Desktop

Nu kan du fråga Claude:
- "Hitta ett italienskt rött vin under 200 kr"
- "Vad passar till grillad lax?"
- "Rekommendera något från Bourgogne"

## 💬 Discord Bot Setup

### 1. Skapa Discord-applikation
1. Gå till [Discord Developer Portal](https://discord.com/developers/applications)
2. Skapa ny applikation
3. Under "Bot" → Add Bot → Kopiera token
4. Aktivera "MESSAGE CONTENT INTENT"

### 2. Skapa .env-fil
```bash
cd discord-bot
```

Skapa `.env`:
```env
DISCORD_TOKEN=din_discord_bot_token
ANTHROPIC_API_KEY=din_anthropic_api_key
```

### 3. Bygg och starta
```bash
cd discord-bot
npm install
npm run build
npm start
```

### 4. Använd i Discord
```
!vin italienskt rött under 200 kr
!vin vad passar till grillad lax?
@WineBot hitta något bubblande
```

## 📊 Datastruktur

Varje vin innehåller:
- **Grundinfo:** Namn, pris, artikelnummer, årgång
- **Ursprung:** Land, region, appellation
- **Teknisk:** Alkoholhalt, volym, druvor
- **Smakprofil:** Fyllighet, strävhet, sötma, fruktsyra (1-12)
- **Beskrivning:** Detaljerad smakbeskrivning
- **Tillgänglighet:** Fast/tillfälligt sortiment

## 🔍 Sökexempel

### PoC Script
```bash
node poc/index.js "Barolo"          # Sök på namn
node poc/index.js "Italien"         # Sök på land
node poc/index.js "Chardonnay"      # Sök på druva
```

### MCP i Claude
```
"Sök efter fylliga röda viner från Spanien under 300 kr"
"Hitta ett torrt vitt vin med hög syra till skaldjur"
"Visa detaljer för artikel 12345"
```

### Discord Bot
```
!vin något gott till fredagsmys
!vin bordeaux mellan 200-400 kr
!vin vad passar till lammstek?
```

## 🔧 Uppdatera data

Kör regelbundet för senaste sortimentet:
```bash
npm run download-data
```

## 📁 Projektstruktur
```
C:\systemet\
├── poc/                # Proof of concept CLI
│   ├── index.js
│   └── package.json
├── mcp-server/         # Claude Desktop integration
│   ├── index.ts
│   ├── package.json
│   └── dist/          # Kompilerad kod
├── discord-bot/        # Discord bot
│   ├── index.ts
│   ├── package.json
│   └── dist/          # Kompilerad kod
├── shared/            # Delad data
│   └── wine_data.json # Systembolagets sortiment
├── scripts/           # Hjälpscript
│   └── download-data.js
└── docs/              # Dokumentation
```

## 🐛 Felsökning

### "Kunde inte ladda wine_data.json"
```bash
npm run download-data
```

### MCP server syns inte i Claude
- Kontrollera sökvägen i `claude_desktop_config.json`
- Starta om Claude Desktop helt
- Kör `cd mcp-server && npm run build`

### Discord bot svarar inte
- Kontrollera MESSAGE CONTENT INTENT är aktiverat
- Verifiera .env-filen finns och har rätt nycklar
- Kolla bot-behörigheter i Discord-servern

## 📝 API-nycklar behövs för:

- **Discord Bot Token:** [Discord Developer Portal](https://discord.com/developers)
- **Anthropic API Key:** [Anthropic Console](https://console.anthropic.com)

## 🍷 Exempel på användning

### Matmatchning
- Grillad lax → Crisp vitt vin, fyllighet 3-8
- Lammstek → Fylligt rött, fyllighet 7-12
- Pasta carbonara → Medelfylligt, fyllighet 4-9

### Smakprofiler (1-12)
- **Fyllighet:** 1=mycket lätt, 12=mycket fyllig
- **Strävhet:** 1=mycket mjuk, 12=mycket strävt
- **Sötma:** 1=mycket torrt, 12=mycket sött
- **Fruktsyra:** 1=mjuk, 12=mycket frisk

## 🎯 Tips

1. **PoC först** - Testa att data fungerar
2. **MCP sedan** - För Claude Desktop-integration  
3. **Discord sist** - När allt annat fungerar

## 📧 Support

Frågor? Kolla CLAUDE.md för projektspecifika instruktioner eller kör:
```bash
node poc/index.js test
```

---

*Byggt med kärlek till vin och kod* 🍷💻