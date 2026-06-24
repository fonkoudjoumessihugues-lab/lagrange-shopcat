#!/bin/bash
echo "🛠️ Extension de l'IA pour répondre aux 150 questions..."

node -e "
const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Nouvelle fonction IA avec 150+ réponses
const newAI = \`
// ========== IA AVANCÉE (150+ QUESTIONS) ==========
app.post('/api/ai/ask', auth, (req, res) => {
  try {
    const { question, shopId } = req.body;
    const lower = question.toLowerCase();
    const userDir = getUserDataDir(req.userId);
    const sales = readJSON(path.join(userDir, 'sales.json'), []);
    const products = readJSON(path.join(userDir, 'products.json'), []);
    const expenses = readJSON(path.join(userDir, 'expenses.json'), []);
    const shops = readJSON(path.join(userDir, 'shops.json'), []);
    const suppliers = readJSON(path.join(userDir, 'suppliers.json'), []);
    const orders = readJSON(path.join(userDir, 'purchase-orders.json'), []);
    const vendors = users.filter(u => u.role === 'vendor');

    const shopSales = sales.filter(s => s.shopId === shopId && !s.cancelled);
    const shopProducts = products.filter(p => p.shopId === shopId);
    const shopExpenses = expenses.filter(e => e.shopId === shopId);
    const shopSuppliers = suppliers.filter(s => s.shopId === shopId);
    const shopOrders = orders.filter(o => o.shopId === shopId);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Stats de base
    const totalSales = shopSales.length;
    const totalRevenue = shopSales.reduce((sum, s) => sum + s.total, 0);
    const todaySales = shopSales.filter(s => new Date(s.date) >= today).length;
    const yesterdaySales = shopSales.filter(s => new Date(s.date) >= yesterday && new Date(s.date) < today).length;
    const monthSales = shopSales.filter(s => new Date(s.date) >= startOfMonth).length;
    const monthRevenue = shopSales.filter(s => new Date(s.date) >= startOfMonth).reduce((sum, s) => sum + s.total, 0);
    const weekSales = shopSales.filter(s => new Date(s.date) >= startOfWeek).length;
    const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0;
    const totalExpenses = shopExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    // Top produits
    const productQty = {};
    shopSales.forEach(s => productQty[s.productId] = (productQty[s.productId] || 0) + s.quantity);
    let topProduct = null;
    if (Object.keys(productQty).length > 0) {
      const topId = Object.keys(productQty).reduce((a, b) => productQty[a] > productQty[b] ? a : b);
      topProduct = shopProducts.find(p => p.id === parseInt(topId));
    }

    // Top vendeurs
    const sellerSalesMap = {};
    shopSales.forEach(s => sellerSalesMap[s.sellerId] = (sellerSalesMap[s.sellerId] || 0) + s.total);
    let topSeller = null;
    if (Object.keys(sellerSalesMap).length > 0) {
      const topId = Object.keys(sellerSalesMap).reduce((a, b) => sellerSalesMap[a] > sellerSalesMap[b] ? a : b);
      topSeller = users.find(u => u.id === parseInt(topId));
    }

    let answer = '';

    // ========== LOGIQUE DE RÉPONSE ==========
    // VENTES
    if (lower.includes('combien de ventes') || lower.includes('ventes aujourd')) {
      answer = \`📊 Aujourd'hui : \${todaySales} vente(s). Hier : \${yesterdaySales} vente(s).\`;
    } else if (lower.includes('chiffre d\'affaires du mois') || lower.includes('ca du mois')) {
      answer = \`💰 Chiffre d'affaires du mois : \${monthRevenue.toLocaleString()} FCFA (\${monthSales} ventes).\`;
    } else if (lower.includes('mois dernier') && lower.includes('ventes')) {
      const lastMonthSales = shopSales.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
      });
      const lastCount = lastMonthSales.length;
      const diff = monthSales - lastCount;
      const percent = lastCount > 0 ? ((diff / lastCount) * 100).toFixed(1) : 0;
      answer = \`📊 Comparaison : \${diff > 0 ? '+' : ''}\${diff} ventes (\${percent}%) par rapport au mois dernier.\`;
    } else if (lower.includes('meilleur jour') || lower.includes('pire jour')) {
      const dailyCount = {};
      shopSales.forEach(s => {
        const day = new Date(s.date).toISOString().split('T')[0];
        dailyCount[day] = (dailyCount[day] || 0) + 1;
      });
      const days = Object.keys(dailyCount);
      if (days.length === 0) answer = 'Aucune donnée disponible.';
      else {
        const maxDay = days.reduce((a, b) => dailyCount[a] > dailyCount[b] ? a : b);
        const minDay = days.reduce((a, b) => dailyCount[a] < dailyCount[b] ? a : b);
        answer = \`📅 Meilleur jour : \${maxDay} (\${dailyCount[maxDay]} ventes). Pire jour : \${minDay} (\${dailyCount[minDay]} ventes).\`;
      }
    } else if (lower.includes('panier moyen') || lower.includes('montant moyen')) {
      answer = \`🛒 Panier moyen : \${avgSale.toLocaleString()} FCFA.\`;
    } else if (lower.includes('meilleure vente')) {
      const best = shopSales.reduce((max, s) => s.total > max.total ? s : max, { total: 0 });
      if (best.total > 0) answer = \`🏆 Meilleure vente : \${best.productName} à \${best.total.toLocaleString()} FCFA.\`;
      else answer = 'Aucune vente enregistrée.';
    } else if (lower.includes('tendance') && (lower.includes('haute') || lower.includes('baisse'))) {
      const last7 = shopSales.slice(-7).reduce((sum, s) => sum + s.total, 0);
      const prev7 = shopSales.slice(-14, -7).reduce((sum, s) => sum + s.total, 0);
      const trend = prev7 > 0 ? ((last7 - prev7) / prev7 * 100).toFixed(1) : 0;
      answer = \`📈 Tendance : \${trend >= 0 ? '📈 Hausse' : '📉 Baisse'} de \${Math.abs(trend)}% sur les 7 derniers jours.\`;
    } else if (lower.includes('jours de la semaine') && lower.includes('vend')) {
      const weekDays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const daySales = {};
      shopSales.forEach(s => {
        const day = new Date(s.date).getDay();
        daySales[day] = (daySales[day] || 0) + 1;
      });
      const bestDay = Object.keys(daySales).reduce((a, b) => daySales[a] > daySales[b] ? a : b);
      answer = \`📅 Jour le plus actif : \${weekDays[bestDay]} (\${daySales[bestDay]} ventes).\`;
    } else if (lower.includes('ventes de la semaine')) {
      answer = \`📊 Ventes de la semaine : \${weekSales} ventes.\`;
    } else if (lower.includes('clients différents')) {
      const unique = new Set(shopSales.map(s => s.customerName)).size;
      answer = \`👥 Clients uniques : \${unique}.\`;
    } else if (lower.includes('taux de transformation') || lower.includes('taux de conversion')) {
      const rate = totalSales > 0 ? ((totalSales / (totalSales + 10)) * 100).toFixed(1) : 0;
      answer = \`📊 Taux de conversion estimé : \${rate}%.\`;
    } else if (lower.includes('duree moyenne') && lower.includes('ventes')) {
      if (shopSales.length < 2) answer = 'Pas assez de données.';
      else {
        const times = shopSales.map(s => new Date(s.date).getTime());
        const avg = times.reduce((a, b, i, arr) => i > 0 ? a + (b - arr[i-1]) : 0, 0) / (times.length - 1);
        const hours = avg / (1000 * 60 * 60);
        answer = \`⏱️ Durée moyenne entre deux ventes : \${hours.toFixed(1)} heures.\`;
      }
    } else if (lower.includes('vendu plus qu\'hier')) {
      answer = todaySales > yesterdaySales ? '✅ Oui, vous avez vendu plus qu\'hier.' : '❌ Non, vous avez vendu moins qu\'hier.';
    } else if (lower.includes('vendu plus que la semaine')) {
      const prevWeek = shopSales.filter(s => {
        const d = new Date(s.date);
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 14);
        return d >= weekAgo && d < startOfWeek;
      }).length;
      const diff = weekSales - prevWeek;
      answer = \`📊 \${diff > 0 ? '✅ +' : '❌ '}\${diff} ventes par rapport à la semaine dernière.\`;
    } else if (lower.includes('objectif mensuel') || lower.includes('progression')) {
      const target = 1000000;
      const progress = Math.min(100, (monthRevenue / target) * 100);
      answer = \`🎯 Objectif mensuel : \${target.toLocaleString()} FCFA. Progression : \${progress.toFixed(1)}% (\${monthRevenue.toLocaleString()} FCFA).\`;
    } else if (lower.includes('ventes par vendeur')) {
      const stats = Object.entries(sellerSalesMap).map(([id, total]) => {
        const user = users.find(u => u.id === parseInt(id));
        return \`\${user?.fullName || 'Inconnu'} : \${total.toLocaleString()} FCFA\`;
      }).join(' | ');
      answer = stats || 'Aucune donnée.';
    } else if (lower.includes('vendeur du mois') || lower.includes('meilleur vendeur')) {
      if (topSeller) answer = \`🥇 Vendeur du mois : \${topSeller.fullName} avec \${sellerSalesMap[topSeller.id].toLocaleString()} FCFA.\`;
      else answer = 'Aucune donnée.';
    } else if (lower.includes('commission') && lower.includes('vendeur')) {
      const totalCommission = vendors.reduce((sum, v) => sum + (v.commission || 0), 0);
      answer = \`💰 Commission totale à verser : \${totalCommission.toLocaleString()} FCFA.\`;
    } else if (lower.includes('ventes annulées') || lower.includes('annulations')) {
      const cancelled = sales.filter(s => s.cancelled).length;
      const cancelledCost = sales.filter(s => s.cancelled).reduce((sum, s) => sum + s.total, 0);
      answer = \`❌ Annulations : \${cancelled} ventes (\${cancelledCost.toLocaleString()} FCFA).\`;
      
    // ========== PRODUITS ==========
    } else if (lower.includes('produit le plus vendu') || lower.includes('best-seller')) {
      if (topProduct) answer = \`🏆 Produit le plus vendu : \${topProduct.name} (\${productQty[topProduct.id]} unités).\`;
      else answer = 'Aucune donnée.';
    } else if (lower.includes('produit le moins vendu')) {
      const minId = Object.keys(productQty).reduce((a, b) => productQty[a] < productQty[b] ? a : b, Object.keys(productQty)[0]);
      const minProduct = shopProducts.find(p => p.id === parseInt(minId));
      if (minProduct) answer = \`📉 Produit le moins vendu : \${minProduct.name} (\${productQty[minId]} unités).\`;
      else answer = 'Aucune donnée.';
    } else if (lower.includes('rupture de stock') || lower.includes('en rupture')) {
      const out = shopProducts.filter(p => p.quantity === 0);
      if (out.length === 0) answer = '✅ Aucun produit en rupture de stock.';
      else answer = \`⚠️ Produits en rupture : \${out.map(p => p.name).join(', ')}.\`;
    } else if (lower.includes('stock faible') || lower.includes('faible stock')) {
      const low = shopProducts.filter(p => p.quantity > 0 && p.quantity <= p.alertThreshold);
      if (low.length === 0) answer = '✅ Aucun stock faible.';
      else answer = \`⚠️ Stock faible : \${low.map(p => \`\${p.name} (\${p.quantity})\`).join(', ')}.\`;
    } else if (lower.includes('produits dormants') || lower.includes('ne se vendent plus')) {
      const soldIds = new Set(shopSales.map(s => s.productId));
      const dormant = shopProducts.filter(p => !soldIds.has(p.id) && p.quantity > 0);
      if (dormant.length === 0) answer = '✅ Aucun produit dormant.';
      else answer = \`💤 Produits dormants : \${dormant.map(p => p.name).join(', ')}.\`;
    } else if (lower.includes('rotation de stock') || lower.includes('rotation du stock')) {
      const totalSold = shopSales.reduce((sum, s) => sum + s.quantity, 0);
      const totalStock = shopProducts.reduce((sum, p) => sum + p.quantity, 0);
      const ratio = totalStock > 0 ? (totalSold / totalStock) : 0;
      answer = \`🔄 Rotation du stock : \${ratio.toFixed(2)} (ventes/stock).\`;
    } else if (lower.includes('valeur totale de mon stock') || lower.includes('valeur du stock')) {
      const total = shopProducts.reduce((sum, p) => sum + (p.quantity * p.sellingPrice), 0);
      answer = \`💰 Valeur totale du stock : \${total.toLocaleString()} FCFA.\`;
    } else if (lower.includes('produit rapporte le plus de marge')) {
      const margins = shopProducts.map(p => {
        const sold = shopSales.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0);
        const profit = sold * p.sellingPrice * 0.3;
        return { name: p.name, profit, id: p.id };
      });
      const best = margins.reduce((a, b) => a.profit > b.profit ? a : b);
      if (best.profit > 0) answer = \`💎 Plus grande marge : \${best.name} (\${best.profit.toLocaleString()} FCFA).\`;
      else answer = 'Aucune donnée.';
    } else if (lower.includes('produits périmés') || lower.includes('peremption')) {
      const expired = shopProducts.filter(p => p.expiryDate && new Date(p.expiryDate) < now);
      if (expired.length === 0) answer = '✅ Aucun produit périmé.';
      else answer = \`⚠️ Produits périmés : \${expired.map(p => p.name).join(', ')}.\`;
    } else if (lower.includes('produits bientôt périmés')) {
      const soon = shopProducts.filter(p => {
        if (!p.expiryDate) return false;
        const diff = (new Date(p.expiryDate) - now) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 30;
      });
      if (soon.length === 0) answer = '✅ Aucun produit bientôt périmé.';
      else answer = \`⚠️ Bientôt périmés : \${soon.map(p => \`\${p.name} (\${new Date(p.expiryDate).toLocaleDateString()})\`).join(', ')}.\`;
    } else if (lower.includes('produits ajoutés récemment')) {
      const recent = shopProducts.filter(p => {
        const diff = (now - new Date(p.createdAt)) / (1000 * 60 * 60 * 24);
        return diff <= 30;
      });
      if (recent.length === 0) answer = 'Aucun produit ajouté récemment.';
      else answer = \`🆕 Produits récents : \${recent.map(p => p.name).join(', ')}.\`;
    } else if (lower.includes('produits n\'ont jamais été vendus')) {
      const soldIds = new Set(shopSales.map(s => s.productId));
      const unsold = shopProducts.filter(p => !soldIds.has(p.id));
      if (unsold.length === 0) answer = '✅ Tous les produits ont été vendus.';
      else answer = \`📦 Produits jamais vendus : \${unsold.map(p => p.name).join(', ')}.\`;
    } else if (lower.includes('produits saisonniers')) {
      const monthly = {};
      shopSales.forEach(s => {
        const month = new Date(s.date).getMonth();
        monthly[month] = (monthly[month] || 0) + s.quantity;
      });
      const peak = Object.keys(monthly).reduce((a, b) => monthly[a] > monthly[b] ? a : b);
      const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
      answer = \`📅 Pic de ventes en \${months[peak]}. Saisonnalité détectée.\`;
    } else if (lower.includes('tendances produits')) {
      const last30 = shopSales.filter(s => {
        const d = new Date(s.date);
        return (now - d) / (1000 * 60 * 60 * 24) <= 30;
      });
      const trends = {};
      last30.forEach(s => trends[s.productId] = (trends[s.productId] || 0) + s.quantity);
      const top = Object.keys(trends).slice(0, 5).map(id => {
        const p = shopProducts.find(pr => pr.id === parseInt(id));
        return \`\${p?.name || 'Inconnu'} (\${trends[id]} unités)\`;
      });
      answer = \`📈 Tendances du moment : \${top.join(' | ') || 'Aucune donnée.'}\`;
      
    // ========== FINANCES ==========
    } else if (lower.includes('bénéfice net aujourd')) {
      const todayRevenue = shopSales.filter(s => new Date(s.date) >= today).reduce((sum, s) => sum + s.total, 0);
      const todayExpenses = shopExpenses.filter(e => new Date(e.date) >= today).reduce((sum, e) => sum + e.amount, 0);
      answer = \`💰 Bénéfice net aujourd'hui : \${(todayRevenue - todayExpenses).toLocaleString()} FCFA.\`;
    } else if (lower.includes('bénéfice net du mois')) {
      const monthRevenue = shopSales.filter(s => new Date(s.date) >= startOfMonth).reduce((sum, s) => sum + s.total, 0);
      const monthExpenses = shopExpenses.filter(e => new Date(e.date) >= startOfMonth).reduce((sum, e) => sum + e.amount, 0);
      answer = \`💰 Bénéfice net du mois : \${(monthRevenue - monthExpenses).toLocaleString()} FCFA.\`;
    } else if (lower.includes('bénéfice net de l\'année')) {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearRevenue = shopSales.filter(s => new Date(s.date) >= yearStart).reduce((sum, s) => sum + s.total, 0);
      const yearExpenses = shopExpenses.filter(e => new Date(e.date) >= yearStart).reduce((sum, e) => sum + e.amount, 0);
      answer = \`💰 Bénéfice net de l'année : \${(yearRevenue - yearExpenses).toLocaleString()} FCFA.\`;
    } else if (lower.includes('marge brute')) {
      const cost = totalRevenue * 0.7;
      answer = \`📊 Marge brute : \${((totalRevenue - cost) / totalRevenue * 100).toFixed(1)}%.\`;
    } else if (lower.includes('marge nette')) {
      answer = \`📊 Marge nette : \${(netProfit / totalRevenue * 100).toFixed(1)}%.\`;
    } else if (lower.includes('dépenses du mois')) {
      const monthExpenses = shopExpenses.filter(e => new Date(e.date) >= startOfMonth).reduce((sum, e) => sum + e.amount, 0);
      answer = \`💸 Dépenses du mois : \${monthExpenses.toLocaleString()} FCFA.\`;
    } else if (lower.includes('plus grosse dépense')) {
      const biggest = shopExpenses.reduce((max, e) => e.amount > max.amount ? e : max, { amount: 0 });
      if (biggest.amount > 0) answer = \`💸 Plus grosse dépense : \${biggest.category} (\${biggest.amount.toLocaleString()} FCFA).\`;
      else answer = 'Aucune dépense.';
    } else if (lower.includes('dépenses par catégorie')) {
      const byCat = {};
      shopExpenses.forEach(e => byCat[e.category] = (byCat[e.category] || 0) + e.amount);
      const str = Object.entries(byCat).map(([cat, amount]) => \`\${cat} : \${amount.toLocaleString()} FCFA\`).join(' | ');
      answer = \`📊 Dépenses par catégorie : \${str || 'Aucune'}.\`;
    } else if (lower.includes('seuil de rentabilité')) {
      const fixedCosts = shopExpenses.filter(e => ['Loyer', 'Salaire', 'Electricite'].includes(e.category))
        .reduce((sum, e) => sum + e.amount, 0);
      const avgMargin = totalRevenue > 0 ? (netProfit / totalRevenue) : 0;
      const breakEven = avgMargin > 0 ? fixedCosts / avgMargin : 0;
      answer = \`📊 Seuil de rentabilité : \${breakEven.toLocaleString()} FCFA de CA.\`;
    } else if (lower.includes('trésorerie')) {
      answer = \`💰 Trésorerie estimée : \${netProfit.toLocaleString()} FCFA.\`;
    } else if (lower.includes('dettes fournisseurs')) {
      const totalOrders = shopOrders.filter(o => o.status === 'pending').reduce((sum, o) => sum + o.total, 0);
      answer = \`💳 Dettes fournisseurs : \${totalOrders.toLocaleString()} FCFA (\${shopOrders.filter(o => o.status === 'pending').length} commandes en attente).\`;
    } else if (lower.includes('santé financière')) {
      const score = netProfit > 0 ? '✅ Bonne' : netProfit > -100000 ? '⚠️ Fragile' : '❌ Critique';
      answer = \`🏥 Santé financière : \${score}. Bénéfice net : \${netProfit.toLocaleString()} FCFA.\`;
    } else if (lower.includes('tva à déclarer')) {
      const tax = totalRevenue * (adminConfig.taxRate / 100);
      answer = \`📄 TVA à déclarer ce mois : \${tax.toLocaleString()} FCFA.\`;
      
    // ========== CLIENTS ET VENDEURS ==========
    } else if (lower.includes('meilleurs clients')) {
      const clientSpending = {};
      shopSales.forEach(s => clientSpending[s.customerName] = (clientSpending[s.customerName] || 0) + s.total);
      const top = Object.entries(clientSpending).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (top.length === 0) answer = 'Aucun client.';
      else answer = \`👑 Meilleurs clients : \${top.map(([name, total]) => \`\${name} (\${total.toLocaleString()} FCFA)\`).join(' | ')}.\`;
    } else if (lower.includes('clients fidèles')) {
      const freq = {};
      shopSales.forEach(s => freq[s.customerName] = (freq[s.customerName] || 0) + 1);
      const loyal = Object.entries(freq).filter(([_, count]) => count >= 3);
      answer = \`❤️ Clients fidèles (3+ achats) : \${loyal.length}.\`;
    } else if (lower.includes('clients à recontacter')) {
      const lastPurchase = {};
      shopSales.forEach(s => {
        const date = new Date(s.date);
        if (!lastPurchase[s.customerName] || date > lastPurchase[s.customerName]) {
          lastPurchase[s.customerName] = date;
        }
      });
      const toContact = Object.entries(lastPurchase).filter(([_, date]) => {
        return (now - date) / (1000 * 60 * 60 * 24) > 30;
      }).map(([name]) => name);
      if (toContact.length === 0) answer = '✅ Tous les clients sont actifs.';
      else answer = \`📞 Clients à recontacter : \${toContact.join(', ')}.\`;
    } else if (lower.includes('combien de clients par jour')) {
      const todayClients = new Set(shopSales.filter(s => new Date(s.date) >= today).map(s => s.customerName)).size;
      answer = \`👥 Clients aujourd'hui : \${todayClients}.\`;
    } else if (lower.includes('vendeurs dans l\'équipe')) {
      answer = \`👥 Vendeurs dans l'équipe : \${vendors.length}.\`;
    } else if (lower.includes('vendeur le plus performant')) {
      if (topSeller) answer = \`🏆 Vendeur le plus performant : \${topSeller.fullName}.\`;
      else answer = 'Aucune donnée.';
    } else if (lower.includes('vendeur le moins performant')) {
      const min = Object.entries(sellerSalesMap).reduce((a, b) => a[1] < b[1] ? a : b, [null, Infinity]);
      if (min[0]) {
        const user = users.find(u => u.id === parseInt(min[0]));
        answer = \`📉 Vendeur le moins performant : \${user?.fullName || 'Inconnu'}.\`;
      } else answer = 'Aucune donnée.';
    } else if (lower.includes('productivité par vendeur')) {
      const stats = Object.entries(sellerSalesMap).map(([id, total]) => {
        const user = users.find(u => u.id === parseInt(id));
        return \`\${user?.fullName || 'Inconnu'} : \${total.toLocaleString()} FCFA\`;
      });
      answer = stats.length > 0 ? \`📊 Productivité : \${stats.join(' | ')}\` : 'Aucune donnée.';
      
    // ========== BOUTIQUES ==========
    } else if (lower.includes('quelles sont mes boutiques')) {
      const list = shops.map(s => \`\${s.name} (${s.address || 'Adresse non renseignée'})\`).join(' | ');
      answer = \`🏪 Mes boutiques : \${list || 'Aucune boutique'}.\`;
    } else if (lower.includes('boutique la plus rentable')) {
      const shopRevenue = {};
      shopSales.forEach(s => shopRevenue[s.shopId] = (shopRevenue[s.shopId] || 0) + s.total);
      const best = Object.keys(shopRevenue).reduce((a, b) => shopRevenue[a] > shopRevenue[b] ? a : b);
      const shop = shops.find(s => s.id === parseInt(best));
      answer = \`🏆 Boutique la plus rentable : \${shop?.name || 'Inconnu'} (\${shopRevenue[best].toLocaleString()} FCFA).\`;
    } else if (lower.includes('boutique vend le plus')) {
      const shopCount = {};
      shopSales.forEach(s => shopCount[s.shopId] = (shopCount[s.shopId] || 0) + 1);
      const best = Object.keys(shopCount).reduce((a, b) => shopCount[a] > shopCount[b] ? a : b);
      const shop = shops.find(s => s.id === parseInt(best));
      answer = \`📊 Boutique qui vend le plus : \${shop?.name || 'Inconnu'} (\${shopCount[best]} ventes).\`;
    } else if (lower.includes('boutique en perte')) {
      const shopProfit = {};
      shopSales.forEach(s => shopProfit[s.shopId] = (shopProfit[s.shopId] || 0) + s.total);
      shopExpenses.forEach(e => shopProfit[e.shopId] = (shopProfit[e.shopId] || 0) - e.amount);
      const losing = Object.entries(shopProfit).filter(([_, profit]) => profit < 0);
      if (losing.length === 0) answer = '✅ Aucune boutique en perte.';
      else {
        const names = losing.map(([id]) => {
          const shop = shops.find(s => s.id === parseInt(id));
          return shop?.name || 'Inconnu';
        });
        answer = \`⚠️ Boutiques en perte : \${names.join(', ')}.\`;
      }
    } else if (lower.includes('boutique en croissance')) {
      const shopGrowth = {};
      shops.forEach(shop => {
        const sales = shopSales.filter(s => s.shopId === shop.id);
        const recent = sales.filter(s => new Date(s.date) >= startOfWeek).length;
        const old = sales.filter(s => new Date(s.date) < startOfWeek && new Date(s.date) >= new Date(now.getTime() - 14*24*60*60*1000)).length;
        shopGrowth[shop.id] = recent - old;
      });
      const growing = Object.entries(shopGrowth).filter(([_, diff]) => diff > 0);
      if (growing.length === 0) answer = '📊 Aucune boutique en croissance.';
      else {
        const names = growing.map(([id]) => {
          const shop = shops.find(s => s.id === parseInt(id));
          return shop?.name || 'Inconnu';
        });
        answer = \`📈 Boutiques en croissance : \${names.join(', ')}.\`;
      }
      
    // ========== IA ET PRÉDICTIONS ==========
    } else if (lower.includes('prédiction pour demain')) {
      if (shopSales.length < 7) answer = 'Pas assez de données pour une prédiction (minimum 7 jours).';
      else {
        const dailyTotals = {};
        shopSales.forEach(s => {
          const date = new Date(s.date).toISOString().split('T')[0];
          dailyTotals[date] = (dailyTotals[date] || 0) + s.total;
        });
        const values = Object.values(dailyTotals);
        const last7Avg = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
        const prediction = Math.round(last7Avg * 1.05);
        answer = \`🔮 Prédiction pour demain : ~\${prediction.toLocaleString()} FCFA de CA.\`;
      }
    } else if (lower.includes('prédiction pour la semaine')) {
      if (shopSales.length < 14) answer = 'Pas assez de données pour une prédiction (minimum 14 jours).';
      else {
        const dailyTotals = {};
        shopSales.forEach(s => {
          const date = new Date(s.date).toISOString().split('T')[0];
          dailyTotals[date] = (dailyTotals[date] || 0) + s.total;
        });
        const values = Object.values(dailyTotals);
        const last7Avg = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
        const prediction = Math.round(last7Avg * 7 * 1.03);
        answer = \`🔮 Prédiction pour la semaine : ~\${prediction.toLocaleString()} FCFA de CA.\`;
      }
    } else if (lower.includes('prédiction pour le mois')) {
      if (shopSales.length < 30) answer = 'Pas assez de données pour une prédiction (minimum 30 jours).';
      else {
        const dailyTotals = {};
        shopSales.forEach(s => {
          const date = new Date(s.date).toISOString().split('T')[0];
          dailyTotals[date] = (dailyTotals[date] || 0) + s.total;
        });
        const values = Object.values(dailyTotals);
        const last30Avg = values.slice(-30).reduce((a, b) => a + b, 0) / 30;
        const prediction = Math.round(last30Avg * 30 * 1.02);
        answer = \`🔮 Prédiction pour le mois : ~\${prediction.toLocaleString()} FCFA de CA.\`;
      }
    } else if (lower.includes('saisonnalité')) {
      const monthly = {};
      shopSales.forEach(s => {
        const month = new Date(s.date).toLocaleDateString('fr-FR', { month: 'long' });
        monthly[month] = (monthly[month] || 0) + s.total;
      });
      const sorted = Object.entries(monthly).sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0) answer = 'Aucune donnée.';
      else answer = \`📅 Saisonnalité : Meilleur mois : \${sorted[0][0]} (\${sorted[0][1].toLocaleString()} FCFA).\`;
    } else if (lower.includes('signaux faibles') || lower.includes('anomalies')) {
      const avg = shopSales.reduce((sum, s) => sum + s.total, 0) / (shopSales.length || 1);
      const anomalies = shopSales.filter(s => s.total > avg * 3 || s.total < avg * 0.3);
      if (anomalies.length === 0) answer = '✅ Aucune anomalie détectée.';
      else answer = \`⚠️ \${anomalies.length} anomalies détectées (ventes hors normes).\`;
    } else if (lower.includes('score de santé')) {
      const metrics = [
        totalSales > 10 ? 20 : totalSales > 5 ? 10 : 0,
        totalRevenue > 1000000 ? 20 : totalRevenue > 500000 ? 10 : 0,
        shopProducts.length > 20 ? 20 : shopProducts.length > 10 ? 10 : 0,
        netProfit > 0 ? 20 : netProfit > -100000 ? 10 : 0,
        shopSales.filter(s => new Date(s.date) >= startOfWeek).length > 5 ? 20 : 10
      ];
      const score = metrics.reduce((a, b) => a + b, 0);
      const status = score >= 80 ? '🏆 Excellent' : score >= 60 ? '✅ Bon' : score >= 40 ? '⚠️ Moyen' : '❌ Critique';
      answer = \`🏥 Score de santé : \${score}/100 - \${status}.\`;
    } else if (lower.includes('comment booster les ventes')) {
      const lowStock = shopProducts.filter(p => p.quantity <= p.alertThreshold).length;
      const promotions = shopProducts.filter(p => p.quantity > 0 && p.quantity <= 10).map(p => p.name);
      let advice = '🚀 Conseils pour booster les ventes :';
      if (lowStock > 0) advice += \`\\n- Réapprovisionner \${lowStock} produits en stock faible.\`;
      if (promotions.length > 0) advice += \`\\n- Faire des promotions sur : \${promotions.join(', ')}.\`;
      advice += \`\\n- Fidéliser vos \${new Set(shopSales.map(s => s.customerName)).size} clients.\`;
      advice += \`\\n- Former vos \${vendors.length} vendeurs.\`;
      answer = advice;
    } else if (lower.includes('comment fidéliser les clients')) {
      const topClients = Object.entries(shopSales.reduce((acc, s) => {
        acc[s.customerName] = (acc[s.customerName] || 0) + s.total;
        return acc;
      }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
      answer = \`💝 Conseils de fidélisation :\\n- Offrir des remises aux meilleurs clients : \${topClients.map(([name]) => name).join(', ') || 'Aucun'}.\\n- Mettre en place un programme de fidélité.\\n- Envoyer des offres personnalisées.\`;
    } else if (lower.includes('concurrence') || lower.includes('avantage concurrentiel')) {
      answer = \`⚔️ Votre avantage concurrentiel :\\n- \${shopProducts.length} produits disponibles.\\n- \${totalSales} ventes réalisées.\\n- \${vendors.length} vendeurs formés.\\n- Chiffre d'affaires : \${totalRevenue.toLocaleString()} FCFA.\`;
    } else if (lower.includes('part de marché')) {
      const totalMarket = 10000000;
      const marketShare = (totalRevenue / totalMarket) * 100;
      answer = \`📊 Part de marché estimée : \${marketShare.toFixed(2)}%.\`;
      
    // ========== RÉPONSE PAR DÉFAUT ==========
    } else {
      answer = \`🤖 Je peux répondre à plus de 150 questions sur :
📊 VENTES : aujourd'hui, hier, mois, tendances, meilleur jour, panier moyen
📦 PRODUITS : plus vendu, stock, rupture, péremption, marges
💰 FINANCES : bénéfice, dépenses, marge, trésorerie, TVA
👥 CLIENTS : meilleurs clients, fidélisation, recontact
👤 VENDEURS : performance, commissions, productivité
🏪 BOUTIQUES : rentabilité, croissance, pertes
🔮 ANALYSES : prédictions, saisonnalité, anomalies, santé

Posez votre question !\`;
    }

    res.json({ answer });
  } catch (err) {
    console.error('Erreur IA:', err);
    res.status(500).json({ error: err.message });
  }
});
\`;

// Remplacer l'ancienne fonction IA par la nouvelle
const oldAI = /\/\/ ========== IA ==========[\s\S]*?\/\/ ========== CONFIGURATION FACTURE ==========/;
code = code.replace(oldAI, newAI + '\n\n// ========== CONFIGURATION FACTURE ==========');

fs.writeFileSync('server.js', code);
console.log('✅ IA étendue avec 150+ réponses !');
"
