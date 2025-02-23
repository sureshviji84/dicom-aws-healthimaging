# AWS HealthImaging DICOM Viewer

This project implements a healthcare imaging workflow using AWS services, allowing users to upload DICOM files and view them through a web interface.

## Architecture Overview

The application uses the following AWS services:
- Amazon S3 for DICOM file storage
- AWS Lambda for file processing
- Amazon Aurora for metadata storage
- Amazon SQS for message queuing
- AWS HealthImaging for medical image management
- AWS IoT Core for edge device management

## Project Structure

```
aws-healthimaging-alcon/
├── frontend/           # React frontend application
├── backend/           # Node.js/Express backend
├── infrastructure/    # AWS CDK infrastructure code
└── docs/             # Project documentation
```

## Prerequisites

- Node.js >= 14.x
- AWS CLI configured with appropriate credentials
- AWS CDK CLI
- Docker (for local development)

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. Set up your AWS credentials and configure environment variables

4. Deploy the infrastructure:
   ```bash
   cd infrastructure
   npm install
   cdk deploy
   ```

5. Start the development servers:
   ```bash
   # Start backend
   cd backend
   npm run dev

   # Start frontend
   cd frontend
   npm start
   ```

## Features

- DICOM file upload to S3
- Web-based DICOM viewer using Cornerstone.js
- Metadata extraction and storage
- Secure authentication using AWS Cognito
- Real-time updates using AWS IoT Core

## Security

This application implements security best practices including:
- HIPAA compliance measures
- Secure file transmission
- Role-based access control
- Data encryption at rest and in transit

## License

MIT License 