#!/bin/bash
echo "🛠️ Ajout des 150 questions à l'IA..."

# Sauvegarder l'original
cp public/index.html public/index.html.backup

# Insérer les questions après la fonction showAI()
node -e "
const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// Définir les 150 questions
const questions = [
  // VENTES
  'Combien de ventes ai-je fait aujourd\'hui ?',
  'Combien de ventes ai-je fait hier ?',
  'Quel est mon chiffre d\'affaires du mois ?',
  'Comparé au mois dernier, comment évoluent mes ventes ?',
  'Quel est mon meilleur jour de vente ?',
  'Quel est mon pire jour de vente ?',
  'Quelle est la moyenne des ventes par jour ?',
  'Quel est le montant moyen d\'une vente (panier moyen) ?',
  'Quelle est ma meilleure vente de tous les temps ?',
  'Y a-t-il une tendance à la hausse ou à la baisse ?',
  'Quels jours de la semaine vends-je le plus ?',
  'Quelles heures de la journée vends-je le plus ?',
  'Quel est le total des ventes de la semaine ?',
  'Combien de clients différents ai-je ?',
  'Quel est le taux de transformation ?',
  'Quelle est la durée moyenne entre deux ventes ?',
  'Ai-je vendu plus qu\'hier ?',
  'Ai-je vendu plus que la semaine dernière ?',
  'Quelle est ma progression par rapport au mois dernier ?',
  'Quel est mon objectif mensuel et où en suis-je ?',
  'Combien de ventes par vendeur ?',
  'Qui est le vendeur du mois ?',
  'Y a-t-il des vendeurs sous-performants ?',
  'Quel vendeur a le meilleur panier moyen ?',
  'Quelle est la commission à verser à chaque vendeur ?',
  'Quel est le taux de conversion par vendeur ?',
  'Y a-t-il des fraudes suspectes ?',
  'Combien de ventes annulées ?',
  'Pourquoi des ventes sont-elles annulées ?',
  'Quel est le coût des annulations ?',
  // PRODUITS
  'Quel est mon produit le plus vendu ?',
  'Quel est mon produit le moins vendu ?',
  'Quels produits sont en rupture de stock ?',
  'Quels produits sont en stock faible ?',
  'Quels produits ne se vendent plus (dormants) ?',
  'Quelle est la rotation de mon stock ?',
  'Combien de produits en stock au total ?',
  'Quelle est la valeur totale de mon stock ?',
  'Quel produit rapporte le plus de marge ?',
  'Quel produit rapporte le moins de marge ?',
  'Quels produits devrais-je commander ?',
  'Quelle quantité de chaque produit commander ?',
  'Quels produits sont périmés bientôt ?',
  'Quels produits ont dépassé la date de péremption ?',
  'Quelle est la durée de vie moyenne des produits ?',
  'Quels produits sont les plus rentables ?',
  'Quels produits sont des best-sellers ?',
  'Quels produits sont des slow-movers ?',
  'Quel est le taux de casse par produit ?',
  'Quels produits ont été ajoutés récemment ?',
  'Quels produits ont été modifiés récemment ?',
  'Quels produits n\'ont jamais été vendus ?',
  'Quels produits sont saisonniers ?',
  'Quelles sont les tendances produits du moment ?',
  'Quel est le meilleur moment pour commander ?',
  'Quel est le meilleur moment pour faire des promotions ?',
  'Quels produits sont à promouvoir ?',
  'Quels produits sont à écouler en urgence ?',
  'Quels sont les produits complémentaires ?',
  'Quel est le taux de rotation par catégorie ?',
  // FINANCES
  'Quel est mon bénéfice net aujourd\'hui ?',
  'Quel est mon bénéfice net du mois ?',
  'Quel est mon bénéfice net de l\'année ?',
  'Quelle est ma marge brute ?',
  'Quelle est ma marge nette ?',
  'Quelles sont mes dépenses du mois ?',
  'Quelle est ma plus grosse dépense ?',
  'Quelles sont mes dépenses par catégorie ?',
  'Comment réduire mes dépenses ?',
  'Quel est mon seuil de rentabilité ?',
  'Combien dois-je vendre par jour pour être rentable ?',
  'Quelle est ma trésorerie actuelle ?',
  'Ai-je des dettes fournisseurs ?',
  'Combien dois-je aux fournisseurs ?',
  'Quels clients me doivent de l\'argent ?',
  'Quel est le total des créances ?',
  'Quel est le total des dettes ?',
  'Quelle est ma santé financière ?',
  'Quel est le ROI de mon entreprise ?',
  'Quels produits sont les plus rentables ?',
  'Quels produits perdent de l\'argent ?',
  'Quelle est la TVA à déclarer ce mois ?',
  'Comment optimiser ma fiscalité ?',
  'Quels sont les coûts cachés ?',
  'Quelle est la rentabilité par boutique ?',
  // CLIENTS ET VENDEURS
  'Qui sont mes meilleurs clients ?',
  'Combien de clients fidèles ?',
  'Quel est le panier moyen par client ?',
  'Qui sont les clients à recontacter ?',
  'Qui a acheté le plus cher ?',
  'Qui a acheté le plus souvent ?',
  'Depuis quand untel n\'a pas acheté ?',
  'Quels clients sont partis chez la concurrence ?',
  'Quels clients méritent une remise ?',
  'Combien de clients par jour ?',
  'Combien de vendeurs dans l\'équipe ?',
  'Qui est le vendeur le plus performant ?',
  'Qui est le vendeur le moins performant ?',
  'Quels vendeurs sont en formation ?',
  'Quels vendeurs ont besoin d\'encouragement ?',
  'Quelle est la productivité par vendeur ?',
  'Quel vendeur mérite une prime ?',
  'Y a-t-il des conflits entre vendeurs ?',
  'Comment améliorer l\'équipe ?',
  'Quels sont les objectifs des vendeurs ?',
  // BOUTIQUES
  'Quelles sont mes boutiques ?',
  'Quelle boutique est la plus rentable ?',
  'Quelle boutique est la moins rentable ?',
  'Quelle boutique vend le plus ?',
  'Quelle boutique a le plus de stock ?',
  'Quelle boutique a le plus de produits ?',
  'Quelle boutique a le plus de clients ?',
  'Quelle boutique a le meilleur emplacement ?',
  'Quelle boutique a besoin d\'être rénovée ?',
  'Quelles sont les heures d\'ouverture ?',
  'Y a-t-il des vols dans les boutiques ?',
  'Quels sont les horaires d\'affluence ?',
  'Quelle boutique mérite une extension ?',
  'Où ouvrir une nouvelle boutique ?',
  'Quels sont les coûts par boutique ?',
  'Quelle est la productivité par boutique ?',
  'Quelles boutiques sont en perte ?',
  'Quelles boutiques sont en croissance ?',
  'Comment optimiser les horaires ?',
  'Quels sont les jours de fermeture ?',
  // IA ET ANALYSES
  'Prédiction pour demain ?',
  'Prédiction pour la semaine prochaine ?',
  'Prédiction pour le mois prochain ?',
  'Quels produits seront en rupture bientôt ?',
  'Quand devrais-je commander ?',
  'Quelles tendances se dessinent ?',
  'Y aura-t-il une baisse de ventes bientôt ?',
  'Comment anticiper une hausse ?',
  'Quels sont les signaux faibles ?',
  'Quelles sont les anomalies détectées ?',
  'Quelle est la saisonnalité de mes ventes ?',
  'Y a-t-il une corrélation météo/ventes ?',
  'Comment améliorer mes prévisions ?',
  'Quelle est la fiabilité de mes prédictions ?',
  'Quels sont les indicateurs avancés ?',
  'Quel est le score de santé de l\'entreprise ?',
  'Que faire en cas de crise ?',
  'Comment booster les ventes ?',
  'Quelles promotions sont efficaces ?',
  'Comment fidéliser les clients ?',
  'Comment recruter de nouveaux clients ?',
  'Quel est mon avantage concurrentiel ?',
  'Comment battre la concurrence ?',
  'Quelle est ma part de marché ?',
  'Comment être leader ?'
];

