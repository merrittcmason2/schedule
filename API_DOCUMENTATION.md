# Schedule Backend API Documentation

## Overview

The Schedule Backend API provides endpoints for managing student schedules, assignments, and file uploads with automatic content extraction and processing.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Authentication

#### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "jwt-token"
}
```

#### Login User
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "token": "jwt-token"
}
```

### File Upload

#### Upload Files
```http
POST /upload
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `files`: File(s) to upload (max 5 files, 10MB each)

**Supported File Types:**
- Excel: `.xlsx`, `.xls`
- Word: `.docx`, `.doc`
- PDF: `.pdf`
- Text: `.txt`, `.md`
- Images: `.jpg`, `.png`, `.gif`

**Response:**
```json
{
  "message": "Files uploaded successfully",
  "files": [
    {
      "id": "uuid",
      "originalName": "schedule.pdf",
      "size": 1024000,
      "mimeType": "application/pdf",
      "status": "processing"
    }
  ]
}
```

#### Get Upload Status
```http
GET /upload/status/:fileId
```

**Response:**
```json
{
  "id": "uuid",
  "originalName": "schedule.pdf",
  "status": "completed",
  "error": null,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### Get User Files
```http
GET /upload/files
```

**Response:**
```json
{
  "files": [
    {
      "id": "uuid",
      "originalName": "schedule.pdf",
      "size": 1024000,
      "mimeType": "application/pdf",
      "status": "completed",
      "error": null,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Assignments

#### Get User Assignments
```http
GET /assignments/:userId
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `startDate`: Filter by start date (YYYY-MM-DD)
- `endDate`: Filter by end date (YYYY-MM-DD)
- `search`: Search in assignment text and location

**Response:**
```json
{
  "assignments": [
    {
      "id": "uuid",
      "assignment": "Complete project proposal",
      "dueDate": "2024-01-15",
      "location": "Room 101",
      "source": "schedule.pdf",
      "fileName": "schedule.pdf",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

#### Get Single Assignment
```http
GET /assignments/assignment/:id
```

**Response:**
```json
{
  "id": "uuid",
  "assignment": "Complete project proposal",
  "dueDate": "2024-01-15",
  "location": "Room 101",
  "source": "schedule.pdf",
  "fileName": "schedule.pdf",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Delete Assignment
```http
DELETE /assignments/:id
```

**Response:**
```json
{
  "message": "Assignment deleted successfully"
}
```

#### Get Assignment Statistics
```http
GET /assignments/:userId/stats
```

**Response:**
```json
{
  "totalAssignments": 25,
  "assignmentsWithDueDate": 20,
  "upcomingAssignments": 15,
  "overdueAssignments": 3,
  "dueThisWeek": 5
}
```

### Calendar

#### Get Calendar Data
```http
GET /calendar/:userId
```

**Query Parameters:**
- `startDate`: Filter by start date (YYYY-MM-DD)
- `endDate`: Filter by end date (YYYY-MM-DD)
- `format`: Response format (`json` or `ical`)

**JSON Response:**
```json
{
  "events": [
    {
      "id": "uuid",
      "title": "Complete project proposal",
      "date": "2024-01-15",
      "location": "Room 101",
      "source": "schedule.pdf",
      "fileName": "schedule.pdf",
      "type": "assignment"
    }
  ]
}
```

**iCal Response:**
```
Content-Type: text/calendar
Content-Disposition: attachment; filename="schedule.ics"

BEGIN:VCALENDAR
VERSION:2.0
...
END:VCALENDAR
```

#### Get Grouped Calendar Events
```http
GET /calendar/:userId/grouped
```

**Response:**
```json
{
  "groupedEvents": {
    "2024-01-15": [
      {
        "id": "uuid",
        "title": "Complete project proposal",
        "location": "Room 101",
        "source": "schedule.pdf",
        "fileName": "schedule.pdf"
      }
    ]
  }
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Valid email is required"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Access token required"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 409 Conflict
```json
{
  "error": "User already exists with this email"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too many requests from this IP, please try again later."
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:
- **Window**: 15 minutes
- **Max Requests**: 100 per IP address per window

## File Processing

The system automatically processes uploaded files to extract academic content:

1. **File Upload**: Files are uploaded and stored securely
2. **Content Extraction**: Text is extracted using appropriate parsers
3. **AI Processing**: OpenAI analyzes content for assignments and schedules
4. **Data Storage**: Extracted assignments are saved to the database

### Processing Status

Files go through several processing stages:
- `pending`: File uploaded, waiting for processing
- `processing`: Currently extracting content
- `text_extracted`: Text extraction completed
- `completed`: All processing finished successfully
- `failed`: Processing failed (check error field)

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt with 12 salt rounds
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: Protection against abuse
- **File Type Validation**: Only allowed file types accepted
- **Size Limits**: Maximum file size enforcement
- **SQL Injection Protection**: Parameterized queries
- **CORS Configuration**: Configurable cross-origin requests

## Environment Variables

Required environment variables:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=schedule_db
DB_USER=postgres
DB_PASSWORD=password

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-3.5-turbo

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```