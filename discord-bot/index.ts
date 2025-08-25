import { config } from 'dotenv';
import { Client, GatewayIntentBits, Message, EmbedBuilder } from 'discord.js';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ladda .env från discord-bot mappen
config({ path: join(__dirname, '../.env') });

interface WineProduct {
  productId: string;
  productNameBold: string;
  productNameThin: string;
  vintage?: string;
  alcoholPercentage: number;
  volumeText: string;
  price: number;
  country: string;
  originLevel1?: string;
  originLevel2?: string;
  grapes?: string[];
  taste?: string;
  usage?: string;
  tasteClockBody?: number;
  tasteClockRoughness?: number;
  tasteClockSweetness?: number;
  tasteClockFruitacid?: number;
  assortmentText: string;
  categoryLevel1?: string;
  categoryLevel2?: string;
  isDiscontinued: boolean;
  isSupplierTemporaryNotAvailable: boolean;
  isCompletelyOutOfStock: boolean;
  isTemporaryOutOfStock: boolean;
}

interface UserProfile {
  userId: string;
  preferences: {
    favoriteCountries: string[];
    favoriteRegions: string[];
    preferredPriceRange: { min: number; max: number };
    highRatedWines: any[];
    stylePreferences: {
      bodyPreference: number; // 1-12 baserat på högt rankade viner
      preferredTypes: string[];
    };
  };
}

class WineBot {
  private client: Client;
  private anthropic: Anthropic;
  private wines: WineProduct[] = [];
  private johanProfile: UserProfile | null = null;
  private johanWineLog: any[] = [];

  constructor(discordToken: string, anthropicKey: string) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.anthropic = new Anthropic({
      apiKey: anthropicKey,
    });

