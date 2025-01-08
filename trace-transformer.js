// Save as trace-parser.js
const fs = require('fs');


/**
 * Parse proto text format into a JavaScript object
 * @param {string} text - The proto text to parse
 * @returns {Object} The parsed JavaScript object
 */
function parseProtoText(text) {
  /**
   * Convert string values to appropriate types
   * @param {string} val - The value to clean
   * @returns {string|number} The cleaned value
   */
  function cleanValue(val) {
      val = val.trim().replace(/^"(.*)"$/, '$1');
      
      try {
          if (val.includes('.')) {
              return parseFloat(val);
          }
          return parseInt(val);
      } catch {
          return val;
      }
  }

  /**
   * Parse one level of proto text, handling nested structures
   * @param {string[]} lines - Array of text lines to parse
   * @param {number} indentLevel - Current indent level (default: 0)
   * @returns {[Object, number]} Tuple of [parsed object, lines consumed]
   */
  function parseLevel(lines, indentLevel = 0) {
      const result = {};
      let i = 0;
      
      while (i < lines.length) {
          const line = lines[i].trim();
          if (!line) {
              i++;
              continue;
          }
          
          if (line === '}') {
              return [result, i];
          }
          
          if (line.includes(':')) {
              const [key, value] = line.split(':', 2).map(part => part.trim());
              const cleanedValue = cleanValue(value);
              
              if (key in result) {
                  if (!Array.isArray(result[key])) {
                      result[key] = [result[key]];
                  }
                  result[key].push(cleanedValue);
              } else {
                  result[key] = cleanedValue;
              }
          } else if (line.includes('{')) {
              const key = line.split('{')[0].trim();
              const [nestedResult, consumed] = parseLevel(lines.slice(i + 1));
              
              if (key in result) {
                  if (!Array.isArray(result[key])) {
                      result[key] = [result[key]];
                  }
                  result[key].push(nestedResult);
              } else {
                  result[key] = nestedResult;
              }
              
              i += consumed + 1;
          }
          
          i++;
      }
      
      return [result, i];
  }

  const lines = text.split('\n');
  const [parsedObj] = parseLevel(lines);
  return parsedObj;
}

// Example usage:
/*
const protoText = `
person {
  name: "John Doe"
  age: 30
  emails: "john@example.com"
  emails: "johndoe@example.com"
  address {
      street: "123 Main St"
      city: "Springfield"
      zip: 12345
  }
}
`;

const result = parseProtoText(protoText);
console.log(JSON.stringify(result, null, 2));
*/

function parseTransformers(content) {
  const transformers = {};
  let currentTransformer = null;
  query_spec_str = '';
  start_capture_query_spec = false;
  
  const lines = content.split('\n');
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    const isLastLine = index === lines.length - 1;
    
    // Start of a transformer
    if (trimmed.includes('::transform"')) {
      const nameMatch = trimmed.match(/name: "(.*?)::transform"/);
      if (nameMatch) {
        currentTransformer = {
          name: nameMatch[1].split('::')[0],
          start_us: null,
          duration_us: null
        };
      }
    }
    
    // Collect timing info
    if (currentTransformer) {
      if (trimmed.startsWith('start_us:')) {
        currentTransformer.start_us = parseInt(trimmed.split(':')[1].trim());
      } 
      else if (trimmed.startsWith('duration_us:')) {
        currentTransformer.duration_us = parseInt(trimmed.split(':')[1].trim());
        
        // If we have all info, add to transformers
        // if (currentTransformer.name && currentTransformer.start_us && currentTransformer.duration_us) {
        //   const key = `${currentTransformer.name}_${currentTransformer.start_us}_${currentTransformer.duration_us}`;
        //   transformers[key] = { content: {} };
        //   currentTransformer = null;
        // }

        // console.log(content);
      } else if (trimmed.startsWith('query_spec {')) {
        start_capture_query_spec = true
      } else if (isLastLine || trimmed.startsWith('child {')) { //todo: or last line in content

        // If we have all info, add to transformers
        if (currentTransformer.name && currentTransformer.start_us && currentTransformer.duration_us) {
          const key1 = `${currentTransformer.name}_before_${currentTransformer.start_us}`;
          endTimeUS = currentTransformer.start_us + currentTransformer.duration_us;
          const key2 = `${currentTransformer.name}_after_${endTimeUS}`;
          query_spec_dict=parseProtoText(query_spec_str);
          transformers[key1] = { content: query_spec_dict };
          transformers[key2] = { content: query_spec_dict };
          currentTransformer = null;
        }
        fs.writeFileSync('last_spec.json', query_spec_str);
        query_spec_str = '';
        start_capture_query_spec = false;
      }

      if (start_capture_query_spec) {
        query_spec_str = query_spec_str + '\n' + trimmed;
      }
    }
  };
  
  return transformers;
}

async function processTraceFile(filename) {
  try {
    const data = fs.readFileSync(filename, 'utf8');
    
    // Parse transformers
    const transformers = parseTransformers(data);
    
    // Write output
    fs.writeFileSync('transformer_dictionary.json', JSON.stringify(transformers, null, 2));
    
    // Log results
    console.log('\nTransformers found:');
    Object.keys(transformers).forEach(key => {
      console.log(key);
    });
    console.log('\nTotal count:', Object.keys(transformers).length);
    
    return transformers;
    
  } catch (error) {
    console.error('Error processing trace file:', error);
    throw error;
  }
}

// Execute if this is the main module
if (require.main === module) {
  const filename = process.argv[2];
  if (!filename) {
    console.error('Please provide a filename as argument');
    process.exit(1);
  }

  processTraceFile(filename)
    .then(() => {
      console.log('\nProcessing complete! Check transformer_dictionary.json for results');
    })
    .catch(error => {
      console.error('Failed to process file:', error);
      process.exit(1);
    });
}

module.exports = {
  parseTransformers,
  processTraceFile
};