// Créer la fonction pour afficher les questions
const questionHtml = questions.map(q => 
  \`<button class="suggestion-btn" onclick="askSuggestion('\${q}')">\${q}</button>\`
).join('');

// Remplacer la section suggestions
const suggestionsDiv = \`
  <div style="margin-top:12px;max-height:200px;overflow-y:auto;padding:8px;background:var(--bg-card);border-radius:var(--radius-sm);border:1px solid var(--border-color);">
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      \${questionHtml}
    </div>
  </div>
\`;

// Remplacer la fonction updateSuggestions
const updateSuggestionsFunc = \`
function updateSuggestions() {
  const suggestionsDiv = document.getElementById('suggestions');
  if (!suggestionsDiv) return;
  const allQuestions = [
    'Combien de ventes ai-je fait aujourd'hui ?',
    'Combien de ventes ai-je fait hier ?',
    'Quel est mon chiffre d'affaires du mois ?',
    'Comparé au mois dernier, comment évoluent mes ventes ?',
    'Quel est mon produit le plus vendu ?',
    'Quels produits sont en rupture de stock ?',
    'Quels produits sont en stock faible ?',
    'Quel est mon bénéfice net aujourd'hui ?',
    'Quel est mon bénéfice net du mois ?',
    'Quelles sont mes dépenses du mois ?',
    'Qui sont mes meilleurs clients ?',
    'Qui est le vendeur du mois ?',
    'Prédiction pour demain ?',
    'Quelle boutique est la plus rentable ?',
    'Comment booster les ventes ?',
    'Quelles tendances se dessinent ?'
  ];
  suggestionsDiv.innerHTML = allQuestions.map(q => 
    \`<button class="suggestion-btn" onclick="askSuggestion('\${q}')">\${q}</button>\`
  ).join('');
}
\`;

// Remplacer dans le code
html = html.replace(/function updateSuggestions\(\) \{[\s\S]*?\}/, updateSuggestionsFunc);

// Ajouter le bouton "Voir toutes les questions"
html = html.replace(
  '<div class="suggestions" id="suggestions"></div>',
  \`<button class="btn-secondary" onclick="toggleAllQuestions()" style="margin-bottom:8px;width:100%;">
  <i class="fas fa-list"></i> Voir toutes les questions (150)
</button>
<div id="allQuestionsContainer" style="display:none;max-height:300px;overflow-y:auto;background:var(--bg-card);border-radius:var(--radius-sm);border:1px solid var(--border-color);padding:12px;margin-bottom:12px;">
  <div style="display:flex;flex-wrap:wrap;gap:6px;">
    \${questionHtml}
  </div>
</div>
<div class="suggestions" id="suggestions"></div>\`
);

// Ajouter la fonction toggleAllQuestions
html = html.replace(
  '</script>',
  \`
function toggleAllQuestions() {
  const container = document.getElementById('allQuestionsContainer');
  if (container.style.display === 'none') {
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}
</script>\`
);

fs.writeFileSync('public/index.html', html);
console.log('✅ 150 questions ajoutées avec succès !');
"
