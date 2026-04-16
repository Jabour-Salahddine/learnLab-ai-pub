# CLAUDE.md — LearnLab AI
# Fichier de contexte permanent pour Claude Code
# Lis ce fichier ENTIÈREMENT avant toute action.

---

## 🎯 QUI TU ES ET CE QU'ON CONSTRUIT

Tu es l'ingénieur principal du projet **LearnLab AI**, une plateforme pédagogique
intelligente de simulation de travaux pratiques (TP) pour étudiants en ingénierie.
Tu travailles en binôme avec Salahddine (étudiant ingénieur 4ème année, Data Science
& Génie Informatique, FST Mohammedia).

Ce projet constitue notre Projet de Fin d’Année (PFA) — prévu sur une durée de deux mois, mais nous allons essayer de travailler efficacement pour le terminer plus rapidement. La qualité,
la lisibilité du code et la documentation comptent autant que les fonctionnalités.

---

## 🏗️ ARCHITECTURE GLOBALE

```
learnlab-ai/
├── backend/          # FastAPI Python — API REST + WebSocket
├── frontend/         # Next.js 14 React TypeScript — UI
├── ai_engine/        # LangGraph + LangChain — Agents IA
├── rag_pipeline/     # Indexation et retrieval Qdrant
├── sandbox/          # Intégration Piston API (exécution code isolée)
├── docker/           # Dockerfiles et configs
├── docker-compose.yml
├── docker-compose.dev.yml
└── CLAUDE.md         # CE FICHIER
```

---

## 🧠 LOGIQUE MÉTIER — LIS ATTENTIVEMENT

### Acteurs
- **Étudiant** : s'inscrit via code d'invitation d'un enseignant, fait des TPs
  générés par l'IA selon son profil, reçoit feedback intelligent
- **Enseignant** : crée des topics de TP, uploade des documents RAG,
  suit ses étudiants, reçoit rapports IA hebdomadaires

### Multi-tenancy — RÈGLE ABSOLUE
**Chaque enseignant a son espace totalement isolé.**
- PostgreSQL : toutes les tables ont une colonne `teacher_id`
- Qdrant : une collection par enseignant → `teacher_{teacher_id}`
- Redis : clés préfixées `session:{teacher_id}:{student_id}:{tp_id}`
- FastAPI : `teacher_id` injecté par Dependency depuis JWT — JAMAIS depuis le client

Un étudiant est rattaché à un enseignant via la table `enrollments`.
Il peut être inscrit chez plusieurs enseignants (plusieurs matières).

### Flux principal étudiant
```
1. Inscription (code d'invitation enseignant obligatoire)
2. Login → JWT contient {student_id, role, active_teacher_id}
3. Dashboard → Agent Analyste recommande des TPs selon profil
4. Sélection topic → Agent Tuteur génère TP personnalisé via RAG
5. Session TP → Monaco Editor + Chat Agent (Tuteur/Explicateur)
6. Submit → Piston Sandbox → exécution isolée
7. Post-submit pipeline:
   ① Agent Évaluateur → score + classification erreurs
   ② Agent Tuteur → hints si score < seuil
   ③ Agent Explicateur → explication concept manqué
   ④ Agent Analyste (background) → màj profil étudiant
8. Résultat affiché → badge, score, recommandations
```

### Les 4 agents IA (LangGraph)
- **Agent Tuteur** : génère le TP + donne des hints progressifs (jamais la solution directe)
  - Déclenche : sélection d'un TP, erreur détectée, question sur le code
  - Input : profil étudiant + topic + chunks RAG
  - Output : énoncé TP OU hint niveau 1/2/3

- **Agent Évaluateur** : analyse la soumission de code
  - Déclenche : POST /submit reçu
  - Input : code + stdout + stderr + exit_code + tests_unitaires
  - Output : score 0-100 + tests_passés[] + erreurs_catégorisées[]

- **Agent Explicateur** : explique les concepts, répond aux questions
  - Déclenche : question directe étudiant OU délégation depuis Tuteur
  - Input : question + concept + niveau étudiant + chunks RAG
  - Output : explication adaptée + exemple code + lien cours

- **Agent Analyste** : analyse les données éducatives
  - Déclenche : après chaque soumission (background) + cron hebdo
  - Input : historique 30 jours + scores + erreurs
  - Output : profil mis à jour + recommandations + rapport enseignant

### Pipeline RAG
- Indexation offline : PDF/MD → PyMuPDF → chunks 512 tokens overlap 50
  → OpenAI embeddings → Qdrant (collection du prof)
- Retrieval runtime : question → embed → search(collection=teacher_{id},
  filter={tp_id, niveau}) → top-5 chunks → injection dans prompt agent
