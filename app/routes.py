from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from db import SessionLocal
from datetime import datetime, timedelta
from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader

import crud, schema, crud_user
import jwt, os
# import schema
import pyotp

router = APIRouter()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

bearer_scheme = HTTPBearer()

def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)
):
    token = creds.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload  # { "sub": "id", "email": "...", "exp": ... }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    

@router.get("/items", response_model=list[schema.Item])
def read_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.get_items(db, skip=skip, limit=limit)


@router.get("/items/{item_id}", response_model=schema.Item)
def read_item(item_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    item = crud.get_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.post("/items", response_model=schema.Item)
def create_item(item: schema.ItemCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.create_item(db, item)


@router.put("/items/{item_id}", response_model=schema.Item)
def update_item(item_id: int, item: schema.ItemUpdate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    updated = crud.update_item(db, item_id, item)
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated


@router.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    deleted = crud.delete_item(db, item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"status": "success"}

@router.delete('/kp/{kp_id}')
def delete_kp(kp_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    deleted = crud.delete_kp(db, kp_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="KP not found")

    return {"status": "success"}


@router.get("/kp/{kp_id}/pdf")
def generate_kp_pdf(kp_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    kp = crud.get_kp(db, kp_id)
    if not kp:
        raise HTTPException(404, "KP not found")


    # # Get KPItems and join with Item data
    kp_items = crud.get_kp_items(db, kp_id)

    # print(f"KP Items: {kp_items[0].id}")

    # Prepare items data with actual Item information
    items_data = []
    total_quantity = 0
    total_weight = 0

    for kp_item in kp_items.items:
        item = crud.get_item(db, kp_item.id)

        item_weight = (item.weight or 0) * kp_item.quantity

        total_weight += item_weight

        print(item)

        if item:
            items_data.append({
                'name': item.name,
                'price': item.price or 0,
                'quantity': kp_item.quantity,
                'total': (item.price or 0) * kp_item.quantity,
                'description': item.description,
                'unit': item.unit,
                'weight': item.weight,
                'total_weight': item_weight,
            })
            total_quantity += kp_item.quantity

    print(items_data)

    # Render template with data
    env = Environment(loader=FileSystemLoader("app/uploads"))
    template = env.get_template("commercial-offer.html")
    
    html_content = template.render(
        kp=kp,
        items=items_data,
        total_price=sum(item['total'] for item in items_data),
        total_weight = item_weight,
        total_items=len(items_data),
    )
    
    pdf = HTML(string=html_content).write_pdf(zoom=1)
    
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={'Content-Disposition': f'attachment; filename="{kp.title}.pdf"'}
    )


@router.post("/kp", response_model=schema.KP)
def create_kp(kp_in: schema.KPCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    try:
        kp = crud.create_kp(db, kp_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return kp

@router.get("/kp", response_model=list[schema.KP])
def list_kp(db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.get_all_kps(db)


# Categories
@router.get("/categories", response_model=list[schema.Category])
def get_categories(db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.get_categories(db)

@router.post("/categories", response_model=schema.Category)
def create_category(category: schema.CategoryCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.create_category(db, category.name)

@router.delete('/categories/{category_id}')
def delete_category(category_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    deleted = crud.delete_category(db, category_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"status": "success"}

# Subcategories
@router.get("/subcategories", response_model=list[schema.Subcategory])
def get_subcategories(category_id: int = None, db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.get_subcategories(db, category_id)

@router.post("/subcategories", response_model=schema.Subcategory)
def create_subcategory(subcategory: schema.SubcategoryCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.create_subcategory(db, subcategory.name, subcategory.category_id)


@router.post("/auth/register", response_model=schema.UserOut)
def register(user_in: schema.UserCreate, db: Session = Depends(get_db)):
    existing = crud_user.get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    user = crud_user.create_user(db, user_in.email, user_in.role, user_in.password)

    return {"id": user.id, 
            "email": user.email, 
            "is_active": user.is_active, 
            "is_admin": user.is_admin, 
            "created_at": user.created_at, 
            "otpauth_url": None,
            "role": user.role
            }

@router.post("/auth/login")
def login(payload: schema.LoginRequest, db: Session = Depends(get_db)):
    user = crud_user.get_user_by_email(db, payload.email)
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not crud_user.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    crud_user.update_last_login(db, user)
    to_encode = {"sub": str(user.id), "email": user.email, "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)}
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}

