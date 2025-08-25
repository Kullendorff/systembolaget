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

class WineBot {
  private client: Client;
  private anthropic: Anthropic;
  private wines: WineProduct[] = [];

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
    this.setupEventHandlers();
  }

  private loadWineData(): void {
    try {
      const dataPath = join(__dirname, '../../shared/wine_data.json');
      const rawData = readFileSync(dataPath, 'utf-8');
      this.wines = JSON.parse(rawData);
      console.log(`Loaded ${this.wines.length} wine products from shared/wine_data.json`);
    } catch (error) {
      console.error('Failed to load wine data:', error);
      console.error('Make sure wine_data.json exists in shared/ folder');
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
      if (message.channel && 'sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }
      
      // Rensa kommando eller mention från meddelandet
      let query = message.content
        .replace('!vin ', '')
        .replace(`<@${this.client.user?.id}>`, '')
        .trim();

      if (!query) {
        await message.reply('Vad vill du veta om vin? Fråga mig om rekommendationer, sök efter specifika viner eller be om matmatchningar! 🍷');
        return;
      }

      // Kolla om det är en specifik vinnamnsökning (börjar med stort namn utan filtrerande ord)
      if (this.isSpecificWineLookup(query)) {
        await this.handleSpecificWineLookup(message, query);
        return;
      }

      // Analysera frågan med Claude och få sökparametrar
      const searchParams = await this.analyzeQuery(query);
      
      // Sök i vindatabasen
      const results = this.searchWines(searchParams);

      if (results.length === 0) {
        await message.reply('Hittade inga viner som matchar din sökning. Prova att ändra kriterierna! 🤷‍♂️');
        return;
      }

      // Skapa svar med Claude
      const response = await this.generateResponse(query, results);
      
      // Skicka svar som embed
      await this.sendWineRecommendations(message, response, results.slice(0, 3));

    } catch (error) {
      console.error('Error handling wine query:', error);
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

VIKTIGT: När någon säger "runt X kr" eller "omkring X kr", sätt minPrice till X-50 och maxPrice till X+50.

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

  private searchWines(params: any): WineProduct[] {
    let results = this.wines.filter(wine => 
      !wine.isDiscontinued && 
      !wine.isSupplierTemporaryNotAvailable &&
      !wine.isCompletelyOutOfStock &&
      !wine.isTemporaryOutOfStock &&
      this.isStandardBottleSize(wine.volumeText)
    );

    if (params.country) {
      results = results.filter(wine => 
        wine.country.toLowerCase().includes(params.country.toLowerCase())
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
        wine.productNameBold.toLowerCase().includes(searchLower) ||
        wine.productNameThin.toLowerCase().includes(searchLower) ||
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
      } else if (dishLower.includes('kött') || dishLower.includes('lamm')) {
        results = results.filter(wine => 
          wine.categoryLevel2?.includes('Rött vin') &&
          wine.tasteClockBody && wine.tasteClockBody >= 6
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
      return a.price - b.price;
    });

    return results.slice(0, 10);
  }

  private async generateResponse(query: string, wines: WineProduct[]): Promise<string> {
    const wineList = wines.slice(0, 3).map(wine => 
      `${wine.productNameBold} ${wine.productNameThin} (${wine.price} kr, ${wine.country}, ${wine.grapes?.join(', ') || 'okänd druva'})`
    ).join('\n');

    // Analysera om användaren anger ett specifikt prisintervall
    const priceMatch = query.match(/runt (\d+)|omkring (\d+)|ca (\d+)/i);
    const targetPrice = priceMatch ? parseInt(priceMatch[1] || priceMatch[2] || priceMatch[3]) : null;

    const prompt = `
Användaren frågade: "${query}"

Jag hittade dessa viner i Systembolagets sortiment:
${wineList}

${targetPrice ? `VIKTIGT: Användaren bad om viner runt ${targetPrice} kr. Kommentera att vinerna ligger i rätt prisklass och fokusera på kvalitet/värde i den prisklassen.` : ''}

Skriv ett naturligt, entusiastiskt svar på svenska som:
1. Bekräftar vad användaren letade efter
2. Presenterar de bästa alternativen med personlighet
3. Ger korta, känslovärda beskrivningar
4. Avslutar med en uppmuntrande kommentar

VIKTIGT: Håll svaret till MAX 150 ord för att passa i Discord. Vardagligt språk, som en kunnig vän.`;

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
      const grapes = wine.grapes ? wine.grapes.join(', ') : 'Okänd druva';
      const vintage = wine.vintage ? ` (${wine.vintage})` : '';
      const origin = wine.originLevel2 || wine.originLevel1 || wine.country;
      const tasteClock = this.formatTasteClock(wine);

      embed.addFields({
        name: `${index + 1}. ${wine.productNameBold} ${wine.productNameThin}${vintage}`,
        value: `📍 ${origin}\n🍇 ${grapes}\n💰 ${wine.price} kr | 🥃 ${wine.alcoholPercentage}%\n🆔 ${wine.productId}${tasteClock}`,
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

      // Sök efter vinet i databasen - hantera null värden
      const matchingWines = this.wines.filter(wine => 
        !wine.isDiscontinued &&
        !wine.isSupplierTemporaryNotAvailable &&
        !wine.isCompletelyOutOfStock &&
        !wine.isTemporaryOutOfStock &&
        this.isStandardBottleSize(wine.volumeText) &&
        wine.productNameBold && wine.productNameThin && // Säkerställ att namnen existerar
        (wine.productNameBold.toLowerCase().includes(vineName.toLowerCase()) ||
         wine.productNameThin.toLowerCase().includes(vineName.toLowerCase()))
      );

      if (matchingWines.length === 0) {
        await message.reply(`Hittade inget vin som heter "${vineName}" i Systembolagets sortiment. Kanske är det utgånget eller stavat annorlunda? 🤔`);
        return;
      }

      // Ta det bästa matchandet (prioritera Fast sortiment)
      matchingWines.sort((a, b) => {
        const aFast = a.assortmentText === 'Fast sortiment';
        const bFast = b.assortmentText === 'Fast sortiment';
        if (aFast && !bFast) return -1;
        if (!aFast && bFast) return 1;
        return a.price - b.price;
      });

      const wine = matchingWines[0];
      
      // Få Claudes analys av vinet
      const analysis = await this.analyzeSpecificWine(wine);
      
      // Skicka detaljerat svar
      await this.sendWineAnalysis(message, wine, analysis);

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

Ge en kort (max 100 ord) expertanalys på svenska som täcker:
1. Vad du tycker om vinet baserat på dess profil
2. Värde för pengarna
3. Vad det passar till
4. Några intressanta detaljer om druvor/region

Skriv som en kunnig vinexpert med personlighet.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    return content.type === 'text' ? content.text : 'Intressant vin! 🍷';
  }

  private async sendWineAnalysis(message: Message, wine: WineProduct, analysis: string): Promise<void> {
    const grapes = wine.grapes ? wine.grapes.join(', ') : 'Okänd druva';
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

  private isStandardBottleSize(volumeText: string): boolean {
    // Extrahera numeriskt värde från volumeText (t.ex. "750 ml", "375ml", "1.5 l")
    const volume = this.parseVolume(volumeText);
    // Acceptera endast flaskor på 750ml eller större
    return volume >= 750;
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