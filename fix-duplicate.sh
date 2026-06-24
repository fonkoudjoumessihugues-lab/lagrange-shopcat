#!/bin/bash
echo "🔧 Correction des doublons IA..."

node -e "
const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

// Trouver et corriger les lignes problématiques
let newLines = [];
let skipNext = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  // Supprimer la première ligne answer avec apostrophe mal formée
  if (line.includes('Je reponds a + de 50 questions') && line.includes('aujourd')) {
    continue; // Sauter cette ligne
  }
  
  // Supprimer la deuxième ligne answer en double
  if (line.includes('VENTES : aujourd') && line.includes('Posez votre question')) {
    continue; // Sauter cette ligne
  }
  
  // Corriger la ligne qui commence par 'VENTES :' seule
  if (line.trim().startsWith('VENTES :')) {
    continue; // Sauter
  }
  
  newLines.push(line);
}

fs.writeFileSync('server.js', newLines.join('\n'));
console.log('✅ Doublons supprimés !');
"
echo ""
echo "📊 Vérification des lignes 185-195 :"
sed -n '185,195p' server.js
echo ""
echo "🚀 Redémarre avec : node server.js"