- Metadata par chunk : {source, tp_id, chapitre, niveau, type, teacher_id, tags[]}

### Gestion des erreurs (classification)
1. Détection déterministe : regex stderr, exit_code, timeout, compare expected_output
2. Classification LLM : SyntaxError / LogicError / AlgoError / ConceptError
3. Hints progressifs : hint_level stocké Redis, incrémenté à chaque erreur
   - Niveau 1 : indice conceptuel
   - Niveau 2 : indice structurel (ligne concernée)
   - Niveau 3 (3ème erreur identique) : solution partielle commentée

---

## 🗄️ SCHÉMA BASE DE DONNÉES

```sql
-- Utilisateurs (étudiants + enseignants)
users: id, email, password_hash, role(student|teacher), first_name,
       last_name, formation, filiere, year_of_study, created_at

-- Profil dynamique étudiant (mis à jour par Agent Analyste)
student_profiles: id, student_id FK, niveau(1-5), concepts_maitrisés[],
                  points_faibles[], vitesse_moyenne_min, updated_at

-- Inscription étudiant ↔ enseignant
enrollments: student_id FK, teacher_id FK, joined_via_code, enrolled_at

-- Codes d'invitation enseignant
invitation_codes: code PK, teacher_id FK, expires_at, max_uses,
                  current_uses, is_active

-- Topics de TP (créés par enseignant)
topics: id, teacher_id FK, title, description, domaine, niveau_min(1-5),
        tags[], is_active, created_at

-- TPs générés par l'IA pour chaque étudiant
generated_tps: id, student_id FK, topic_id FK, teacher_id FK,
               enonce TEXT, starter_code, tests_unitaires JSON,
               hints_progressifs JSON, solution_modele TEXT, created_at

-- Soumissions de code
submissions: id, student_id FK, tp_id FK, teacher_id FK, code TEXT,
             stdout, stderr, exit_code, score INT, errors_json JSON,
             created_at

-- Messages de chat (historique conversations avec agents)
chat_messages: id, student_id FK, tp_id FK, teacher_id FK,
               role(user|assistant), agent_type, content TEXT, created_at

-- Documents RAG uploadés par enseignant
rag_documents: id, teacher_id FK, filename, file_type, topic_id FK,
               qdrant_collection, chunks_count, status(pending|indexed|error),
               uploaded_at

-- Rapports hebdomadaires générés par Agent Analyste
reports: id, student_id FK, teacher_id FK, period_start, period_end,
         content TEXT, metrics_json JSON, created_at
```

---

## 🛠️ STACK TECHNIQUE

### Backend
- **Python 3.11**
- **FastAPI** — async, WebSocket, BackgroundTasks
- **SQLAlchemy 2.0** (async) + **Alembic** migrations
- **PostgreSQL 15**
- **Redis 7** — sessions, cache, queue
- **APScheduler** — tâches périodiques (rapport hebdo)
- **python-jose** — JWT
- **passlib[bcrypt]** — hashing passwords
- **PyMuPDF (fitz)** — parsing PDF
- **Pydantic v2** — validation

### IA
- **LangChain 0.2+** — chaînes, prompts, mémoire
- **LangGraph** — orchestration multi-agents avec AgentState
- **OpenAI API** — GPT-4o-mini (LLM) + text-embedding-3-small (embeddings)
- **Qdrant** — base vectorielle

### Sandbox
- **Piston API** (self-hosted ou public) — exécution code isolée Docker
- Langages supportés : Python, Java, R, C++

### Frontend
- React + Vite + Bun — projet généré par Lovable on va faire les modifications nécessaire après
- **TypeScript** strict
- **Tailwind CSS**
- **shadcn/ui**
- **Recharts** — visualisations
- **Lucide React** — icônes
- **Monaco Editor** — éditeur de code
- **React Query (TanStack)** — fetching + cache
- **Zustand** — state management

### Infrastructure
- **Docker** + **Docker Compose**
- **Nginx** — reverse proxy
- **MinIO** — stockage fichiers PDF (compatible S3)

---

## 🔐 VARIABLES D'ENVIRONNEMENT

S'il n'existe pas déja Crée un fichier `.env` à la racine avec :

```env
# PostgreSQL
POSTGRES_USER=learnlab
POSTGRES_PASSWORD=learnlab_secure_2025
POSTGRES_DB=learnlab_db
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET_KEY=change_this_to_a_very_long_random_secret_key_minimum_32_chars
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# OpenAI
OPENAI_API_KEY=sk-...

# Qdrant
QDRANT_HOST=qdrant
QDRANT_PORT=6333

# Piston (sandbox)
PISTON_URL=http://piston:2000

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=learnlab_minio
MINIO_SECRET_KEY=learnlab_minio_secret
MINIO_BUCKET=rag-documents

# App
ENVIRONMENT=development
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=["http://localhost:3000"]
```

