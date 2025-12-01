# 📝 Transient Notes

Une application simple et élégante de prise de notes avec support d'images et organisation selon la méthode PARA.

## ✨ Fonctionnalités

- 📝 Création et édition de notes
- 🖼️ Support des images (drag & drop, copy/paste)
- 🗂️ Organisation PARA (Projects, Areas, Resources, Archives)
- 💾 Persistance locale avec IndexedDB
- 📤 Export au format TXT
- ⌨️ Raccourcis clavier
- 🎨 Interface 3 panneaux intuitive

## 🚀 Utilisation locale

Ouvrez simplement `index.html` dans Chrome - aucun serveur ou build requis !

## 📦 Déploiement sur GitHub Pages

### Configuration initiale

1. **Activer GitHub Pages** dans les paramètres du repository :
   - Allez dans `Settings` > `Pages`
   - Source : `GitHub Actions`

2. **Pousser vers main/master** :
   ```bash
   git push origin main
   ```

3. **Le workflow se lance automatiquement** et déploie votre application

### Déploiement manuel

Vous pouvez aussi déclencher un déploiement manuellement :
- Allez dans l'onglet `Actions`
- Sélectionnez `Deploy to GitHub Pages`
- Cliquez sur `Run workflow`

### URL de l'application

Une fois déployée, votre application sera accessible à :
```
https://[username].github.io/[repository-name]/
```

## 🛠️ Stack technique

- **HTML5** - Structure sémantique
- **CSS3** - Méthodologie BEM
- **JavaScript ES2024+** - Paradigme fonctionnel
- **IndexedDB** - Persistance des données
- **Chrome latest** - Navigateur cible

## 📖 Méthode PARA

L'organisation suit la méthode PARA de Tiago Forte :

- **Projects** 🎯 - Efforts à court terme avec deadline
- **Areas** 🏠 - Responsabilités à long terme
- **Resources** 📚 - Sujets d'intérêt
- **Archives** 🗄️ - Éléments inactifs

## ⌨️ Raccourcis clavier

- `Ctrl+N` - Nouvelle note
- `Ctrl+F` - Rechercher
- `Ctrl+B` - Gras
- `Ctrl+I` - Italique

## 📄 License

MIT
