# Systembolaget MCP Server - Setup Guide

Den här guiden hjälper dig att sätta upp MCP-servern så jag kan hjälpa dig med vin- och matval direkt i Claude Desktop.

## Steg 1: Skapa projektet

```bash
# Skapa en ny mapp
mkdir systembolaget-mcp
cd systembolaget-mcp

# Spara koden och package.json från artifacts
# Skapa tsconfig.json
```

## Steg 2: Skapa tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Steg 3: Installera beroenden

```bash
npm install
```

## Steg 4: Hämta vindata

**Alternativ A: AlexGustafsson (Rekommenderat)**
```bash
# Ladda ner senaste datan
curl -o wine_data.json https://raw.githubusercontent.com/AlexGustafsson/systembolaget-api-data/main/data/assortment.json
```

**Alternativ B: C4illin**
```bash
# Ladda ner från C4illins repo
curl -o wine_data.json https://raw.githubusercontent.com/C4illin/systembolaget-data/main/products.json
```

## Steg 5: Testa servern

```bash
# Bygg projektet
npm run build

# Testa att servern startar
npm start
```

Du bör se: "Systembolaget MCP Server running on stdio"

## Steg 6: Konfigurera Claude Desktop

### macOS
Öppna: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Windows  
Öppna: `%APPDATA%\Claude\claude_desktop_config.json`

Lägg till:
```json
{
  "mcpServers": {
    "systembolaget": {
      "command": "node",
      "args": ["/FULL/PATH/TO/systembolaget-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

**Viktigt:** Ändra `/FULL/PATH/TO/systembolaget-mcp/` till din faktiska sökväg!

## Steg 7: Starta om Claude Desktop

Stäng Claude Desktop helt och starta om. Du bör nu se en hammare/verktygsikon i chatfältet.

## Verifiering

Testa genom att skriva till mig:
- "Hitta ett italienskt rött vin under 200 kr"
- "Vad passar till grillad lax?"
- "Rekommendera något från Bourgogne"

Jag bör då kunna söka i Systembolagets sortiment och ge dig specifika rekommendationer!

## Felsökning

**Problem:** Claude Desktop hittar inte servern
- Kontrollera att sökvägen i config.json är korrekt (absolut sökväg)
- Kör `npm run build` igen
- Kontrollera att `node` finns i din PATH

**Problem:** "Failed to load wine data"
- Kontrollera att `wine_data.json` finns i projektmappen
- Testa att ladda ner datan igen

**Problem:** Servern startar inte
- Kontrollera Node.js version (behöver >=18)
- Kör `npm install` igen

## Uppdatering av data

Kör detta regelbundet för att få senaste sortimentet:
```bash
cd systembolaget-mcp
curl -o wine_data.json https://raw.githubusercontent.com/AlexGustafsson/systembolaget-api-data/main/data/assortment.json
```

Nu kan vi prata mat och vin med full tillgång till Systembolagets sortiment! 🍷