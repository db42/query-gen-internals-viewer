import json
import glob
from pathlib import Path
import argparse
import sys
import os
import shutil

def load_template(template_path: str = None) -> str:
    """Load HTML template from file."""
    if template_path is None:
        # Use default template path relative to script location
        script_dir = Path(__file__).parent
        template_path = script_dir / 'templates' / 'viewer_template.html'
    
    try:
        with open(template_path, 'r') as f:
            return f.read()
    except FileNotFoundError:
        print(f"Error: Template file not found at {template_path}")
        sys.exit(1)

def parse_proto_text(text: str) -> dict:
    """Parse proto text format into a Python dictionary."""
    def clean_value(val: str) -> any:
        """Convert string values to appropriate types."""
        val = val.strip('" ')
        try:
            if '.' in val:
                return float(val)
            return int(val)
        except ValueError:
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
                
            if line == '}':
                return result, i
                
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip()
                value = clean_value(value.strip())
                
                if key in result:
                    if not isinstance(result[key], list):
                        result[key] = [result[key]]
                    result[key].append(value)
                else:
                    result[key] = value
                    
            elif '{' in line:
                key = line.split('{')[0].strip()
                nested_result, consumed = parse_level(lines[i+1:])
                
                if key in result:
                    if not isinstance(result[key], list):
                        result[key] = [result[key]]
                    result[key].append(nested_result)
                else:
                    result[key] = nested_result
                    
                i += consumed + 1
                
            i += 1
            
        return result, i

    lines = text.split('\n')
    parsed_dict, _ = parse_level(lines)
    return parsed_dict

def parse_proto_file(file_path: str, debug: bool = False) -> dict:
    """Parse a proto text format file into a dictionary."""
    try:
        if debug:
            print(f"Parsing file: {file_path}")
            
        with open(file_path, 'r') as f:
            content = f.read()
            if debug:
                print(f"Read {len(content)} characters")
                
        result = parse_proto_text(content)
        
        if debug:
            print("Successfully parsed proto text")
            
        return result
        
    except Exception as e:
        print(f"Error parsing file {file_path}: {str(e)}")
        raise

def process_directory(input_dir: str, output_dir: str = None, debug: bool = False):
    """Process directory and generate viewer HTML.
    
    Args:
        input_dir: Directory containing transformer files
        output_dir: Directory where output files will be generated
        debug: Enable debug logging
    
    Returns:
        Path to the generated HTML file
    """
    try:
        # Setup directories
        input_dir = os.path.abspath(input_dir)
        script_dir = Path(__file__).parent
        
        # Set output directory
        if output_dir is None:
            output_dir = script_dir / "output"
        else:
            output_dir = Path(output_dir)
            
        # Create output directory
        output_dir.mkdir(parents=True, exist_ok=True)
            
        # Generate the HTML file path
        output_path = output_dir / "query_spec_viewer.html"
        
        # Create static directory next to HTML file
        static_dir = output_dir / "static"
        static_dir.mkdir(exist_ok=True)
        
        # Create json directory next to HTML file
        json_dir = output_dir / "json"
        json_dir.mkdir(exist_ok=True)
        
        # Copy static files
        shutil.copy2(script_dir / "static" / "viewer.js", static_dir)
        shutil.copy2(script_dir / "static" / "styles.css", static_dir)
        
        print(f"Processing files in: {input_dir}")
            
        # Find all transformer files
        files = glob.glob(os.path.join(input_dir, "*Transformer_*.txt"))
        if not files:
            raise ValueError(f"No transformer files found in {input_dir}")
            
        transformers = {}
        for file_path in files:
            try:
                name = Path(file_path).stem
                transformer_name, timestamp = name.split('_', 1)
                
                # Parse proto file
                content_dict = parse_proto_file(file_path, debug=debug)
                transformers[name] = {
                    'name': transformer_name,
                    'timestamp': int(timestamp),
                    'content': content_dict
                }
                
                # Save individual JSON file
                json_path = json_dir / f"{name}.json"
                with open(json_path, 'w') as f:
                    json.dump(content_dict, f, indent=2)
                
                if debug:
                    print(f"Successfully processed: {name}")
                    print(f"Saved JSON to: {json_path}")
                    
            except Exception as e:
                print(f"Error processing {file_path}: {str(e)}")
                continue
        
        if not transformers:
            raise ValueError("No valid transformer files could be processed")
        
        # Save consolidated JSON
        consolidated_path = output_dir / "transformers.json"
        with open(consolidated_path, 'w') as f:
            json.dump(transformers, f, indent=2)
        print(f"Saved consolidated JSON to: {consolidated_path}")
            
        # Generate HTML
        generate_html(transformers, output_path, template_path=None)
        print(f"Generated viewer at: {output_path}")
        print(f"Processed {len(transformers)} transformer files")
        
        return output_path
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return None

def generate_html(transformers: dict, output_path: str, template_path: str = None):
    """Generate HTML file with embedded transformer data."""
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Load template
    template = load_template(template_path)
    
    # Insert transformer data
    transformer_json = json.dumps(transformers)
    html_content = template.replace('{DATA_PLACEHOLDER}', transformer_json)
    
    # Write output file
    with open(output_path, 'w') as f:
        f.write(html_content)

def main():
    parser = argparse.ArgumentParser(
        description="Generate Query Spec Viewer from transformer files"
    )
    parser.add_argument(
        "input_dir",
        help="Directory containing transformer files"
    )
    parser.add_argument(
        "-o", "--output",
        help="Output directory (default: ./output)",
        default=None
    )
    parser.add_argument(
        "-t", "--template",
        help="Path to custom HTML template file",
        default=None
    )
    parser.add_argument(
        "--debug",
        help="Enable debug mode",
        action="store_true"
    )
    
    args = parser.parse_args()
    
    output_path = process_directory(
        args.input_dir, 
        args.output, 
        args.debug, 
        # args.template
    )
    sys.exit(0 if output_path else 1)

if __name__ == "__main__":
    main()