// Save as trace-parser.js
const fs = require('fs');

const cleanValue = (val) => {
  // Remove quotes and trim
  val = val.trim().replace(/^["']|["']$/g, '');

  // Handle booleans
  if (val.toLowerCase() === 'true') return true;
  if (val.toLowerCase() === 'false') return false;

  // If it looks like a GUID or contains letters, keep as string
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /[a-zA-Z]/.test(val)) {
    return val;
  }

  // Try to convert to number if it's a numeric string
  if (/^-?\d+(\.\d+)?$/.test(val)) {
    return Number(val);
  }

  return val;
};

const parseLevel = (lines, indentLevel = 0) => {
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
      const [key, ...valueParts] = line.split(':');
      const value = cleanValue(valueParts.join(':'));
      const trimmedKey = key.trim();
      
      if (trimmedKey in result) {
        if (!Array.isArray(result[trimmedKey])) {
          result[trimmedKey] = [result[trimmedKey]];
        }
        result[trimmedKey].push(value);
      } else {
        result[trimmedKey] = value;
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
};

const parseProtoText = (text) => {
  const lines = text.split('\n');
  const [parsed] = parseLevel(lines);
  return parsed;
};

// // Read input file
// const inputFile = process.argv[2] || 'input.proto';
// try {
//   const fs = require('fs');
//   const protoText = fs.readFileSync(inputFile, 'utf8');
//   const result = parseProtoText(protoText);
//   console.log(JSON.stringify(result, null, 2));
// } catch (error) {
//   console.error('Error:', error.message);
//   process.exit(1);
// }

//Input is the content of the trace file
//output is a dictionary of transformers - see transformers.json
function parseTransformers(content) {
  const transformers = {};
  // let currentTransformer = null;
  query_spec_str = '';
  start_capture_query_spec = false;
  //create a stack to keep track of the current transformer
  let transformer_stack = [];
  
  const lines = content.split('\n');
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    const isLastLine = index === lines.length - 1;
    
    // Start of a transformer
    if (trimmed.includes('::transform"') && !trimmed.includes('CohortColumnTransformer')) {
      const nameMatch = trimmed.match(/name: "(.*?)::transform"/);
      if (nameMatch) {
        let transformer = {
          name: nameMatch[1].split('::')[0],
          start_us: null,
          duration_us: null
        };
        // if (transformer.name == 'WorksheetTransformer') {
            console.log('push', transformer.name);
        // }
        transformer_stack.push(transformer);
      }
    }
    
    // child {
    //   name: "TopSortTransformer::transform"
    //   start_us: 1736268554488374
    //   duration_us: 205
    //   chrono_type: CHRONO_SEQUENTIAL
    //   [callosum.CallosumDebugInfo.trace]
    // Collect timing info
    if (transformer_stack.length > 0) { 
      topTransformer = transformer_stack[transformer_stack.length - 1];
      if (trimmed.startsWith('start_us:') && topTransformer.start_us == null) {
        //update the start_us of the transformer on the top of the stack
        // if (transformer_stack.length > 0) {
        topTransformer.start_us = parseInt(trimmed.split(':')[1].trim());
          if (topTransformer.name === 'WorksheetTransformer') {
            console.log('update', topTransformer.name, topTransformer.start_us);
          }
        // }
      } else if (trimmed.startsWith('duration_us:') && topTransformer.duration_us == null) {
        topTransformer.duration_us = parseInt(trimmed.split(':')[1].trim());
        
        // If we have all info, add to transformers
        // if (currentTransformer.name && currentTransformer.start_us && currentTransformer.duration_us) {
        //   const key = `${currentTransformer.name}_${currentTransformer.start_us}_${currentTransformer.duration_us}`;
        //   transformers[key] = { content: {} };
        //   currentTransformer = null;
        // }

        // console.log(content);
      } else if (trimmed.startsWith('query_spec {')) {
        start_capture_query_spec = true
      } else if (isLastLine || 
        trimmed.startsWith('child {') ||
        trimmed.startsWith('[callosum.CallosumDebugInfo.trace] {')) { //todo: or last line in content

        // If we have all info, add to transformers
        if (query_spec_str.length > 0 && topTransformer.name && topTransformer.start_us && topTransformer.duration_us) {
          const key1 = `${topTransformer.name}_before_${topTransformer.start_us}`;
          endTimeUS = topTransformer.start_us + topTransformer.duration_us;
          const key2 = `${topTransformer.name}_after_${endTimeUS}`;
          // query_spec_str = query_spec_str.split('\n').slice(0, -4).join('\n');
          query_spec_dict=parseProtoText(query_spec_str);
          transformers[key1] = { content: query_spec_dict };
          transformers[key2] ={ content: query_spec_dict };
            console.log('pop', topTransformer.name);
            // console.log('STRING');
            // console.log(query_spec_str);
          // if (topTransformer.name == 'WorksheetTransformer') {
            console.log('JSON');
            //remove last two lines from query_spec_str
            fs.writeFileSync('last_spec.json', JSON.stringify(query_spec_dict));
          // }

          transformer_stack.pop();
          fs.writeFileSync('last_spec.proto', query_spec_str);
          query_spec_str = '';
          start_capture_query_spec = false;
        }
      }

      if (start_capture_query_spec) {
        query_spec_str = query_spec_str + '\n' + trimmed;
      }
    }
  };
  
  console.log('transformer_stack', transformer_stack);
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
    // console.log('\nTransformers found:');
    // Object.keys(transformers).forEach(key => {
    //   console.log(key);
    // });
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