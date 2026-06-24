#!/bin/bash
echo "🔧 Correction définitive du chemin des données..."

# Sauvegarde
cp server.js server.js.path.final.backup

# Modifier le chemin vers le bon dossier
sed -i 's|const USER_DATA_ROOT = process.env.USER_DATA_DIR || path.join(os.homedir(), '\''.lagrange-shop'\'');|const USER_DATA_ROOT = path.join(__dirname, '\''user-data'\'');|' server.js

# Vérifier la modification
echo "✅ Chemin modifié vers : ./user-data"
echo ""
echo "📊 Vérification :"
grep "USER_DATA_ROOT" server.js

echo ""
echo "📁 Données trouvées dans user-data :"
ls -la user-data/

echo ""
echo "📊 Utilisateurs trouvés :"
ls -la user-data/

echo ""
echo "🚀 Redémarre avec : node server.js"
