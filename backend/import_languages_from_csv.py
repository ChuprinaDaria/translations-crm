#!/usr/bin/env python3
"""
Script to import languages from CSV file into the database.

CSV format expected:
- Column 1: name_pl (Polish name, e.g., "Angielski")
- Column 2: name_en (English name, optional, e.g., "English")
- Column 3: base_client_price (Base price in PLN, e.g., "200.00")

Usage:
    python import_languages_from_csv.py <path_to_csv_file>
    
Example:
    python import_languages_from_csv.py languages.csv
"""
import os
import sys
import csv
from pathlib import Path
from decimal import Decimal

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Set DATABASE_URL if not set
if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql://translator:traslatorini2025@localhost:5434/crm_db"

from core.database import SessionLocal
from modules.crm.crud_languages import create_language, get_languages
from modules.crm.schemas import LanguageCreate

# Імпортуємо всі моделі для реєстрації в Base.metadata (щоб SQLAlchemy знав про всі зв'язки)
import modules.crm.models  # noqa: F401
import modules.communications.models  # noqa: F401

def import_languages_from_csv(csv_path: Path):
    """Import languages from CSV file"""
    print(f"📄 Reading CSV file: {csv_path}")
    
    if not csv_path.exists():
        print(f"❌ File not found: {csv_path}")
        return False
    
    db = SessionLocal()
    created_count = 0
    updated_count = 0
    skipped_count = 0
    errors = []
    
    try:
        # Get existing languages to check for duplicates
        existing_languages = {lang.name_pl.lower(): lang for lang in get_languages(db, skip=0, limit=1000, active_only=False)}
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            # Try to detect delimiter
            sample = f.read(1024)
            f.seek(0)
            delimiter = ',' if sample.count(',') > sample.count(';') else ';'
            
            reader = csv.DictReader(f, delimiter=delimiter)
            
            # Check if we have the expected column names
            if reader.fieldnames:
                # Try to map column names to our expected format
                field_map = {}
                for field in reader.fieldnames:
                    field_lower = field.lower().strip()
                    if 'language' in field_lower or 'nazwa' in field_lower or 'name' in field_lower:
                        field_map['name_pl'] = field
                    elif 'price' in field_lower or 'cena' in field_lower or 'pln' in field_lower:
                        field_map['price'] = field
                    elif 'note' in field_lower or 'uwaga' in field_lower:
                        field_map['notes'] = field
                
                # If we found the columns, use DictReader
                if 'name_pl' in field_map or 'price' in field_map:
                    for row_num, row in enumerate(reader, start=2):
                        if not row or all(not str(v).strip() for v in row.values()):
                            continue
                        
                        try:
                            # Extract data using field mapping
                            name_pl = row.get(field_map.get('name_pl', reader.fieldnames[0]), '').strip()
                            price_str = row.get(field_map.get('price', reader.fieldnames[1] if len(reader.fieldnames) > 1 else ''), '0').strip()
                            notes = row.get(field_map.get('notes', ''), '').strip() if field_map.get('notes') else ''
                            
                            if not name_pl:
                                skipped_count += 1
                                print(f"⚠️  Row {row_num}: Skipping - no language name")
                                continue
                            
                            # Parse price
                            try:
                                price_str = price_str.replace('zł', '').replace('PLN', '').replace(' ', '').replace(',', '.')
                                base_client_price = Decimal(price_str)
                            except (ValueError, AttributeError):
                                print(f"⚠️  Row {row_num}: Invalid price '{price_str}', using 0")
                                base_client_price = Decimal('0')
                            
                            # Check if language already exists
                            if name_pl.lower() in existing_languages:
                                existing_lang = existing_languages[name_pl.lower()]
                                print(f"ℹ️  Row {row_num}: Language '{name_pl}' already exists (ID: {existing_lang.id})")
                                skipped_count += 1
                                continue
                            
                            # Create language
                            language_data = LanguageCreate(
                                name_pl=name_pl,
                                name_en=None,  # CSV doesn't have English name
                                base_client_price=base_client_price
                            )
                            
                            new_language = create_language(db, language_data)
                            existing_languages[name_pl.lower()] = new_language
                            created_count += 1
                            print(f"✅ Row {row_num}: Created '{name_pl}' with price {base_client_price} zł" + (f" (Notes: {notes})" if notes else ""))
                            
                        except Exception as e:
                            error_msg = f"Row {row_num}: {str(e)}"
                            errors.append(error_msg)
                            print(f"❌ {error_msg}")
                    
                    # Print summary and return
                    print("\n" + "="*50)
                    print("📊 Import Summary:")
                    print(f"   ✅ Created: {created_count}")
                    print(f"   ⏭️  Skipped: {skipped_count}")
                    if errors:
                        print(f"   ❌ Errors: {len(errors)}")
                        for error in errors[:10]:
                            print(f"      - {error}")
                    print("="*50)
                    db.close()
                    return True
            
            # If DictReader doesn't work, try reading as list
            if not reader.fieldnames:
                f.seek(0)
                reader = csv.reader(f, delimiter=delimiter)
                # Read header
                header = next(reader, None)
                if not header:
                    print("❌ CSV file is empty")
                    return False
                
                # Try to detect column order
                # Expected: name_pl, name_en (optional), base_client_price
                name_pl_idx = 0
                name_en_idx = 1 if len(header) > 1 else None
                price_idx = 2 if len(header) > 2 else (1 if name_en_idx is None else 2)
                
                for row_num, row in enumerate(reader, start=2):
                    if not row or all(not cell.strip() for cell in row):
                        continue
                    
                    try:
                        # Extract data
                        name_pl = row[name_pl_idx].strip() if len(row) > name_pl_idx else ""
                        name_en = row[name_en_idx].strip() if name_en_idx and len(row) > name_en_idx else ""
                        price_str = row[price_idx].strip() if len(row) > price_idx else "0"
                        
                        if not name_pl:
                            skipped_count += 1
                            print(f"⚠️  Row {row_num}: Skipping - no name_pl")
                            continue
                        
                        # Parse price
                        try:
                            # Remove currency symbols and spaces
                            price_str = price_str.replace('zł', '').replace('PLN', '').replace(' ', '').replace(',', '.')
                            base_client_price = Decimal(price_str)
                        except (ValueError, AttributeError):
                            print(f"⚠️  Row {row_num}: Invalid price '{price_str}', using 0")
                            base_client_price = Decimal('0')
                        
                        # Check if language already exists
                        if name_pl.lower() in existing_languages:
                            existing_lang = existing_languages[name_pl.lower()]
                            print(f"ℹ️  Row {row_num}: Language '{name_pl}' already exists (ID: {existing_lang.id})")
                            skipped_count += 1
                            continue
                        
                        # Create language
                        language_data = LanguageCreate(
                            name_pl=name_pl,
                            name_en=name_en if name_en else None,
                            base_client_price=base_client_price
                        )
                        
                        new_language = create_language(db, language_data)
                        existing_languages[name_pl.lower()] = new_language
                        created_count += 1
                        print(f"✅ Row {row_num}: Created '{name_pl}' with price {base_client_price} zł")
                        
                    except Exception as e:
                        error_msg = f"Row {row_num}: {str(e)}"
                        errors.append(error_msg)
                        print(f"❌ {error_msg}")
            else:
                # Use DictReader if it works
                for row_num, row in enumerate(reader, start=2):
                    try:
                        # Try different column name variations
                        name_pl = (
                            row.get('name_pl') or 
                            row.get('Name PL') or 
                            row.get('Nazwa PL') or 
                            row.get('Język') or
                            row.get('Language') or
                            list(row.values())[0] if row else ""
                        ).strip()
                        
                        name_en = (
                            row.get('name_en') or 
                            row.get('Name EN') or 
                            row.get('Nazwa EN') or
                            row.get('English') or
                            (list(row.values())[1] if len(row) > 1 else "")
                        ).strip() or None
                        
                        price_str = (
                            row.get('base_client_price') or 
                            row.get('Base Price') or 
                            row.get('Cena') or
                            row.get('Price') or
                            (list(row.values())[-1] if row else "0")
                        ).strip()
                        
                        if not name_pl:
                            skipped_count += 1
                            print(f"⚠️  Row {row_num}: Skipping - no name_pl")
                            continue
                        
                        # Parse price
                        try:
                            price_str = price_str.replace('zł', '').replace('PLN', '').replace(' ', '').replace(',', '.')
                            base_client_price = Decimal(price_str)
                        except (ValueError, AttributeError):
                            print(f"⚠️  Row {row_num}: Invalid price '{price_str}', using 0")
                            base_client_price = Decimal('0')
                        
                        # Check if language already exists
                        if name_pl.lower() in existing_languages:
                            existing_lang = existing_languages[name_pl.lower()]
                            print(f"ℹ️  Row {row_num}: Language '{name_pl}' already exists (ID: {existing_lang.id})")
                            skipped_count += 1
                            continue
                        
                        # Create language
                        language_data = LanguageCreate(
                            name_pl=name_pl,
                            name_en=name_en if name_en else None,
                            base_client_price=base_client_price
                        )
                        
                        new_language = create_language(db, language_data)
                        existing_languages[name_pl.lower()] = new_language
                        created_count += 1
                        print(f"✅ Row {row_num}: Created '{name_pl}' with price {base_client_price} zł")
                        
                    except Exception as e:
                        error_msg = f"Row {row_num}: {str(e)}"
                        errors.append(error_msg)
                        print(f"❌ {error_msg}")
        
        print("\n" + "="*50)
        print("📊 Import Summary:")
        print(f"   ✅ Created: {created_count}")
        print(f"   ⏭️  Skipped: {skipped_count}")
        if errors:
            print(f"   ❌ Errors: {len(errors)}")
            for error in errors[:10]:  # Show first 10 errors
                print(f"      - {error}")
        print("="*50)
        
        return True
        
    except Exception as e:
        print(f"❌ Error reading CSV file: {str(e)}")
        return False
    finally:
        db.close()

