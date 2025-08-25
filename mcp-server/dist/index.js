#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
class SystembolagetMCPServer {
    server;
    wines = [];
    constructor() {
        this.server = new Server({
            name: 'systembolaget-wine-server',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
        this.loadWineData();
    }
    async loadWineData() {
        try {
            console.error('Loading wine data from JSON database...');
            // Läs från JSON-fil istället för API (upp ett steg från mcp-server mappen)
            const dataPath = join(__dirname, '../../shared/wine_database.json');
            const jsonData = readFileSync(dataPath, 'utf8');
            const data = JSON.parse(jsonData);
            this.wines = data.wines || [];
            console.error(`Loaded ${this.wines.length} wine products from JSON database`);
            console.error(`Database exported: ${data.metadata?.exportedAt}`);
            console.error(`Total wines in DB: ${data.metadata?.totalWines || 'unknown'}`);
        }
        catch (error) {
            console.error('Failed to load wine data from JSON:', error);
            console.error('Make sure you have exported the database with: npm run export-wines');
            console.error('Or run: cd scripts && node export-full-database.js');
            // Fallback till API om JSON inte fungerar
            try {
                console.error('Falling back to API...');
                const response = await fetch('http://localhost:3000/api/v1/products?limit=50000');
                if (response.ok) {
                    const apiData = await response.json();
                    const wineProducts = (apiData.products || apiData).filter((wine) => {
                        const category = wine.categoryLevel1 || wine.categoryLevel2 || '';
                        return category.toLowerCase().includes('vin');
                    });
                    this.wines = wineProducts.filter((wine) => !wine.isDiscontinued &&
                        !wine.isSupplierTemporaryNotAvailable &&
                        !wine.isCompletelyOutOfStock &&
                        !wine.isTemporaryOutOfStock &&
                        this.isStandardBottleSize(wine.volumeText));
                    console.error(`Fallback: Loaded ${this.wines.length} wines from API`);
                }
            }
            catch (fallbackError) {
                console.error('API fallback also failed:', fallbackError);
            }
        }
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'search_wines',
                        description: `Söker i Systembolagets sortiment efter viner baserat på olika kriterier. 
            Perfekt för att hitta viner till mat, specific druvor, regioner eller prisklasser.
            Kan också användas för att få rekommendationer baserat på smakprofil.`,
                        inputSchema: {
                            type: 'object',
                            properties: {
                                country: {
                                    type: 'string',
                                    description: 'Ursprungsland (t.ex. "Italien", "Frankrike", "Spanien")',
                                },
                                grapes: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Lista med druvsorter (t.ex. ["Chardonnay", "Sauvignon Blanc"])',
                                },
                                minPrice: {
                                    type: 'number',
                                    description: 'Lägsta pris i SEK',
                                },
                                maxPrice: {
                                    type: 'number',
                                    description: 'Högsta pris i SEK',
                                },
                                minAlcohol: {
                                    type: 'number',
                                    description: 'Lägsta alkoholhalt i procent',
                                },
                                maxAlcohol: {
                                    type: 'number',
                                    description: 'Högsta alkoholhalt i procent',
                                },
                                vintage: {
                                    type: 'string',
                                    description: 'Specifik årgång (t.ex. "2020")',
                                },
                                categoryLevel1: {
                                    type: 'string',
                                    description: 'Vinkategori (t.ex. "Rött vin", "Vitt vin", "Rosévin", "Mousserande vin"). Systemet söker i både level1 och level2.',
                                },
                                categoryLevel2: {
                                    type: 'string',
                                    description: 'Underkategori för mer specifik sökning',
                                },
                                tasteClockBodyMin: {
                                    type: 'number',
                                    description: 'Minsta fyllighet på skala 1-12 (1=mycket lätt, 12=mycket fyllig)',
                                },
                                tasteClockBodyMax: {
                                    type: 'number',
                                    description: 'Högsta fyllighet på skala 1-12',
                                },
                                tasteClockRoughnessMin: {
                                    type: 'number',
                                    description: 'Minsta strävhet/tanniner på skala 1-12 (1=mycket mjuk, 12=mycket strävt)',
                                },
                                tasteClockRoughnessMax: {
                                    type: 'number',
                                    description: 'Högsta strävhet/tanniner på skala 1-12',
                                },
                                tasteClockSweetnessMin: {
                                    type: 'number',
                                    description: 'Minsta sötma på skala 1-12 (1=mycket torrt, 12=mycket sött)',
                                },
                                tasteClockSweetnessMax: {
                                    type: 'number',
                                    description: 'Högsta sötma på skala 1-12',
                                },
                                searchText: {
                                    type: 'string',
                                    description: 'Fritextsökning i produktnamn och beskrivning',
                                },
                                limit: {
                                    type: 'number',
                                    description: 'Max antal resultat att returnera (standard: 10)',
                                    default: 10,
                                },
                            },
                        },
                    },
                    {
                        name: 'get_wine_details',
                        description: 'Hämtar detaljerad information om ett specifikt vin baserat på produktID',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                productId: {
                                    type: 'string',
                                    description: 'Produktens ID från Systembolaget',
                                },
                            },
                            required: ['productId'],
                        },
                    },
                    {
                        name: 'analyze_specific_wine',
                        description: `Analyserar ett specifikt vin baserat på dess namn. Ger både Systembolagets data och expertanalys.`,
                        inputSchema: {
                            type: 'object',
                            properties: {
                                wineName: {
                                    type: 'string',
                                    description: 'Namnet på vinet att analysera (t.ex. "Barolo Fontanafredda", "Chablis Premier Cru")',
                                },
                            },
                            required: ['wineName'],
                        },
                    },
                    {
                        name: 'get_wine_recommendations',
                        description: `Ger vinrekommendationer baserat på maträtter eller smakpreferenser.
            Använder intern logik för att matcha viner med mat.`,
                        inputSchema: {
                            type: 'object',
                            properties: {
                                dish: {
                                    type: 'string',
                                    description: 'Beskrivning av maträtt eller kött/fisk/vegetarisk (t.ex. "grillad lax", "pasta carbonara", "lammstek")',
                                },
                                preferredStyle: {
                                    type: 'string',
                                    description: 'Önskad vinstil: "light", "medium", "full", "crisp", "smooth", "bold"',
                                },
                                maxPrice: {
                                    type: 'number',
                                    description: 'Maxpris i SEK',
                                    default: 300,
                                },
                                limit: {
                                    type: 'number',
                                    description: 'Antal rekommendationer',
                                    default: 5,
                                },
                            },
                            required: ['dish'],
                        },
                    },
                ],
            };
        });
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                if (request.params.name === 'search_wines') {
                    const filters = request.params.arguments;
                    const results = this.searchWines(filters);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Hittade ${results.length} viner som matchar kriterierna:\n\n` +
                                    results.map(wine => this.formatWineResult(wine)).join('\n\n'),
                            },
                        ],
                    };
                }
                if (request.params.name === 'get_wine_details') {
                    const { productId } = request.params.arguments;
                    const wine = this.wines.find(w => w.productId === productId);
                    if (!wine) {
                        throw new McpError(ErrorCode.InvalidParams, `Wine with ID ${productId} not found`);
                    }
                    return {
                        content: [
                            {
                                type: 'text',
                                text: this.formatDetailedWine(wine),
                            },
                        ],
                    };
                }
                if (request.params.name === 'analyze_specific_wine') {
                    const { wineName } = request.params.arguments;
                    const analysis = await this.analyzeSpecificWine(wineName);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: analysis,
                            },
                        ],
                    };
                }
                if (request.params.name === 'get_wine_recommendations') {
                    const { dish, preferredStyle, maxPrice = 300, limit = 5 } = request.params.arguments;
                    const recommendations = this.getWineRecommendations(dish, preferredStyle, maxPrice, limit);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Vinrekommendationer till "${dish}":\n\n` +
                                    recommendations.map(wine => this.formatWineResult(wine)).join('\n\n'),
                            },
                        ],
                    };
                }
                throw new McpError(ErrorCode.MethodNotFound, `Tool ${request.params.name} not found`);
            }
            catch (error) {
                if (error instanceof McpError) {
                    throw error;
                }
                throw new McpError(ErrorCode.InternalError, `Error executing tool: ${error}`);
            }
        });
    }
    searchWines(filters) {
        let results = this.wines.filter(wine => !wine.isDiscontinued &&
            !wine.isSupplierTemporaryNotAvailable &&
            !wine.isCompletelyOutOfStock &&
            !wine.isTemporaryOutOfStock &&
            this.isStandardBottleSize(wine.volumeText));
        if (filters.country) {
            results = results.filter(wine => wine.country.toLowerCase().includes(filters.country.toLowerCase()));
        }
        if (filters.grapes && filters.grapes.length > 0) {
            results = results.filter(wine => wine.grapes && filters.grapes.some(grape => wine.grapes.some(wineGrape => wineGrape.toLowerCase().includes(grape.toLowerCase()))));
        }
        if (filters.minPrice !== undefined) {
            results = results.filter(wine => wine.price >= filters.minPrice);
        }
        if (filters.maxPrice !== undefined) {
            results = results.filter(wine => wine.price <= filters.maxPrice);
        }
        if (filters.minAlcohol !== undefined) {
            results = results.filter(wine => wine.alcoholPercentage >= filters.minAlcohol);
        }
        if (filters.maxAlcohol !== undefined) {
            results = results.filter(wine => wine.alcoholPercentage <= filters.maxAlcohol);
        }
        if (filters.vintage) {
            results = results.filter(wine => wine.vintage === filters.vintage);
        }
        if (filters.categoryLevel1) {
            results = results.filter(wine => {
                const searchTerm = filters.categoryLevel1.toLowerCase();
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
        if (filters.tasteClockBodyMin !== undefined) {
            results = results.filter(wine => wine.tasteClockBody !== undefined && wine.tasteClockBody >= filters.tasteClockBodyMin);
        }
        if (filters.tasteClockBodyMax !== undefined) {
            results = results.filter(wine => wine.tasteClockBody !== undefined && wine.tasteClockBody <= filters.tasteClockBodyMax);
        }
        if (filters.searchText) {
            const searchLower = filters.searchText.toLowerCase();
            results = results.filter(wine => wine.productNameBold.toLowerCase().includes(searchLower) ||
                wine.productNameThin.toLowerCase().includes(searchLower) ||
                (wine.taste && wine.taste.toLowerCase().includes(searchLower)));
        }
        // Sortera efter relevans - prioritera tillgänglighet
        results.sort((a, b) => {
            // 1. Prioritera Fast sortiment högst
            const aFast = a.assortmentText === 'Fast sortiment';
            const bFast = b.assortmentText === 'Fast sortiment';
            if (aFast && !bFast)
                return -1;
            if (!aFast && bFast)
                return 1;
            // 2. Sedan Tillfälligt sortiment
            const aTemp = a.assortmentText === 'Tillfälligt sortiment';
            const bTemp = b.assortmentText === 'Tillfälligt sortiment';
            if (aTemp && !bTemp)
                return -1;
            if (!aTemp && bTemp)
                return 1;
            // 3. Lokalt & Småskaligt
            const aLocal = a.assortmentText === 'Lokalt & Småskaligt';
            const bLocal = b.assortmentText === 'Lokalt & Småskaligt';
            if (aLocal && !bLocal)
                return -1;
            if (!aLocal && bLocal)
                return 1;
            // 4. Ordervaror sist (svårast att få tag på)
            const aOrder = a.assortmentText === 'Ordervaror';
            const bOrder = b.assortmentText === 'Ordervaror';
            if (aOrder && !bOrder)
                return 1;
            if (!aOrder && bOrder)
                return -1;
            // 5. Inom samma sortiment, sortera efter pris
            return a.price - b.price;
        });
        return results.slice(0, filters.limit || 10);
    }
    getWineRecommendations(dish, preferredStyle, maxPrice = 300, limit = 5) {
        const dishLower = dish.toLowerCase();
        let filters = { maxPrice, limit: limit * 3 }; // Hämta fler för att kunna filtrera
        // Enkel matmatchningslogik
        if (dishLower.includes('lax') || dishLower.includes('fisk') || dishLower.includes('skaldjur')) {
            filters.categoryLevel1 = 'Vitt vin';
            filters.tasteClockBodyMin = 3;
            filters.tasteClockBodyMax = 8;
        }
        else if (dishLower.includes('kött') || dishLower.includes('lamm') || dishLower.includes('nöt') || dishLower.includes('stek')) {
            filters.categoryLevel1 = 'Rött vin';
            filters.tasteClockBodyMin = 6;
        }
        else if (dishLower.includes('kyckling') || dishLower.includes('pasta') || dishLower.includes('pizza')) {
            // Både rött och vitt kan fungera - vi tar lite av vardera
            filters.tasteClockBodyMin = 4;
            filters.tasteClockBodyMax = 9;
        }
        else if (dishLower.includes('ost') || dishLower.includes('cheese')) {
            filters.categoryLevel1 = 'Rött vin';
            filters.tasteClockBodyMin = 7;
        }
        // Anpassa efter prefererad stil
        if (preferredStyle) {
            switch (preferredStyle.toLowerCase()) {
                case 'light':
                    filters.tasteClockBodyMax = 6;
                    filters.categoryLevel1 = 'Vitt vin';
                    break;
                case 'full':
                case 'bold':
                    filters.tasteClockBodyMin = 8;
                    filters.categoryLevel1 = 'Rött vin';
                    break;
                case 'crisp':
                    filters.categoryLevel1 = 'Vitt vin';
                    filters.tasteClockFruitacid = 7;
                    break;
            }
        }
        const results = this.searchWines(filters);
        return results.slice(0, limit);
    }
    formatWineResult(wine) {
        const grapes = wine.grapes ? wine.grapes.join(', ') : 'Okänd druva';
        const vintage = wine.vintage ? ` (${wine.vintage})` : '';
        const origin = wine.originLevel2 || wine.originLevel1 || wine.country;
        const taste = wine.taste ? `\nSmak: ${wine.taste}` : '';
        const usage = wine.usage ? `\n🌡️ ${wine.usage}` : '';
        const tasteClock = this.formatTasteClock(wine);
        return `**${wine.productNameBold} ${wine.productNameThin}${vintage}**
📍 ${origin} | 🍇 ${grapes} | 🍾 ${wine.volumeText} | 💰 ${wine.price} kr | 🥃 ${wine.alcoholPercentage}%
ID: ${wine.productId}${taste}${usage}${tasteClock}`;
    }
    formatDetailedWine(wine) {
        return `# ${wine.productNameBold} ${wine.productNameThin}

**Grundinfo:**
- Produkt-ID: ${wine.productId}
- Årgång: ${wine.vintage || 'Ej angiven'}
- Land: ${wine.country}
- Region: ${wine.originLevel1 || 'Ej angiven'}
- Appellation: ${wine.originLevel2 || 'Ej angiven'}
- Druvor: ${wine.grapes ? wine.grapes.join(', ') : 'Ej angiven'}

**Teknisk data:**
- Alkoholhalt: ${wine.alcoholPercentage}%
- Volym: ${wine.volumeText}
- Pris: ${wine.price} kr
- Kategori: ${wine.categoryLevel1}${wine.categoryLevel2 ? ` > ${wine.categoryLevel2}` : ''}
- Sortiment: ${wine.assortmentText}

**Smakprofil:**
${wine.taste || 'Ingen smakbeskrivning tillgänglig'}

**Servering:**
${wine.usage || 'Ingen serveringsinformation tillgänglig'}

**Smakklocka:**
${this.formatTasteClock(wine)}

**Status:**
- Utgången: ${wine.isDiscontinued ? 'Ja' : 'Nej'}
- Tillfälligt slut: ${wine.isSupplierTemporaryNotAvailable ? 'Ja' : 'Nej'}`;
    }
    formatTasteClock(wine) {
        if (!wine.tasteClockBody && !wine.tasteClockRoughness && !wine.tasteClockSweetness && !wine.tasteClockFruitacid) {
            return '';
        }
        const parts = [];
        if (wine.tasteClockBody)
            parts.push(`Fyllighet: ${wine.tasteClockBody}/12`);
        if (wine.tasteClockRoughness)
            parts.push(`Strävhet: ${wine.tasteClockRoughness}/12`);
        if (wine.tasteClockSweetness)
            parts.push(`Sötma: ${wine.tasteClockSweetness}/12`);
        if (wine.tasteClockFruitacid)
            parts.push(`Fruktsyra: ${wine.tasteClockFruitacid}/12`);
        return parts.length > 0 ? `\n🕐 ${parts.join(' | ')}` : '';
    }
    isStandardBottleSize(volumeText) {
        // Extrahera numeriskt värde från volumeText (t.ex. "750 ml", "375ml", "1.5 l")
        const volume = this.parseVolume(volumeText);
        // Acceptera endast flaskor på 750ml eller större
        return volume >= 750;
    }
    parseVolume(volumeText) {
        // Hantera olika format: "750 ml", "375ml", "1.5 l", "0.75l"
        const text = volumeText.toLowerCase().replace(/\s+/g, '');
        // Extrahera nummer och enhet
        const match = text.match(/(\d+(?:\.\d+)?)\s*(ml|l)/);
        if (!match)
            return 0;
        const value = parseFloat(match[1]);
        const unit = match[2];
        // Konvertera till ml
        if (unit === 'l') {
            return value * 1000;
        }
        return value;
    }
    async analyzeSpecificWine(wineName) {
        // Sök efter vinet i databasen - hantera null värden
        const matchingWines = this.wines.filter(wine => !wine.isDiscontinued &&
            !wine.isSupplierTemporaryNotAvailable &&
            !wine.isCompletelyOutOfStock &&
            !wine.isTemporaryOutOfStock &&
            this.isStandardBottleSize(wine.volumeText) &&
            wine.productNameBold && wine.productNameThin && // Säkerställ att namnen existerar
            (wine.productNameBold.toLowerCase().includes(wineName.toLowerCase()) ||
                wine.productNameThin.toLowerCase().includes(wineName.toLowerCase())));
        if (matchingWines.length === 0) {
            return `Hittade inget vin som heter "${wineName}" i Systembolagets tillgängliga sortiment. Kanske är det utgånget eller stavat annorlunda?`;
        }
        // Ta det bästa matchandet (prioritera Fast sortiment)
        matchingWines.sort((a, b) => {
            const aFast = a.assortmentText === 'Fast sortiment';
            const bFast = b.assortmentText === 'Fast sortiment';
            if (aFast && !bFast)
                return -1;
            if (!aFast && bFast)
                return 1;
            return a.price - b.price;
        });
        const wine = matchingWines[0];
        // Formatera detaljerad information
        const grapes = wine.grapes ? wine.grapes.join(', ') : 'Okänd';
        const origin = wine.originLevel2 || wine.originLevel1 || wine.country;
        const taste = wine.taste || 'Ingen smakbeskrivning tillgänglig';
        const vintage = wine.vintage ? ` (${wine.vintage})` : '';
        const tasteClock = [];
        if (wine.tasteClockBody)
            tasteClock.push(`Fyllighet: ${wine.tasteClockBody}/12`);
        if (wine.tasteClockRoughness)
            tasteClock.push(`Strävhet: ${wine.tasteClockRoughness}/12`);
        if (wine.tasteClockSweetness)
            tasteClock.push(`Sötma: ${wine.tasteClockSweetness}/12`);
        if (wine.tasteClockFruitacid)
            tasteClock.push(`Fruktsyra: ${wine.tasteClockFruitacid}/12`);
        return `# ${wine.productNameBold} ${wine.productNameThin}${vintage}

## 📋 Systembolagets information

**Grunduppgifter:**
- **Pris:** ${wine.price} kr
- **Ursprung:** ${origin}
- **Druvor:** ${grapes}
- **Alkoholhalt:** ${wine.alcoholPercentage}%
- **Volym:** ${wine.volumeText}
- **Kategori:** ${wine.categoryLevel2 || wine.categoryLevel1}
- **Sortiment:** ${wine.assortmentText}
- **Artikel-ID:** ${wine.productId}

**Smakprofil:**
${taste}

**Servering:**
${wine.usage || 'Ingen serveringsinformation tillgänglig'}

**Smakklocka:**
${tasteClock.join(' | ') || 'Ej angiven'}

**Status:**
- Utgången: ${wine.isDiscontinued ? 'Ja' : 'Nej'}
- Tillfälligt slut: ${wine.isSupplierTemporaryNotAvailable ? 'Ja' : 'Nej'}

${matchingWines.length > 1 ? `\n*Hittade ${matchingWines.length} matcher - visar det bästa alternativet.*` : ''}`;
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Systembolaget MCP Server running on stdio');
    }
}
const server = new SystembolagetMCPServer();
server.run().catch(console.error);
//# sourceMappingURL=index.js.map