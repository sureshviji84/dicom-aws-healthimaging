import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import cornerstone from 'cornerstone-core';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import cornerstoneTools from 'cornerstone-tools';
import dicomParser from 'dicom-parser';
import './Viewer.css';

// Initialize cornerstone tools
cornerstoneTools.external.cornerstone = cornerstone;
cornerstoneTools.external.Hammer = window.Hammer;
cornerstoneTools.external.cornerstoneMath = window.cornerstoneMath;
cornerstoneTools.init();

// Initialize WADO Image loader
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

// Configure cornerstone loader
cornerstoneWADOImageLoader.configure({
  useWebWorkers: false,
  decodeConfig: {
    convertFloatPixelDataToInt: false,
    use16Bits: true
  }
});

// Configure request options for S3
cornerstoneWADOImageLoader.configure({
  beforeSend: function(xhr) {
    xhr.setRequestHeader('Access-Control-Allow-Headers', '*');
    xhr.setRequestHeader('Access-Control-Allow-Origin', '*');
  }
});

const Viewer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [viewerStatus, setViewerStatus] = useState('Loading...');
  const [isElementEnabled, setIsElementEnabled] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [metadata, setMetadata] = useState(null);
  const [activeTool, setActiveTool] = useState('Wwwc');
  const viewerRef = useRef(null);

  const allFiles = location.state?.allFiles || [];
  const currentFile = allFiles[currentFileIndex];

  // Initialize the viewer element
  useEffect(() => {
    const element = viewerRef.current;
    if (!element) {
      console.error('Viewer element not found during initialization');
      setViewerStatus('Error: Viewer element not found');
      return;
    }

    try {
      console.log('Initializing viewer element...');
      cornerstone.enable(element);
      setIsElementEnabled(true);
      console.log('Viewer element initialized successfully');

      // Initialize tools
      cornerstoneTools.addTool(cornerstoneTools.WwwcTool);
      cornerstoneTools.addTool(cornerstoneTools.ZoomTool);
      cornerstoneTools.addTool(cornerstoneTools.PanTool);
      cornerstoneTools.addTool(cornerstoneTools.LengthTool);
      cornerstoneTools.addTool(cornerstoneTools.AngleTool);
      cornerstoneTools.addTool(cornerstoneTools.RectangleRoiTool);
      cornerstoneTools.addTool(cornerstoneTools.EllipticalRoiTool);

      // Set initial active tool
      cornerstoneTools.setToolActive('Wwwc', { mouseButtonMask: 1 });
    } catch (error) {
      console.error('Error initializing viewer element:', error);
      setViewerStatus(`Error initializing viewer: ${error.message}`);
    }

    return () => {
      if (element && isElementEnabled) {
        try {
          cornerstone.disable(element);
          setIsElementEnabled(false);
        } catch (error) {
          console.log('Cleanup error:', error);
        }
      }
    };
  }, []);

  // Load and display the image
  useEffect(() => {
    if (!currentFile?.fileUrl) {
      console.error('No file URL provided');
      setViewerStatus('No file URL provided');
      return;
    }

    if (!isElementEnabled) {
      console.log('Waiting for element to be enabled...');
      return;
    }

    const element = viewerRef.current;
    if (!element) {
      console.error('Viewer element not found during image load');
      setViewerStatus('Error: Viewer element not found');
      return;
    }

    const loadAndViewImage = async () => {
      try {
        setViewerStatus('Loading DICOM image...');
        
        // Register the URL handler
        cornerstoneWADOImageLoader.wadouri.register(cornerstone);
        
        // Create image ID based on URL
        const imageUrl = currentFile.fileUrl;
        console.log('Loading image from URL:', imageUrl);
        
        // Handle both S3 and local URLs
        const imageId = `wadouri:${imageUrl}`;
        console.log('Image ID:', imageId);

        // Load the image
        const image = await cornerstone.loadImage(imageId);
        console.log('Image loaded successfully:', image);

        // Extract metadata
        const dicomData = cornerstoneWADOImageLoader.wadouri.dataSetCacheManager.get(imageId);
        if (dicomData) {
          setMetadata({
            patientName: dicomData.string('x00100010'),
            patientId: dicomData.string('x00100020'),
            studyDate: dicomData.string('x00080020'),
            modality: dicomData.string('x00080060'),
            studyDescription: dicomData.string('x00081030'),
            seriesDescription: dicomData.string('x0008103e'),
            imageType: dicomData.string('x00080008'),
            windowCenter: dicomData.floatString('x00281050'),
            windowWidth: dicomData.floatString('x00281051'),
            rows: dicomData.uint16('x00280010'),
            columns: dicomData.uint16('x00280011'),
            bitsAllocated: dicomData.uint16('x00280100'),
            bitsStored: dicomData.uint16('x00280101'),
          });
        }

        // Display image
        await cornerstone.displayImage(element, image);
        setViewerStatus('');

      } catch (error) {
        console.error('Error in loadAndViewImage:', error);
        setViewerStatus(`Error: ${error.message || 'Failed to load image'}`);
        
        if (error.dataSet) {
          console.log('DICOM dataset:', error.dataSet);
        }
        if (error.imageId) {
          console.log('Failed imageId:', error.imageId);
        }
      }
    };

    loadAndViewImage();
  }, [currentFile, isElementEnabled]);

  const handleToolChange = (toolName) => {
    setActiveTool(toolName);
    cornerstoneTools.setToolActive(toolName, { mouseButtonMask: 1 });
  };

  const navigateFiles = (direction) => {
    const newIndex = currentFileIndex + direction;
    if (newIndex >= 0 && newIndex < allFiles.length) {
      setCurrentFileIndex(newIndex);
    }
  };

  const handleBackClick = () => {
    navigate('/');
  };

  return (
    <div className="viewer">
      <header className="viewer-header">
        <button className="back-button" onClick={handleBackClick}>
          ← Back to Upload
        </button>
        <h1>DICOM Viewer</h1>
        {currentFile?.fileName && (
          <p className="file-name">
            File {currentFileIndex + 1} of {allFiles.length}: {currentFile.fileName}
          </p>
        )}
      </header>
      
      <main className="viewer-main">
        <div className="viewer-layout">
          <div className="viewer-sidebar">
            {metadata && (
              <div className="metadata-panel">
                <h3>DICOM Metadata</h3>
                <div className="metadata-content">
                  {metadata.patientName && (
                    <div className="metadata-item">
                      <span className="label">Patient Name:</span>
                      <span className="value">{metadata.patientName}</span>
                    </div>
                  )}
                  {metadata.patientId && (
                    <div className="metadata-item">
                      <span className="label">Patient ID:</span>
                      <span className="value">{metadata.patientId}</span>
                    </div>
                  )}
                  {metadata.studyDate && (
                    <div className="metadata-item">
                      <span className="label">Study Date:</span>
                      <span className="value">{metadata.studyDate}</span>
                    </div>
                  )}
                  {metadata.modality && (
                    <div className="metadata-item">
                      <span className="label">Modality:</span>
                      <span className="value">{metadata.modality}</span>
                    </div>
                  )}
                  {metadata.studyDescription && (
                    <div className="metadata-item">
                      <span className="label">Study Description:</span>
                      <span className="value">{metadata.studyDescription}</span>
                    </div>
                  )}
                  {metadata.seriesDescription && (
                    <div className="metadata-item">
                      <span className="label">Series Description:</span>
                      <span className="value">{metadata.seriesDescription}</span>
                    </div>
                  )}
                  {metadata.imageType && (
                    <div className="metadata-item">
                      <span className="label">Image Type:</span>
                      <span className="value">{metadata.imageType}</span>
                    </div>
                  )}
                  <div className="metadata-item">
                    <span className="label">Image Size:</span>
                    <span className="value">{metadata.columns} × {metadata.rows}</span>
                  </div>
                  <div className="metadata-item">
                    <span className="label">Bits:</span>
                    <span className="value">
                      Allocated: {metadata.bitsAllocated}, 
                      Stored: {metadata.bitsStored}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="viewer-content">
            <div className="viewer-container">
              <div
                ref={viewerRef}
                className="cornerstone-element"
                style={{
                  width: '800px',
                  height: '600px',
                  backgroundColor: '#000'
                }}
                data-cy="cornerstone-element"
              />
            </div>

            {viewerStatus && (
              <div className="status-message">{viewerStatus}</div>
            )}

            {!viewerStatus && (
              <>
                <div className="tools-section">
                  <button 
                    onClick={() => handleToolChange('Wwwc')}
                    className={`tool-button ${activeTool === 'Wwwc' ? 'active' : ''}`}
                  >
                    Window/Level
                  </button>
                  <button 
                    onClick={() => handleToolChange('Zoom')}
                    className={`tool-button ${activeTool === 'Zoom' ? 'active' : ''}`}
                  >
                    Zoom
                  </button>
                  <button 
                    onClick={() => handleToolChange('Pan')}
                    className={`tool-button ${activeTool === 'Pan' ? 'active' : ''}`}
                  >
                    Pan
                  </button>
                  <button 
                    onClick={() => handleToolChange('Length')}
                    className={`tool-button ${activeTool === 'Length' ? 'active' : ''}`}
                  >
                    Length
                  </button>
                  <button 
                    onClick={() => handleToolChange('Angle')}
                    className={`tool-button ${activeTool === 'Angle' ? 'active' : ''}`}
                  >
                    Angle
                  </button>
                  <button 
                    onClick={() => handleToolChange('RectangleRoi')}
                    className={`tool-button ${activeTool === 'RectangleRoi' ? 'active' : ''}`}
                  >
                    Rectangle
                  </button>
                  <button 
                    onClick={() => handleToolChange('EllipticalRoi')}
                    className={`tool-button ${activeTool === 'EllipticalRoi' ? 'active' : ''}`}
                  >
                    Ellipse
                  </button>
                </div>

                {allFiles.length > 1 && (
                  <div className="navigation-section">
                    <button
                      onClick={() => navigateFiles(-1)}
                      disabled={currentFileIndex === 0}
                      className="nav-button"
                    >
                      Previous
                    </button>
                    <span className="file-counter">
                      {currentFileIndex + 1} / {allFiles.length}
                    </span>
                    <button
                      onClick={() => navigateFiles(1)}
                      disabled={currentFileIndex === allFiles.length - 1}
                      className="nav-button"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Viewer; 