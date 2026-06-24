#!/bin/bash
echo "🔧 Correction complète de l'IA..."

# Sauvegarde
cp server.js server.js.backup

# Correction de TOUTES les apostrophes problématiques
sed -i "s/Aujourd'hui/Aujourd\\\x27hui/g" server.js
sed -i "s/aujourd'hui/aujourd\\\x27hui/g" server.js
sed -i "s/d'affaires/d\\\x27affaires/g" server.js
sed -i "s/l'équipe/l\\\x27équipe/g" server.js
sed -i "s/l'année/l\\\x27année/g" server.js
sed -i "s/aujourd'hui/aujourd\\\x27hui/g" server.js
sed -i "s/Aujourd'hui/Aujourd\\\x27hui/g" server.js

# Correction des guillemets dans les strings
sed -i "s/answer = '\([^']*\)Aujourd\\\x27hui\([^']*\)'/answer = \"\1Aujourd'hui\2\"/g" server.js

echo "✅ Corrections appliquées !"
echo ""
echo "📊 Vérification de la ligne 58 :"
sed -n '58p' server.js
echo ""
echo "🚀 Redémarre avec : node server.js"
