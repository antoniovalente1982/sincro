import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  console.log('📡 Fetching shop page to extract image URLs...');
  const res = await fetch('https://shop.metodosincro.it/');
  const html = await res.text();
  
  // Let's find images
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
  let match;
  const images = [];
  while ((match = imgRegex.exec(html)) !== null) {
    images.push(match[1]);
  }
  
  console.log(`📸 Found ${images.length} images:`);
  images.slice(0, 30).forEach((img, idx) => {
    console.log(`[${idx}] ${img}`);
  });

  // Let's find product links and image containers specifically
  // WooCommerce products typically use classes like "wp-post-image" or are inside a product list
  console.log('\n🔍 Filtering product cover images...');
  const filtered = images.filter(img => 
    img.includes('/uploads/') && 
    (img.includes('copertina') || img.includes('Guida') || img.includes('mockup') || img.includes('habit') || img.includes('potenzia') || img.includes('pressione') || img.includes('strategie') || img.includes('nutrizione') || img.includes('detox'))
  );
  
  const unique = [...new Set(filtered)];
  console.log(`📦 Found ${unique.length} unique product-like images:`);
  unique.forEach((img, idx) => {
    console.log(`[${idx}] ${img}`);
  });
}

main().catch(console.error);
