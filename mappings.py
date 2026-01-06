import os
import json
from filename_generator import get_base_filename

# Store mappings between original files and vendor part numbers
MAPPINGS_FILE = 'vendor_part_mappings.json'

def load_mappings():
    """Load existing vendor part number mappings"""
    if os.path.exists(MAPPINGS_FILE):
        with open(MAPPINGS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_mappings(mappings):
    """Save vendor part number mappings"""
    with open(MAPPINGS_FILE, 'w') as f:
        json.dump(mappings, f, indent=2)

def check_file_mapping_status(file_path, mappings):
    """Check if a file has an existing mapping"""
    # First check exact file path
    if file_path in mappings:
        mapping = mappings[file_path]
        if isinstance(mapping, dict):
            base = mapping.get('base', '')
            rev = mapping.get('revision', 1)
            full = f"{base}{rev:03d}"
            return {
                'hasMapping': True,
                'basePartNumber': base,
                'revision': rev,
                'vendorPartNumber': full
            }
        elif isinstance(mapping, str) and len(mapping) == 12:
            # Old format
            base = mapping[:9]
            rev = int(mapping[9:])
            return {
                'hasMapping': True,
                'basePartNumber': base,
                'revision': rev,
                'vendorPartNumber': mapping
            }
    
    # Check if there's a mapping for a file with the same base name (different extension)
    base_filename = get_base_filename(file_path)
    for mapped_path, mapping_data in mappings.items():
        if get_base_filename(mapped_path) == base_filename:
            # Found a file with the same base name
            if isinstance(mapping_data, dict):
                base = mapping_data.get('base', '')
                rev = mapping_data.get('revision', 1)
                full = f"{base}{rev:03d}"
                return {
                    'hasMapping': True,
                    'basePartNumber': base,
                    'revision': rev,
                    'vendorPartNumber': full
                }
            elif isinstance(mapping_data, str) and len(mapping_data) == 12:
                base = mapping_data[:9]
                rev = int(mapping_data[9:])
                return {
                    'hasMapping': True,
                    'basePartNumber': base,
                    'revision': rev,
                    'vendorPartNumber': mapping_data
                }
    
    return {'hasMapping': False}

