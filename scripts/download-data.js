#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_URL = 'https://raw.githubusercontent.com/AlexGustafsson/systembolaget-api-data/main/data/assortment.json';
const SHARED_DIR = path.join(__dirname, '../shared');
const OUTPUT_FILE = path.join(SHARED_DIR, 'wine_data.json');

// Skapa shared-mappen om den inte finns
if (!fs.existsSync(SHARED_DIR)) {
  fs.mkdirSync(SHARED_DIR, { recursive: true });
}

console.log('📥 Laddar ner Systembolagets sortiment...');
console.log(`   URL: ${DATA_URL}`);
console.log(`   Destination: ${OUTPUT_FILE}`);

const file = fs.createWriteStream(OUTPUT_FILE);

https.get(DATA_URL, (response) => {
  if (response.statusCode !== 200) {
    console.error(`❌ Fel vid nedladdning. Status: ${response.statusCode}`);
    process.exit(1);
  }

  const totalBytes = parseInt(response.headers['content-length'], 10);
  let downloadedBytes = 0;

  response.on('data', (chunk) => {
    downloadedBytes += chunk.length;
    const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
    process.stdout.write(`\r   Progress: ${progress}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)`);
  });

  response.pipe(file);

  file.on('finish', () => {
    file.close();
    console.log('\n✅ Data nedladdad!');
    
    // Verifiera att filen är giltig JSON
    try {
      const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      console.log(`📊 Verifierad: ${data.length} produkter`);
      
      // Visa lite statistik
      const wines = data.filter(p => p.categoryLevel1?.includes('vin'));
      const beers = data.filter(p => p.categoryLevel1?.includes('Öl'));
      const spirits = data.filter(p => p.categoryLevel1?.includes('Sprit'));
      
      console.log(`   🍷 ${wines.length} viner`);
      console.log(`   🍺 ${beers.length} öl`);
      console.log(`   🥃 ${spirits.length} spritsorter`);
      
    } catch (error) {
      console.error('❌ Nedladdad fil är inte giltig JSON!');
      fs.unlinkSync(OUTPUT_FILE);
      process.exit(1);
    }
  });
}).on('error', (err) => {
  fs.unlinkSync(OUTPUT_FILE);
  console.error(`\n❌ Nedladdning misslyckades: ${err.message}`);
  process.exit(1);
});