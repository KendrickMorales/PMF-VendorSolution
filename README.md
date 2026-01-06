# PMF Vendor Part Number Generator

A web application that generates unique 12-digit vendor part numbers for SOLIDWORKS files and updates their custom properties.

## Features

- **Folder Scanning**: Select a folder containing SOLIDWORKS files (.sldprt, .sldasm, .slddrw) and related formats (.step, .stp, .x_t, .x_b)
- **Metadata Reading**: Reads existing custom properties from SOLIDWORKS files
- **Unique Part Numbers**: Generates unique 12-digit vendor part numbers
- **Property Updates**: Updates the "Vendor Part Number" custom property in SOLIDWORKS files
- **Mapping System**: Maintains a mapping between original files and vendor part numbers
- **Export**: Export mappings to CSV for reference

## Requirements

### For Full Functionality (Windows)

- SOLIDWORKS installed with Document Manager API
- Python 3.8+
- Node.js 16+

### For Basic Functionality (macOS/Linux)

- Python 3.8+
- Node.js 16+
- Note: SOLIDWORKS file property updates require SOLIDWORKS API (Windows only). The app will still generate and save mappings.

## Installation

1. **Install Python dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

2. **Install Node.js dependencies:**

   ```bash
   npm install
   ```

3. **For Windows users with SOLIDWORKS:**
   ```bash
   pip install pywin32
   ```

## Usage

1. **Start the backend server:**

   ```bash
   python app.py
   ```

   Or use the fallback version (if SOLIDWORKS API not available):

   ```bash
   python app_fallback.py
   ```

2. **Start the frontend development server:**

   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

4. **Use the application:**
   - Enter the folder path containing your SOLIDWORKS files
   - Click "Scan Folder" to find all SOLIDWORKS files
   - Click "Process Files & Generate Part Numbers" to read properties and generate vendor part numbers
   - Review and edit vendor part numbers if needed
   - Click "Update Files with Vendor Part Numbers" to update the files
   - Export mappings to CSV for your records

## How It Works

1. **Part Number Generation**:

   - Creates a unique 12-digit number: **9 digits for base part + 3 digits for revision**
   - Base part number (9 digits) is generated from file path hash
   - Revision number (3 digits) starts at 001 and can be incremented for part revisions
   - Example: `123456789001` = Base `123456789` + Revision `001`
   - Ensures uniqueness across all processed files
   - Maintains consistency (same file = same base part number)

2. **Mapping System**:

   - Stores mappings in `vendor_part_mappings.json`
   - Allows you to reference original files by vendor part number
   - Persists across sessions

3. **SOLIDWORKS Integration**:
   - Uses SOLIDWORKS Document Manager API (Windows only)
   - Reads and writes custom properties without opening files
   - Updates "Vendor Part Number" property in files

## File Structure

```
PMF-VendorSolution/
├── app.py                 # Main Flask backend (with SOLIDWORKS API)
├── app_fallback.py        # Fallback backend (no SOLIDWORKS API)
├── requirements.txt       # Python dependencies
├── package.json          # Node.js dependencies
├── vite.config.js        # Vite configuration
├── index.html            # HTML entry point
├── src/
│   ├── main.jsx         # React entry point
│   ├── App.jsx          # Main React component
│   ├── App.css          # Styles
│   └── index.css        # Global styles
└── vendor_part_mappings.json  # Generated mappings (gitignored)
```

## Notes

- **12-Digit Format**: Vendor part numbers are exactly 12 digits (numeric)
  - **9 digits**: Base part number (unique per file)
  - **3 digits**: Revision number (001, 002, 003, etc.)
- **File Types Supported**:
  - SOLIDWORKS native: `.sldprt`, `.sldasm`, `.slddrw`
  - Export formats: `.step`, `.stp`, `.x_t`, `.x_b`
- **Same Part Number for Same Base Name**: Files with the same base filename but different extensions (e.g., `part.sldprt` and `part.step`) will share the same vendor part number, as they represent the same part in different formats.
- **Revisions**: When you need to create a new version of a part, use the "New Rev" button or increment the revision number. The base part number stays the same, only the revision changes.
- **Uniqueness**: Each file gets a unique base part number that remains consistent across revisions
- **Mapping**: The `vendor_part_mappings.json` file stores base part numbers and revisions separately
- **Cross-Platform**: Works on macOS/Linux for generating mappings, but SOLIDWORKS file updates require Windows with SOLIDWORKS installed
- **Note on Export Formats**: `.step`, `.stp`, `.x_t`, and `.x_b` files may not support direct property updates via SOLIDWORKS API, but part numbers will still be generated and saved in mappings

## Troubleshooting

- **SOLIDWORKS API not available**: Use `app_fallback.py` instead. Mappings will still be generated and saved.
- **Port conflicts**: Change ports in `vite.config.js` (frontend) and `app.py` (backend)
- **File permissions**: Ensure the application has read/write permissions for the target folder

## License

MIT
