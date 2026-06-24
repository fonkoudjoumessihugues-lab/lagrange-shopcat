#!/bin/bash
echo "🔍 Vérification du chemin des données..."

# Voir où le serveur pointe
grep -n "USER_DATA_ROOT" server.js

echo ""
echo "📁 Dossiers existants :"
ls -la user-data/ 2>/dev/null && echo "✅ user-data existe"
ls -la ~/.lagrange-shop/ 2>/dev/null && echo "✅ ~/.lagrange-shop existe"
ls -la data/users/ 2>/dev/null && echo "✅ data/users existe"

echo ""
echo "👤 Utilisateurs dans user-data :"
ls -la user-data/ 2>/dev/null | grep ^d

echo ""
echo "📦 Boutiques de l'utilisateur 3 :"
cat user-data/3/shops.json 2>/dev/null | head -10

echo ""
echo "📦 Boutiques de l'utilisateur 6 :"
cat user-data/6/shops.json 2>/dev/null | head -10
