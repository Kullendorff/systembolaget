#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Exporterar hela vindatabasen från systemet-collector till en JSON-fil
 */

async function exportFullDatabase() {
  try {
    console.log('🍷 Exporterar hela vindatabasen...');
    
    // Hämta alla produkter från API:t (utan begränsning)
    const response = await fetch('http://localhost:3000/api/v1/products?limit=50000');
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const data = await response.json();
    const wines = data.products || data;
    
    // Filtrera till bara viner (inte öl, sprit, etc)
    const wineProducts = wines.filter(wine => {
      const category = wine.categoryLevel1 || wine.categoryLevel2 || '';
      return category.toLowerCase().includes('vin') || 
             category.toLowerCase().includes('wine');
    });
    
    console.log(`📊 Hittade ${wines.length} produkter totalt`);
    console.log(`🍷 Varav ${wineProducts.length} viner`);
    
    // Filtrera till bara tillgängliga viner och standardflaskor
    const availableWines = wineProducts.filter(wine => {
      // Kolla tillgänglighet
      if (wine.isDiscontinued || 
          wine.isSupplierTemporaryNotAvailable || 
          wine.isCompletelyOutOfStock || 
          wine.isTemporaryOutOfStock) {
        return false;
      }
      
      // Filtrera bort bag-in-box
      if (isBagInBox(wine)) {
        return false;
      }
      
      // Kolla flaskstorlek (750ml eller större)
      const volume = parseVolume(wine.volumeText);
      return volume >= 750;
    });
    
    console.log(`✅ ${availableWines.length} tillgängliga viner (${Math.round(availableWines.length/wines.length*100)}%)`);
    
    // Lägg till metadata
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        totalProducts: wines.length,
      totalWines: wineProducts.length,
        availableWines: availableWines.length,
        version: "1.0.0",
        source: "systemet-collector"
      },
      wines: availableWines
    };
    
    // Spara till shared mappen
    const outputPath = path.join(__dirname, '../shared/wine_database.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');
    
    console.log(`💾 Sparad till: ${outputPath}`);
    console.log(`📁 Filstorlek: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
    
    // Skapa också en backup med timestamp
    const backupPath = path.join(__dirname, '../shared/backups/', `wine_database_${new Date().toISOString().slice(0,10)}.json`);
    
    // Skapa backup-mapp om den inte finns
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    fs.copyFileSync(outputPath, backupPath);
    console.log(`🔄 Backup sparad: ${backupPath}`);
    
    // Visa statistik
    showStatistics(availableWines);
    
  } catch (error) {
    console.error('❌ Fel vid export:', error.message);
    console.error('💡 Kontrollera att systemet-collector körs på http://localhost:3000');
    process.exit(1);
  }
}

function parseVolume(volumeText) {
  if (!volumeText) return 0;
  
  const text = volumeText.toLowerCase().replace(/\s+/g, '');
  const match = text.match(/(\d+(?:\.\d+)?)\s*(ml|l)/);
  
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2];
  
  return unit === 'l' ? value * 1000 : value;
}

function isBagInBox(wine) {
  // Kolla olika sätt att identifiera bag-in-box
  if (wine.bottleText?.toLowerCase().includes('box')) return true;
  if (wine.packagingLevel1?.toLowerCase().includes('box')) return true;
  if (wine.productNameBold?.toLowerCase().includes('bag in box')) return true;
  if (wine.productNameThin?.toLowerCase().includes('bag in box')) return true;
  
  // Volym över 1.5L är ofta bag-in-box
  const volume = parseVolume(wine.volumeText || '');
  if (volume > 1500) return true;
  
  return false;
}

function showStatistics(wines) {
  console.log('\n📈 Statistik:');
  
  // Länder
  const countries = {};
  wines.forEach(wine => {
    const country = wine.country || 'Okänt';
    countries[country] = (countries[country] || 0) + 1;
  });
  
  console.log(`🌍 Länder: ${Object.keys(countries).length}`);
  const topCountries = Object.entries(countries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  topCountries.forEach(([country, count]) => {
    console.log(`   ${country}: ${count} viner`);
  });
  
  // Prisintervall
  const prices = wines.map(w => w.price).filter(p => p > 0).sort((a, b) => a - b);
  if (prices.length > 0) {
    console.log(`💰 Pris: ${prices[0]} - ${prices[prices.length-1]} kr`);
    console.log(`   Median: ${prices[Math.floor(prices.length/2)]} kr`);
  }
  
  // Kategorier
  const categories = {};
  wines.forEach(wine => {
    const cat = wine.categoryLevel2 || wine.categoryLevel1 || 'Okänt';
    categories[cat] = (categories[cat] || 0) + 1;
  });
  
  console.log(`🍷 Kategorier: ${Object.keys(categories).length}`);
  const topCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  topCategories.forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count} viner`);
  });
}

// Kör export
if (require.main === module) {
  exportFullDatabase();
}

module.exports = { exportFullDatabase };