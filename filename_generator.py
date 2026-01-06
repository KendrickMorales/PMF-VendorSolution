import os
import hashlib
import re

def get_base_filename(file_path):
    """Get base filename without extension for matching files with same name"""
    base_name = os.path.splitext(os.path.basename(file_path))[0]
    dir_path = os.path.dirname(file_path)
    return os.path.join(dir_path, base_name) if dir_path else base_name

def generate_base_part_number(file_path, existing_mappings):
    """Generate a unique 9-digit base part number (last 3 digits reserved for revision)"""
    # Use base filename (without extension) for hash to ensure same part number
    # for files with same name but different extensions
    base_filename = get_base_filename(file_path)
    file_hash = hashlib.md5(str(base_filename).encode()).hexdigest()[:8]
    
    # Generate a 9-digit base number
    base_number = int(file_hash, 16) % 1000000000
    
    # Ensure uniqueness of base number
    base_str = f"{base_number:09d}"
    
    # Check if this base number already exists for a different base filename
    for mapped_path, mapping_data in existing_mappings.items():
        if isinstance(mapping_data, dict) and mapping_data.get('base') == base_str:
            mapped_base = get_base_filename(mapped_path)
            if mapped_base != base_filename:
                # Collision with different base filename - adjust base number
                base_number = (base_number + 1) % 1000000000
                base_str = f"{base_number:09d}"
                break
    
    return base_str

def get_or_create_part_mapping(file_path, existing_mappings, revision=None):
    """Get existing part mapping or create new one with revision support"""

    base_filename = get_base_filename(file_path)
    
    if file_path in existing_mappings:
        mapping = existing_mappings[file_path]
        
        if isinstance(mapping, str):
            if len(mapping) == 12:
                base = mapping[:9]
                rev = int(mapping[9:])
                mapping = {'base': base, 'revision': rev}
                existing_mappings[file_path] = mapping
            else:
                base = generate_base_part_number(file_path, existing_mappings)
                mapping = {'base': base, 'revision': 1}
                existing_mappings[file_path] = mapping
        else:
            mapping = existing_mappings[file_path].copy()
        
        if revision is not None and revision != mapping.get('revision', 1):
            mapping['revision'] = revision
            existing_mappings[file_path] = mapping
    else:
        matching_mapping = None
        for mapped_path, mapping_data in existing_mappings.items():
            if get_base_filename(mapped_path) == base_filename:
                # Found a file with the same base name - use its mapping
                if isinstance(mapping_data, dict):
                    matching_mapping = mapping_data.copy()
                elif isinstance(mapping_data, str) and len(mapping_data) == 12:
                    # Old format - convert
                    base = mapping_data[:9]
                    rev = int(mapping_data[9:])
                    matching_mapping = {'base': base, 'revision': rev}
                break
        
        if matching_mapping:
            mapping = matching_mapping.copy()
            if revision is not None:
                mapping['revision'] = revision
            existing_mappings[file_path] = mapping
        else:
            base = generate_base_part_number(file_path, existing_mappings)
            mapping = {'base': base, 'revision': revision if revision is not None else 1}
            existing_mappings[file_path] = mapping
    
    # Generate full 12-digit part number
    full_part_number = f"{mapping['base']}{mapping['revision']:03d}"
    
    return mapping, full_part_number

def is_part_number_filename(filename):
    """Check if filename is a 12-digit part number"""
    base_name = os.path.splitext(filename)[0]
    # Check if base name is exactly 12 digits
    return bool(re.match(r'^\d{12}$', base_name))

def find_original_filename_by_part_number(part_number, mappings):
    """Find original filename(s) that have this part number"""
    original_files = []
    for mapped_path, mapping_data in mappings.items():
        if isinstance(mapping_data, dict):
            base = mapping_data.get('base', '')
            rev = mapping_data.get('revision', 1)
            full = f"{base}{rev:03d}"
            if full == part_number:
                original_files.append(os.path.basename(mapped_path))
        elif isinstance(mapping_data, str) and len(mapping_data) == 12:
            if mapping_data == part_number:
                original_files.append(os.path.basename(mapped_path))
    return original_files

