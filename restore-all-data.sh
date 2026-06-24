#!/bin/bash
echo "🔄 Restauration complète des données..."

# 1. Créer le dossier de destination
mkdir -p ~/.lagrange-shop

# 2. Copier les données depuis user-data/
if [ -d "user-data" ]; then
  echo "📁 Copie depuis user-data/..."
  cp -r user-data/* ~/.lagrange-shop/
  echo "✅ Données copiées depuis user-data/"
fi

# 3. Copier depuis backup_final si existant
if [ -d "backup_final/user-data" ]; then
  echo "📁 Copie depuis backup_final/user-data/..."
  cp -r backup_final/user-data/* ~/.lagrange-shop/
  echo "✅ Données copiées depuis backup_final/"
fi

# 4. Vérifier les données restaurées
echo ""
echo "📊 Données restaurées :"
ls -la ~/.lagrange-shop/

# 5. Afficher les utilisateurs trouvés
echo ""
echo "👥 Utilisateurs trouvés :"
for dir in ~/.lagrange-shop/*/; do
  if [ -d "$dir" ]; then
    user_id=$(basename "$dir")
    if [ -f "$dir/shops.json" ]; then
      shops=$(cat "$dir/shops.json" | grep -c "name" 2>/dev/null || echo "?")
      echo "  - Utilisateur $user_id : $shops boutiques"
    fi
  fi
done

echo ""
echo "✅ Restauration terminée !"
echo "🚀 Redémarre avec : node server.js"
