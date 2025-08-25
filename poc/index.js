#!/usr/bin/env node

/**
 * PROOF OF CONCEPT - Systembolaget Wine Search
 * 
 * Minimal script för att testa datastrukturen och grundläggande sök.
 * Kör detta först för att verifiera att allt fungerar innan du bygger MCP/Discord-bot.
 */

const { readFileSync } = require('fs');
const { createInterface } = require('readline');
const { join } = require('path');

// Enkel interface för att testa interaktivt
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

let wines = [];

// Ladda data
function loadWineData() {
  try {
    console.log('🔄 Laddar vindata...');
    // Försök olika platser för wine_data.json
    let dataPath = join(__dirname, '../shared/wine_data.json');
    const rawData = readFileSync(dataPath, 'utf-8');
    wines = JSON.parse(rawData);
    console.log(`✅ Laddade ${wines.length} viner från Systembolaget`);
    
    // Visa lite statistik
    const countries = [...new Set(wines.map(w => w.country))].filter(Boolean);
    const redWines = wines.filter(w => w.categoryLevel1?.includes('Rött'));
    const whiteWines = wines.filter(w => w.categoryLevel1?.includes('Vitt'));
    
    console.log(`📊 Statistik:`);
    console.log(`   🌍 ${countries.length} länder`);
    console.log(`   🔴 ${redWines.length} röda viner`);
    console.log(`   ⚪ ${whiteWines.length} vita viner`);
    console.log(`   💰 Prisspan: ${Math.min(...wines.map(w => w.price))} - ${Math.max(...wines.map(w => w.price))} kr`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Kunde inte ladda wine_data.json från shared/wine_data.json');
    console.error('Kör: npm run download-data');
    console.error('Eller ladda ner manuellt från:');
    console.error('https://raw.githubusercontent.com/AlexGustafsson/systembolaget-api-data/main/data/assortment.json');
    process.exit(1);
  }
}

// Enkel sökning
function searchWines(query) {
  const queryLower = query.toLowerCase();
  
  return wines.filter(wine => {
    // Sök i namn
    const nameMatch = wine.productNameBold?.toLowerCase().includes(queryLower) ||
                     wine.productNameThin?.toLowerCase().includes(queryLower);
    
    // Sök i land
    const countryMatch = wine.country?.toLowerCase().includes(queryLower);
    
    // Sök i druvor
    const grapeMatch = wine.grapes?.some(grape => 
      grape.toLowerCase().includes(queryLower)
    );
    
    // Sök i region
    const regionMatch = wine.originLevel1?.toLowerCase().includes(queryLower) ||
                       wine.originLevel2?.toLowerCase().includes(queryLower);
    
    // Inte utgången
    const available = !wine.isDiscontinued;
    
    return (nameMatch || countryMatch || grapeMatch || regionMatch) && available;
  }).slice(0, 5); // Max 5 resultat för PoC
}

// Formatera resultat
function formatWine(wine) {
  const grapes = wine.grapes ? wine.grapes.join(', ') : 'Okänd druva';
  const vintage = wine.vintage ? ` (${wine.vintage})` : '';
  const origin = wine.originLevel2 || wine.originLevel1 || wine.country;
  
  let result = `🍷 ${wine.productNameBold} ${wine.productNameThin}${vintage}`;
  result += `\n   📍 ${origin} | 🍇 ${grapes}`;
  result += `\n   💰 ${wine.price} kr | 🥃 ${wine.alcoholPercentage}% | 🆔 ${wine.productId}`;
  
  if (wine.tasteClockBody || wine.tasteClockRoughness || wine.tasteClockSweetness) {
    const taste = [];
    if (wine.tasteClockBody) taste.push(`Fyllighet: ${wine.tasteClockBody}/12`);
    if (wine.tasteClockRoughness) taste.push(`Strävhet: ${wine.tasteClockRoughness}/12`);
    if (wine.tasteClockSweetness) taste.push(`Sötma: ${wine.tasteClockSweetness}/12`);
    result += `\n   🕐 ${taste.join(' | ')}`;
  }
  
  if (wine.taste) {
    const shortTaste = wine.taste.length > 100 ? 
      wine.taste.substring(0, 100) + '...' : wine.taste;
    result += `\n   👄 ${shortTaste}`;
  }
  
  return result;
}

// Testfunktioner
function runTests() {
  console.log('🧪 Kör tester...\n');
  
  const tests = [
    'Italien',
    'Chardonnay', 
    'Barolo',
    'Champagne',
    'Bordeaux'
  ];
  
  tests.forEach(test => {
    console.log(`🔍 Testar: "${test}"`);
    const results = searchWines(test);
    console.log(`   Hittade ${results.length} resultat`);
    
    if (results.length > 0) {
      console.log(`   Exempel: ${results[0].productNameBold} - ${results[0].price} kr`);
    }
    console.log('');
  });
}

// Interaktiv session
function startInteractiveSession() {
  console.log('🎯 Interaktiv vinsökning startad!');
  console.log('Skriv söktermer som "Italien", "Chardonnay", "under 200", etc.');
  console.log('Skriv "test" för att köra automatiska tester');
  console.log('Skriv "quit" för att avsluta\n');
  
  function askForSearch() {
    rl.question('🍷 Sök vin: ', (input) => {
      const query = input.trim();
      
      if (query.toLowerCase() === 'quit' || query.toLowerCase() === 'exit') {
        console.log('👋 Tack för att du testade vinsökningen!');
        rl.close();
        return;
      }
      
      if (query.toLowerCase() === 'test') {
        runTests();
        askForSearch();
        return;
      }
      
      if (!query) {
        askForSearch();
        return;
      }
      
      console.log(`\n🔍 Söker efter: "${query}"`);
      const results = searchWines(query);
      
      if (results.length === 0) {
        console.log('❌ Inga viner hittades. Prova ett annat sökord.\n');
      } else {
        console.log(`✅ Hittade ${results.length} viner:\n`);
        results.forEach((wine, index) => {
          console.log(`${index + 1}. ${formatWine(wine)}\n`);
        });
      }
      
      askForSearch();
    });
  }
  
  askForSearch();
}

// Huvudprogram
function main() {
  console.log('🍷 SYSTEMBOLAGET WINE SEARCH - PROOF OF CONCEPT');
  console.log('================================================\n');
  
  loadWineData();
  
  // Kolla om det finns command line argument
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // Direkt sökning
    const query = args.join(' ');
    console.log(`🔍 Söker efter: "${query}"`);
    const results = searchWines(query);
    
    if (results.length === 0) {
      console.log('❌ Inga viner hittades.');
    } else {
      console.log(`✅ Hittade ${results.length} viner:\n`);
      results.forEach((wine, index) => {
        console.log(`${index + 1}. ${formatWine(wine)}\n`);
      });
    }
  } else {
    // Interaktiv mode
    startInteractiveSession();
  }
}

// Kör programmet
main();