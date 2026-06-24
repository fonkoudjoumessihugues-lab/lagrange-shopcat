#!/bin/bash
echo "🔧 Remplacement par guillemets doubles..."

cp server.js server.js.quotes.backup

# Remplacer les apostrophes simples par des guillemets doubles pour les strings
sed -i "s/answer = '\([^']*\)Aujourd'hui\([^']*\)'/answer = \"\1Aujourd'hui\2\"/g" server.js
sed -i "s/answer = '\([^']*\)aujourd'hui\([^']*\)'/answer = \"\1aujourd'hui\2\"/g" server.js

echo "✅ Correction terminée !"
