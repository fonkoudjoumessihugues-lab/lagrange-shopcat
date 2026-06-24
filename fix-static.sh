#!/bin/bash
echo "🔧 Correction du serveur statique..."

# Vérifier que le dossier public existe
if [ ! -d "public" ]; then
  echo "❌ Dossier public manquant !"
  exit 1
fi

# Vérifier que index.html existe
if [ ! -f "public/index.html" ]; then
  echo "❌ public/index.html manquant !"
  exit 1
fi

# Ajouter la route pour la racine
cat >> server.js << 'ROUTE'

// ========== ROUTES STATIQUES ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/auth.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

ROUTE

echo "✅ Routes statiques ajoutées !"
echo ""
echo "📊 Vérification :"
grep -n "app.get('/'" server.js || echo "⚠️ Vérifie que la route a été ajoutée"
echo ""
echo "🚀 Redémarre avec : node server.js"
