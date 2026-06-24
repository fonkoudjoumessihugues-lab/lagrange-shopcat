#!/bin/bash
echo "🔧 Correction de la ligne 109..."

# Créer une copie
cp server.js server.js.line109.backup

# Remplacer la ligne avec un fichier temporaire
node -e "
const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');
if (lines[108]) {
  lines[108] = '      answer = \"Je reponds a + de 50 questions sur : VENTES : aujourd\\'\\''hui, hier, mois, tendances, panier moyen | PRODUITS : plus vendu, stock, rupture, peremption | FINANCES : benefice, depenses, marge, sante | CLIENTS : meilleurs clients, fideles | VENDEURS : performance, commissions | BOUTIQUES : rentabilite | PREDICTIONS : demain, semaine | Posez votre question !\";';
  fs.writeFileSync('server.js', lines.join('\n'));
  console.log('✅ Ligne 109 corrigée !');
} else {
  console.log('❌ Ligne 109 non trouvée');
}
"
