"""
Seed script — creates minimal test data for end-to-end demo.
Idempotent: safe to re-run, uses get-or-create logic.

Usage:
    docker compose exec backend python scripts/seed.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models.user import User
from app.models.invitation import InvitationCode
from app.models.enrollment import StudentEnrollment
from app.models.topic import Topic
from app.models.student_profile import StudentProfile


# ── DB setup ──────────────────────────────────────────────────────────────────

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ── Helpers ───────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


async def get_or_create_user(db: AsyncSession, email: str, defaults: dict) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        print(f"  [skip] User {email} already exists (id={user.id})")
        return user
    user = User(id=uuid.uuid4(), email=email, **defaults)
    db.add(user)
    await db.flush()
    print(f"  [+] Created user {email} (id={user.id})")
    return user


async def ensure_student_profile(db: AsyncSession, student_id: uuid.UUID) -> None:
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    if not result.scalar_one_or_none():
        profile = StudentProfile(student_id=student_id, niveau=2)
        db.add(profile)
        print(f"  [+] Created profile for student {student_id}")


async def get_or_create_invitation(db: AsyncSession, teacher_id: uuid.UUID) -> str:
    result = await db.execute(
        select(InvitationCode).where(
            InvitationCode.teacher_id == teacher_id,
            InvitationCode.is_active == True,
        )
    )
    code = result.scalar_one_or_none()
    if code:
        print(f"  [skip] Invitation code {code.code} already exists")
        return code.code
    code_str = "DEMO-2026-LEARNLAB"
    code = InvitationCode(
        code=code_str,
        teacher_id=teacher_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=365),
        max_uses=100,
    )
    db.add(code)
    await db.flush()
    print(f"  [+] Created invitation code: {code_str}")
    return code_str


async def get_or_create_enrollment(
    db: AsyncSession, student_id: uuid.UUID, teacher_id: uuid.UUID, code: str
) -> None:
    result = await db.execute(
        select(StudentEnrollment).where(
            StudentEnrollment.student_id == student_id,
            StudentEnrollment.teacher_id == teacher_id,
        )
    )
    if result.scalar_one_or_none():
        print(f"  [skip] Enrollment already exists")
        return
    enrollment = StudentEnrollment(
        student_id=student_id,
        teacher_id=teacher_id,
        joined_via_code=code,
    )
    db.add(enrollment)
    await db.flush()
    print(f"  [+] Created enrollment")


async def get_or_create_topic(
    db: AsyncSession, teacher_id: uuid.UUID, title: str, defaults: dict
) -> Topic:
    result = await db.execute(
        select(Topic).where(Topic.teacher_id == teacher_id, Topic.title == title)
    )
    topic = result.scalar_one_or_none()
    if topic:
        print(f"  [skip] Topic '{title}' already exists (id={topic.id})")
        return topic
    topic = Topic(id=uuid.uuid4(), teacher_id=teacher_id, title=title, **defaults)
    db.add(topic)
    await db.flush()
    print(f"  [+] Created topic '{title}' (id={topic.id})")
    return topic


# ── Main ──────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("\n=== LearnLab AI — Seed Script ===\n")

    async with AsyncSessionLocal() as db:
        # 1. Teacher
        print("--- Teacher ---")
        teacher = await get_or_create_user(db, "prof@test.ma", {
            "password_hash": hash_password("test1234"),
            "role": "teacher",
            "first_name": "Mohammed",
            "last_name": "Settar",
            "formation": "FST Mohammedia",
            "filiere": "Informatique",
        })

        # 2. Invitation code
        print("--- Invitation Code ---")
        inv_code = await get_or_create_invitation(db, teacher.id)

        # 3. Student
        print("--- Student ---")
        student = await get_or_create_user(db, "etudiant@test.ma", {
            "password_hash": hash_password("test1234"),
            "role": "student",
            "first_name": "Salahddine",
            "last_name": "Jabour",
            "formation": "Data Science & Genie Informatique",
            "filiere": "IDSI",
            "year_of_study": 4,
        })
        await ensure_student_profile(db, student.id)

        # 4. Enrollment
        print("--- Enrollment ---")
        await get_or_create_enrollment(db, student.id, teacher.id, inv_code)

        # 5. Topics
        print("--- Topics ---")
        topic_defs = [
            {
                "title": "Tri et Recherche",
                "defaults": {
                    "description": "Implémenter des algorithmes de tri classiques en Python",
                    "domaine": "Algorithmique",
                    "niveau_min": 2,
                    "tags": ["Python", "Complexite", "Recursivite"],
                    "is_active": True,
                },
            },
            {
                "title": "Programmation Orientee Objet",
                "defaults": {
                    "description": "Concepts fondamentaux de la POO en Python",
                    "domaine": "Python",
                    "niveau_min": 2,
                    "tags": ["Python", "OOP", "Classes"],
                    "is_active": True,
                },
            },
            {
                "title": "Introduction au Machine Learning",
                "defaults": {
                    "description": "Premiers algorithmes de Machine Learning supervisé",
                    "domaine": "Data Science",
                    "niveau_min": 3,
                    "tags": ["Python", "sklearn", "KNN", "SVM"],
                    "is_active": True,
                },
            },
        ]
        for t in topic_defs:
            await get_or_create_topic(db, teacher.id, t["title"], t["defaults"])

        await db.commit()

    print("\n=== Seed terminé avec succès ! ===")
    print(f"\nComptes de démonstration :")
    print(f"  Enseignant : prof@test.ma / test1234")
    print(f"  Etudiant   : etudiant@test.ma / test1234")
    print(f"  Code d'invitation : {inv_code}\n")


if __name__ == "__main__":
    asyncio.run(main())