def main():
    csv_path = None
    
    if len(sys.argv) >= 2:
        csv_path = Path(sys.argv[1])
    else:
        # Try to find languages.csv in project root
        base_dir = Path(__file__).parent.parent
        default_csv = base_dir / "languages.csv"
        if default_csv.exists():
            csv_path = default_csv
            print(f"📁 Using default file: {csv_path}")
        else:
            print("Usage: python import_languages_from_csv.py <path_to_csv_file>")
            print("\nCSV format supported:")
            print("  Format 1: Language,Price_PLN,Notes")
            print("  Format 2: name_pl,name_en,base_client_price")
            print("  Format 3: name_pl,base_client_price")
            print("\nThe script automatically detects column names and order.")
            print("\nExample:")
            print("  python import_languages_from_csv.py languages.csv")
            print("  python import_languages_from_csv.py /path/to/languages.csv")
            sys.exit(1)
    
    # If relative path, try to resolve from script location or current directory
    if not csv_path.is_absolute():
        base_dir = Path(__file__).parent.parent
        potential_path = base_dir / csv_path
        if potential_path.exists():
            csv_path = potential_path
        elif csv_path.exists():
            csv_path = csv_path.resolve()
        else:
            print(f"❌ File not found: {csv_path}")
            print(f"   Tried: {base_dir / csv_path}")
            print(f"   Tried: {csv_path.resolve()}")
            sys.exit(1)
    
    success = import_languages_from_csv(csv_path)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()

