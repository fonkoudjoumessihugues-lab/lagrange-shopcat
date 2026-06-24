#!/bin/bash
echo "🗑️ Suppression de TOUTES les anciennes versions de l'IA..."

# Sauvegarde
cp server.js server.js.remove.backup

# Supprimer TOUTES les lignes qui contiennent des mots clés de l'IA
sed -i '/Je reponds a + de 50 questions/d' server.js
sed -i '/VENTES : aujourd/d' server.js
sed -i '/PRODUITS : plus vendu/d' server.js
sed -i '/FINANCES : benefice/d' server.js
sed -i '/CLIENTS : meilleurs clients/d' server.js
sed -i '/VENDEURS : performance/d' server.js
sed -i '/BOUTIQUES : rentabilite/d' server.js
sed -i '/PREDICTIONS : demain/d' server.js
sed -i '/Posez votre question/d' server.js

# Supprimer les lignes vides
sed -i '/^[[:space:]]*$/d' server.js

echo "✅ Anciennes versions supprimées !"
echo ""
echo "📊 Vérification :"
grep -n "Je reponds" server.js || echo "✅ Aucune trace de l'ancienne IA trouvée"
echo ""
echo "🚀 Maintenant on peut installer la nouvelle IA !"
