import React, { useState } from 'react'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('main') // 'main' or 'processed'
  const [folderPath, setFolderPath] = useState('')
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [files, setFiles] = useState([])
  const [fileData, setFileData] = useState([])
  const [folderStatus, setFolderStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const fileInputRef = React.useRef(null)
  
  // Processed files page state
  const [processedFiles, setProcessedFiles] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('originalName')
  const [sortDirection, setSortDirection] = useState('asc')

  const handleFolderPicker = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Try File System Access API first (Chrome, Edge, Opera)
      if ('showDirectoryPicker' in window) {
        const directoryHandle = await window.showDirectoryPicker()
        setSelectedFolder(directoryHandle)
        
        // Extract files from the directory
        const solidworksFiles = []
        await scanDirectory(directoryHandle, solidworksFiles, '')
        
        if (solidworksFiles.length === 0) {
          setError('No SOLIDWORKS files found in the selected folder')
          setLoading(false)
          return
        }
        
        setFiles(solidworksFiles)
        setFolderPath(directoryHandle.name)
        
        // Automatically process the files
        await processFilesFromSelection(solidworksFiles)
      } else {
        // Fallback: Use file input with webkitdirectory
        fileInputRef.current?.click()
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to select folder')
      }
      setLoading(false)
    }
  }
  
  const processFilesFromSelection = async (filesToProcess) => {
    if (!filesToProcess || filesToProcess.length === 0) {
      setLoading(false)
      return
    }

    try {
      // If files were selected via File System Access API or file input,
      // we need to upload them to the server for processing
      if (filesToProcess[0].file || filesToProcess[0].handle) {
        // Create FormData to upload files
        const formData = new FormData()
        
        for (const fileInfo of filesToProcess) {
          if (fileInfo.file) {
            // From file input
            formData.append('files', fileInfo.file, fileInfo.path)
          } else if (fileInfo.handle) {
            // From File System Access API - need to get the file
            const file = await fileInfo.handle.getFile()
            formData.append('files', file, fileInfo.path)
          }
        }

        const response = await fetch('http://localhost:5000/api/process-uploaded-files', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Failed to process uploaded files')
        }

        const data = await response.json()
        setFileData(data.results)
        
        // Calculate folder status from results
        const processed = data.results.filter(f => f.hasMapping).length
        const newFiles = data.results.filter(f => f.isNew).length
        setFolderStatus({
          totalFiles: data.results.length,
          processedFiles: processed,
          newFiles: newFiles,
          hasBeenProcessed: processed > 0
        })
      }
    } catch (err) {
      setError(err.message || 'Failed to process files')
    } finally {
      setLoading(false)
    }
  }

  const scanDirectory = async (dirHandle, fileList, path) => {
    const solidworksExtensions = ['.sldprt', '.sldasm', '.slddrw', '.step', '.stp', '.x_t', '.x_b']
    
    for await (const entry of dirHandle.values()) {
      // Only scan files in the selected folder, skip subdirectories
      if (entry.kind === 'file') {
        const ext = entry.name.toLowerCase().substring(entry.name.lastIndexOf('.'))
        if (solidworksExtensions.includes(ext)) {
          fileList.push({
            name: entry.name,
            path: entry.name,  // Just filename, no subdirectory path
            relativePath: entry.name,
            handle: entry
          })
        }
      }
      // Skip directories - don't recurse into subfolders
    }
  }

  const handleFileInputChange = async (event) => {
    const fileList = event.target.files
    if (!fileList || fileList.length === 0) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const solidworksExtensions = ['.sldprt', '.sldasm', '.slddrw', '.step', '.stp', '.x_t', '.x_b']
      const solidworksFiles = []
      
      // Get folder name from first file's relative path
      const firstFile = fileList[0]
      const folderPath = firstFile.webkitRelativePath ? 
        firstFile.webkitRelativePath.split('/')[0] : 
        'Selected Folder'

      Array.from(fileList).forEach(file => {
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
        if (solidworksExtensions.includes(ext)) {
          // Only include files directly in the selected folder (no subdirectories)
          const relativePath = file.webkitRelativePath || file.name
          // Check if file is in a subdirectory (has '/' in path beyond the folder name)
          const pathParts = relativePath.split('/')
          if (pathParts.length <= 2) {  // folder/file.ext or just file.ext
            solidworksFiles.push({
              name: file.name,
              path: file.name,  // Just filename for top-level files
              relativePath: file.name,
              file: file
            })
          }
        }
      })

      if (solidworksFiles.length === 0) {
        setError('No SOLIDWORKS files found in the selected folder')
        setLoading(false)
      } else {
        setFiles(solidworksFiles)
        setFolderPath(folderPath)
        
        // Automatically process the files
        await processFilesFromSelection(solidworksFiles)
      }
    } catch (err) {
      setError(err.message || 'Failed to process files')
      setLoading(false)
    }
    
    // Reset input so same folder can be selected again
    event.target.value = ''
  }

  const handleFolderSelect = async () => {
    // Fallback: Manual folder path entry
    if (!folderPath) {
      setError('Please enter a folder path')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('http://localhost:5000/api/scan-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderPath }),
      })

      if (!response.ok) {
        throw new Error('Failed to scan folder')
      }

      const data = await response.json()
      setFiles(data.files)
      setFolderStatus(data.folderStatus || null)
      
      // Automatically process files after scanning
      if (data.files && data.files.length > 0) {
        const filePaths = data.files.map(f => f.path)
        const processResponse = await fetch('http://localhost:5000/api/read-properties', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filePaths }),
        })

        if (processResponse.ok) {
          const processData = await processResponse.json()
          setFileData(processData.results)
          
          // Update folder status from processed results
          const processed = processData.results.filter(f => f.hasMapping).length
          const newFiles = processData.results.filter(f => f.isNew).length
          const hasRenamed = processData.results.some(f => f.isRenamedFile)
          setFolderStatus({
            totalFiles: processData.results.length,
            processedFiles: processed,
            newFiles: newFiles,
            hasBeenProcessed: processed > 0,
            hasRenamedFiles: hasRenamed
          })
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleProcessFiles = async () => {
    if (files.length === 0) {
      setError('No files to process')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // If files were selected via File System Access API or file input,
      // we need to upload them to the server for processing
      if (files[0].file || files[0].handle) {
        // Create FormData to upload files
        const formData = new FormData()
        
        for (const fileInfo of files) {
          if (fileInfo.file) {
            // From file input
            formData.append('files', fileInfo.file, fileInfo.path)
          } else if (fileInfo.handle) {
            // From File System Access API - need to get the file
            const file = await fileInfo.handle.getFile()
            formData.append('files', file, fileInfo.path)
          }
        }

        const response = await fetch('http://localhost:5000/api/process-uploaded-files', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Failed to process uploaded files')
        }

        const data = await response.json()
        setFileData(data.results)
        
        // Calculate folder status from results
        const processed = data.results.filter(f => f.hasMapping).length
        const newFiles = data.results.filter(f => f.isNew).length
        setFolderStatus({
          totalFiles: data.results.length,
          processedFiles: processed,
          newFiles: newFiles,
          hasBeenProcessed: processed > 0
        })
      } else {
        // Files from server-side folder scan
        const filePaths = files.map(f => f.path)
        const response = await fetch('http://localhost:5000/api/read-properties', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filePaths }),
        })

        if (!response.ok) {
          throw new Error('Failed to read file properties')
        }

        const data = await response.json()
        setFileData(data.results)
        
        // Calculate folder status from results
        const processed = data.results.filter(f => f.hasMapping).length
        const newFiles = data.results.filter(f => f.isNew).length
        const hasRenamed = data.results.some(f => f.isRenamedFile)
        setFolderStatus({
          totalFiles: data.results.length,
          processedFiles: processed,
          newFiles: newFiles,
          hasBeenProcessed: processed > 0,
          hasRenamedFiles: hasRenamed
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProperties = async () => {
    if (fileData.length === 0) {
      setError('No file data to update')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Check if files were uploaded (have file or handle property)
      const hasUploadedFiles = files.length > 0 && (files[0].file || files[0].handle)
      
      if (hasUploadedFiles) {
        // For uploaded files, we can only save mappings
        // File updates would require File System Access API write access
        const updates = fileData.map(file => ({
          filePath: file.path,
          vendorPartNumber: file.vendorPartNumber,
          revision: file.revision
        }))

        const response = await fetch('http://localhost:5000/api/update-properties', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ updates }),
        })

        if (!response.ok) {
          throw new Error('Failed to save mappings')
        }

        const data = await response.json()
        setSuccess(`Mappings saved for ${data.results.length} file(s). Use the exported CSV to update files manually or use SOLIDWORKS API on Windows.`)
      } else {
        // For server-side scanned files, we can update directly
        const updates = fileData.map(file => ({
          filePath: file.path,
          vendorPartNumber: file.vendorPartNumber,
          revision: file.revision
        }))

        const response = await fetch('http://localhost:5000/api/update-properties', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ updates }),
        })

        if (!response.ok) {
          throw new Error('Failed to update properties')
        }

        const data = await response.json()
        const allSuccess = data.results.every(r => r.success)
        
        if (allSuccess) {
          setSuccess(`Successfully updated ${data.results.length} file(s)`)
        } else {
          setError('Some files failed to update')
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExportMappings = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/export-mappings')
      const data = await response.json()
      
      const blob = new Blob([data.csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'vendor_part_mappings.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError('Failed to export mappings')
    }
  }

  const handleGenerateFilesWithPartNumbers = async () => {
    if (fileData.length === 0) {
      setError('No file data to generate')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Check if files were uploaded (have file or handle property)
      const hasUploadedFiles = files.length > 0 && (files[0].file || files[0].handle)
      
      if (hasUploadedFiles) {
        // For uploaded files, we need to upload them again with new names
        const formData = new FormData()
        
        for (const fileInfo of files) {
          const fileDataItem = fileData.find(f => 
            f.path === fileInfo.path || 
            f.name === fileInfo.name ||
            f.path === fileInfo.relativePath
          )
          if (!fileDataItem || !fileDataItem.vendorPartNumber) continue
          
          let file = null
          if (fileInfo.file) {
            file = fileInfo.file
          } else if (fileInfo.handle) {
            file = await fileInfo.handle.getFile()
          }
          
          if (file) {
            const ext = file.name.substring(file.name.lastIndexOf('.'))
            const newName = `${fileDataItem.vendorPartNumber}${ext}`
            formData.append('files', file, newName)
          }
        }
        
        const response = await fetch('http://localhost:5000/api/generate-files-from-upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorText = await response.text()
          try {
            const errorData = JSON.parse(errorText)
            throw new Error(errorData.error || 'Failed to generate files')
          } catch {
            throw new Error(errorText || 'Failed to generate files')
          }
        }

        // Download the zip file
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'Vendor_Part_Numbers.zip'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        setSuccess('Successfully generated files with part numbers. Zip file downloaded!')
      } else {
        // For server-side scanned files
        if (!folderPath) {
          setError('Folder path is required')
          setLoading(false)
          return
        }

        // Prepare file data for backend
        const filesForGeneration = fileData.map(file => ({
          path: file.path,
          name: file.name,
          vendorPartNumber: file.vendorPartNumber
        }))

        const response = await fetch('http://localhost:5000/api/generate-files-with-part-numbers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            folderPath: folderPath,
            files: filesForGeneration
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to generate files')
        }

        const data = await response.json()
        setSuccess(
          `Successfully generated ${data.filesCopied} file(s) with part numbers in "${data.outputFolder}". ` +
          `Excel file created with ${data.uniquePartNumbers} unique part number(s).`
        )
      }
    } catch (err) {
      setError(err.message || 'Failed to generate files with part numbers')
    } finally {
      setLoading(false)
    }
  }

  // Load processed files when switching to processed page
  React.useEffect(() => {
    if (currentPage === 'processed') {
      loadProcessedFiles()
    }
  }, [currentPage])

  const loadProcessedFiles = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('http://localhost:5000/api/all-processed-files')
      if (!response.ok) {
        throw new Error('Failed to load processed files')
      }
      const data = await response.json()
      setProcessedFiles(data.files || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const filteredAndSortedFiles = React.useMemo(() => {
    let filtered = processedFiles.filter(file => {
      const query = searchQuery.toLowerCase()
      return (
        file.originalName.toLowerCase().includes(query) ||
        file.fullPartNumber.includes(query) ||
        file.basePartNumber.includes(query) ||
        file.originalPath.toLowerCase().includes(query)
      )
    })

    filtered.sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [processedFiles, searchQuery, sortField, sortDirection])

  if (currentPage === 'processed') {
    return (
      <div className="app">
        <div className="container">
          <header className="header">
            <h1>All Processed Files</h1>
            <p className="subtitle">
              View and search all files that have been assigned part numbers
            </p>
          </header>

          <div className="card">
            <div className="section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <button
                  onClick={() => setCurrentPage('main')}
                  className="btn btn-secondary"
                  style={{ marginBottom: 0 }}
                >
                  ← Back to Main
                </button>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Search files, part numbers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input"
                    style={{ width: '300px', marginBottom: 0 }}
                  />
                  <span style={{ color: '#d1d5db', fontSize: '0.9rem' }}>
                    {filteredAndSortedFiles.length} of {processedFiles.length} files
                  </span>
                </div>
              </div>

              {loading && processedFiles.length === 0 ? (
                <p className="info-text">Loading processed files...</p>
              ) : processedFiles.length === 0 ? (
                <p className="info-text">No processed files found.</p>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th 
                          onClick={() => handleSort('originalName')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          Original File Name
                          {sortField === 'originalName' && (
                            <span style={{ marginLeft: '5px' }}>
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </th>
                        <th 
                          onClick={() => handleSort('basePartNumber')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          Base Part # (9 digits)
                          {sortField === 'basePartNumber' && (
                            <span style={{ marginLeft: '5px' }}>
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </th>
                        <th 
                          onClick={() => handleSort('revision')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          Revision
                          {sortField === 'revision' && (
                            <span style={{ marginLeft: '5px' }}>
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </th>
                        <th 
                          onClick={() => handleSort('fullPartNumber')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          Full Part # (12 digits)
                          {sortField === 'fullPartNumber' && (
                            <span style={{ marginLeft: '5px' }}>
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </th>
                        <th 
                          onClick={() => handleSort('originalPath')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          Original Path
                          {sortField === 'originalPath' && (
                            <span style={{ marginLeft: '5px' }}>
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedFiles.map((file, index) => (
                        <tr key={index}>
                          <td className="file-name-cell">
                            <strong>{file.originalName}</strong>
                          </td>
                          <td className="base-part-cell">
                            <code>{file.basePartNumber}</code>
                          </td>
                          <td className="revision-cell">
                            {file.revision}
                          </td>
                          <td className="full-part-cell">
                            <code style={{ fontFamily: 'Courier New', fontSize: '1rem', fontWeight: 'bold' }}>
                              {file.fullPartNumber}
                            </code>
                          </td>
                          <td className="path-cell" style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                            {file.originalPath}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {error && (
                <div className="error-message" style={{ marginTop: '20px' }}>
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>PMF Vendor Part Number Generator</h1>
          <p className="subtitle">
            Generate unique 12-digit part numbers for SOLIDWORKS files
          </p>
          <div style={{ marginTop: '15px' }}>
            <button
              onClick={() => setCurrentPage('processed')}
              className="btn btn-secondary"
              style={{ fontSize: '0.9rem', padding: '8px 16px' }}
            >
              View All Processed Files →
            </button>
          </div>
        </header>

        <div className="card">
          <div className="section">
            <h2>1. Select Folder</h2>
            <div className="folder-select-group">
              <button
                onClick={handleFolderPicker}
                disabled={loading}
                className="btn btn-primary btn-folder-picker"
              >
                📁 Select Folder
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                webkitdirectory=""
                directory=""
                multiple
                style={{ display: 'none' }}
              />
              {folderPath && (
                <div className="selected-folder">
                  <span className="folder-icon">📂</span>
                  <span className="folder-path">{folderPath}</span>
                </div>
              )}
            </div>
            <div className="divider">
              <span>OR</span>
            </div>
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter folder path manually (e.g., C:\Projects\Parts)"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                className="input"
              />
              <button
                onClick={handleFolderSelect}
                disabled={loading}
                className="btn btn-secondary"
              >
                Scan Folder
              </button>
            </div>
          </div>

          {files.length > 0 && (
            <div className="section">
              <h2>2. Found Files ({files.length})</h2>
              {loading && fileData.length === 0 && (
                <p className="info-text" style={{ marginBottom: '15px' }}>
                  ⏳ Processing files and checking for existing part numbers...
                </p>
              )}
              {folderStatus && folderStatus.hasRenamedFiles && (
                <div className="folder-status-banner renamed">
                  <span className="status-icon">⚠️</span>
                  <div className="status-content">
                    <strong>This folder contains renamed files (part numbers as filenames)</strong>
                    <div className="status-details">
                      Some files have been renamed with part numbers. Original filenames will be shown below.
                    </div>
                  </div>
                </div>
              )}
              {folderStatus && folderStatus.hasBeenProcessed && !folderStatus.hasRenamedFiles && (
                <div className="folder-status-banner processed">
                  <span className="status-icon">✓</span>
                  <div className="status-content">
                    <strong>This folder has been processed before</strong>
                    <div className="status-details">
                      {folderStatus.processedFiles} of {folderStatus.totalFiles} files already have part numbers
                      {folderStatus.newFiles > 0 && ` • ${folderStatus.newFiles} new file(s) need part numbers`}
                    </div>
                  </div>
                </div>
              )}
              {folderStatus && !folderStatus.hasBeenProcessed && (
                <div className="folder-status-banner new">
                  <span className="status-icon">📁</span>
                  <div className="status-content">
                    <strong>New folder - no part numbers generated yet</strong>
                    <div className="status-details">
                      All {folderStatus.totalFiles} files are new and will get part numbers
                    </div>
                  </div>
                </div>
              )}
              <div className="file-list">
                {files.map((file, index) => (
                  <div 
                    key={index} 
                    className={`file-item ${file.hasMapping ? 'has-mapping' : 'new-file'}`}
                  >
                    <div className="file-info">
                      <span className="file-name">
                        {file.name}
                        {file.hasMapping && (
                          <span className="mapping-badge" title="Has existing part number">
                            ✓ Processed
                          </span>
                        )}
                        {!file.hasMapping && (
                          <span className="new-badge" title="New file - needs part number">
                            New
                          </span>
                        )}
                      </span>
                      <span className="file-path">{file.relativePath}</span>
                      {file.isRenamedFile && file.originalFilenames && file.originalFilenames.length > 0 && (
                        <span className="original-filename">
                          Original: {file.originalFilenames.join(', ')}
                        </span>
                      )}
                      {file.hasMapping && file.existingPartNumber && !file.isRenamedFile && (
                        <span className="existing-part-number">
                          Existing Part #: {file.existingPartNumber}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {fileData.length === 0 && (
                <button
                  onClick={handleProcessFiles}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  Process Files & Generate Part Numbers
                </button>
              )}
              {fileData.length > 0 && (
                <button
                  onClick={handleProcessFiles}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  Re-process Files
                </button>
              )}
            </div>
          )}

          {fileData.length > 0 && (
            <div className="section">
              <h2>3. Vendor Part Numbers</h2>
              <p className="info-text">
                Part numbers are 12 digits: 9 digits for base part + 3 digits for revision (001, 002, etc.)
              </p>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Base Part # (9 digits)</th>
                      <th>Revision</th>
                      <th>Full Part # (12 digits)</th>
                      <th>Actions</th>
                      <th>Existing Properties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...fileData]
                      .sort((a, b) => {
                        // Sort by vendor part number first (to group same part numbers together)
                        const aPart = a.vendorPartNumber || ''
                        const bPart = b.vendorPartNumber || ''
                        if (aPart !== bPart) {
                          return aPart.localeCompare(bPart)
                        }
                        // If same part number, sort by filename
                        return a.name.localeCompare(b.name)
                      })
                      .map((file, index) => {
                      const basePart = file.basePartNumber || (file.vendorPartNumber ? file.vendorPartNumber.substring(0, 9) : '')
                      const revision = file.revision || (file.vendorPartNumber ? parseInt(file.vendorPartNumber.substring(9)) : 1)
                      const fullPart = file.vendorPartNumber || `${basePart}${revision.toString().padStart(3, '0')}`
                      const hasMapping = file.hasMapping || false
                      
                      return (
                        <tr key={index} className={hasMapping ? 'row-has-mapping' : 'row-new'}>
                          <td className="file-name-cell">
                            <div className="file-name-with-status">
                              <div>
                                {file.name}
                                {file.isRenamedFile && (
                                  <span className="table-badge renamed-badge" title="This file has been renamed with a part number">
                                    Renamed
                                  </span>
                                )}
                                {hasMapping && !file.isRenamedFile && (
                                  <span className="table-badge processed-badge" title="This file was processed before">
                                    ✓
                                  </span>
                                )}
                                {!hasMapping && !file.isRenamedFile && (
                                  <span className="table-badge new-badge-table" title="New file">
                                    New
                                  </span>
                                )}
                              </div>
                              {file.isRenamedFile && file.originalFilenames && file.originalFilenames.length > 0 && (
                                <div className="original-filename-display">
                                  <span className="original-label">Original:</span> {file.originalFilenames.join(', ')}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="base-part-cell">
                            <input
                              type="text"
                              value={basePart}
                              onChange={(e) => {
                                const newData = [...fileData]
                                const newBase = e.target.value.replace(/\D/g, '').substring(0, 9)
                                newData[index].basePartNumber = newBase
                                newData[index].vendorPartNumber = `${newBase}${revision.toString().padStart(3, '0')}`
                                setFileData(newData)
                              }}
                              className="part-number-input base-input"
                              maxLength={9}
                              placeholder="123456789"
                            />
                          </td>
                          <td className="revision-cell">
                            <div className="revision-controls">
                              <input
                                type="number"
                                value={revision}
                                onChange={(e) => {
                                  const newData = [...fileData]
                                  const newRev = Math.max(1, Math.min(999, parseInt(e.target.value) || 1))
                                  newData[index].revision = newRev
                                  newData[index].vendorPartNumber = `${basePart}${newRev.toString().padStart(3, '0')}`
                                  setFileData(newData)
                                }}
                                className="revision-input"
                                min="1"
                                max="999"
                              />
                              <button
                                onClick={async () => {
                                  const newData = [...fileData]
                                  const newRev = revision + 1
                                  try {
                                    const response = await fetch('http://localhost:5000/api/create-revision', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({
                                        filePath: file.path,
                                        revision: newRev
                                      }),
                                    })
                                    
                                    if (response.ok) {
                                      const data = await response.json()
                                      newData[index].revision = data.revision
                                      newData[index].vendorPartNumber = data.vendorPartNumber
                                      newData[index].basePartNumber = data.basePartNumber
                                      setFileData(newData)
                                      setSuccess(`Created revision ${data.revision} for ${file.name}`)
                                    }
                                  } catch (err) {
                                    // Fallback: just update locally
                                    newData[index].revision = newRev
                                    newData[index].vendorPartNumber = `${basePart}${newRev.toString().padStart(3, '0')}`
                                    setFileData(newData)
                                  }
                                }}
                                className="btn btn-small btn-revision"
                                title="Create next revision"
                              >
                                +1
                              </button>
                            </div>
                          </td>
                          <td className="full-part-cell">
                            <input
                              type="text"
                              value={fullPart}
                              readOnly
                              className="part-number-input full-input"
                              maxLength={12}
                            />
                          </td>
                          <td className="actions-cell">
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch('http://localhost:5000/api/create-revision', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                      filePath: file.path
                                    }),
                                  })
                                  
                                  if (response.ok) {
                                    const data = await response.json()
                                    const newData = [...fileData]
                                    newData[index].revision = data.revision
                                    newData[index].vendorPartNumber = data.vendorPartNumber
                                    newData[index].basePartNumber = data.basePartNumber
                                    setFileData(newData)
                                    setSuccess(`Created revision ${data.revision} for ${file.name}`)
                                  }
                                } catch (err) {
                                  setError('Failed to create revision')
                                }
                              }}
                              className="btn btn-small btn-new-revision"
                              title="Create new revision"
                            >
                              New Rev
                            </button>
                          </td>
                          <td className="properties-cell">
                            {Object.keys(file.properties || {}).length > 0 ? (
                              <div className="properties-list">
                                {Object.entries(file.properties).map(([key, value]) => (
                                  <div key={key} className="property-item">
                                    <strong>{key}:</strong> {value.resolved || value.value}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="no-properties">No properties found</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="button-group">
                <button
                  onClick={handleUpdateProperties}
                  disabled={loading}
                  className="btn btn-success"
                >
                  Update Files with Vendor Part Numbers
                </button>
                <button
                  onClick={handleExportMappings}
                  className="btn btn-outline"
                >
                  Export Mappings (CSV)
                </button>
                <button
                  onClick={handleGenerateFilesWithPartNumbers}
                  disabled={loading}
                  className="btn btn-outline"
                >
                  Generate Files with Part Numbers
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              {success}
            </div>
          )}

          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <p>Processing...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App

