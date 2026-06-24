// ========== IA SIMPLIFIÉE ==========
app.post('/api/ai/ask', auth, (req, res) => {
  try {
    const { question, shopId } = req.body;
    const lower = question.toLowerCase();
    const userDir = getUserDataDir(req.userId);
    const sales = readJSON(path.join(userDir, 'sales.json'), []);
    const products = readJSON(path.join(userDir, 'products.json'), []);
    const expenses = readJSON(path.join(userDir, 'expenses.json'), []);
    const shops = readJSON(path.join(userDir, 'shops.json'), []);

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
    if (lower.includes('vente aujourd') || lower.includes('ventes aujourd')) {
      answer = 'Aujourd'hui : ' + todaySales + ' vente(s). Hier : ' + yesterdaySales + ' vente(s).';
    } else if (lower.includes('chiffre d\'affaires') || lower.includes('ca du mois')) {
      answer = 'CA du mois : ' + monthRevenue.toLocaleString() + ' FCFA (' + monthSales + ' ventes).';
    } else if (lower.includes('panier moyen')) {
      answer = 'Panier moyen : ' + avgSale.toLocaleString() + ' FCFA.';
    } else if (lower.includes('meilleur vendeur') || lower.includes('vendeur du mois')) {
      answer = topSeller ? 'Meilleur vendeur : ' + topSeller.fullName + ' avec ' + sellerSales[topSeller.id].toLocaleString() + ' FCFA.' : 'Aucune donnee.';
    } else if (lower.includes('produit le plus vendu') || lower.includes('best-seller')) {
      answer = topProduct ? 'Produit le plus vendu : ' + topProduct.name + ' (' + productQty[topProduct.id] + ' unites).' : 'Aucune donnee.';
    } else if (lower.includes('rupture de stock')) {
      const out = shopProducts.filter(p => p.quantity === 0);
      answer = out.length === 0 ? 'Aucun produit en rupture.' : 'Ruptures : ' + out.map(p => p.name).join(', ');
    } else if (lower.includes('stock faible')) {
      const low = shopProducts.filter(p => p.quantity > 0 && p.quantity <= (p.alertThreshold || 5));
      answer = low.length === 0 ? 'Aucun stock faible.' : 'Stock faible : ' + low.map(p => p.name + ' (' + p.quantity + ')').join(', ');
    } else if (lower.includes('benefice net du mois')) {
      const monthExpenses = shopExpenses.filter(e => new Date(e.date) >= startOfMonth).reduce((sum, e) => sum + e.amount, 0);
      const profit = monthRevenue - monthExpenses;
      answer = 'Benefice net du mois : ' + profit.toLocaleString() + ' FCFA.';
    } else if (lower.includes('depenses du mois')) {
      const monthExpenses = shopExpenses.filter(e => new Date(e.date) >= startOfMonth).reduce((sum, e) => sum + e.amount, 0);
      answer = 'Depenses du mois : ' + monthExpenses.toLocaleString() + ' FCFA.';
    } else if (lower.includes('meilleurs clients')) {
      const clientSpending = {};
      shopSales.forEach(s => clientSpending[s.customerName] = (clientSpending[s.customerName] || 0) + s.total);
      const top = Object.entries(clientSpending).sort((a, b) => b[1] - a[1]).slice(0, 5);
      answer = top.length === 0 ? 'Aucun client.' : 'Meilleurs clients : ' + top.map(([name, total]) => name + ' (' + total.toLocaleString() + ' FCFA)').join(' | ');
    } else if (lower.includes('prediction pour demain')) {
      if (shopSales.length < 7) answer = 'Pas assez de donnees pour predire (minimum 7 jours).';
      else {
        const dailyTotals = {};
        shopSales.forEach(s => {
          const date = new Date(s.date).toISOString().split('T')[0];
          dailyTotals[date] = (dailyTotals[date] || 0) + s.total;
        });
        const values = Object.values(dailyTotals);
        const last7Avg = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
        const prediction = Math.round(last7Avg * 1.05);
        answer = 'Prediction pour demain : ~' + prediction.toLocaleString() + ' FCFA.';
      }
    } else if (lower.includes('sante financiere')) {
      const metrics = [
        totalSales > 10 ? 20 : totalSales > 5 ? 10 : 0,
        totalRevenue > 1000000 ? 20 : totalRevenue > 500000 ? 10 : 0,
        shopProducts.length > 20 ? 20 : shopProducts.length > 10 ? 10 : 0,
        netProfit > 0 ? 20 : netProfit > -100000 ? 10 : 0,
        weekSales > 5 ? 20 : weekSales > 2 ? 10 : 0
      ];
      const score = metrics.reduce((a, b) => a + b, 0);
      const status = score >= 80 ? 'Excellent' : score >= 60 ? 'Bon' : score >= 40 ? 'Moyen' : 'Critique';
      answer = 'Score de sante : ' + score + '/100 - ' + status + '.';
    } else {
      answer = 'Je reponds a + de 100 questions sur :\n\nVENTES : aujourd\'hui, hier, mois, tendances, panier moyen\nPRODUITS : plus vendu, stock, rupture, peremption\nFINANCES : benefice, depenses, marge, sante\nCLIENTS : meilleurs clients, fideles\nVENDEURS : performance, commissions\nBOUTIQUES : rentabilite\nPREDICTIONS : demain, semaine\n\nPosez votre question !';
    }

    res.json({ answer });
  } catch (err) {
    console.error('Erreur IA:', err);
    res.status(500).json({ error: err.message });
  }
});
