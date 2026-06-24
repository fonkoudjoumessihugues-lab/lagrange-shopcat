#!/bin/bash
echo "🔄 Réinitialisation de l'IA à son état initial..."

node -e "
const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Localiser la section IA actuelle
const startMarker = '// ========== IA ==========';
const endMarker = '// ========== CONFIGURATION FACTURE ==========';

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.log('❌ Marqueurs IA non trouvés');
  process.exit(1);
}

// IA INITIALE (comme dans ton code)
const initialIA = `// ========== IA ==========
app.post('/api/ai/ask', auth, (req, res) => {
  try {
    const { question, shopId } = req.body;
    const lower = question.toLowerCase();
    const userDir = getUserDataDir(req.userId);
    const sales = readJSON(path.join(userDir, 'sales.json'), []);
    const products = readJSON(path.join(userDir, 'products.json'), []);
    const expenses = readJSON(path.join(userDir, 'expenses.json'), []);

    const shopSales = sales.filter(s => s.shopId === shopId && !s.cancelled);
    const shopProducts = products.filter(p => p.shopId === shopId);
    const shopExpenses = expenses.filter(e => e.shopId === shopId);

    let answer = '';

    if ((lower.includes(\"aujourd'hui\") || lower.includes('jour')) && (lower.includes('vente') || lower.includes('vendu'))) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const todayCount = shopSales.filter(s => new Date(s.date) >= today).length;
      const yesterdayCount = shopSales.filter(s => new Date(s.date) >= yesterday && new Date(s.date) < today).length;
      let evolution = '';
      if (yesterdayCount > 0) {
        const percent = ((todayCount - yesterdayCount) / yesterdayCount) * 100;
        evolution = percent > 0 ? ' (+' + percent.toFixed(1) + '% par rapport a hier)' : ' (' + percent.toFixed(1) + '% par rapport a hier)';
      }
      answer = '📊 Aujourd\\'hui : ' + todayCount + ' vente(s)' + evolution + '.';
      if (yesterdayCount > 0) answer += ' Hier : ' + yesterdayCount + ' vente(s).';
    } else if (lower.includes('hier') && (lower.includes('vente') || lower.includes('vendu'))) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const count = shopSales.filter(s => new Date(s.date) >= yesterday && new Date(s.date) < today).length;
      answer = '📅 Hier : ' + count + ' vente(s).';
    } else if (lower.includes('produit') && lower.includes('plus vendu')) {
      const productQty = {};
      shopSales.forEach(s => productQty[s.productId] = (productQty[s.productId] || 0) + s.quantity);
      if (Object.keys(productQty).length === 0) answer = 'Aucune vente enregistree pour le moment.';
      else {
        const topId = Object.keys(productQty).reduce((a, b) => productQty[a] > productQty[b] ? a : b);
        const product = shopProducts.find(p => p.id === parseInt(topId));
        answer = '🏆 Le produit le plus vendu est \"' + (product?.name || 'Inconnu') + '\" avec ' + productQty[topId] + ' unites vendues.';
      }
    } else if (lower.includes('meilleur vendeur') || lower.includes('top vendeur')) {
      const sellerSalesMap = {};
      shopSales.forEach(s => sellerSalesMap[s.sellerId] = (sellerSalesMap[s.sellerId] || 0) + s.total);
      if (Object.keys(sellerSalesMap).length === 0) answer = 'Aucune vente enregistree pour le moment.';
      else {
        const topId = Object.keys(sellerSalesMap).reduce((a, b) => sellerSalesMap[a] > sellerSalesMap[b] ? a : b);
        const seller = users.find(u => u.id === parseInt(topId));
        answer = '🥇 Le meilleur vendeur est ' + (seller?.fullName || 'Inconnu') + ' avec ' + sellerSalesMap[topId].toLocaleString() + ' FCFA de ventes.';
      }
    } else if (lower.includes('commander') || lower.includes('stock') || lower.includes('reapprovisionner')) {
      const low = shopProducts.filter(p => p.quantity <= p.alertThreshold);
      if (low.length === 0) answer = '✅ Votre stock est suffisant pour tous les produits.';
      else answer = '⚠️ Produits a reapprovisionner : ' + low.map(p => p.name + ' (' + p.quantity + ' restants)').join(', ') + '.';
    } else if (lower.includes('depense') || lower.includes('depenses')) {
      const totalExpenses = shopExpenses.reduce((sum, e) => sum + e.amount, 0);
      answer = '💰 Total des depenses : ' + totalExpenses.toLocaleString() + ' FCFA.';
      if (shopExpenses.length > 0) {
        const categories = [...new Set(shopExpenses.map(e => e.category))];
        answer += ' Categories : ' + categories.join(', ') + '.';
      }
    } else if (lower.includes('benefice') || lower.includes('profit')) {
      const revenue = shopSales.reduce((sum, s) => sum + s.total, 0);
      const totalExpenses = shopExpenses.reduce((sum, e) => sum + e.amount, 0);
      const profit = revenue - totalExpenses;
      answer = '📈 Votre benefice net est de ' + profit.toLocaleString() + ' FCFA. (CA: ' + revenue.toLocaleString() + ' FCFA - Depenses: ' + totalExpenses.toLocaleString() + ' FCFA)';
    } else if (lower.includes('prediction') || lower.includes('demain')) {
      if (shopSales.length < 7) answer = 'Pas assez de donnees pour une prediction (minimum 7 jours).';
      else {
        const dailyTotals = {};
        shopSales.forEach(sale => {
          const date = new Date(sale.date).toISOString().split('T')[0];
          dailyTotals[date] = (dailyTotals[date] || 0) + sale.total;
        });
        const values = Object.values(dailyTotals);
        const last7Avg = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
        const prediction = Math.round(last7Avg * 1.05);
        answer = '🔮 Prediction pour demain : environ ' + prediction.toLocaleString() + ' FCFA de chiffre d\\'affaires.';
      }
    } else {
      answer = '🤖 Je peux repondre aux questions sur :\n- Ventes (aujourd\\'hui, hier)\n- Produit le plus vendu\n- Meilleur vendeur\n- Stock / Reapprovisionnement\n- Depenses\n- Benefice net\n- Prediction CA\n\nExemple : \"Combien de ventes aujourd\\'hui ?\"';
    }
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

// Remplacer
code = code.substring(0, startIdx) + initialIA + '\n\n' + code.substring(endIdx);
fs.writeFileSync('server.js', code);
console.log('✅ IA réinitialisée à son état initial !');
"
echo ""
echo "✅ Fait ! Redémarre avec : node server.js"
