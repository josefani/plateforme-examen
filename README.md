# Plateforme Examen

MVP full-stack d’examens en ligne avec :

- Frontend : React, TypeScript, Vite, TailwindCSS, daisyUI, lucide-react, react-hot-toast
- Backend : Flask, SQLAlchemy, Flask-Migrate, JWT
- Base de donnees : PostgreSQL 18 Alpine
- Conteneurisation : Docker Compose

## Fonctionnalites MVP

- Authentification securisee avec access token + refresh token
- Roles `admin` et `student`
- Gestion admin des etudiants, groupes, questions, examens, affectations
- Correction automatique des `single_choice`, `multiple_choice`, `true_false`
- Correction manuelle des `short_text`
- Session etudiante avec chrono, autosave, heartbeat et journalisation d’evenements suspects
- Publication manuelle ou automatique des resultats selon le type d’examen
- Seed de demonstration inclus

## Demarrage rapide

1. Copier les variables d’environnement :

```bash
cp .env.example .env
```

2. Construire et lancer les services :

```bash
docker compose up --build
```

3. Ouvrir :

- Frontend : `http://localhost:4173`
- Backend : `http://localhost:5000`
- Healthcheck : `http://localhost:5000/health`

Le backend applique automatiquement les migrations puis execute le seed de demonstration au demarrage.

## Comptes de demonstration

- Admin
  - email : `admin@exam.local`
  - mot de passe : `Admin1234!`
- Etudiants
  - `alice@student.local` / `Student123!`
  - `bob@student.local` / `Student123!`
  - `clara@student.local` / `Student123!`

## Variables d’environnement

Le fichier `.env.example` couvre les variables principales :

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_PORT`
- `DATABASE_URL`
- `SECRET_KEY`
- `JWT_SECRET_KEY`
- `ACCESS_EXPIRES_MINUTES`
- `REFRESH_EXPIRES_DAYS`
- `HEARTBEAT_GRACE_SECONDS`
- `LOGIN_RATE_LIMIT`
- `BACKEND_PORT`
- `FRONTEND_PORT`
- `CORS_ORIGINS`
- `VITE_API_URL`

## Commandes utiles

### Docker

```bash
docker compose up --build
docker compose down
docker compose logs -f backend
docker compose logs -f frontend
docker compose exec postgres psql -U exam_user -d exam_db
```

### Backend

```bash
docker compose run --rm backend flask db upgrade
docker compose run --rm backend flask seed-demo
docker compose run --rm backend flask db migrate -m "message"
```

### Frontend

```bash
docker compose build frontend
docker compose up frontend
```

## Developpement local hors Docker

Si vous avez les outils locaux installes :

### Backend

```bash
cd backend
.venv/bin/pip install -r requirements.txt
FLASK_APP=manage.py .venv/bin/python -m flask db upgrade
FLASK_APP=manage.py .venv/bin/python -m flask seed-demo
.venv/bin/python manage.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Structure du projet

```text
.
├── backend
│   ├── app
│   │   ├── api
│   │   │   ├── admin
│   │   │   ├── auth
│   │   │   └── student
│   │   ├── models
│   │   ├── schemas
│   │   ├── services
│   │   └── utils
│   ├── migrations
│   ├── Dockerfile
│   ├── manage.py
│   └── requirements.txt
├── frontend
│   ├── src
│   │   ├── app
│   │   ├── components
│   │   ├── lib
│   │   ├── pages
│   │   ├── router
│   │   ├── store
│   │   └── types
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── .env.example
```

## API principales

### Auth

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

### Admin

- `GET/POST/PATCH/DELETE /api/admin/students`
- `GET/POST/PUT/DELETE /api/admin/groups`
- `GET/POST/PUT /api/admin/questions`
- `GET/POST/PUT /api/admin/exams`
- `POST /api/admin/exams/:id/assignments`
- `GET /api/admin/grading/pending`
- `POST /api/admin/answers/:id/grade`
- `GET /api/admin/results`
- `POST /api/admin/results/publish`

### Student

- `GET /api/student/exams`
- `GET /api/student/exams/:id`
- `POST /api/student/exams/:id/start`
- `GET /api/student/attempts/:id`
- `PUT /api/student/attempts/:id/save`
- `POST /api/student/attempts/:id/heartbeat`
- `POST /api/student/attempts/:id/events`
- `POST /api/student/attempts/:id/submit`
- `GET /api/student/results`

## Seed inclus

Le seed cree :

- 1 admin
- 3 etudiants
- 1 groupe
- 4 questions de demonstration
- 1 examen publie affecte au groupe

## Verification effectuee

- Build frontend valide via Docker
- Build backend valide via Docker
- Migration initiale generee et appliquee sur PostgreSQL 18
- Seed de demonstration execute avec succes
- Verification SQL des volumes seedes :
  - `users = 4`
  - `groups = 1`
  - `questions = 4`
  - `exams = 1`
