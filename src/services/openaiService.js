const OpenAI = require('openai');
const logger = require('../utils/logger');

class OpenAIService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  async extractScheduleData(extractedText, fileName) {
    const prompt = `
You are an AI assistant that extracts academic schedule and assignment information from text content.

Please analyze the following text extracted from a file named "${fileName}" and extract any assignments, due dates, class schedules, or academic events.

For each item found, return a JSON object with this exact structure:
{
  "assignment": "string - description of the assignment, class, or event",
  "due_date": "YYYY-MM-DD format or null if no date found",
  "location": "string or null if no location specified",
  "source": "string - the filename where this was found"
}

Return an array of these objects. If no relevant academic information is found, return an empty array.

Rules:
- Only extract academic-related content (assignments, classes, exams, study sessions, etc.)
- Dates must be in YYYY-MM-DD format or null
- Be conservative - only extract clear, unambiguous information
- If you're unsure about a date, set it to null
- Include the source filename for each item

Text content to analyze:
${extractedText}
`;

    try {
      return await this.makeRequestWithRetry(prompt);
    } catch (error) {
      logger.error('OpenAI extraction failed:', error);
      throw error;
    }
  }

  async makeRequestWithRetry(prompt, attempt = 1) {
    try {
      logger.info(`Making OpenAI request (attempt ${attempt})`);

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts academic schedule information from text and returns valid JSON arrays.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      // Parse and validate JSON response
      const parsedData = this.parseAndValidateResponse(content);
      logger.info(`Successfully extracted ${parsedData.length} items from OpenAI`);
      
      return parsedData;

    } catch (error) {
      logger.error(`OpenAI request failed (attempt ${attempt}):`, error.message);

      if (attempt < this.maxRetries) {
        const delay = this.retryDelay * attempt;
        logger.info(`Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequestWithRetry(prompt, attempt + 1);
      }

      throw new Error(`OpenAI request failed after ${this.maxRetries} attempts: ${error.message}`);
    }
  }

  parseAndValidateResponse(content) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      
      const parsed = JSON.parse(jsonString);
      
      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      // Validate each item in the array
      return parsed.map((item, index) => {
        if (typeof item !== 'object' || item === null) {
          throw new Error(`Item ${index} is not an object`);
        }

        const validated = {
          assignment: this.validateString(item.assignment, 'assignment'),
          due_date: this.validateDate(item.due_date),
          location: this.validateOptionalString(item.location),
          source: this.validateString(item.source, 'source')
        };

        return validated;
      });

    } catch (error) {
      logger.error('Failed to parse OpenAI response:', { content, error: error.message });
      throw new Error(`Invalid JSON response from OpenAI: ${error.message}`);
    }
  }

  validateString(value, fieldName) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${fieldName} must be a non-empty string`);
    }
    return value.trim();
  }

  validateOptionalString(value) {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  validateDate(value) {
    if (value === null || value === undefined) {
      return null;
    }
    
    if (typeof value !== 'string') {
      return null;
    }

    // Validate YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
      return null;
    }

    // Validate that it's a real date
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return null;
    }

    // Ensure the date string matches what we parsed (handles invalid dates like 2023-02-30)
    if (date.toISOString().split('T')[0] !== value) {
      return null;
    }

    return value;
  }
}

module.exports = new OpenAIService();