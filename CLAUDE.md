# Instruktioner för Claude - Systembolaget Vinprojekt

**Projektkontext:** Användaren (Johan) bygger verktyg för att integrera Systembolagets vindata med AI-assistenter. Projektets mål är att skapa smarta vinrekommendationer baserat på mat, smakpreferenser och budget.

## Projektöversikt

### Vad vi bygger
- **MCP Server** för Claude Desktop integration
- **Discord Bot** för social vinrådgivning  
- **Proof of Concept** scripts för att testa data och funktionalitet

### Datakälla
- **Primär:** AlexGustafsson/systembolaget-api-data (GitHub)
- **Backup:** C4illin/systembolaget-data
- **Format:** JSON-fil (~20k produkter) med omfattande metadata

### Teknisk stack
- **Runtime:** Node.js + TypeScript
- **MCP:** @modelcontextprotocol/sdk
- **Discord:** discord.js
- **AI:** Anthropic Claude API

## Datastruktur som Claude ska känna till

```typescript
interface WineProduct {
  productId: string;           // Systembolagets artikel-ID
  productNameBold: string;     // Huvudnamn (t.ex. "Barolo")
  productNameThin: string;     // Tilläggsnamn (t.ex. "Fontanafredda")
  vintage?: string;            // Årgång
  alcoholPercentage: number;   // Alkoholhalt
  volumeText: string;          // "750 ml"
  price: number;               // Pris i SEK
  country: string;             // Ursprungsland
  originLevel1?: string;       // Region (t.ex. "Piemonte")
  originLevel2?: string;       // Appellation (t.ex. "Barolo DOCG")
  grapes?: string[];           // Druvsorter
  taste?: string;              // Smakbeskrivning
  tasteClockBody?: number;     // Fyllighet 1-12
  tasteClockRoughness?: number;// Strävhet 1-12
  tasteClockSweetness?: number;// Sötma 1-12
  tasteClockFruitacid?: number;// Fruktsyra 1-12
  assortmentText: string;      // "Fast sortiment", "Tillfälligt"
  categoryLevel1?: string;     // "Rött vin", "Vitt vin", etc.
  isDiscontinued: boolean;     // Utgången
}
```

## Sökfunktioner Claude ska implementera

### 1. Grundläggande produktsökning
```typescript
search_wines({
  country?: string,
  grapes?: string[],
  minPrice?: number,
  maxPrice?: number,
  categoryLevel1?: string,
  tasteClockBodyMin/Max?: number,
  searchText?: string
})
```

### 2. Matmatchning
```typescript
get_wine_recommendations({
  dish: string,           // "grillad lax", "lammstek"
  preferredStyle?: string,// "light", "full", "crisp"
  maxPrice?: number
})
```

### 3. Detaljvyer
```typescript
get_wine_details({
  productId: string
})
```

## Matmatchningslogik för Claude

### Fisk & Skaldjur
- **Kategorier:** Vitt vin, Rosé, lätta röda
- **Smakprofil:** Fyllighet 3-8, hög syra
- **Druvor:** Chardonnay, Sauvignon Blanc, Pinot Noir

### Rött kött & Vilt
- **Kategorier:** Rött vin
- **Smakprofil:** Fyllighet 7-12, medel-hög strävhet
- **Druvor:** Cabernet Sauvignon, Syrah, Nebbiolo

### Kyckling & Ljust kött
- **Kategorier:** Vitt vin, lätta röda, Rosé
- **Smakprofil:** Fyllighet 4-8
- **Druvor:** Chardonnay, Pinot Noir, Sangiovese

### Kryddig mat
- **Kategorier:** Vita viner med låg alkohol, fruktiga röda
- **Smakprofil:** Låg-medel strävhet, balanserad syra
- **Specialiteter:** Riesling, Gewürztraminer

### Efterrätter
- **Kategorier:** Söta viner, Mousserande
- **Smakprofil:** Sötma 6-12
- **Specialiteter:** Sauternes, Portvin, Moscato

## Kommunikationsstil för Claude

### Personlighet
- **Entusiastisk** men inte överdriven
- **Kunnig** utan att vara pretentiös  
- **Praktisk** - fokus på vad som går att köpa
- **Svensk kontext** - prismedvetenhet, Systembolaget-specifikt

### Svarsmönster
1. **Bekräfta** vad användaren letar efter
2. **Presentera** 2-3 konkreta alternativ
3. **Förklara** kort varför de passar
4. **Inkludera** praktisk info (pris, artikel-ID, tillgänglighet)
5. **Avsluta** med uppmuntrande kommentar

### Exempel på bra svar
```
"Perfekt val för grillad lax! Jag hittade tre utmärkta vita viner som kompletterar fiskens delikata smak:

🍷 Sancerre Loire från Henri Bourgeois (289 kr, art. 12345)
Mineralskt och elegant med fin syra som lyfter fisken utan att konkurrera.

🍷 Chablis Premier Cru från Domaine Laroche (245 kr, art. 67890)  
Klassisk kombination - citrusfräscha med touch av fat som matchar grillsmaken.

🍷 Albariño från Rías Baixas (189 kr, art. 11111)
Spansk pärla med havsmineral som är som gjord för skaldjur och fisk!

Alla finns i fast sortiment så du hittar dem på de flesta Systembolag. Skål! 🥂"
```

## Tekniska detaljer Claude ska komma ihåg

### MCP-implementation
- **Transport:** stdio
- **Tools:** Definiera 3 huvudverktyg (search, details, recommendations)
- **Error handling:** Graceful fallbacks, informativa felmeddelanden
- **Performance:** Filtrera data smart, begränsa resultat

### Discord-implementation  
- **Commands:** `!vin [query]` och mentions
- **Response format:** Rich embeds med färger och struktur
- **Rate limiting:** Hantera Discord och Claude API-begränsningar
- **Error recovery:** Fallback till enklare svar vid API-fel

### Datahantering
- **Loading:** Läs wine_data.json vid start, casha i minnet
- **Filtering:** Kombinera flera filter effektivt
- **Sorting:** Prioritera fast sortiment, sedan pris
- **Limiting:** Max 10 sökresultat, 3-5 rekommendationer

## Felsökning som Claude kan hjälpa med

### Vanliga problem
1. **"Failed to load wine data"** → Kontrollera filsökväg och format
2. **"No wines found"** → För snäva sökkriterier
3. **"API errors"** → Kontrollera nycklar och rate limits
4. **"Permission denied"** → Discord bot-behörigheter eller MCP-konfiguration

### Debug-funktioner att implementera
- **Data stats** vid startup (antal viner, länder, priser)
- **Search logging** för att förstå vad som inte funkar
- **Performance metrics** för långsamma sökningar

## Utvecklingsflöde

1. **PoC först** - Testa grunddata och söklogik
2. **MCP sedan** - Bygg lokal integration  
3. **Discord sist** - Social funktionalitet
4. **Iterativ förbättring** - Lägg till funktioner baserat på användning

## Viktigt om processhantering

**KRITISKT:** Om du behöver döda alla processer (t.ex. med taskkill), **MÅSTE** du först dokumentera:
1. Vad du jobbar med just nu
2. Vilka todos som är aktiva 
3. Nästa steg i processen

Detta så att du kommer ihåg vad du höll på med när du startar om systemet.

---

**OBS för Claude:** Johan är tekniskt kunnig men vill ha konkret kod och tydliga instruktioner. Fokusera på working solutions över teoretiska diskussioner. Han uppskattar humor och vardagligt språk när det passar kontextet.