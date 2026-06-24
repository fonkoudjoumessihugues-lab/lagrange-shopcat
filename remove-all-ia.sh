#!/bin/bash
echo "🗑️ Suppression des DEUX sections IA..."

# Sauvegarde
cp server.js server.js.before-remove

# Supprimer la première IA (ligne 2)
sed -i '2,23d' server.js

# Supprimer la deuxième IA (ligne 187)
sed -i '187,208d' server.js

echo "✅ Les deux IA supprimées !"
echo ""
echo "📊 Vérification :"
grep -c "api/ai/ask" server.js || echo "✅ Aucune IA trouvée (c'est bon)"
echo ""
echo "📦 Installation de la nouvelle IA..."
