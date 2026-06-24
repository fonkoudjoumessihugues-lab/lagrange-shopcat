#!/bin/bash
echo "🛠️ Mise à jour SIMPLIFIÉE de l'IA..."

# 1. SAUVEGARDE
cp public/index.html public/index.html.ia.backup 2>/dev/null
cp server.js server.js.ia.backup 2>/dev/null

# 2. MISE À JOUR SERVEUR (version simplifiée)
node -e "
const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Nettoyer l'ancienne IA
const start = code.indexOf('// ========== IA ==========');
const end = code.indexOf('// ========== CONFIGURATION FACTURE ==========');
if (start !== -1 && end !== -1) {
  code = code.substring(0, start) + code.substring(end);
}

// Ajouter la nouvelle IA
const newAI = \`
// ========== IA AVANCÉE ==========
app.post('/api/ai/ask', auth, (req, res) => {
  try {
    const { question, shopId } = req.body;
    const lower = question.toLowerCase();
    const userDir = getUserDataDir(req.userId);
    const sales = readJSON(path.join(userDir, 'sales.json'), []);
    const products = readJSON(path.join(userDir, 'products.json'), []);
    const expenses = readJSON(path.join(userDir, 'expenses.json'), []);
    const shops = readJSON(path.join(userDir, 'shops.json'), []);
    const vendors = users.filter(u => u.role === 'vendor');

    const shopSales = sales.filter(s => s.shopId === parseInt(shopId) && !s.cancelled);
    const shopProducts = products.filter(p => p.shopId === parseInt(shopId));
    const shopExpenses = expenses.filter(e => e.shopId === parseInt(shopId));

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const totalSales = shopSales.length;
    const totalRevenue = shopSales.reduce((sum, s) => sum + s.total, 0);
    const todaySales = shopSales.filter(s => new Date(s.date) >= today).length;
    const yesterdaySales = shopSales.filter(s => {
      const d = new Date(s.date);
      return d >= new Date(today.getTime() - 86400000) && d < today;
    }).length;
    const monthRevenue = shopSales.filter(s => new Date(s.date) >= startOfMonth).reduce((sum, s) => sum + s.total, 0);
    const monthSales = shopSales.filter(s => new Date(s.date) >= startOfMonth).length;
    const weekSales = shopSales.filter(s => new Date(s.date) >= startOfWeek).length;
    const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0;
    const totalExpenses = shopExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    const productQty = {};
    shopSales.forEach(s => productQty[s.productId] = (productQty[s.productId] || 0) + s.quantity);
    let topProduct = null;
    if (Object.keys(productQty).length > 0) {
      const topId = Object.keys(productQty).reduce((a, b) => productQty[a] > productQty[b] ? a : b);
      topProduct = shopProducts.find(p => p.id === parseInt(topId));
    }

    const sellerSales = {};
    shopSales.forEach(s => sellerSales[s.sellerId] = (sellerSales[s.sellerId] || 0) + s.total);
    let topSeller = null;
    if (Object.keys(sellerSales).length > 0) {
      const topId = Object.keys(sellerSales).reduce((a, b) => sellerSales[a] > sellerSales[b] ? a : b);
      topSeller = users.find(u => u.id === parseInt(topId));
    }

    let answer = '';

    // VENTES
    if (lower.includes('aujourd') && lower.includes('vente')) {
      answer = '📊 Aujourd'hui : ' + todaySales + ' vente(s). Hier : ' + yesterdaySales + ' vente(s).';
    } else if (lower.includes('hier') && lower.includes('vente')) {
      answer = '📅 Hier : ' + yesterdaySales + ' vente(s).';
    } else if (lower.includes('chiffre d\\'affaires') || (lower.includes('ca') && lower.includes('mois'))) {
      answer = '💰 CA du mois : ' + monthRevenue.toLocaleString() + ' FCFA (' + monthSales + ' ventes).';
    } else if (lower.includes('panier moyen') || lower.includes('montant moyen')) {
      answer = '🛒 Panier moyen : ' + avgSale.toLocaleString() + ' FCFA.';
    } else if (lower.includes('meilleur vendeur') || lower.includes('top vendeur')) {
      if (topSeller) answer = '🥇 Meilleur vendeur : ' + topSeller.fullName + ' avec ' + sellerSales[topSeller.id].toLocaleString() + ' FCFA.';
      else answer = 'Aucune donnée.';
    } else if (lower.includes('tendance') || lower.includes('hausse') || lower.includes('baisse')) {
      const last7 = shopSales.slice(-7).reduce((sum, s) => sum + s.total, 0);
      const prev7 = shopSales.slice(-14, -7).reduce((sum, s) => sum + s.total, 0);
      const trend = prev7 > 0 ? ((last7 - prev7) / prev7 * 100).toFixed(1) : 0;
      answer = '📈 Tendance : ' + (trend >= 0 ? '📈 Hausse' : '📉 Baisse') + ' de ' + Math.abs(trend) + '% sur 7 jours.';
    } else if (lower.includes('objectif mensuel')) {
      const target = 1000000;
      const progress = Math.min(100, (monthRevenue / target) * 100);
      answer = '🎯 Objectif : 1 000 000 FCFA - Progression : ' + progress.toFixed(1) + '%.';
    } else if (lower.includes('ventes annulées')) {
      const cancelled = sales.filter(s => s.cancelled).length;
      answer = '❌ Annulations : ' + cancelled + ' vente(s).';
    } else if (lower.includes('meilleure vente')) {
      const best = shopSales.reduce((max, s) => s.total > max.total ? s : max, { total: 0 });
      if (best.total > 0) answer = '🏆 Meilleure vente : ' + best.productName + ' à ' + best.total.toLocaleString() + ' FCFA.';
      else answer = 'Aucune vente.';
    } else if (lower.includes('ventes par vendeur')) {
      const stats = Object.entries(sellerSales).map(([id, total]) => {
        const user = users.find(u => u.id === parseInt(id));
        return (user ? user.fullName : 'Inconnu') + ' : ' + total.toLocaleString() + ' FCFA';
      }).join(' | ');
      answer = stats || 'Aucune donnée.';
      
    // PRODUITS
    } else if (lower.includes('produit le plus vendu') || lower.includes('best-seller')) {
      if (topProduct) answer = '🏆 Produit le plus vendu : ' + topProduct.name + ' (' + productQty[topProduct.id] + ' unités).';
      else answer = 'Aucune donnée.';
    } else if (lower.includes('rupture de stock')) {
      const out = shopProducts.filter(p => p.quantity === 0);
      if (out.length === 0) answer = '✅ Aucun produit en rupture.';
      else answer = '⚠️ Ruptures : ' + out.map(p => p.name).join(', ');
    } else if (lower.includes('stock faible')) {
      const low = shopProducts.filter(p => p.quantity > 0 && p.quantity <= (p.alertThreshold || 5));
      if (low.length === 0) answer = '✅ Aucun stock faible.';
      else answer = '⚠️ Stock faible : ' + low.map(p => p.name + ' (' + p.quantity + ')').join(', ');
    } else if (lower.includes('valeur totale du stock') || lower.includes('valeur du stock')) {
      const total = shopProducts.reduce((sum, p) => sum + (p.quantity * p.sellingPrice), 0);
      answer = '💰 Valeur du stock : ' + total.toLocaleString() + ' FCFA.';
    } else if (lower.includes('produits périmés')) {
      const expired = shopProducts.filter(p => p.expiryDate && new Date(p.expiryDate) < new Date());
      if (expired.length === 0) answer = '✅ Aucun produit périmé.';
      else answer = '⚠️ Produits périmés : ' + expired.map(p => p.name).join(', ');
    } else if (lower.includes('produits bientôt périmés')) {
      const soon = shopProducts.filter(p => {
        if (!p.expiryDate) return false;
        const diff = (new Date(p.expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 30;
      });
      if (soon.length === 0) answer = '✅ Aucun produit bientôt périmé.';
      else answer = '⚠️ Bientôt périmés : ' + soon.map(p => p.name + ' (' + new Date(p.expiryDate).toLocaleDateString() + ')').join(', ');
      
    // FINANCES
    } else if (lower.includes('bénéfice net du mois')) {
      const monthExpenses = shopExpenses.filter(e => new Date(e.date) >= startOfMonth).reduce((sum, e) => sum + e.amount, 0);
      const profit = monthRevenue - monthExpenses;
      answer = '💰 Bénéfice net du mois : ' + profit.toLocaleString() + ' FCFA.';
    } else if (lower.includes('bénéfice net aujourd')) {
      const todayRevenue = shopSales.filter(s => new Date(s.date) >= today).reduce((sum, s) => sum + s.total, 0);
      const todayExpenses = shopExpenses.filter(e => new Date(e.date) >= today).reduce((sum, e) => sum + e.amount, 0);
      answer = '💰 Bénéfice net aujourd\'hui : ' + (todayRevenue - todayExpenses).toLocaleString() + ' FCFA.';
    } else if (lower.includes('dépenses du mois')) {
      const monthExpenses = shopExpenses.filter(e => new Date(e.date) >= startOfMonth).reduce((sum, e) => sum + e.amount, 0);
      answer = '💸 Dépenses du mois : ' + monthExpenses.toLocaleString() + ' FCFA.';
    } else if (lower.includes('dépenses par catégorie')) {
      const byCat = {};
      shopExpenses.forEach(e => byCat[e.category] = (byCat[e.category] || 0) + e.amount);
      const str = Object.entries(byCat).map(([cat, amount]) => cat + ' : ' + amount.toLocaleString() + ' FCFA').join(' | ');
      answer = '📊 Dépenses par catégorie : ' + (str || 'Aucune');
    } else if (lower.includes('santé financière')) {
      const score = netProfit > 0 ? '✅ Bonne' : netProfit > -100000 ? '⚠️ Fragile' : '❌ Critique';
      answer = '🏥 Santé financière : ' + score + '.';
      
    // CLIENTS
    } else if (lower.includes('meilleurs clients')) {
      const clientSpending = {};
      shopSales.forEach(s => clientSpending[s.customerName] = (clientSpending[s.customerName] || 0) + s.total);
      const top = Object.entries(clientSpending).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (top.length === 0) answer = 'Aucun client.';
      else answer = '👑 Meilleurs clients : ' + top.map(([name, total]) => name + ' (' + total.toLocaleString() + ' FCFA)').join(' | ');
    } else if (lower.includes('clients fidèles')) {
      const freq = {};
      shopSales.forEach(s => freq[s.customerName] = (freq[s.customerName] || 0) + 1);
      const loyal = Object.entries(freq).filter(([_, count]) => count >= 3);
      answer = '❤️ Clients fidèles (3+ achats) : ' + loyal.length + '.';
    } else if (lower.includes('clients à recontacter')) {
      const lastPurchase = {};
      shopSales.forEach(s => {
        const date = new Date(s.date);
        if (!lastPurchase[s.customerName] || date > lastPurchase[s.customerName]) {
          lastPurchase[s.customerName] = date;
        }
      });
      const toContact = Object.entries(lastPurchase).filter(([_, date]) => {
        return (new Date() - date) / (1000 * 60 * 60 * 24) > 30;
      }).map(([name]) => name);
      if (toContact.length === 0) answer = '✅ Tous les clients sont actifs.';
      else answer = '📞 Clients à recontacter : ' + toContact.join(', ');
      
    // VENDEURS
    } else if (lower.includes('vendeur du mois') || lower.includes('meilleur vendeur')) {
      if (topSeller) answer = '🥇 Vendeur du mois : ' + topSeller.fullName + ' avec ' + sellerSales[topSeller.id].toLocaleString() + ' FCFA.';
      else answer = 'Aucune donnée.';
    } else if (lower.includes('vendeurs dans l\'équipe')) {
      answer = '👥 Vendeurs : ' + vendors.length + '.';
    } else if (lower.includes('commission') && lower.includes('vendeur')) {
      const totalComm = vendors.reduce((sum, v) => sum + (v.commission || 0), 0);
      answer = '💰 Commission totale : ' + totalComm.toLocaleString() + ' FCFA.';
      
    // BOUTIQUES
    } else if (lower.includes('quelles sont mes boutiques') || lower.includes('liste des boutiques')) {
      const list = shops.map(s => s.name).join(' | ');
      answer = '🏪 Boutiques : ' + (list || 'Aucune');
    } else if (lower.includes('boutique la plus rentable')) {
      const shopRevenue = {};
      shopSales.forEach(s => shopRevenue[s.shopId] = (shopRevenue[s.shopId] || 0) + s.total);
      const best = Object.keys(shopRevenue).reduce((a, b) => shopRevenue[a] > shopRevenue[b] ? a : b, '0');
      const shop = shops.find(s => s.id === parseInt(best));
      answer = '🏆 Boutique la plus rentable : ' + (shop ? shop.name : 'Inconnu') + ' (' + shopRevenue[best].toLocaleString() + ' FCFA).';
      
    // PRÉDICTIONS
    } else if (lower.includes('prédiction pour demain')) {
      if (shopSales.length < 7) answer = 'Pas assez de données (minimum 7 jours).';
      else {
        const dailyTotals = {};
        shopSales.forEach(s => {
          const date = new Date(s.date).toISOString().split('T')[0];
          dailyTotals[date] = (dailyTotals[date] || 0) + s.total;
        });
        const values = Object.values(dailyTotals);
        const last7Avg = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
        const prediction = Math.round(last7Avg * 1.05);
        answer = '🔮 Prédiction demain : ~' + prediction.toLocaleString() + ' FCFA.';
      }
    } else if (lower.includes('prédiction pour la semaine')) {
      if (shopSales.length < 14) answer = 'Pas assez de données (minimum 14 jours).';
      else {
        const dailyTotals = {};
        shopSales.forEach(s => {
          const date = new Date(s.date).toISOString().split('T')[0];
          dailyTotals[date] = (dailyTotals[date] || 0) + s.total;
        });
        const values = Object.values(dailyTotals);
        const last7Avg = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
        const prediction = Math.round(last7Avg * 7 * 1.03);
        answer = '🔮 Prédiction semaine : ~' + prediction.toLocaleString() + ' FCFA.';
      }
    } else if (lower.includes('saisonnalité')) {
      const monthly = {};
      shopSales.forEach(s => {
        const month = new Date(s.date).toLocaleDateString('fr-FR', { month: 'long' });
        monthly[month] = (monthly[month] || 0) + s.total;
      });
      const sorted = Object.entries(monthly).sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0) answer = 'Aucune donnée.';
      else answer = '📅 Meilleur mois : ' + sorted[0][0] + ' (' + sorted[0][1].toLocaleString() + ' FCFA).';
    } else if (lower.includes('score de santé')) {
      const metrics = [
        totalSales > 10 ? 20 : totalSales > 5 ? 10 : 0,
        totalRevenue > 1000000 ? 20 : totalRevenue > 500000 ? 10 : 0,
        shopProducts.length > 20 ? 20 : shopProducts.length > 10 ? 10 : 0,
        netProfit > 0 ? 20 : netProfit > -100000 ? 10 : 0,
        weekSales > 5 ? 20 : weekSales > 2 ? 10 : 0
      ];
      const score = metrics.reduce((a, b) => a + b, 0);
      const status = score >= 80 ? '🏆 Excellent' : score >= 60 ? '✅ Bon' : score >= 40 ? '⚠️ Moyen' : '❌ Critique';
      answer = '🏥 Score : ' + score + '/100 - ' + status + '.';
      
    // BOOSTER LES VENTES
    } else if (lower.includes('comment booster les ventes')) {
      const lowStock = shopProducts.filter(p => p.quantity <= (p.alertThreshold || 5)).length;
      const promo = shopProducts.filter(p => p.quantity > 0 && p.quantity <= 10).map(p => p.name).slice(0, 5);
      answer = '🚀 Conseils :\n- Réapprovisionner ' + lowStock + ' produits.\n- Promotions sur : ' + (promo.join(', ') || 'aucun') + '.\n- Fidéliser ' + new Set(shopSales.map(s => s.customerName)).size + ' clients.\n- Former ' + vendors.length + ' vendeurs.';
    } else {
      answer = '🤖 Je réponds à + de 100 questions sur :\n📊 VENTES : aujourd\'hui, hier, mois, tendances, panier moyen\n📦 PRODUITS : plus vendu, stock, rupture, péremption\n💰 FINANCES : bénéfice, dépenses, marge, santé\n👥 CLIENTS : meilleurs, fidèles, recontact\n👤 VENDEURS : performance, commissions\n🏪 BOUTIQUES : rentabilité, liste\n🔮 PRÉDICTIONS : demain, semaine, saisonnalité\n\nPosez votre question !';
    }

    res.json({ answer });
  } catch (err) {
    console.error('❌ Erreur IA:', err);
    res.status(500).json({ error: err.message });
  }
});
\`;

code = newAI + code;
fs.writeFileSync('server.js', code);
console.log('✅ Serveur IA mis à jour !');
"

echo ""
echo "✅ MISE À JOUR TERMINÉE !"
echo "🚀 Redémarre le serveur : node server.js"
