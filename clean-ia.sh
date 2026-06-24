#!/bin/bash
echo "🧹 Nettoyage des lignes parasites de l'IA..."

# Sauvegarde
cp server.js server.js.clean.backup

# Supprimer les lignes qui commencent par "VENTES :", "PRODUITS :", etc.
sed -i '/^VENTES :/d' server.js
sed -i '/^PRODUITS :/d' server.js
sed -i '/^FINANCES :/d' server.js
sed -i '/^CLIENTS :/d' server.js
sed -i '/^VENDEURS :/d' server.js
sed -i '/^BOUTIQUES :/d' server.js
sed -i '/^PREDICTIONS :/d' server.js

# Supprimer les lignes vides en trop
sed -i '/^$/N;/^\n$/D' server.js

echo "✅ Nettoyage terminé !"
echo "📊 Vérification de la ligne 190 :"
sed -n '190p' server.js
echo ""
echo "🚀 Redémarre avec : node server.js"