---

## 🐳 DOCKER COMPOSE — SERVICES REQUIS

```yaml
services:
  backend:      # FastAPI — port 8000
  frontend:     # Next.js — port 3000
  postgres:     # PostgreSQL 15 — port 5432
  redis:        # Redis 7 — port 6379
  qdrant:       # Qdrant latest — port 6333/6334
  piston:       # Piston API — port 2000
  minio:        # MinIO — port 9000/9001
  nginx:        # Reverse proxy — port 80
```

Tous les services dans le même network `learnlab_network`.
Volumes persistants pour postgres_data, redis_data, qdrant_data, minio_data.

---

## 📋 CONVENTIONS DE CODE

### Python (Backend + IA)
- **PEP 8** strict
- Type hints partout — pas de `Any` sauf exception justifiée
- Async/await pour toutes les opérations I/O
- Docstrings Google style sur toutes les fonctions publiques
- Gestion d'erreurs avec exceptions custom (jamais `Exception` générique)
- Logging avec `structlog` (JSON en prod, lisible en dev)

### TypeScript (Frontend)
- Strict mode activé
- Interfaces pour tous les types de données (pas de `any`)
- Composants fonctionnels uniquement
- Custom hooks pour la logique réutilisable
- Nommage : PascalCase composants, camelCase fonctions, SCREAMING_SNAKE constantes

### Git
- Commits en anglais, conventional commits format
  ex: `feat(agents): add tutor agent hint generation`
- Une branche par fonctionnalité : `feature/agent-evaluateur`
- Jamais commit direct sur `main`

---

## 🚀 ORDRE D'IMPLÉMENTATION

Respecte cet ordre — chaque étape dépend de la précédente :

### Phase 1 — Infrastructure
- [ ] docker-compose.yml complet avec tous les services
- [ ] Backend FastAPI squelette : structure dossiers, config, health check
- [ ] Modèles SQLAlchemy + migrations Alembic
- [ ] Auth JWT : register, login, refresh token
- [ ] Système invitation codes
- [ ] Tests unitaires auth

### Phase 2 — RAG Pipeline
- [ ] Script indexation documents (upload PDF → chunks → Qdrant)
- [ ] Endpoint upload document (enseignant)
- [ ] Endpoint RAG search (interne, utilisé par agents)
- [ ] Création automatique collection Qdrant à l'inscription enseignant
- [ ] Tests pipeline RAG

### Phase 3 — Agents LangGraph
- [ ] AgentState dataclass
- [ ] Agent Tuteur (génération TP + hints)
- [ ] Agent Évaluateur (scoring + classification erreurs)
- [ ] Agent Explicateur (réponses questions)
- [ ] Agent Analyste (profil + rapport)
- [ ] Orchestrateur LangGraph (routing conditionnel)
- [ ] Tests agents avec mock LLM

### Phase 4 — API Complète
- [ ] Endpoints étudiants (TPs, sessions, soumissions)
- [ ] Endpoints enseignants (topics, étudiants, rapports)
- [ ] WebSocket chat temps réel
- [ ] Intégration Piston sandbox
- [ ] Background tasks APScheduler
- [ ] Tests intégration API

### Phase 5 — Frontend
- [ ] Setup Next.js + Tailwind + shadcn
- [ ] Pages auth (login, register multi-step)
- [ ] Dashboard étudiant
- [ ] Page sélection TP + génération
- [ ] Session TP (éditeur + chat + résultat)
- [ ] Dashboard enseignant
- [ ] Gestion étudiants + documents RAG

### Phase 6 — Finalisation
- [ ] Tests E2E
- [ ] Documentation API (auto-générée FastAPI)
- [ ] README complet
- [ ] Optimisations performances
- [ ] Démo préparation

---

## ⚠️ RÈGLES IMPORTANTES

1. **Ne jamais hardcoder** de clés API, passwords, ou secrets dans le code
2. **Multi-tenancy** : vérifier le `teacher_id` dans CHAQUE endpoint qui touche des données
3. **Sandbox** : toujours timeout 50s max sur Piston, jamais d'exécution directe sur le serveur
4. **RAG** : toujours filtrer par `collection = teacher_{id}` — jamais de search global
5. **Agents** : le prompt système Tuteur doit explicitement interdire de donner la solution directe
6. **Mémoire LLM** : utiliser ConversationSummaryBufferMemory — max 10 messages directs, le reste résumé
7. **Async** : tous les appels OpenAI et Qdrant sont async — ne jamais bloquer l'event loop
8. **Tests** : chaque fonction de agent doit avoir un test avec mock LLM (pas de vrais appels API en test)

