import json
from pathlib import Path
import re

def parse_proto_text(text: str) -> dict:
    """
    Parse proto text format into a Python dictionary.
    
    Basic rules:
    - Nested structures are within { }
    - Fields are either key-value pairs or nested structures
    - Arrays are repeated fields
    """
    def clean_value(val: str) -> any:
        """Convert string values to appropriate types."""
        val = val.strip('" ')
        # Try to convert to number if possible
        try:
            if '.' in val:
                return float(val)
            return int(val)
        except ValueError:
            # Keep as string if not a number
            return val

    def parse_level(lines: list[str], indent_level: int = 0) -> tuple[dict, int]:
        """Parse one level of proto text, handling nested structures."""
        result = {}
        i = 0
        
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue
                
            # Check if this line belongs to this level
            if line == '}':
                return result, i
                
            # Split line into key and value
            if ':' in line:
                # Simple key-value pair
                key, value = line.split(':', 1)
                key = key.strip()
                value = clean_value(value.strip())
                
                # Handle repeated fields
                if key in result:
                    if not isinstance(result[key], list):
                        result[key] = [result[key]]
                    result[key].append(value)
                else:
                    result[key] = value
                    
            elif '{' in line:
                # Nested structure
                key = line.split('{')[0].strip()
                nested_result, consumed = parse_level(lines[i+1:])
                
                # Handle repeated nested structures
                if key in result:
                    if not isinstance(result[key], list):
                        result[key] = [result[key]]
                    result[key].append(nested_result)
                else:
                    result[key] = nested_result
                    
                i += consumed + 1
                
            i += 1
            
        return result, i

    # Split into lines and parse
    lines = text.split('\n')
    parsed_dict, _ = parse_level(lines)
    return parsed_dict

def parse_proto_file(file_path: str, debug: bool = False) -> dict:
    """Parse a proto text format file into a dictionary."""
    try:
        if debug:
            print(f"Parsing file: {file_path}")
            
        # Read file content
        with open(file_path, 'r') as f:
            content = f.read()
            if debug:
                print(f"Read {len(content)} characters")
                
        # Parse the content
        result = parse_proto_text(content)
        
        if debug:
            print("Successfully parsed proto text")
            
        return result
        
    except Exception as e:
        print(f"Error parsing file {file_path}: {str(e)}")
        raise

def main():
    try:
        # Parse a single file
        file_path = "logs/WindowingFunctionTransformer_1735721589932.txt"
        result = parse_proto_file(file_path, debug=True)
        
        # Print the result
        print("\nParsed Content:")
        print(json.dumps(result, indent=2))
        
        # Save to JSON file
        output_file = file_path + ".json"
        with open(output_file, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"\nSaved JSON output to: {output_file}")
        
    except Exception as e:
        print(f"\nError: {str(e)}")
        raise

if __name__ == "__main__":
    main()