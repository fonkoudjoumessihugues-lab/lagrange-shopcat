#!/bin/bash
echo "🔧 Correction du chemin des données..."

# Sauvegarde
cp server.js server.js.path.backup

# Modifier USER_DATA_ROOT pour pointer vers le bon dossier
sed -i 's|const USER_DATA_ROOT = path.join(DATA_DIR, '\''users'\'');|const USER_DATA_ROOT = process.env.USER_DATA_DIR || path.join(os.homedir(), '\''.lagrange-shop'\'');|' server.js

# Ajouter l'import os si manquant
if ! grep -q "const os = require('os')" server.js; then
  sed -i 's|const path = require('"'"'path'"'"');|const path = require('"'"'path'"'"');\nconst os = require('"'"'os'"'"');|' server.js
fi

echo "✅ Chemin des données corrigé !"
echo ""
echo "📊 Nouveau chemin : ~/.lagrange-shop"
echo ""
echo "📁 Vérification des anciennes données :"
ls -la ~/.lagrange-shop/ 2>/dev/null || echo "⚠️ Aucune donnée trouvée dans ~/.lagrange-shop"
echo ""
echo "🚀 Redémarre avec : node server.js"
