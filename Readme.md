Goal is to make it easy to reason and understand what’s happening in query generation engine.

Query generation engine. Here input and output are of QuerySpecProto. This is a kind of platform agnostic SQL.

Inside, there are a bunch of tranformers each of which transforms the QuerySpec.

Here’s the main logic:
* Main logic calls transformers serially in a chained manner
* One transformer can also call other transformers

With this project, we'll log the transformed query spec before and after each transformation in a file with this naming format:

<transformerName_timestamp.txt>
e.g. AggregateConstantExpressionTransformer_before_1735719877570.txt

This tool will then create a visualization  to
1. see the nesting and order of transformers
2. For each transformer, see the queryspec before and after running the transformer
3. For each transformer, see the diff in the queryspec

Currently this POC is done by running the query-gen-validator tool.

## Todo
0. Become queryspec expert by using this - WIP
1. when debug=true, provide one option inside the i icon to visualize and debug query-gen-engine for an answer. Collect all the info in memory and pass it to this tool via a file.
2. Triage this bug where number of transfomers logged in qgen-validator is more than what we get from traces
3. Triage why cohortColumnTranformer is seen in traces but not in qgen-validator logs
4. this tool can also consume just the traces

## How to run

On local
```
gradle :callosum-upgrade:buildRequestFetcherJar -x test
scp callosum/upgrade/target/libs/query-generation-validator.jar admin@172.32.27.151:~/validator-full.jar
```

 On nebula

 ```
 #home directory
 rm -rf /export/querygen-validator/logs/*.txt
 time java -Dthoughtspot_log_dir=/export/querygen-validator/logs/ -jar validator-full.jar fetch --topObjects 0 --answerGuids 186d5a92-d5f1-44a0-9793-7cadc6c8b4b1 --output pre_upgrade --zooServer 127.0.0.1:2181 --clusterName ${ORION_CLUSTER_NAME} --logLevel ERROR
 zip -r logs.zip /export/querygen-validator/logs
 ```

 From local machine
 ```
  scp admin@172.32.27.151:logs.zip ~/Downloads/logs-full-new.zip
  # move and extract in query-spec-generator folder
 python3 query-spec-generator.py logs-full-new
  ```