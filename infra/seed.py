"""Reproducible, idempotent demo data (fixed random seed, deterministic ids).

  python infra/seed.py             # write to DynamoDB
  python infra/seed.py --dry-run   # only print counts

200 students, 40 companies, 30 teachers, 2 responsables, 1 admin, 120 offers,
100 archived subjects, 2 institutions with templates and settings.
All demo accounts share the password below (one PBKDF2 hash reused: demo data only).
"""
import argparse
import pathlib
import random
import sys
import uuid

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "lambdas"))

import config as C  # noqa: E402
from common.auth import hash_password  # noqa: E402
from common.validate import normalize  # noqa: E402

PASSWORD = "Test1234!"
NS = uuid.UUID("6f1c2f4e-0c1d-4a53-9a70-3f4f3c1b2a11")
CREATED = "2026-09-01T00:00:00Z"

ETABS = {"ETAB1": "Institut A", "ETAB2": "Institut B"}
DEPARTMENTS = ["INFO", "TELECOM"]
SPECIALTIES = ["Génie logiciel", "Réseaux", "Data science", "Systèmes embarqués"]
GOUVERNORATS = ["Tunis", "Sousse", "Sfax", "Monastir", "Nabeul", "Gabès", "Gafsa", "Bizerte"]
SKILLS = ["python", "java", "aws", "docker", "react", "sql", "spring", "linux", "kubernetes",
          "django", "typescript", "git", "mongodb", "c++", "iot", "networking", "tensorflow",
          "pandas", "node", "angular"]
DOMAINS = ["Application web", "Pipeline de données", "Plateforme cloud", "Système embarqué",
           "Outil de supervision réseau", "Application mobile", "Moteur de recommandation",
           "Chatbot"]
SECTORS = ["de santé", "bancaire", "e-commerce", "logistique", "éducation", "agricole",
           "touristique", "industriel"]
TEMPLATE = ("CONVENTION DE STAGE\n\nEntre {{etab}}, l'étudiant {{student}} et l'entreprise "
            "{{company}}, pour le sujet « {{subject}} », du {{startDate}} au {{endDate}} "
            "({{durationWeeks}} semaines).")


def uid(kind, i):
    return str(uuid.uuid5(NS, f"{kind}-{i}"))


def build(password_hash):
    rng = random.Random(42)
    etab_ids = list(ETABS)
    items = {name: [] for name in C.TABLES}
    accounts = {}

    def user(kind, i, role, **extra):
        email = f"{kind}{i}@pfe.test"
        item = {"userId": uid(kind, i), "email": email, "passwordHash": password_hash,
                "role": role, "createdAt": CREATED, **extra}
        items["Users"].append(item)
        items["Reference"].append({"type": "EMAIL", "id": email, "userId": item["userId"]})
        accounts.setdefault(role, email)
        return item

    user("admin", 1, "ADM", firstName="Admin", lastName="Demo")
    for n, etab in enumerate(etab_ids, 1):
        user("resp", n, "RESP", etab=etab, firstName="Responsable", lastName=f"{n}")
    for i in range(1, 31):
        user("ens", i, "ENS", etab=etab_ids[i % 2], firstName="Enseignant", lastName=f"{i}",
             expertise=set(rng.sample(SKILLS, 3)))
    companies = [user("ent", i, "ENT", companyName=f"Entreprise {i}", lastName=f"{i}")
                 for i in range(1, 41)]
    for i in range(1, 201):
        etab = etab_ids[i % 2]
        user("etu", i, "ETU", etab=etab, firstName="Etudiant", lastName=f"{i}",
             department=rng.choice(DEPARTMENTS), specialty=rng.choice(SPECIALTIES),
             skills={normalize(s) for s in rng.sample(SKILLS, rng.randint(3, 5))},
             gouvernorat=rng.choice(GOUVERNORATS), activeCount=0, sansStageEtab=etab)

    for n in range(120):
        company = companies[n % 40]
        gouv = rng.choice(GOUVERNORATS)
        created = f"2026-09-{rng.randint(1, 28):02d}T{rng.randint(8, 18):02d}:00:00Z"
        skills = rng.sample(SKILLS, rng.randint(3, 5))
        items["Offers"].append({
            "offerId": uid("offer", n), "companyId": company["userId"],
            "title": f"{rng.choice(DOMAINS)} {rng.choice(SECTORS)}",
            "description": f"Stage de fin d'études autour de {', '.join(skills)}.",
            "keywords": set(skills[:3]), "skills": set(skills), "gouvernorat": gouv,
            "durationWeeks": rng.choice([12, 16, 20]), "status": "OPEN",
            "gouvernoratCreatedAt": f"{gouv}#{created}",
            "similar": [], "createdAt": created})

    for year in range(2021, 2026):
        for n in range(20):
            title = f"{rng.choice(DOMAINS)} {rng.choice(SECTORS)}"
            tokens = {normalize(w) for w in title.split()} | {rng.choice(SKILLS)}
            items["SubjectsArchive"].append({
                "year": year, "subjectId": uid("subject", f"{year}-{n}"),
                "title": title, "tokens": tokens, "keywords": tokens})

    for etab, name in ETABS.items():
        items["Reference"] += [
            {"type": "ETAB", "id": etab, "name": name},
            {"type": "CONV_TEMPLATE", "id": f"{etab}#v1", "text": TEMPLATE,
             "createdAt": CREATED},
            {"type": "SETTINGS", "id": etab, "deadline": "2027-02-15",
             "deadlineEnabled": True, "templateVersion": 1},
        ]
        for dept in DEPARTMENTS:
            items["Reference"].append(
                {"type": "DEPARTMENT", "id": f"{etab}#{dept}", "name": dept})
    for dept in DEPARTMENTS:
        for spec in SPECIALTIES:
            items["Reference"].append(
                {"type": "SPECIALTY", "id": f"{dept}#{normalize(spec).replace(' ', '-')}",
                 "name": spec})
    return items, accounts


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    items, accounts = build(hash_password(PASSWORD))
    for table_name, rows in items.items():
        if rows:
            print(f"{table_name:16} {len(rows)}")
    if not args.dry_run:
        import boto3
        ddb = boto3.resource("dynamodb", region_name=C.REGION)
        for table_name, rows in items.items():
            if rows:
                with ddb.Table(C.table_name(table_name)).batch_writer() as batch:
                    for row in rows:
                        batch.put_item(Item=row)
        print("Seeded.")
    print(f"\nTest accounts (password: {PASSWORD})")
    for role, email in accounts.items():
        print(f"  {role:5} {email}")
