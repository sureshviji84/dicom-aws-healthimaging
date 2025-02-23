import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Home.css';

const Home = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState({});
  const navigate = useNavigate();

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(prevFiles => [...prevFiles, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[index];
      return newProgress;
    });
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadStatus('Please select files first');
      return;
    }

    setUploadStatus('Uploading...');
    const uploadedFiles = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const formData = new FormData();
        formData.append('file', selectedFiles[i]);

        const response = await axios.post('http://localhost:3001/api/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(prev => ({
              ...prev,
              [i]: percentCompleted
            }));
          }
        });

        uploadedFiles.push({
          fileUrl: response.data.fileUrl,
          fileName: selectedFiles[i].name
        });
      }

      setUploadStatus('Upload successful!');

      // Navigate to viewer with the first file, but pass all files
      navigate('/viewer', { 
        state: { 
          currentFile: uploadedFiles[0],
          allFiles: uploadedFiles
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('Upload failed. Please try again.');
    }
  };

  const renderFilePreview = useCallback((file, index) => {
    const progress = uploadProgress[index] || 0;
    
    return (
      <div key={index} className="file-preview">
        <div className="file-info">
          <span className="file-name">{file.name}</span>
          <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
        </div>
        {progress > 0 && progress < 100 && (
          <div className="progress-bar">
            <div className="progress" style={{ width: `${progress}%` }}></div>
          </div>
        )}
        <button 
          className="remove-file"
          onClick={() => removeFile(index)}
          title="Remove file"
        >
          ×
        </button>
      </div>
    );
  }, [uploadProgress]);

  return (
    <div className="home">
      <header className="home-header">
        <h1>DICOM File Upload</h1>
      </header>
      
      <main className="home-main">
        <div className="upload-container">
          <div className="upload-box">
            <h2>Upload DICOM Files</h2>
            
            <div className="upload-actions">
              <input
                type="file"
                accept=".dcm"
                onChange={handleFileChange}
                className="file-input"
                multiple
              />
              <button 
                onClick={handleUpload}
                className="upload-button"
                disabled={selectedFiles.length === 0}
              >
                Upload DICOM Files
              </button>
            </div>

            {selectedFiles.length > 0 && (
              <div className="selected-files">
                <h3>Selected Files ({selectedFiles.length})</h3>
                <div className="file-list">
                  {selectedFiles.map((file, index) => renderFilePreview(file, index))}
                </div>
              </div>
            )}

            <p className={`status-message ${uploadStatus.includes('failed') ? 'error' : ''}`}>
              {uploadStatus}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home; 