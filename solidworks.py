import os

# Try to import SOLIDWORKS API (Windows only)
try:
    import win32com.client
    import pythoncom
    SOLIDWORKS_AVAILABLE = True
except ImportError:
    SOLIDWORKS_AVAILABLE = False

def read_solidworks_properties(file_path):
    """Read custom properties from SOLIDWORKS file using Document Manager API"""
    if not SOLIDWORKS_AVAILABLE:
        return None
    
    try:
        # Initialize COM for SOLIDWORKS Document Manager
        pythoncom.CoInitialize()
        sw_dm = win32com.client.Dispatch("SwDocumentMgr.SwDMApplication")
        
        # Get document type
        doc_type = 1  # swDmDocumentPart = 1
        if file_path.lower().endswith('.sldasm'):
            doc_type = 2  # swDmDocumentAssembly
        elif file_path.lower().endswith('.slddrw'):
            doc_type = 3  # swDmDocumentDrawing
        
        # Open document
        errors = []
        sw_doc = sw_dm.GetDocument(file_path, doc_type, True, "", errors)
        
        if sw_doc is None:
            return None
        
        # Read custom properties
        properties = {}
        custom_props = sw_doc.CustomPropertyManager("")
        
        if custom_props:
            prop_names = custom_props.GetNames()
            if prop_names:
                for prop_name in prop_names:
                    prop_value, resolved_value = custom_props.Get6(prop_name, False, "")
                    properties[prop_name] = {
                        'value': prop_value,
                        'resolved': resolved_value
                    }
        
        sw_doc.CloseDoc()
        return properties
    except Exception as e:
        print(f"Error reading SOLIDWORKS properties: {e}")
        return None
    finally:
        pythoncom.CoUninitialize()

def update_solidworks_property(file_path, property_name, property_value):
    """Update custom property in SOLIDWORKS file"""
    if not SOLIDWORKS_AVAILABLE:
        return False
    
    # Only update native SOLIDWORKS files, not export formats
    solidworks_extensions = ['.sldprt', '.sldasm', '.slddrw']
    file_ext = os.path.splitext(file_path)[1].lower()
    if file_ext not in solidworks_extensions:
        # Export formats (.step, .x_t, etc.) cannot be updated via SOLIDWORKS API
        return False
    
    try:
        pythoncom.CoInitialize()
        sw_dm = win32com.client.Dispatch("SwDocumentMgr.SwDMApplication")
        
        doc_type = 1
        if file_path.lower().endswith('.sldasm'):
            doc_type = 2
        elif file_path.lower().endswith('.slddrw'):
            doc_type = 3
        
        errors = []
        sw_doc = sw_dm.GetDocument(file_path, doc_type, True, "", errors)
        
        if sw_doc is None:
            return False
        
        custom_props = sw_doc.CustomPropertyManager("")
        if custom_props:
            # Add or update the property
            custom_props.Add3(property_name, 30, property_value)  # 30 = swCustomInfoText
        
        sw_doc.CloseDoc()
        return True
    except Exception as e:
        print(f"Error updating SOLIDWORKS property: {e}")
        return False
    finally:
        pythoncom.CoUninitialize()

