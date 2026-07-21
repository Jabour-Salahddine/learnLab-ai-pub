# LearnLab AI

Plateforme pédagogique intelligente de simulation de travaux pratiques (TP) pour
étudiants en ingénierie, construite autour de 4 agents IA collaboratifs (LangGraph)
et d'un pipeline RAG multi-tenant.

Projet de Fin d'Année (PFA) — FST Mohammedia, filière IDSI, 2025/2026.

---

## Architecture

```
learnlab-ai/
├── backend/          # FastAPI (Python) — API REST + WebSocket + agents LangGraph
├── frontend/         # React + Vite + TypeScript — UI
├── docker/           # Dockerfiles et configs
└── docker-compose.yml
```

**Stack** : FastAPI · PostgreSQL · Redis · Qdrant · MinIO · Piston (sandbox
d'exécution de code) · LangChain / LangGraph · OpenAI API · React + Vite + Bun ·
Tailwind CSS · shadcn/ui · Monaco Editor.

## Fonctionnement

- Un **enseignant** crée des topics de TP, uploade des documents de cours (PDF/MD)
  indexés dans une collection Qdrant qui lui est propre (isolation multi-tenant).
- Un **étudiant** s'inscrit via un code d'invitation, reçoit des TPs générés sur
  mesure selon son profil, code dans un éditeur intégré, et soumet son travail
  pour exécution isolée (Piston).
- Quatre agents IA orchestrés via LangGraph interviennent après chaque
  soumission : **Tuteur** (génération de TP + hints progressifs), **Évaluateur**
  (scoring + classification des erreurs), **Explicateur** (réponses aux
  questions), **Analyste** (mise à jour du profil étudiant + rapports).

## Prérequis

- Docker et Docker Compose
- Une clé API OpenAI

## Installation

1. Clonez le dépôt puis copiez les fichiers d'environnement d'exemple :

   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   ```

2. Renseignez vos propres valeurs dans `.env`, en particulier :
   - `OPENAI_API_KEY`
   - `JWT_SECRET_KEY` (une chaîne aléatoire longue)
   - les identifiants PostgreSQL / MinIO si vous les changez

3. Démarrez l'ensemble des services :

   ```bash
   docker compose up -d
   ```

4. Appliquez les migrations de base de données :

   ```bash
   docker compose exec backend alembic upgrade head
   ```

5. Accédez à l'application :
   - Frontend : http://localhost:3000
   - API backend : http://localhost:8000
   - Documentation API (Swagger) : http://localhost:8000/docs
   - Dashboard Qdrant : http://localhost:6333/dashboard
   - Console MinIO : http://localhost:9001

## Comptes de démonstration

Après le démarrage, vous pouvez créer vos propres comptes via l'interface :

1. **Enseignant** : s'inscrit directement
2. **Étudiant** : s'inscrit avec le code d'invitation généré par l'enseignant

## Commandes utiles

```bash
# Voir les logs d'un service
docker compose logs -f backend

# Créer une nouvelle migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Lancer les tests backend
docker compose exec backend pytest tests/ -v
```

## Licence

Ce projet est réalisé dans un cadre académique — FST Mohammedia, 2025/2026.