    this.loadWineData();
    this.loadJohanProfile();
    this.setupEventHandlers();
  }

  private async loadWineData(): Promise<void> {
    try {
      console.log('Loading wine data from JSON database...');
      
      // Läs från JSON-fil istället för API (upp två steg från discord-bot/dist)
      const dataPath = join(__dirname, '../../shared/wine_database.json');
      const jsonData = readFileSync(dataPath, 'utf8');
      const data = JSON.parse(jsonData);
      
      this.wines = data.wines || [];
      console.log(`Loaded ${this.wines.length} wine products from JSON database`);
      console.log(`Database exported: ${data.metadata?.exportedAt}`);
      console.log(`Total wines in DB: ${data.metadata?.totalWines || 'unknown'}`);
      
    } catch (error) {
      console.error('Failed to load wine data from JSON:', error);
      console.error('Make sure you have exported the database with: npm run export-wines');
      console.error('Or run: cd scripts && node export-full-database.js');
      
      // Fallback till API om JSON inte fungerar
      try {
        console.error('Falling back to API...');
        const response = await fetch('http://localhost:3000/api/v1/products?limit=50000');
        if (response.ok) {
          const apiData = await response.json();
          const wineProducts = (apiData.products || apiData).filter((wine: any) => {
            const category = wine.categoryLevel1 || wine.categoryLevel2 || '';
            return category.toLowerCase().includes('vin');
          });
          this.wines = wineProducts.filter((wine: any) => 
            !wine.isDiscontinued && 
            !wine.isSupplierTemporaryNotAvailable &&
            !wine.isCompletelyOutOfStock &&
            !wine.isTemporaryOutOfStock &&
            this.isStandardBottleSize(wine.volumeText)
          );
          console.log(`Fallback: Loaded ${this.wines.length} wines from API`);
        }
      } catch (fallbackError) {
        console.error('API fallback also failed:', fallbackError);
      }
    }
  }

  private loadJohanProfile(): void {
    try {
      console.log('Loading Johan\'s wine profile...');
      
      const profilePath = join(__dirname, '../johan_wine_log.json');
      const profileData = readFileSync(profilePath, 'utf8');
      const wineLog = JSON.parse(profileData);
      
      // Spara hela vinloggen för senare uppslagning
      this.johanWineLog = wineLog.wines;
      
      // Analysera Johans smakprofil baserat på högt rankade viner (90+)
      const highRatedWines = wineLog.wines.filter((wine: any) => wine.rating >= 90);
      
      // Räkna ut favoritländer
      const countryCount: Record<string, number> = {};
      highRatedWines.forEach((wine: any) => {
        countryCount[wine.country] = (countryCount[wine.country] || 0) + 1;
      });
      
      const favoriteCountries = Object.entries(countryCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([country]) => country);
      
      // Räkna ut favoritregioner
      const regionCount: Record<string, number> = {};
      highRatedWines.forEach((wine: any) => {
        if (wine.region) {
          regionCount[wine.region] = (regionCount[wine.region] || 0) + 1;
        }
      });
      
      const favoriteRegions = Object.entries(regionCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([region]) => region);
      
      // Räkna ut prisintervall för högt rankade viner
      const prices = highRatedWines
        .map((wine: any) => {
          const priceMatch = wine.price?.match(/(\d+)/);
          return priceMatch ? parseInt(priceMatch[1]) : null;
        })
        .filter((price: number | null) => price !== null) as number[];
      
      const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 300;
      const minPrice = Math.min(...prices) || 150;
      const maxPrice = Math.max(...prices) || 800;
      
      // Identifiera prefererade vintyper baserat på högt rankade
      const typeCount: Record<string, number> = {};
      highRatedWines.forEach((wine: any) => {
        // Gissa vintyp baserat på land/region/namn
        const name = wine.name.toLowerCase();
        if (name.includes('pinot noir') || name.includes('nebbiolo') || name.includes('barbaresco') || name.includes('barolo')) {
          typeCount['Elegant rött'] = (typeCount['Elegant rött'] || 0) + 1;
        } else if (name.includes('syrah') || name.includes('cabernet')) {
          typeCount['Kraftigt rött'] = (typeCount['Kraftigt rött'] || 0) + 1;
        } else if (name.includes('riesling') || name.includes('chardonnay')) {
          typeCount['Kvalitetsvitt'] = (typeCount['Kvalitetsvitt'] || 0) + 1;
        } else if (name.includes('champagne') || name.includes('crémant')) {
          typeCount['Mousserande'] = (typeCount['Mousserande'] || 0) + 1;
        }
      });
      
      const preferredTypes = Object.entries(typeCount)
        .sort((a, b) => b[1] - a[1])
        .map(([type]) => type);
      
      this.johanProfile = {
        userId: '177927888819978240',
        preferences: {
          favoriteCountries,
          favoriteRegions,
          preferredPriceRange: { min: minPrice, max: maxPrice },
          highRatedWines: highRatedWines.slice(0, 10), // Top 10 för referens
          stylePreferences: {
            bodyPreference: 8, // Baserat på hans kärlek för Nebbiolo, Syrah etc
            preferredTypes
          }
        }
      };
      
      console.log(`Loaded profile for Johan:`);
      console.log(`- Favorite countries: ${favoriteCountries.join(', ')}`);
      console.log(`- Favorite regions: ${favoriteRegions.join(', ')}`);
      console.log(`- Price range: ${minPrice}-${maxPrice} kr (avg: ${avgPrice})`);
      console.log(`- Preferred styles: ${preferredTypes.join(', ')}`);
      
    } catch (error) {
      console.error('Failed to load Johan\'s profile:', error);
    }
  }

  private setupEventHandlers(): void {
    this.client.once('ready', () => {
      console.log(`Bot logged in as ${this.client.user?.tag}!`);
      console.log(`Listening in channel: ${process.env.ALLOWED_CHANNEL_ID || 'all channels'}`);
    });

    this.client.on('messageCreate', async (message: Message) => {
      if (message.author.bot) return;
      
      // Kolla om vi ska begränsa till specifik kanal
      if (process.env.ALLOWED_CHANNEL_ID && message.channel.id !== process.env.ALLOWED_CHANNEL_ID) {
        return;
      }
      
      // Reagera på meddelanden som börjar med !vin eller mentions
      if (message.content.startsWith('!vin ') || message.mentions.has(this.client.user!)) {
        await this.handleWineQuery(message);
      }
    });
  }

  private async handleWineQuery(message: Message): Promise<void> {
    try {
      console.log(`[DEBUG] Wine query from ${message.author.username} (${message.author.id}): "${message.content}"`);
      
      if (message.channel && 'sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }
      
      // Rensa kommando eller mention från meddelandet
      let query = message.content
        .replace('!vin ', '')
        .replace(`<@${this.client.user?.id}>`, '')
        .trim();
        
      console.log(`[DEBUG] Cleaned query: "${query}"`);

      if (!query) {
        await message.reply('Vad vill du veta om vin? Fråga mig om rekommendationer, sök efter specifika viner eller be om matmatchningar! 🍷');
        return;
      }

      // Kolla om det är en artikel-ID sökning (bara siffror)
      if (this.isProductIdLookup(query)) {
        console.log(`[DEBUG] Detected product ID lookup: ${query}`);
        await this.handleProductIdLookup(message, query);
        return;
      }

      // Kolla om det är en specifik vinnamnsökning (börjar med stort namn utan filtrerande ord)
      if (this.isSpecificWineLookup(query)) {
        console.log(`[DEBUG] Detected specific wine lookup: ${query}`);
        await this.handleSpecificWineLookup(message, query);
        return;
      }
      
      console.log(`[DEBUG] Using general search with Claude analysis`);

      // Analysera frågan med Claude och få sökparametrar
      const searchParams = await this.analyzeQuery(query);
      console.log(`[DEBUG] Claude analysis result:`, JSON.stringify(searchParams, null, 2));
      
      // Integrera Johans smakprofil om det är han som frågar
      const isJohan = message.author.id === '177927888819978240';
      console.log(`[DEBUG] Is Johan: ${isJohan}`);
      
      if (isJohan && this.johanProfile) {
        console.log(`[DEBUG] Enhancing search with Johan's profile`);
        this.enhanceSearchWithProfile(searchParams, this.johanProfile);
        console.log(`[DEBUG] Enhanced search params:`, JSON.stringify(searchParams, null, 2));
      }
      
      // Kolla om användaren vill ha dyrare viner (har satt max-pris)
      const maxPriceMatch = query.match(/max (\d+)|under (\d+)|högst (\d+)/i);
      const preferHigherPrices = !!maxPriceMatch;

      // Sök i vindatabasen
      let results = this.searchWines(searchParams, preferHigherPrices);
      console.log(`[DEBUG] Search found ${results.length} wines before personal preferences`);
      
      // Boosta resultat baserat på Johans profil om det är han
      if (isJohan && this.johanProfile) {
        console.log(`[DEBUG] Applying Johan's personal preferences`);
        results = this.applyPersonalPreferences(results, this.johanProfile);
        console.log(`[DEBUG] After personal preferences: ${results.length} wines`);
      }

      if (results.length === 0) {
        console.log(`[DEBUG] No wines found for query: "${query}"`);
        await message.reply('Hittade inga viner som matchar din sökning. Prova att ändra kriterierna! 🤷‍♂️');
        return;
      }

      // Skapa svar med Claude
      const response = await this.generateResponse(query, results, isJohan ? this.johanProfile : null);
      console.log(`[DEBUG] Generated response (${response.length} chars)`);
      
      // Skicka svar som embed
      const topResults = results.slice(0, 3);
      console.log(`[DEBUG] Sending ${topResults.length} wines:`, topResults.map(w => `${w.productNameBold} ${w.productNameThin || ''} (${w.productId})`));
      await this.sendWineRecommendations(message, response, topResults);

    } catch (error) {
      console.error('[ERROR] Error handling wine query:', error);
      if (error instanceof Error) {
        console.error('[ERROR] Stack trace:', error.stack);
      }
      await message.reply('Något gick fel när jag letade efter viner. Försök igen! 😅');
    }
  }

  private async analyzeQuery(query: string): Promise<any> {
    const prompt = `
Analysera denna vinförfrågan och extrahera sökparametrar: "${query}"

Svara med JSON enligt detta format:
{
  "country": "Land eller null",
  "grapes": ["lista med druvor"] eller null,
  "minPrice": nummer eller null,
  "maxPrice": nummer eller null,
  "categoryLevel1": "Rött vin/Vitt vin/Rosévin/Mousserande vin" eller null,
  "tasteClockBodyMin": 1-12 eller null,
  "tasteClockBodyMax": 1-12 eller null,
  "searchText": "fritextsökning" eller null,
  "dish": "maträtt om det är matmatchning" eller null
}

Exempel:
"Italienskt rött under 200 kr" → {"country": "Italien", "categoryLevel1": "Rött vin", "maxPrice": 200}
"Vad passar till lax?" → {"dish": "lax", "categoryLevel1": "Vitt vin", "tasteClockBodyMin": 3, "tasteClockBodyMax": 8}
"Fylliga Barolo" → {"searchText": "Barolo", "categoryLevel1": "Rött vin", "tasteClockBodyMin": 8}
"runt 200 kr" → {"minPrice": 150, "maxPrice": 250}
"omkring 300 kr" → {"minPrice": 250, "maxPrice": 350}
"max 300 kr" → {"maxPrice": 300}
"till älg - max 300" → {"dish": "älg", "categoryLevel1": "Rött vin", "tasteClockBodyMin": 7, "maxPrice": 300}

VIKTIGT: 
- När någon säger "runt X kr" eller "omkring X kr", sätt minPrice till X-50 och maxPrice till X+50.
- När någon säger "max X kr" eller "under X kr", sätt bara maxPrice till X (ingen minPrice).

SVARA ENDAST MED JSON!`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    try {
      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text.trim());
      }
    } catch (error) {
      console.error('Failed to parse Claude response:', error);
    }

    return {}; // Fallback till tom sökning
  }

  private searchWines(params: any, preferHigherPrices: boolean = false): WineProduct[] {
    let results = this.wines.filter(wine => 
      !wine.isDiscontinued && 
      !wine.isSupplierTemporaryNotAvailable &&
      !wine.isCompletelyOutOfStock &&
      !wine.isTemporaryOutOfStock &&
      this.isStandardBottleSize(wine.volumeText) &&
      !this.isBagInBox(wine)
    );

    if (params.country) {
      results = results.filter(wine => 
        wine.country && wine.country.toLowerCase().includes(params.country.toLowerCase())
      );
    }

    if (params.grapes && params.grapes.length > 0) {
      results = results.filter(wine => 
        wine.grapes && params.grapes.some((grape: string) => 
          wine.grapes!.some(wineGrape => 
            wineGrape.toLowerCase().includes(grape.toLowerCase())
          )
        )
      );
    }

    if (params.minPrice) {
      results = results.filter(wine => wine.price >= params.minPrice);
    }

    if (params.maxPrice) {
      results = results.filter(wine => wine.price <= params.maxPrice);
    }

    if (params.categoryLevel1) {
      results = results.filter(wine => {
        const searchTerm = params.categoryLevel1.toLowerCase();
        // Sök både i level1 och level2, men hantera specifika fall
        if (searchTerm.includes('vitt vin') || searchTerm.includes('vit')) {
          return wine.categoryLevel2?.toLowerCase().includes('vitt vin');
        }
        if (searchTerm.includes('rött vin') || searchTerm.includes('röd')) {
          return wine.categoryLevel2?.toLowerCase().includes('rött vin');
        }
        if (searchTerm.includes('rosé') || searchTerm.includes('rosa')) {
          return wine.categoryLevel2?.toLowerCase().includes('rosé');
        }
        if (searchTerm.includes('mousserande') || searchTerm.includes('champagne')) {
          return wine.categoryLevel2?.toLowerCase().includes('mousserande');
        }
        // Fallback till ursprunglig logik
        return wine.categoryLevel1?.toLowerCase().includes(searchTerm) ||
               wine.categoryLevel2?.toLowerCase().includes(searchTerm);
      });
    }

    if (params.tasteClockBodyMin) {
      results = results.filter(wine => 
        wine.tasteClockBody && wine.tasteClockBody >= params.tasteClockBodyMin
      );
    }

    if (params.tasteClockBodyMax) {
      results = results.filter(wine => 
        wine.tasteClockBody && wine.tasteClockBody <= params.tasteClockBodyMax
      );
    }

    if (params.searchText) {
      const searchLower = params.searchText.toLowerCase();
      results = results.filter(wine => 
        (wine.productNameBold && wine.productNameBold.toLowerCase().includes(searchLower)) ||
        (wine.productNameThin && wine.productNameThin.toLowerCase().includes(searchLower)) ||
        (wine.taste && wine.taste.toLowerCase().includes(searchLower))
      );
    }

    // Matmatchning
    if (params.dish) {
      const dishLower = params.dish.toLowerCase();
      if (dishLower.includes('lax') || dishLower.includes('fisk')) {
        results = results.filter(wine => 
          wine.categoryLevel2?.includes('Vitt vin') &&
          wine.tasteClockBody && wine.tasteClockBody >= 3 && wine.tasteClockBody <= 8
        );
      } else if (dishLower.includes('kött') || dishLower.includes('lamm') || dishLower.includes('älg') || dishLower.includes('vilt')) {
        results = results.filter(wine => 
          wine.categoryLevel2?.includes('Rött vin') &&
          wine.tasteClockBody && wine.tasteClockBody >= 7  // Högre krav för vilt
        );
      }
    }

    // Sortera efter relevans - prioritera tillgänglighet
    results.sort((a, b) => {
      // 1. Prioritera Fast sortiment högst
      const aFast = a.assortmentText === 'Fast sortiment';
      const bFast = b.assortmentText === 'Fast sortiment';
      if (aFast && !bFast) return -1;
      if (!aFast && bFast) return 1;
      
      // 2. Sedan Tillfälligt sortiment
      const aTemp = a.assortmentText === 'Tillfälligt sortiment';
      const bTemp = b.assortmentText === 'Tillfälligt sortiment';
      if (aTemp && !bTemp) return -1;
      if (!aTemp && bTemp) return 1;
      
      // 3. Lokalt & Småskaligt
      const aLocal = a.assortmentText === 'Lokalt & Småskaligt';
      const bLocal = b.assortmentText === 'Lokalt & Småskaligt';
      if (aLocal && !bLocal) return -1;
      if (!aLocal && bLocal) return 1;
      
      // 4. Ordervaror sist (svårast att få tag på)
      const aOrder = a.assortmentText === 'Ordervaror';
      const bOrder = b.assortmentText === 'Ordervaror';
      if (aOrder && !bOrder) return 1;
      if (!aOrder && bOrder) return -1;
      
      // 5. Inom samma sortiment, sortera efter pris
      return preferHigherPrices ? b.price - a.price : a.price - b.price;
    });

    // Ta bort eventuella dubletter baserat på productId innan vi returnerar
    const uniqueResults = results.filter((wine, index, arr) => 
      arr.findIndex(w => w.productId === wine.productId) === index
    );
    
    return uniqueResults.slice(0, 10);
  }

  private async generateResponse(query: string, wines: WineProduct[], userProfile?: UserProfile | null): Promise<string> {
    const wineList = wines.slice(0, 3).map((wine, index) => {
      const wineName = wine.productNameThin ? 
        `${wine.productNameBold} ${wine.productNameThin}` : 
        wine.productNameBold || 'Okänt vin';
      
      // Kolla om användaren har prövat detta vin tidigare (endast för Johan)
      const userTasting = this.johanWineLog.find(logWine => 
        logWine.article_number === wine.productId || 
        this.isWineNameMatch(logWine.name, wineName)
      );
      
      let wineDescription = `${index + 1}. ${wineName} (${wine.price} kr, ${wine.country}, ${wine.grapes?.join(', ') || 'okänd druva'})`;
      
      if (userTasting) {
        wineDescription += `\n   DITT TIDIGARE BETYG: ${userTasting.rating}/100`;
        if (userTasting.tasting_notes) {
          wineDescription += ` - "${userTasting.tasting_notes}"`;
        }
        if (userTasting.comments) {
          wineDescription += ` | ${userTasting.comments}`;
        }
      }
      
      return wineDescription;
    }).join('\n');

    // Analysera om användaren anger ett specifikt prisintervall
    const priceMatch = query.match(/runt (\d+)|omkring (\d+)|ca (\d+)/i);
    const targetPrice = priceMatch ? parseInt(priceMatch[1] || priceMatch[2] || priceMatch[3]) : null;

    // Analysera prisintention från frågan
    const maxPriceMatch = query.match(/max (\d+)|under (\d+)|högst (\d+)/i);
    const maxPriceRequested = maxPriceMatch ? parseInt(maxPriceMatch[1] || maxPriceMatch[2] || maxPriceMatch[3]) : null;

    // Bygg personaliserad kontext om det är Johan
    const personalContext = userProfile ? `
PERSONLIG SMAKPROFIL (Johan):
- Favoritländer: ${userProfile.preferences.favoriteCountries.join(', ')}
- Favoritregioner: ${userProfile.preferences.favoriteRegions.join(', ')}
- Högt rankade viner inkluderar: Nebbiolo (Barolo/Barbaresco), Pinot Noir, Syrah, kvalitetschardonnay och Riesling
- Uppskattar fyllighet 7-12, elegant struktur och kvalitet över lågt pris
- Gillar både klassiska och moderna uttryck från respekterade producenter
` : '';

    const prompt = `
Användaren frågade: "${query}"

${personalContext}

Jag hittade dessa viner i Systembolagets sortiment:
${wineList}

${targetPrice ? `VIKTIGT: Användaren bad om viner runt ${targetPrice} kr. Kommentera att vinerna ligger i rätt prisklass och fokusera på kvalitet/värde i den prisklassen.` : ''}
${maxPriceRequested ? `KRITISKT: Användaren specificerade MAX ${maxPriceRequested} kr. Rekommendera viner i övre delen av denna prisklass (${Math.round(maxPriceRequested * 0.7)}-${maxPriceRequested} kr) för bästa kvalitet. Undvik att föreslå billigaste alternativen utan anledning.` : ''}
${userProfile ? `PERSONLIGT: Baserat på smakprofilen, prioritera viner från favoritländer/regioner och med hans prefererade stilar.` : ''}

Skriv ett naturligt, entusiastiskt svar på svenska som:
1. Bekräftar vad användaren letade efter (inklusive prisbudget om specificerat)
2. Presenterar de bästa alternativen med personlighet
3. Ger korta, känslovärda beskrivningar
4. Förklarar kort varför just dessa viner valts
5. Avslutar med en uppmuntrande kommentar

KRITISKT: Prata ENDAST om de viner som finns i listan ovan. Hitta INTE på andra viner. Om det bara finns ett vin i listan, skriv bara om det vinet.
VIKTIGT: Håll svaret till MAX 150 ord för att passa i Discord. Vardagligt språk, som en kunnig vän.
ABSOLUT VIKTIGT: Om det finns "DITT TIDIGARE BETYG" för ett vin, referera till det som "Du har tidigare prövat detta och gav det X/100" eftersom det är användarens egen vinlogg. ALDRIG påstå att du som AI har testat vinet.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    return content.type === 'text' ? content.text : 'Ett utmärkt val! 🍷';
  }

  private async sendWineRecommendations(message: Message, response: string, wines: WineProduct[]): Promise<void> {
    // Discord embed description limit är 4096 tecken, men vi håller det kortare för säkerhet
    const truncatedResponse = response.length > 1500 ? response.substring(0, 1500) + '...' : response;
    
    const embed = new EmbedBuilder()
      .setTitle('🍷 Vinrekommendationer från Systembolaget')
      .setDescription(truncatedResponse)
      .setColor(0x8B0000) // Vinröd
      .setThumbnail('https://emoji.gg/assets/emoji/4698-wine.png');

    // Lägg till viner som fält
    wines.forEach((wine, index) => {
      const grapes = wine.grapes && wine.grapes.length > 0 ? wine.grapes.join(', ') : 'Okänd druva';
      const vintage = wine.vintage ? ` (${wine.vintage})` : '';
      const origin = wine.originLevel2 || wine.originLevel1 || wine.country;
      const tasteClock = this.formatTasteClock(wine);

      const wineName = wine.productNameThin ? 
        `${wine.productNameBold} ${wine.productNameThin}` : 
        wine.productNameBold || 'Okänt vin';
      
      const usage = wine.usage ? `\n🌡️ ${wine.usage}` : '';
      
      embed.addFields({
        name: `${index + 1}. ${wineName}${vintage}`,
        value: `📍 ${origin}\n🍇 ${grapes}\n💰 ${wine.price} kr | 🥃 ${wine.alcoholPercentage}%\n🆔 ${wine.productId}${usage}${tasteClock}`,
        inline: false,
      });
    });

    embed.setFooter({ text: 'Sök fler viner med !vin [din fråga]' });

    await message.reply({ embeds: [embed] });
  }

  private formatTasteClock(wine: WineProduct): string {
    const parts = [];
    if (wine.tasteClockBody) parts.push(`Fyllighet: ${wine.tasteClockBody}/12`);
    if (wine.tasteClockRoughness) parts.push(`Strävhet: ${wine.tasteClockRoughness}/12`);
    if (wine.tasteClockSweetness) parts.push(`Sötma: ${wine.tasteClockSweetness}/12`);
    
    return parts.length > 0 ? `\n🕐 ${parts.join(' | ')}` : '';
  }

  private isProductIdLookup(query: string): boolean {
    // Känner igen artikel-ID (bara siffror, 4-6 tecken)
    const trimmed = query.trim();
    return /^\d{4,6}$/.test(trimmed);
  }

  private async handleProductIdLookup(message: Message, productId: string): Promise<void> {
    try {
      if (message.channel && 'sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      // Sök efter vinet med artikel-ID
      const wine = this.wines.find(w => w.productId === productId);
      
      if (!wine) {
        await message.reply(`Hittade inget vin med artikel-ID ${productId}. Kolla att numret är rätt! 🤔`);
        return;
      }

      if (wine.isDiscontinued || wine.isSupplierTemporaryNotAvailable || 
          wine.isCompletelyOutOfStock || wine.isTemporaryOutOfStock) {
        await message.reply(`Vinet med artikel-ID ${productId} är tyvärr inte tillgängligt just nu. Det kan vara utgånget eller tillfälligt slut i lager. 😞`);
        return;
      }

      // Analysera vinet och visa detaljer
      const analysis = await this.analyzeSpecificWine(wine);
      await this.sendWineAnalysis(message, wine, analysis);

    } catch (error) {
      console.error('Error in product ID lookup:', error);
      await message.reply('Något gick fel när jag letade efter artikel-ID:t. Försök igen! 😅');
    }
  }

  private isSpecificWineLookup(query: string): boolean {
    // Känner igen specifika vinnamn som inte innehåller filtrerande ord
    const filterWords = ['till', 'för', 'under', 'över', 'runt', 'billig', 'dyr', 'från', 'land', 'region', 'druv'];
    const hasFilterWords = filterWords.some(word => query.toLowerCase().includes(word));
    
    // Om det inte har filtrerande ord och är mer än ett ord, antas det vara ett vinnamn
    const words = query.trim().split(' ');
    return !hasFilterWords && words.length >= 2;
  }

  private async handleSpecificWineLookup(message: Message, vineName: string): Promise<void> {
    try {
      if (message.channel && 'sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      // Sök direkt i den laddade vindatabasen
      const searchTerms = this.generateSearchVariants(vineName);
      let allMatchingWines: WineProduct[] = [];
      
      // Sök med alla varianter tills vi hittar resultat
      for (const searchTerm of searchTerms) {
        const searchLower = searchTerm.toLowerCase();
        const matches = this.wines.filter(wine => 
          wine.productNameBold?.toLowerCase().includes(searchLower) ||
          wine.productNameThin?.toLowerCase().includes(searchLower)
        );
        
        if (matches.length > 0) {
          allMatchingWines = matches;
          break; // Sluta söka när vi hittar träffar
        }
      }
      
      // JSON-databasen innehåller redan bara tillgängliga viner
      let matchingWines = allMatchingWines;

      if (matchingWines.length === 0) {
        await message.reply(`Hittade inget vin som heter "${vineName}" i Systembolagets sortiment. Kanske är det utgånget eller stavat annorlunda? 🤔`);
        return;
      }

      // Tillämpa personliga preferenser om det är Johan
      const isJohan = message.author.id === '177927888819978240';
      if (isJohan && this.johanProfile) {
        console.log(`[DEBUG] Applying Johan's preferences to specific wine search`);
        matchingWines = this.applyPersonalPreferences(matchingWines, this.johanProfile);
      }
      
      // Sortera för att hitta bästa träffar (behåll personlig sortering om den är tillämpad)
      if (!isJohan || !this.johanProfile) {
        matchingWines.sort((a: WineProduct, b: WineProduct) => {
          const aFast = a.assortmentText === 'Fast sortiment';
          const bFast = b.assortmentText === 'Fast sortiment';
          if (aFast && !bFast) return -1;
          if (!aFast && bFast) return 1;
          return a.price - b.price;
        });
      }

      // Om vi bara har en träff eller första träffen är en perfekt match
      if (matchingWines.length === 1 || this.isExactMatch(vineName, matchingWines[0])) {
        const wine = matchingWines[0];
        const analysis = await this.analyzeSpecificWine(wine);
        await this.sendWineAnalysis(message, wine, analysis);
      } else {
        // Visa flera alternativ om vi inte har exakt träff - med Claude's beskrivningar
        const topWines = matchingWines.slice(0, 3);
        const response = await this.generateResponse(vineName, topWines, isJohan ? this.johanProfile : null);
        await this.sendWineRecommendations(message, response, topWines);
      }

    } catch (error) {
      console.error('Error in specific wine lookup:', error);
      await message.reply('Något gick fel när jag letade efter vinet. Försök igen! 😅');
    }
  }

  private async analyzeSpecificWine(wine: WineProduct): Promise<string> {
    const grapes = wine.grapes ? wine.grapes.join(', ') : 'Okänd';
    const origin = wine.originLevel2 || wine.originLevel1 || wine.country;
    const taste = wine.taste || 'Ingen smakbeskrivning tillgänglig';
    
    const tasteClock = [];
    if (wine.tasteClockBody) tasteClock.push(`Fyllighet: ${wine.tasteClockBody}/12`);
    if (wine.tasteClockRoughness) tasteClock.push(`Strävhet: ${wine.tasteClockRoughness}/12`);
    if (wine.tasteClockSweetness) tasteClock.push(`Sötma: ${wine.tasteClockSweetness}/12`);
    if (wine.tasteClockFruitacid) tasteClock.push(`Fruktsyra: ${wine.tasteClockFruitacid}/12`);

    const prompt = `
Analysera detta vin från Systembolaget:

**${wine.productNameBold} ${wine.productNameThin}**
- Pris: ${wine.price} kr
- Land/Region: ${origin}  
- Druvor: ${grapes}
- Årgång: ${wine.vintage || 'Ej angiven'}
- Alkohol: ${wine.alcoholPercentage}%
- Kategori: ${wine.categoryLevel2 || wine.categoryLevel1}
- Smakbeskrivning: ${taste}
- Smakklocka: ${tasteClock.join(', ') || 'Ej angiven'}

Ge en kort (max 100 ord) analys på svenska som täcker:
1. Vad du tycker om vinet baserat på dess profil
2. Värde för pengarna
3. Vad det passar till
4. Några intressanta detaljer om druvor/region

Skriv med personlighet men undvik att kalla dig själv 'expert' eller liknande. Skriv som en kunnig vän som gillar vin.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    return content.type === 'text' ? content.text : 'Intressant vin! 🍷';
  }

  private async sendWineAnalysis(message: Message, wine: WineProduct, analysis: string): Promise<void> {
    const grapes = wine.grapes && wine.grapes.length > 0 ? wine.grapes.join(', ') : 'Okänd druva';
    const vintage = wine.vintage ? ` (${wine.vintage})` : '';
    const origin = wine.originLevel2 || wine.originLevel1 || wine.country || 'Okänt ursprung';
    const tasteClock = this.formatTasteClock(wine);
    
    // Säkerställ att vi har giltiga namn
    const productName = `${wine.productNameBold || 'Okänt'} ${wine.productNameThin || ''}`.trim();

    const embed = new EmbedBuilder()
      .setTitle(`🍷 ${productName}${vintage}`)
      .setColor(0x8B0000)
      .setThumbnail('https://emoji.gg/assets/emoji/4698-wine.png');

    // Systembolagets officiella info
    embed.addFields({
      name: '📋 Systembolagets information',
      value: `📍 **Ursprung:** ${origin}
🍇 **Druvor:** ${grapes}
💰 **Pris:** ${wine.price} kr | 🥃 **Alkohol:** ${wine.alcoholPercentage}%
📦 **Sortiment:** ${wine.assortmentText}
🆔 **Artikel-ID:** ${wine.productId}${tasteClock}`,
      inline: false
    });

    // Smakbeskrivning om den finns
    if (wine.taste) {
      embed.addFields({
        name: '👅 Smakbeskrivning',
        value: wine.taste.length > 200 ? wine.taste.substring(0, 200) + '...' : wine.taste,
        inline: false
      });
    }

    // Serveringsinformation om den finns
    if (wine.usage) {
      embed.addFields({
        name: '🌡️ Servering',
        value: wine.usage,
        inline: false
      });
    }

    // Claudes analys
    const truncatedAnalysis = analysis.length > 1000 ? analysis.substring(0, 1000) + '...' : analysis;
    embed.addFields({
      name: '🤖 Claudes vinanalys',
      value: truncatedAnalysis,
      inline: false
    });

    embed.setFooter({ text: 'Sök fler viner med !vin [vinnamn] eller !vin [beskrivning]' });

    await message.reply({ embeds: [embed] });
  }

  private generateSearchVariants(vineName: string): string[] {
    const variants = [];
    
    // Original sökning
    variants.push(vineName);
    
    // Ta bort accenter och specialtecken för fuzzy search
    const normalized = vineName
      .toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c');
    
    if (normalized !== vineName.toLowerCase()) {
      variants.push(normalized);
    }
    
    // Extrahera bara producentnamnet (första 1-2 orden)
    const words = vineName.split(' ').filter(w => w.length > 2);
    if (words.length >= 2) {
      variants.push(words.slice(0, 2).join(' '));
    }
    if (words.length >= 1) {
      variants.push(words[0]);
    }
    
    // Ta bort årgång och sök utan den
    const withoutVintage = vineName.replace(/\b(19|20)\d{2}\b/g, '').trim();
    if (withoutVintage !== vineName && withoutVintage.length > 3) {
      variants.push(withoutVintage);
    }
    
    // Lägg till normalised version av producent
    if (words.length >= 1) {
      const normalizedProducer = words[0]
        .toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ñ]/g, 'n')
        .replace(/[ç]/g, 'c');
      variants.push(normalizedProducer);
    }
    
    return [...new Set(variants)]; // Ta bort dubletter
  }

  private isStandardBottleSize(volumeText: string): boolean {
    // Extrahera numeriskt värde från volumeText (t.ex. "750 ml", "375ml", "1.5 l")
    const volume = this.parseVolume(volumeText);
    // Acceptera endast standard flaskor mellan 750ml och 1000ml
    return volume >= 750 && volume <= 1000;
  }

  private parseVolume(volumeText: string): number {
    // Hantera olika format: "750 ml", "375ml", "1.5 l", "0.75l"
    const text = volumeText.toLowerCase().replace(/\s+/g, '');
    
    // Extrahera nummer och enhet
    const match = text.match(/(\d+(?:\.\d+)?)\s*(ml|l)/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2];
    
    // Konvertera till ml
    if (unit === 'l') {
      return value * 1000;
    }
    return value;
  }

  private isBagInBox(wine: any): boolean {
    // Kolla olika sätt att identifiera bag-in-box
    if (wine.bottleText?.toLowerCase().includes('box')) return true;
    if (wine.packagingLevel1?.toLowerCase().includes('box')) return true;
    if (wine.productNameBold?.toLowerCase().includes('bag in box')) return true;
    if (wine.productNameThin?.toLowerCase().includes('bag in box')) return true;
    
    // Volym över 1.5L är ofta bag-in-box
    const volume = this.parseVolume(wine.volumeText || '');
    if (volume > 1500) return true;
    
    return false;
  }

  private enhanceSearchWithProfile(searchParams: any, profile: UserProfile): void {
    // Om inget specifikt land/region är satt, förbättra med Johans favoriter
    if (!searchParams.country && profile.preferences.favoriteCountries.length > 0) {
      // Lägg inte till automatiskt, men använd för prioritering senare
    }
    
    // Om inget prisintervall är satt, använd Johans kvalitetspreferenser
    if (!searchParams.minPrice && !searchParams.maxPrice) {
      // Föreslå viner i hans vanliga prisintervall för kvalitet
      if (searchParams.dish || searchParams.categoryLevel1) {
        searchParams.minPrice = Math.max(200, profile.preferences.preferredPriceRange.min);
      }
    }
    
    // Förstärk fyllighetsparametrar baserat på hans smak
    if (!searchParams.tasteClockBodyMin && searchParams.categoryLevel1?.toLowerCase().includes('rött')) {
      searchParams.tasteClockBodyMin = Math.max(6, profile.preferences.stylePreferences.bodyPreference - 2);
    }
  }

  private applyPersonalPreferences(wines: WineProduct[], profile: UserProfile): WineProduct[] {
    // Poängsystem för att prioritera viner som matchar Johans smak
    const scoredWines = wines.map(wine => {
      let score = 0;
      
      // +10 poäng för favoritländer
      if (profile.preferences.favoriteCountries.includes(wine.country)) {
        score += 10;
      }
      
      // +15 poäng för favoritregioner
      if (wine.originLevel1 && profile.preferences.favoriteRegions.some(region => 
          wine.originLevel1?.includes(region) || region.includes(wine.originLevel1 || ''))) {
        score += 15;
      }
      if (wine.originLevel2 && profile.preferences.favoriteRegions.some(region => 
          wine.originLevel2?.includes(region) || region.includes(wine.originLevel2 || ''))) {
        score += 15;
      }
      
      // +5 poäng för viner i hans kvalitetsprisintervall
      if (wine.price >= profile.preferences.preferredPriceRange.min * 0.8 && 
          wine.price <= profile.preferences.preferredPriceRange.max * 1.2) {
        score += 5;
      }
      
      // +8 poäng för rätt fyllighet (han gillar fylligare viner)
      if (wine.tasteClockBody && wine.tasteClockBody >= profile.preferences.stylePreferences.bodyPreference - 2) {
        score += 8;
      }
      
      // +20 poäng för druvor han historiskt uppskattat
      const favoriteGrapes = ['nebbiolo', 'pinot noir', 'syrah', 'riesling', 'chardonnay', 'sangiovese'];
      if (wine.grapes) {
        wine.grapes.forEach(grape => {
          if (favoriteGrapes.some(fav => grape.toLowerCase().includes(fav))) {
            score += 20;
          }
        });
      }
      
      return { wine, score };
    });
    
    // Sortera efter poäng (behåll ursprunglig sortering för lika poäng)
    scoredWines.sort((a, b) => {
      if (b.score === a.score) return 0;
      return b.score - a.score;
    });
    
    // Ta bort dubletter även efter personlig prioritering
    const uniqueWines = scoredWines
      .map(item => item.wine)
      .filter((wine, index, arr) => 
        arr.findIndex(w => w.productId === wine.productId) === index
      );
    
    return uniqueWines;
  }

  private isExactMatch(searchTerm: string, wine: WineProduct): boolean {
    const search = searchTerm.toLowerCase();
    const wineName = `${wine.productNameBold || ''} ${wine.productNameThin || ''}`.toLowerCase();
    
    // Kolla om söktermen innehåller årgång
    const searchVintage = search.match(/\b(19|20)\d{2}\b/);
    
    // Om användaren specificerade årgång, kräv exakt årgångsträff
    if (searchVintage && wine.vintage) {
      return search.includes(wine.vintage);
    }
    
    // Annars är det en exakt träff om vinnamnet täcker större delen av söktermen
    return wineName.includes(search) || search.includes(wineName.substring(0, wineName.length / 2));
  }

  private isWineNameMatch(logWineName: string, systemWineName: string): boolean {
    // Normalisera båda namnen för jämförelse
    const normalize = (name: string) => name
      .toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      .replace(/\b(19|20)\d{2}\b/g, '') // Ta bort årgång
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const logName = normalize(logWineName);
    const systemName = normalize(systemWineName);
    
    // Kolla om namnen liknar varandra tillräckligt
    const logWords = logName.split(' ').filter(w => w.length > 2);
    const systemWords = systemName.split(' ').filter(w => w.length > 2);
    
    // Minst 2 ord måste matcha, eller första ordet + något annat
    let matches = 0;
    for (const logWord of logWords) {
      if (systemWords.some(systemWord => 
          systemWord.includes(logWord) || logWord.includes(systemWord))) {
        matches++;
      }
    }
    
    return matches >= 2 || (matches >= 1 && logWords.length > 0 && systemWords.length > 0 && 
      (logWords[0].includes(systemWords[0]) || systemWords[0].includes(logWords[0])));
  }

  private async sendMultipleWineOptions(message: Message, originalQuery: string, wines: WineProduct[]): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle(`🍷 Hittade flera viner för "${originalQuery}"`)
      .setDescription('Här är de bästa träffarna:')
      .setColor(0x8B0000);

    wines.forEach((wine, index) => {
      const grapes = wine.grapes && wine.grapes.length > 0 ? wine.grapes.join(', ') : 'Okänd druva';
      const vintage = wine.vintage ? ` (${wine.vintage})` : '';
      const origin = wine.originLevel2 || wine.originLevel1 || wine.country;

      const wineName = wine.productNameThin ? 
        `${wine.productNameBold} ${wine.productNameThin}` : 
        wine.productNameBold || 'Okänt vin';
        
      embed.addFields({
        name: `${index + 1}. ${wineName}${vintage}`,
        value: `📍 ${origin}\n🍇 ${grapes}\n💰 ${wine.price} kr | 🆔 ${wine.productId}`,
        inline: false,
      });
    });

    embed.setFooter({ text: 'Skriv !vin [exakt vinnamn] för detaljerad analys' });
    
    await message.reply({ embeds: [embed] });
  }

  public async start(): Promise<void> {
    await this.client.login(process.env.DISCORD_TOKEN);
  }
}

// Starta boten
const bot = new WineBot(
  process.env.DISCORD_TOKEN!,
  process.env.ANTHROPIC_API_KEY!
);

bot.start().catch(console.error);