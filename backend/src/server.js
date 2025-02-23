const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  HeadBucketCommand,
  PutBucketCorsCommand 
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Validate required environment variables in production
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'S3_BUCKET_NAME'
  ];

  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:', missingEnvVars.join(', '));
    process.exit(1);
  }
}

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Configure S3 bucket CORS
async function configureBucketCors() {
  if (process.env.NODE_ENV === 'production') {
    try {
      const corsCommand = new PutBucketCorsCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
              AllowedOrigins: ['*'],
              ExposeHeaders: ['ETag', 'x-amz-meta-custom-header', 'x-amz-server-side-encryption'],
              MaxAgeSeconds: 3600
            }
          ]
        }
      });

      await s3Client.send(corsCommand);
      console.log('Successfully configured S3 bucket CORS');
    } catch (error) {
      console.error('Error configuring S3 bucket CORS:', error);
      process.exit(1);
    }
  }
}

// Verify S3 bucket access and configure CORS
async function verifyS3Access() {
  if (process.env.NODE_ENV === 'production') {
    try {
      const command = new HeadBucketCommand({
        Bucket: process.env.S3_BUCKET_NAME
      });
      await s3Client.send(command);
      console.log('Successfully connected to S3 bucket');
      
      // Configure CORS after verifying access
      await configureBucketCors();
    } catch (error) {
      console.error('Error accessing S3 bucket:', error);
      process.exit(1);
    }
  }
}

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

// Middleware
app.use(cors({
  exposedHeaders: ['Content-Length', 'Content-Type', 'Accept-Ranges'],
  credentials: true,
  origin: true
}));
app.use(express.json());

// Create local uploads directory for development fallback
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (process.env.NODE_ENV !== 'production') {
  fsPromises.mkdir(uploadsDir, { recursive: true }).catch(console.error);
}

// Helper function to upload file to S3
async function uploadToS3(file, filename) {
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `uploads/${filename}`,
    Body: file.buffer,
    ContentType: 'application/dicom',
    Metadata: {
      'Content-Type': 'application/dicom'
    }
  });

  try {
    const response = await s3Client.send(command);
    console.log('Successfully uploaded to S3:', response);
    return true;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    return false;
  }
}

// Helper function to get signed URL from S3
async function getSignedS3Url(filename) {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `uploads/${filename}`
  });

  try {
    // URL expires in 1 hour
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
}

// Routes
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = Date.now() + '-' + req.file.originalname;
    let fileUrl;

    if (process.env.NODE_ENV === 'production') {
      // Upload to S3 in production
      const uploaded = await uploadToS3(req.file, filename);
      if (!uploaded) {
        return res.status(500).json({ error: 'Failed to upload file to S3' });
      }
      fileUrl = await getSignedS3Url(filename);
      if (!fileUrl) {
        return res.status(500).json({ error: 'Failed to generate signed URL' });
      }
    } else {
      // Save locally in development
      const filePath = path.join(uploadsDir, filename);
      await fsPromises.writeFile(filePath, req.file.buffer);
      fileUrl = `http://localhost:${port}/uploads/${filename}`;
    }

    console.log('File uploaded:', filename);
    console.log('File URL:', fileUrl);
    console.log('Storage mode:', process.env.NODE_ENV === 'production' ? 'S3' : 'Local');

    res.json({
      message: 'File uploaded successfully',
      fileKey: filename,
      fileUrl: fileUrl,
      storageMode: process.env.NODE_ENV === 'production' ? 'S3' : 'Local'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Serve DICOM files with proper headers (development only)
app.get('/uploads/:filename', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send('Not found in production - use S3 signed URLs');
  }

  try {
    const filePath = path.join(uploadsDir, req.params.filename);
    
    try {
      await fsPromises.access(filePath);
    } catch (error) {
      console.error(`File not found: ${filePath}`);
      return res.status(404).send('File not found');
    }

    const stat = await fsPromises.stat(filePath);
    const fileSize = stat.size;

    // Handle range requests
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      const stream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'application/dicom',
        'Access-Control-Allow-Origin': '*'
      });
      
      stream.on('error', (error) => {
        console.error('Stream error:', error);
        if (!res.headersSent) {
          res.status(500).send('Error streaming file');
        }
      });

      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'application/dicom',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      });
      
      console.log(`Serving DICOM file: ${filePath}`);
      console.log(`File size: ${fileSize} bytes`);
      
      const stream = fs.createReadStream(filePath);
      
      stream.on('error', (error) => {
        console.error('Stream error:', error);
        if (!res.headersSent) {
          res.status(500).send('Error streaming file');
        }
      });

      stream.pipe(res);
    }
  } catch (error) {
    console.error('Error serving file:', error);
    if (!res.headersSent) {
      res.status(500).send('Error serving file');
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    environment: process.env.NODE_ENV,
    s3Status: process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled',
    s3Bucket: process.env.NODE_ENV === 'production' ? process.env.S3_BUCKET_NAME : null
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Something went wrong!' });
  }
});

// Start server after verifying S3 access
async function startServer() {
  try {
    await verifyS3Access();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`File uploads will be stored in: ${uploadsDir}`);
      } else {
        console.log(`File uploads will be stored in S3 bucket: ${process.env.S3_BUCKET_NAME}`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 