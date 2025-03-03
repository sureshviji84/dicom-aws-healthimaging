const express = require('express');
const router = express.Router();
const { MedicalImagingClient, 
        SearchCommand, 
        GetImageSetCommand, 
        GetImageFrameCommand } = require('@aws-sdk/client-medical-imaging');

const medicalImaging = new MedicalImagingClient({ region: process.env.AWS_REGION });

// QIDO-RS: Search for Studies
router.get('/studies', async (req, res) => {
    try {
        const searchParams = {
            dataStoreId: process.env.HEALTHIMAGING_DATASTORE_ID,
            searchCriteria: {
                filters: []
            }
        };

        // Add search filters based on query parameters
        if (req.query.PatientID) {
            searchParams.searchCriteria.filters.push({
                dicomTag: '00100020', // Patient ID
                value: req.query.PatientID
            });
        }
        if (req.query.StudyDate) {
            searchParams.searchCriteria.filters.push({
                dicomTag: '00080020', // Study Date
                value: req.query.StudyDate
            });
        }
        if (req.query.Modality) {
            searchParams.searchCriteria.filters.push({
                dicomTag: '00080060', // Modality
                value: req.query.Modality
            });
        }

        const command = new SearchCommand(searchParams);
        const response = await medicalImaging.send(command);

        res.json(response.imageSetResults);
    } catch (error) {
        console.error('QIDO-RS error:', error);
        res.status(500).json({ error: 'Failed to search studies' });
    }
});

// QIDO-RS: Search for Series in a Study
router.get('/studies/:studyUID/series', async (req, res) => {
    try {
        const searchParams = {
            dataStoreId: process.env.HEALTHIMAGING_DATASTORE_ID,
            searchCriteria: {
                filters: [{
                    dicomTag: '0020000D', // Study Instance UID
                    value: req.params.studyUID
                }]
            }
        };

        const command = new SearchCommand(searchParams);
        const response = await medicalImaging.send(command);

        res.json(response.imageSetResults);
    } catch (error) {
        console.error('QIDO-RS error:', error);
        res.status(500).json({ error: 'Failed to search series' });
    }
});

// WADO-RS: Retrieve Study
router.get('/studies/:studyUID', async (req, res) => {
    try {
        const params = {
            dataStoreId: process.env.HEALTHIMAGING_DATASTORE_ID,
            imageSetId: req.params.studyUID
        };

        const command = new GetImageSetCommand(params);
        const response = await medicalImaging.send(command);

        res.json(response.imageSet);
    } catch (error) {
        console.error('WADO-RS error:', error);
        res.status(500).json({ error: 'Failed to retrieve study' });
    }
});

// WADO-RS: Retrieve Series
router.get('/studies/:studyUID/series/:seriesUID', async (req, res) => {
    try {
        const params = {
            dataStoreId: process.env.HEALTHIMAGING_DATASTORE_ID,
            imageSetId: req.params.studyUID,
            imageFrameInformation: [{
                imageFrameId: req.params.seriesUID
            }]
        };

        const command = new GetImageFrameCommand(params);
        const response = await medicalImaging.send(command);

        // Set appropriate headers for DICOM response
        res.set('Content-Type', 'application/dicom');
        res.set('Content-Disposition', `attachment; filename="${req.params.seriesUID}.dcm"`);
        
        res.send(response.imageFrameData);
    } catch (error) {
        console.error('WADO-RS error:', error);
        res.status(500).json({ error: 'Failed to retrieve series' });
    }
});

// WADO-RS: Retrieve Instance
router.get('/studies/:studyUID/series/:seriesUID/instances/:instanceUID', async (req, res) => {
    try {
        const params = {
            dataStoreId: process.env.HEALTHIMAGING_DATASTORE_ID,
            imageSetId: req.params.studyUID,
            imageFrameInformation: [{
                imageFrameId: `${req.params.seriesUID}/${req.params.instanceUID}`
            }]
        };

        const command = new GetImageFrameCommand(params);
        const response = await medicalImaging.send(command);

        // Set appropriate headers for DICOM response
        res.set('Content-Type', 'application/dicom');
        res.set('Content-Disposition', `attachment; filename="${req.params.instanceUID}.dcm"`);
        
        res.send(response.imageFrameData);
    } catch (error) {
        console.error('WADO-RS error:', error);
        res.status(500).json({ error: 'Failed to retrieve instance' });
    }
});

module.exports = router; 