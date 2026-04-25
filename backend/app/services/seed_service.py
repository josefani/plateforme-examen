from __future__ import annotations

from datetime import timedelta

from flask import Flask

from app.extensions import db
from app.models.enums import AssignmentTargetType, ExamMode, ExamStatus, QuestionType, UserRole
from app.models.exam import Exam, ExamAssignment, ExamQuestion, Question, QuestionChoice
from app.models.group import Group, GroupMember
from app.models.user import User
from app.utils.security import hash_password
from app.utils.time import utcnow


FORMATIONS = {
    "DevOps": {
        "description": "Formation intensive DevOps - durée 3 mois",
        "tags": ["devops"],
        "questions": [
            ("Pipeline CI/CD", "Quel outil orchestre généralement les étapes de build, test et déploiement ?", ["GitLab CI", "CSS", "SMTP"], 0),
            ("Conteneurisation", "Docker permet principalement d'isoler une application dans un conteneur reproductible.", None, True),
            ("Infrastructure as Code", "Citez deux avantages de l'Infrastructure as Code dans une équipe DevOps.", None, None),
            ("Supervision", "Sélectionnez les pratiques utiles pour surveiller une plateforme.", ["Collecter des métriques", "Ignorer les logs", "Créer des alertes", "Supprimer les sauvegardes"], [0, 2]),
            ("Déploiement", "Quelle stratégie réduit le risque lors d'une mise en production ?", ["Blue/Green", "Copier en FTP sans test", "Modifier directement la production"], 0),
        ],
    },
    "Cybersécurité": {
        "description": "Formation intensive cybersécurité - durée 3 mois",
        "tags": ["cybersecurite"],
        "questions": [
            ("Authentification", "Le hachage d'un mot de passe est préférable au stockage en clair.", None, True),
            ("Contrôle d'accès", "Pourquoi faut-il vérifier les rôles côté serveur et pas seulement côté navigateur ?", None, None),
            ("Vulnérabilités web", "Sélectionnez des protections contre les attaques web courantes.", ["Validation des entrées", "CSP", "Mots de passe en clair", "Requêtes préparées"], [0, 1, 3]),
            ("Journalisation", "Quel élément aide à enquêter après un incident ?", ["Journaux d'audit", "Désactivation des traces", "Partage du compte admin"], 0),
            ("Réseau", "Un pare-feu peut filtrer le trafic selon des règles définies.", None, True),
        ],
    },
    "Administration Réseau": {
        "description": "Formation intensive administration réseau - durée 3 mois",
        "tags": ["reseau"],
        "questions": [
            ("Adressage IP", "Quel protocole attribue automatiquement des adresses IP aux postes clients ?", ["DHCP", "HTML", "SMTP"], 0),
            ("DNS", "Le DNS traduit des noms de domaine en adresses IP.", None, True),
            ("Segmentation", "Expliquez l'intérêt d'utiliser des VLAN dans un réseau d'entreprise.", None, None),
            ("Sécurité réseau", "Sélectionnez des mesures utiles pour protéger un réseau.", ["Segmentation", "ACL", "Mots de passe partagés publiquement", "Mises à jour"], [0, 1, 3]),
            ("Routage", "Quel équipement relie plusieurs réseaux IP ?", ["Routeur", "Clavier", "Écran"], 0),
        ],
    },
}


def _make_question(title, statement, choices, correct, tags, order):
    if choices is None and isinstance(correct, bool):
        return Question(
            type=QuestionType.TRUE_FALSE,
            title=title,
            statement=statement,
            points=1,
            correct_boolean=correct,
            explanation="Question vrai/faux corrigée automatiquement.",
            tags=tags,
            difficulty="facile",
            is_active=True,
        )
    if choices is None:
        return Question(
            type=QuestionType.SHORT_TEXT,
            title=title,
            statement=statement,
            points=4,
            explanation="Question ouverte corrigée manuellement.",
            tags=tags,
            difficulty="moyen",
            is_active=True,
        )

    is_multiple = isinstance(correct, list)
    question = Question(
        type=QuestionType.MULTIPLE_CHOICE if is_multiple else QuestionType.SINGLE_CHOICE,
        title=title,
        statement=statement,
        points=3 if is_multiple else 2,
        explanation="Question à choix corrigée automatiquement.",
        tags=tags,
        difficulty="moyen",
        is_active=True,
    )
    correct_indexes = set(correct if is_multiple else [correct])
    question.choices.extend(
        [
            QuestionChoice(label=label, sort_order=index + 1, is_correct=index in correct_indexes)
            for index, label in enumerate(choices)
        ]
    )
    return question


def seed_demo_data():
    admin = User.query.filter_by(email="admin@exam.local").first()
    if admin is None:
        admin = User(
            full_name="Administrateur principal",
            email="admin@exam.local",
            password_hash=hash_password("Admin1234!"),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.session.add(admin)

    student_specs = [
        ("Alice Randria", "alice@student.local"),
        ("Bob Rakoto", "bob@student.local"),
        ("Clara Rajaonarison", "clara@student.local"),
    ]
    students = []
    for full_name, email in student_specs:
        student = User.query.filter_by(email=email).first()
        if student is None:
            student = User(
                full_name=full_name,
                email=email,
                password_hash=hash_password("Student123!"),
                role=UserRole.STUDENT,
                is_active=True,
            )
            db.session.add(student)
        students.append(student)
    db.session.flush()

    for formation_index, (formation_name, config) in enumerate(FORMATIONS.items()):
        exam_title = f"Évaluation {formation_name}"
        if Exam.query.filter_by(title=exam_title).first():
            continue

        group_name = f"{formation_name} - Session 3 mois"
        group = Group.query.filter_by(name=group_name).first()
        if group is None:
            group = Group(name=group_name, description=config["description"])
            db.session.add(group)
        else:
            group.description = config["description"]
        db.session.flush()

        for student in students:
            if not any(member.student_id == student.id for member in group.members):
                group.members.append(GroupMember(group=group, student=student))

        questions = []
        for index, question_data in enumerate(config["questions"], start=1):
            question = _make_question(*question_data, tags=config["tags"], order=index)
            questions.append(question)
            db.session.add(question)

        exam = Exam(
            title=exam_title,
            description=f"Évaluation de départ pour la formation {formation_name}.",
            instructions="Lisez chaque question attentivement. Les réponses sont autosauvegardées.",
            duration_minutes=60,
            shuffle_questions=True,
            shuffle_choices=True,
            mode=ExamMode.SCHEDULED,
            available_from=utcnow() - timedelta(days=1),
            available_until=utcnow() + timedelta(days=90 + formation_index),
            auto_publish_results=False,
            status=ExamStatus.PUBLISHED,
        )
        db.session.add(exam)
        db.session.flush()

        for index, question in enumerate(questions, start=1):
            exam.question_items.append(ExamQuestion(exam=exam, question=question, sort_order=index, points=question.points))
        exam.assignments.append(ExamAssignment(exam=exam, target_type=AssignmentTargetType.GROUP, group=group))

    db.session.commit()
    return "Demo data ready."


def register_seed_command(app: Flask):
    @app.cli.command("seed-demo")
    def seed_demo_command():
        message = seed_demo_data()
        print(message)
