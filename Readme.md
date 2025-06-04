The goal of this project is to provide a clear understanding of the processes within a query generation engine.

The query generation engine processes QuerySpecProto objects as both input and output. QuerySpecProto is a platform-agnostic SQL representation.

Internally, it utilizes a series of transformers, each modifying the QuerySpec.

The main logic flow is as follows:
* The main logic calls transformers serially in a chained manner.
* One transformer can also call other transformers.

This project logs the QuerySpec before and after each transformation. These logs are stored in files named `<transformerName_timestamp.txt>` (e.g., `AggregateConstantExpressionTransformer_before_1735719877570.txt`).
The tool then uses these logs to create a visualization that helps to:
1. See the nesting and order of transformers.
2. For each transformer, view the QuerySpec before and after its execution.
3. For each transformer, observe the diff in the QuerySpec.

This tool visualizes query generation traces by processing these log files that capture the state of QuerySpecProto.

## Todo
0. Understand QuerySpec transformations using this tool.
1. When debug=true, provide an option (e.g., within an info icon) to visualize and debug the query generation engine for a specific answer. This would involve collecting all necessary information in memory and passing it to this tool via a file.

## Deployment

Deployed using Netlify at https://query-gen-internals-viewer.netlify.app/. Netlify automatically fetches from the linked GitHub repository.

Also, deployed using GitHub Pages at https://db42.github.io/query-gen-internals-viewer/.

## How to Run

To visualize query generation traces:

1. Open the `index.html` file (located in the root of this project) in your web browser.
2. Upload the trace file when prompted by the application.
3. The tool will then display the visualizations, allowing you to inspect the transformation steps.