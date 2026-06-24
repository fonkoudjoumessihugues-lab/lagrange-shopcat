#!/bin/bash
echo "🔧 Correction du chemin des données..."

# Sauvegarde
cp server.js server.js.data.backup

# Remplacer le chemin USER_DATA_ROOT
sed -i 's|const USER_DATA_ROOT = path.join(DATA_DIR, '\''users'\'');|const USER_DATA_ROOT = path.join(__dirname, '\''user-data'\'');|' server.js

# Vérifier
echo "✅ Chemin modifié vers : ./user-data"
echo ""
echo "📊 Nouveau chemin :"
grep "USER_DATA_ROOT" server.js

echo ""
echo "📁 Données utilisateur :"
ls -la user-data/

echo ""
echo "👤 Utilisateurs trouvés :"
ls -la user-data/ | grep ^d

echo ""
echo "🚀 Redémarre avec : node server.js"
