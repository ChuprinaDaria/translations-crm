# test.py

import random
from faker import Faker
from sqlalchemy.orm import Session

from db import SessionLocal
import crud
import schema

fake = Faker()

# Predefined categories
CATEGORIES = [
    "salads",
    "hot_dishes",
    "desserts",
    "drinks",
    "service",
    "rent",
    "logistics",
]

def seed_categories(db: Session):
    print("Seeding categories...")
    categories = []
    for name in CATEGORIES:
        category = crud.create_category(db, name)
        categories.append(category)
    return categories

def seed_subcategories(db: Session, categories):
    print("Seeding subcategories...")
    subcategories = []
    for category in categories:
        for _ in range(random.randint(1, 3)):
            name = fake.word().capitalize()
            subcat = crud.create_subcategory(db, name, category.id)
            subcategories.append(subcat)
    return subcategories

def generate_random_item(subcategories):
    return schema.ItemUpdate(
        name=fake.word().capitalize(),
        subcategory_id=random.choice(subcategories).id if subcategories else None,
        description=fake.sentence(nb_words=6),
        price=round(random.uniform(5, 100), 2),
        weight=round(random.uniform(100, 1200), 1),
        unit="g",
        photo_url=fake.image_url(),
        active=True
    )

def seed_items(db: Session, subcategories, amount: int = 20):
    print(f"Seeding {amount} items...")
    for _ in range(amount):
        item_data = generate_random_item(subcategories)
        crud.create_item(db, item_data)

def seed_users(db: Session, amount: int = 5):
    print(f"Seeding {amount} users...")
    users = []
    for _ in range(amount):
        email = fake.email()
        password = "test123"  # plain test password
        user_create = schema.UserCreate(email=email, password=password)
        # You can create a simple CRUD function for users if needed
        # db_user = crud.create_user(db, user_create)
        users.append({"email": email, "password": password})
    return users

if __name__ == "__main__":
    db: Session = SessionLocal()

    categories = seed_categories(db)
    subcategories = seed_subcategories(db, categories)
    seed_items(db, subcategories, amount=30)
    # users = seed_users(db, amount=5)

    db.close()
    print("Seeding completed!")