---

## 📁 STRUCTURE DÉTAILLÉE BACKEND

```
backend/
├── app/
│   ├── main.py              # FastAPI app, middleware, routers
│   ├── config.py            # Settings depuis .env (pydantic-settings)
│   ├── database.py          # SQLAlchemy async engine + session
│   ├── dependencies.py      # FastAPI Dependencies (get_current_user, etc.)
│   │
│   ├── models/              # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── enrollment.py
│   │   ├── topic.py
│   │   ├── tp.py
│   │   ├── submission.py
│   │   └── report.py
│   │
│   ├── schemas/             # Pydantic schemas (request/response)
│   │   ├── auth.py
│   │   ├── student.py
│   │   ├── teacher.py
│   │   └── tp.py
│   │
│   ├── routers/             # Endpoints FastAPI
│   │   ├── auth.py          # /auth/login, /auth/register, /auth/refresh
│   │   ├── student.py       # /student/tps, /student/submit, etc.
│   │   ├── teacher.py       # /teacher/topics, /teacher/students, etc.
│   │   ├── rag.py           # /rag/upload, /rag/search (interne)
│   │   └── websocket.py     # /ws/chat/{session_id}
│   │
│   ├── services/            # Logique métier
│   │   ├── auth_service.py
│   │   ├── tp_service.py
│   │   ├── submission_service.py
│   │   └── report_service.py
│   │
│   └── utils/
│       ├── security.py      # JWT, password hashing
│       └── exceptions.py    # Custom exceptions
│
├── ai_engine/
│   ├── state.py             # AgentState dataclass
│   ├── graph.py             # LangGraph orchestrateur
│   ├── agents/
│   │   ├── tutor.py
│   │   ├── evaluator.py
│   │   ├── explainer.py
│   │   └── analyst.py
│   └── prompts/
│       ├── tutor_prompts.py
│       ├── evaluator_prompts.py
│       └── explainer_prompts.py
│
├── rag_pipeline/
│   ├── indexer.py           # Upload + chunking + embedding + Qdrant upsert
│   ├── retriever.py         # Search Qdrant avec filtres
│   └── embeddings.py        # Wrapper OpenAI embeddings
│
├── alembic/                 # Migrations DB
├── tests/
├── Dockerfile
└── requirements.txt
```

---

## 🔑 COMMANDES UTILES

```bash
# Démarrer tout l'environnement
docker compose up -d

# Voir les logs d'un service
docker compose logs -f backend

# Appliquer les migrations
docker compose exec backend alembic upgrade head

# Créer une nouvelle migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Accéder à PostgreSQL
docker compose exec postgres psql -U learnlab -d learnlab_db

# Accéder à Redis
docker compose exec redis redis-cli

# Lancer les tests
docker compose exec backend pytest tests/ -v

# Indexer des documents RAG (script manuel)
docker compose exec backend python rag_pipeline/indexer.py --file docs/cours.pdf --teacher-id xxx

# Qdrant dashboard
# http://localhost:6333/dashboard

# MinIO console
# http://localhost:9001 (learnlab_minio / learnlab_minio_secret)
```

---

## 📌 CONTEXTE ACADÉMIQUE

- **Encadrante** : Prof. (à confirmer avec Salahddine)
- **École** : FST Mohammedia, Maroc
- **Durée** : 2 mois, mais avec une productivité vraiment élevé on souhaite términer vraiment très très tot
- **Livrables** : application fonctionnelle + code documenté + rapport + présentation + démo
- **Stack imposée** : aucune — liberté totale sur les choix techniques
- **Langue du code** : anglais (variables, fonctions, commentaires)
- **Langue de l'UI** : français
- **Langue des rapports/docs** : français

---

## 🤝 COMMENT TRAVAILLER AVEC SALAHDDINE

- Il est en 4ème année Data Science — niveau technique solide sur Python, ML, R
- Il comprend bien l'architecture mais a besoin de guidance sur les détails d'implémentation
- Il préfère les explications étape par étape avec le raisonnement explicite
- Quand tu fais un choix technique, explique POURQUOI brièvement
- Si tu vois une meilleure approche que ce qui est décrit ici, propose-la avec les avantages/inconvénients
- Ce projet est son PFA — la qualité du code compte pour sa note

---

*Dernière mise à jour : début du projet*
*Ce fichier est la référence — en cas de doute, reviens ici, si tu ne trouve pas la réponse poser la à Salahddine, on compte sur vous chef*
