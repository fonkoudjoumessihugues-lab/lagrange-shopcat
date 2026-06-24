#!/bin/bash
echo "🔄 Restauration des données depuis user-data/..."

if [ -d "user-data" ] && [ "$(ls -A user-data)" ]; then
  echo "📁 Données trouvées dans user-data/"
  echo ""
  echo "📊 Contenu :"
  ls -la user-data/
  echo ""
  echo "📦 Copie vers ~/.lagrange-shop..."
  
  # Créer le dossier de destination
  mkdir -p ~/.lagrange-shop
  
  # Copier toutes les données
  cp -r user-data/* ~/.lagrange-shop/
  
  echo "✅ Données restaurées avec succès !"
  echo ""
  echo "📊 Vérification :"
  ls -la ~/.lagrange-shop/
else
  echo "❌ Aucune donnée trouvée dans user-data/"
  echo ""
  echo "🔍 Recherche d'autres emplacements..."
  
  # Chercher dans d'autres emplacements possibles
  find ~ -name "shops.json" -type f 2>/dev/null | head -5
fi
