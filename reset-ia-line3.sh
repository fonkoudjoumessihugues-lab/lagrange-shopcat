#!/bin/bash
echo "🔄 Réinitialisation de l'IA (ligne 3)..."

# Sauvegarde
cp server.js server.js.backup

# Créer le nouveau fichier avec l'IA initiale
cat > server.js.new << 'NEWFILE'
// ========== IA ==========
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

    if ((lower.includes('aujourd') || lower.includes('jour')) && (lower.includes('vente') || lower.includes('vendu'))) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const todayCount = shopSales.filter(s => new Date(s.date) >= today).length;
      const yesterdayCount = shopSales.filter(s => new Date(s.date) >= yesterday && new Date(s.date) < today).length;
      answer = "Aujourd'hui : " + todayCount + " vente(s). Hier : " + yesterdayCount + " vente(s).";
    } else if (lower.includes('hier') && (lower.includes('vente') || lower.includes('vendu'))) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const count = shopSales.filter(s => new Date(s.date) >= yesterday && new Date(s.date) < today).length;
      answer = "Hier : " + count + " vente(s).";
    } else if (lower.includes('produit') && lower.includes('plus vendu')) {
      const productQty = {};
      shopSales.forEach(s => productQty[s.productId] = (productQty[s.productId] || 0) + s.quantity);
      if (Object.keys(productQty).length === 0) answer = 'Aucune vente enregistree.';
      else {
        const topId = Object.keys(productQty).reduce((a, b) => productQty[a] > productQty[b] ? a : b);
        const product = shopProducts.find(p => p.id === parseInt(topId));
        answer = "Produit le plus vendu : " + (product?.name || 'Inconnu') + " (" + productQty[topId] + " unites).";
      }
    } else if (lower.includes('meilleur vendeur') || lower.includes('top vendeur')) {
      const sellerSalesMap = {};
      shopSales.forEach(s => sellerSalesMap[s.sellerId] = (sellerSalesMap[s.sellerId] || 0) + s.total);
      if (Object.keys(sellerSalesMap).length === 0) answer = 'Aucune vente enregistree.';
      else {
        const topId = Object.keys(sellerSalesMap).reduce((a, b) => sellerSalesMap[a] > sellerSalesMap[b] ? a : b);
        const seller = users.find(u => u.id === parseInt(topId));
        answer = "Meilleur vendeur : " + (seller?.fullName || 'Inconnu') + " (" + sellerSalesMap[topId].toLocaleString() + " FCFA).";
      }
    } else if (lower.includes('commander') || lower.includes('stock') || lower.includes('reapprovisionner')) {
      const low = shopProducts.filter(p => p.quantity <= p.alertThreshold);
      if (low.length === 0) answer = 'Stock suffisant pour tous les produits.';
      else answer = "Produits a reapprovisionner : " + low.map(p => p.name + " (" + p.quantity + " restants)").join(', ');
    } else if (lower.includes('depense') || lower.includes('depenses')) {
      const totalExpenses = shopExpenses.reduce((sum, e) => sum + e.amount, 0);
      answer = "Total des depenses : " + totalExpenses.toLocaleString() + " FCFA.";
    } else if (lower.includes('benefice') || lower.includes('profit')) {
      const revenue = shopSales.reduce((sum, s) => sum + s.total, 0);
      const totalExpenses = shopExpenses.reduce((sum, e) => sum + e.amount, 0);
      const profit = revenue - totalExpenses;
      answer = "Benefice net : " + profit.toLocaleString() + " FCFA (CA: " + revenue.toLocaleString() + " FCFA - Depenses: " + totalExpenses.toLocaleString() + " FCFA)";
    } else if (lower.includes('prediction') || lower.includes('demain')) {
      if (shopSales.length < 7) answer = 'Pas assez de donnees (minimum 7 jours).';
      else {
        const dailyTotals = {};
        shopSales.forEach(sale => {
          const date = new Date(sale.date).toISOString().split('T')[0];
          dailyTotals[date] = (dailyTotals[date] || 0) + sale.total;
        });
        const values = Object.values(dailyTotals);
        const last7Avg = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
        const prediction = Math.round(last7Avg * 1.05);
        answer = "Prediction demain : ~" + prediction.toLocaleString() + " FCFA.";
      }
    } else {
      answer = "Je reponds aux questions sur : Ventes (aujourd'hui, hier), Produit plus vendu, Meilleur vendeur, Stock, Depenses, Benefice, Prediction. Ex: 'Combien de ventes aujourd'hui ?'";
    }
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
NEWFILE

# Ajouter le reste du fichier (à partir de la ligne 4)
tail -n +4 server.js >> server.js.new

# Remplacer
mv server.js.new server.js

echo "✅ IA réinitialisée avec succès !"
echo "📊 L'IA initiale est restaurée."
echo "🚀 Redémarre avec : node server.js"
