# Student Schedule Management Backend

A comprehensive Node.js backend system for processing academic schedules, assignments, and calendar information from various document types using AI-powered content extraction.

## Features

### 🚀 Core Functionality
- **Multi-format File Processing**: Support for Excel, Word, PDF, text, and image files
- **AI-Powered Content Extraction**: Uses OpenAI to intelligently extract assignments and schedules
- **RESTful API**: Clean, well-documented API endpoints
- **Real-time Processing**: Background file processing with status tracking
- **Calendar Integration**: Export to iCal format for calendar applications

### 🔒 Security & Performance
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Protection against API abuse
- **Input Validation**: Comprehensive request validation and sanitization
- **File Security**: Type validation, size limits, and secure storage
- **Database Security**: Parameterized queries and proper indexing

### 📊 Data Management
- **PostgreSQL Database**: Robust relational database with proper relationships
- **Database Migrations**: Version-controlled schema management
- **Connection Pooling**: Optimized database connections
- **Audit Trails**: Comprehensive logging and timestamps

## Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- OpenAI API key

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd schedule-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Set up the database**
```bash
# Create database
createdb schedule_db

# Run migrations
npm run migrate
```

5. **Start the development server**
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Set up environment**
```bash
cp .env.example .env
# Add your OPENAI_API_KEY to .env
```

2. **Start services**
```bash
docker-compose up -d
```

3. **Run migrations**
```bash
docker-compose exec app npm run migrate
```

### Using Docker

```bash
# Build image
docker build -t schedule-backend .

# Run container
docker run -p 3000:3000 --env-file .env schedule-backend
```

## API Usage

### Authentication

1. **Register a new user**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

2. **Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'
```

### File Upload

```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "files=@schedule.pdf" \
  -F "files=@assignments.xlsx"
```

### Get Assignments

```bash
curl -X GET "http://localhost:3000/api/assignments/USER_ID?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Export Calendar

```bash
# JSON format
curl -X GET "http://localhost:3000/api/calendar/USER_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# iCal format
curl -X GET "http://localhost:3000/api/calendar/USER_ID?format=ical" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## File Processing

The system supports the following file types:

| Type | Extensions | Processing Method |
|------|------------|-------------------|
| Excel | .xlsx, .xls | xlsx library |
| Word | .docx, .doc | mammoth library |
| PDF | .pdf | pdf-parse library |
| Text | .txt, .md | Native Node.js |
| Images | .jpg, .png, .gif | Tesseract.js OCR |

### Processing Flow

1. **Upload**: Files are uploaded and validated
2. **Storage**: Files are stored securely with metadata
3. **Extraction**: Content is extracted using appropriate parsers
4. **AI Analysis**: OpenAI processes content to identify assignments
5. **Database Storage**: Extracted data is saved with proper relationships

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Uploaded Files Table
```sql
CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  processing_status VARCHAR(50) DEFAULT 'pending',
  processing_error TEXT,
  extracted_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Assignments Table
```sql
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL,
  assignment VARCHAR(500) NOT NULL,
  due_date DATE,
  location VARCHAR(255),
  source VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

### Test Structure
```
tests/
├── auth.test.js          # Authentication tests
├── fileProcessor.test.js # File processing tests
├── setup.js             # Test setup and utilities
└── fixtures/            # Test files and data
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 5432 |
| `DB_NAME` | Database name | schedule_db |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | password |
| `JWT_SECRET` | JWT signing secret | required |
| `JWT_EXPIRES_IN` | Token expiration | 7d |
| `OPENAI_API_KEY` | OpenAI API key | required |
| `OPENAI_MODEL` | OpenAI model | gpt-3.5-turbo |
| `MAX_FILE_SIZE` | Max file size (bytes) | 10485760 |
| `UPLOAD_PATH` | Upload directory | ./uploads |

### Rate Limiting

- **Window**: 15 minutes
- **Max Requests**: 100 per IP
- **Configurable**: Via environment variables

## Architecture

### Project Structure
```
src/
├── config/           # Database and configuration
├── controllers/      # Request handlers (future expansion)
├── middleware/       # Authentication, validation, error handling
├── models/          # Database models and queries
├── routes/          # API route definitions
├── services/        # Business logic (file processing, OpenAI)
├── utils/           # Utilities (logging, helpers)
└── server.js        # Application entry point
```

### Design Patterns

- **MVC Architecture**: Clear separation of concerns
- **Service Layer**: Business logic abstraction
- **Middleware Pattern**: Request/response processing
- **Repository Pattern**: Data access abstraction
- **Factory Pattern**: File processor creation

## Monitoring & Logging

### Logging
- **Winston**: Structured logging with multiple transports
- **Log Levels**: Error, warn, info, debug
- **Log Files**: Separate error and combined logs
- **Console Output**: Development environment

### Health Checks
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600
}
```

## Error Handling

### Global Error Handler
- Catches all unhandled errors
- Logs errors with context
- Returns appropriate HTTP status codes
- Sanitizes error messages in production

### Error Types
- **Validation Errors**: 400 Bad Request
- **Authentication Errors**: 401 Unauthorized
- **Authorization Errors**: 403 Forbidden
- **Not Found Errors**: 404 Not Found
- **Conflict Errors**: 409 Conflict
- **Rate Limit Errors**: 429 Too Many Requests
- **Server Errors**: 500 Internal Server Error

## Performance Optimization

### Database
- **Connection Pooling**: Efficient connection management
- **Indexing**: Optimized queries with proper indexes
- **Query Optimization**: Efficient SQL queries

### File Processing
- **Background Processing**: Non-blocking file processing
- **Streaming**: Memory-efficient file handling
- **Caching**: Processed content caching

### API
- **Pagination**: Efficient data retrieval
- **Rate Limiting**: Resource protection
- **Compression**: Response compression (future)

## Security Best Practices

### Authentication & Authorization
- **JWT Tokens**: Secure, stateless authentication
- **Password Hashing**: Bcrypt with high salt rounds
- **Token Expiration**: Configurable token lifetime

### Input Validation
- **Schema Validation**: Joi/express-validator
- **File Type Validation**: MIME type checking
- **Size Limits**: File size restrictions
- **SQL Injection Protection**: Parameterized queries

### Security Headers
- **Helmet**: Security headers middleware
- **CORS**: Configurable cross-origin requests
- **Rate Limiting**: DDoS protection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Style
- **ESLint**: Code linting (future)
- **Prettier**: Code formatting (future)
- **Conventional Commits**: Commit message format

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the API documentation
- Review the test files for usage examples

## Roadmap

### Upcoming Features
- [ ] Real-time notifications
- [ ] Webhook support
- [ ] Advanced search and filtering
- [ ] Bulk operations
- [ ] API versioning
- [ ] Caching layer
- [ ] Email notifications
- [ ] Mobile app support

### Performance Improvements
- [ ] Response caching
- [ ] Database query optimization
- [ ] File processing optimization
- [ ] CDN integration
- [ ] Load balancing support