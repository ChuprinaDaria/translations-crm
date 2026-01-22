"""
CRUD operations for languages, specializations, and translator language rates.
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from modules.crm.models import Language, Specialization, TranslatorLanguageRate
from modules.crm.schemas import (
    LanguageCreate, LanguageUpdate,
    SpecializationCreate,
    TranslatorLanguageRateCreate, TranslatorLanguageRateUpdate
)


# ============ LANGUAGES ============

def get_languages(db: Session, skip: int = 0, limit: int = 100, active_only: bool = True) -> List[Language]:
    """Отримати список мов"""
    query = db.query(Language)
    if active_only:
        query = query.filter(Language.is_active == True)
    return query.order_by(Language.name_pl).offset(skip).limit(limit).all()


def get_language_by_id(db: Session, language_id: int) -> Optional[Language]:
    """Отримати мову за ID"""
    return db.query(Language).filter(Language.id == language_id).first()


def create_language(db: Session, language: LanguageCreate) -> Language:
    """Створити нову мову"""
    db_language = Language(**language.model_dump())
    db.add(db_language)
    db.commit()
    db.refresh(db_language)
    return db_language


def update_language(db: Session, language_id: int, language_update: LanguageUpdate) -> Optional[Language]:
    """Оновити мову"""
    db_language = get_language_by_id(db, language_id)
    if not db_language:
        return None
    
    update_data = language_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_language, key, value)
    
    db.commit()
    db.refresh(db_language)
    return db_language


def delete_language(db: Session, language_id: int) -> bool:
    """Видалити мову"""
    db_language = get_language_by_id(db, language_id)
    if not db_language:
        return False
    db.delete(db_language)
    db.commit()
    return True


# ============ SPECIALIZATIONS ============

def get_specializations(db: Session) -> List[Specialization]:
    """Отримати список спеціалізацій"""
    return db.query(Specialization).order_by(Specialization.name).all()


def get_specialization_by_id(db: Session, specialization_id: int) -> Optional[Specialization]:
    """Отримати спеціалізацію за ID"""
    return db.query(Specialization).filter(Specialization.id == specialization_id).first()


def create_specialization(db: Session, spec: SpecializationCreate) -> Specialization:
    """Створити кастомну спеціалізацію"""
    db_spec = Specialization(**spec.model_dump(), is_custom=True)
    db.add(db_spec)
    db.commit()
    db.refresh(db_spec)
    return db_spec


# ============ TRANSLATOR LANGUAGE RATES ============

def get_translator_rates(db: Session, translator_id: int) -> List[TranslatorLanguageRate]:
    """Отримати мови та ставки перекладача"""
    return db.query(TranslatorLanguageRate).filter(
        TranslatorLanguageRate.translator_id == translator_id
    ).order_by(TranslatorLanguageRate.created_at.desc()).all()


def get_translator_rate_by_id(db: Session, rate_id: int) -> Optional[TranslatorLanguageRate]:
    """Отримати ставку за ID"""
    return db.query(TranslatorLanguageRate).filter(TranslatorLanguageRate.id == rate_id).first()


def create_translator_rate(db: Session, rate: TranslatorLanguageRateCreate) -> TranslatorLanguageRate:
    """Додати мову/ставку перекладачу"""
    db_rate = TranslatorLanguageRate(**rate.model_dump())
    db.add(db_rate)
    db.commit()
    db.refresh(db_rate)
    return db_rate


def update_translator_rate(db: Session, rate_id: int, rate_update: TranslatorLanguageRateUpdate) -> Optional[TranslatorLanguageRate]:
    """Оновити ставку перекладача"""
    db_rate = get_translator_rate_by_id(db, rate_id)
    if not db_rate:
        return None
    
    update_data = rate_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_rate, key, value)
    
    db.commit()
    db.refresh(db_rate)
    return db_rate


def delete_translator_rate(db: Session, rate_id: int) -> bool:
    """Видалити мову перекладача"""
    db_rate = get_translator_rate_by_id(db, rate_id)
    if not db_rate:
        return False
    db.delete(db_rate)
    db.commit()
    return True

